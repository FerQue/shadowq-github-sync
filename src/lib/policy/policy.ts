// ShadowQ policy engine — evaluate-usage
// Policy Rules v1.0 (Oct 24, 2026). Pure functions: no database calls, no network.
// Shared by the app (src/lib/policy/policy.ts) and the evaluate-usage edge function. Keep both copies identical.

export const POLICY_VERSION = "1.0";

// ---------- Types ----------
export type DataClass = 1 | 2 | 3 | 4; // 1 Public, 2 Internal, 3 Confidential, 4 Restricted
export const PUBLIC: DataClass = 1;
export const INTERNAL: DataClass = 2;
export const CONFIDENTIAL: DataClass = 3;
export const RESTRICTED: DataClass = 4;
export const CLASS_NAMES: Record<DataClass, string> = { 1: "Public", 2: "Internal", 3: "Confidential", 4: "Restricted" };

export type ServiceStatus = "approved" | "under_review" | "unknown" | "prohibited";
export type RiskTier = "low" | "medium" | "high";
export type Action = "allow" | "coach" | "redirect" | "request_approval" | "block" | "allow_with_alert";
export type RuleId = "R0" | "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7" | "R9";
export type ClassSource = "label" | "department_default" | "pattern_check";

export interface Service {
  id: string;
  name: string;
  status: ServiceStatus;
  ceiling: DataClass | null;      // only for approved services
  riskTier: RiskTier;
  killSwitch: boolean;
  expiresAt: string | null;       // ISO date; approvals only
  vendorChanged: boolean;         // vendor terms or model changed since approval
  isDefaultAlternative?: boolean; // the tool to redirect people to
}

export interface Exception {
  id: string;
  serviceId: string;
  employeeId?: string;   // either an employee...
  department?: string;   // ...or a whole department
  maxClass: DataClass;
  expiresAt: string;     // ISO date
}

export interface Employee {
  id: string;            // pseudonymous ID, e.g. "E-1042"
  department: string;
}

export interface EvaluateInput {
  employee: Employee;
  service: Service | null;          // null = lookup failed → R9
  declaredClass?: DataClass | null; // label the employee picked, if any
  departmentDefault?: DataClass | null;
  patternHit: boolean;              // result of detectRestricted() run in the browser
  exceptions: Exception[];
  catalog: Service[];               // approved services, for finding the alternative
  now: Date;
}

export interface SideEffects {
  markUnderReview: boolean;   // R3: set service.status = 'under_review'
  queueReReview: boolean;     // R3: open a re-review request
  alertSecOps: boolean;       // R9
}

export interface Decision {
  action: Action;
  rule: RuleId;
  effectiveClass: DataClass | null;
  classSource: ClassSource | null;
  alternative: { id: string; name: string } | null;
  exceptionId: string | null;
  message: string;            // what the employee sees
  sideEffects: SideEffects;
  policyVersion: string;
}

// ---------- Data class ----------
// Effective class = declared label, or the department default when none is declared,
// raised to Restricted when the pattern check fires.
export function effectiveClass(
  declared: DataClass | null | undefined,
  deptDefault: DataClass | null | undefined,
  patternHit: boolean
): { cls: DataClass; source: ClassSource } {
  if (patternHit) return { cls: RESTRICTED, source: "pattern_check" };
  if (declared) return { cls: declared, source: "label" };
  if (deptDefault) return { cls: deptDefault, source: "department_default" };
  throw new Error("No data class: no label and no department default");
}

// Luhn checksum — used by SIN and card numbers.
function luhnOk(digits: string): boolean {
  let sum = 0, double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) { d *= 2; if (d > 9) d -= 9; }
    sum += d; double = !double;
  }
  return sum % 10 === 0;
}

// Runs in the browser before anything is sent. Only the true/false result leaves the page.
export function detectRestricted(text: string): { hit: boolean; kinds: string[] } {
  const kinds = new Set<string>();
  // Canadian SIN: 9 digits, optional spaces or dashes, valid Luhn
  for (const m of text.matchAll(/\b(\d{3})[- ]?(\d{3})[- ]?(\d{3})\b/g)) {
    if (luhnOk(m.slice(1, 4).join(""))) kinds.add("SIN");
  }
  // Payment card: 13–19 digits, optional spaces or dashes, valid Luhn
  for (const m of text.matchAll(/\b\d(?:[- ]?\d){12,18}\b/g)) {
    const digits = m[0].replace(/[- ]/g, "");
    if (digits.length >= 13 && luhnOk(digits)) kinds.add("Card number");
  }
  // Canadian bank account: transit (5) - institution (3) - account (7–12)
  if (/\b\d{5}[- ]\d{3}[- ]\d{7,12}\b/.test(text)) kinds.add("Bank account");
  return { hit: kinds.size > 0, kinds: [...kinds] };
}

// ---------- Helpers ----------
const isExpired = (iso: string | null, now: Date) => iso !== null && new Date(iso).getTime() < now.getTime();

export function approvedAlternative(cls: DataClass, catalog: Service[], now: Date, excludeId?: string): Service | null {
  const ok = catalog.filter(s =>
    s.id !== excludeId && s.status === "approved" && !s.killSwitch && !s.vendorChanged &&
    !isExpired(s.expiresAt, now) && s.ceiling !== null && s.ceiling >= cls);
  return ok.find(s => s.isDefaultAlternative) ?? null;
}

function activeException(input: EvaluateInput, cls: DataClass): Exception | null {
  const { employee, service, exceptions, now } = input;
  return exceptions.find(e =>
    e.serviceId === service!.id &&
    (e.employeeId === employee.id || e.department === employee.department) &&
    e.maxClass >= cls && !isExpired(e.expiresAt, now)) ?? null;
}

// ---------- The decision ----------
export function evaluateUsage(input: EvaluateInput): Decision {
  const none: SideEffects = { markUnderReview: false, queueReReview: false, alertSecOps: false };
  let cls: DataClass | null = null, source: ClassSource | null = null;
  try {
    const ec = effectiveClass(input.declaredClass, input.departmentDefault, input.patternHit);
    cls = ec.cls; source = ec.source;
    const svc = input.service;
    if (!svc) throw new Error("Service lookup failed");
    const fx: SideEffects = { ...none };
    const out = (action: Action, rule: RuleId, message: string, alt: Service | null = null, exceptionId: string | null = null): Decision =>
      ({ action, rule, effectiveClass: cls, classSource: source, alternative: alt ? { id: alt.id, name: alt.name } : null,
         exceptionId, message, sideEffects: fx, policyVersion: POLICY_VERSION });
    const cn = CLASS_NAMES[cls];

    // R0 Kill switch
    if (svc.killSwitch) return out("block", "R0", `${svc.name} has been switched off by Security. Use another approved tool.`,
      approvedAlternative(cls, input.catalog, input.now, svc.id));
    // R1 Prohibited
    if (svc.status === "prohibited") {
      const alt = approvedAlternative(cls, input.catalog, input.now, svc.id);
      return out("block", "R1", `${svc.name} is not permitted at Northbridge.${alt ? ` Use ${alt.name} instead.` : ""}`, alt);
    }
    // R2 Active exception
    const ex = activeException(input, cls);
    if (ex) return out("allow", "R2", `Allowed under exception ${ex.id} (until ${ex.expiresAt.slice(0, 10)}).`, null, ex.id);
    // R3 Approval decay → treat as Under review and keep going
    let status: ServiceStatus = svc.status;
    if (status === "approved" && (isExpired(svc.expiresAt, input.now) || svc.vendorChanged)) {
      status = "under_review"; fx.markUnderReview = true; fx.queueReReview = true;
    }
    const ceiling: number = status === "approved" && svc.ceiling ? svc.ceiling : 0;
    // R4 Within ceiling
    if (cls <= ceiling) return out("allow", "R4", `${svc.name} is approved for ${cn} data.`);
    // R6 Restricted above ceiling
    if (cls === RESTRICTED) {
      const alt = approvedAlternative(cls, input.catalog, input.now, svc.id);
      return out("block", "R6", `${svc.name} can't be used with Restricted data.${alt ? ` Use ${alt.name}.` : " Ask AI Governance for an exception."}`, alt);
    }
    // R7 No ceiling, low-sensitivity data → coach
    if (ceiling === 0 && cls <= INTERNAL) {
      const alt = approvedAlternative(cls, input.catalog, input.now, svc.id);
      const why = fx.markUnderReview ? "This tool's approval is being re-reviewed." : "This tool hasn't been reviewed.";
      return out("coach", "R7", `${why} ${cn} data is OK for now — avoid customer data.${alt ? ` Approved alternative: ${alt.name}.` : ""}`, alt);
    }
    // R5 Above ceiling, Confidential or lower → redirect or request approval
    const alt = approvedAlternative(cls, input.catalog, input.now, svc.id);
    if (alt) return out("redirect", "R5", `This data is ${cn}. Use ${alt.name}, which is approved for it.`, alt);
    return out("request_approval", "R5", `${svc.name} isn't approved for ${cn} data. Request access to continue.`);
  } catch {
    // R9 Fail safe: closed for sensitive data, open with an alert otherwise
    const sensitive = cls === null || cls >= CONFIDENTIAL;
    return {
      action: sensitive ? "block" : "allow_with_alert", rule: "R9", effectiveClass: cls, classSource: source,
      alternative: null, exceptionId: null,
      message: sensitive ? "We couldn't check this request, so it's blocked for safety. Try again shortly."
                         : "We couldn't check this request. It's allowed and Security has been notified.",
      sideEffects: { ...none, alertSecOps: !sensitive }, policyVersion: POLICY_VERSION,
    };
  }
}

// ---------- Approvals ----------
export type Route = "low" | "medium" | "high";
export const ROUTES: Record<Route, { approvers: string[]; targetBusinessDays: number; defaultExpiryDays: number }> = {
  low:    { approvers: ["manager"], targetBusinessDays: 1, defaultExpiryDays: 365 },
  medium: { approvers: ["governance_lead"], targetBusinessDays: 2, defaultExpiryDays: 180 },
  high:   { approvers: ["governance_lead", "security", "privacy"], targetBusinessDays: 5, defaultExpiryDays: 90 },
};

// The higher of the service's risk tier and the requested data class decides the route.
export function routeFor(riskTier: RiskTier, requested: DataClass): Route {
  const byTier = { low: 1, medium: 2, high: 3 }[riskTier];
  const byClass = requested <= INTERNAL ? 1 : requested === CONFIDENTIAL ? 2 : 3;
  const level = Math.max(byTier, byClass);
  return level === 1 ? "low" : level === 2 ? "medium" : "high";
}

export interface Signature { approverId: string; role: string }
export interface AccessRequest {
  id: string; requesterId: string; serviceId: string; route: Route;
  submittedAt: string; signatures: Signature[];
}

// Segregation of duties: no self-approval; on the High route each role is signed by a different person.
export function canSign(req: AccessRequest, approverId: string, role: string): { ok: boolean; reason: string } {
  if (approverId === req.requesterId) return { ok: false, reason: "You can't approve your own request." };
  if (!ROUTES[req.route].approvers.includes(role)) return { ok: false, reason: `The ${req.route} route doesn't need a ${role} signature.` };
  if (req.signatures.some(s => s.approverId === approverId)) return { ok: false, reason: "Each approval on this request must come from a different person." };
  if (req.signatures.some(s => s.role === role)) return { ok: false, reason: `A ${role} has already signed.` };
  return { ok: true, reason: "OK" };
}

// Business days elapsed (Mon–Fri) between two instants.
export function businessDaysBetween(from: Date, to: Date): number {
  let days = 0; const d = new Date(from);
  while (true) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getTime() > to.getTime()) break;
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) days++;
  }
  return days;
}

export function isOverdue(req: AccessRequest, now: Date): { overdue: boolean; escalateTo: string | null } {
  const done = req.signatures.length >= ROUTES[req.route].approvers.length;
  const late = !done && businessDaysBetween(new Date(req.submittedAt), now) > ROUTES[req.route].targetBusinessDays;
  return { overdue: late, escalateTo: late ? "CISO office" : null };
}

// ---------- Demand signal (Should) ----------
export interface UsageEvent { employeeId: string; serviceId: string; action: Action; at: string }
export function isPriorityReview(events: UsageEvent[], serviceId: string, now: Date): { priority: boolean; distinctEmployees: number } {
  const since = now.getTime() - 7 * 864e5;
  const who = new Set(events.filter(e => e.serviceId === serviceId && (e.action === "coach" || e.action === "redirect") &&
    new Date(e.at).getTime() >= since).map(e => e.employeeId));
  return { priority: who.size >= 5, distinctEmployees: who.size };
}
