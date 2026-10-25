import { describe, expect, it } from "vitest";
import {
  canSign,
  detectRestricted,
  evaluateUsage,
  type DataClass,
  type EvaluateInput,
  type Service,
} from "@/lib/policy/policy";

// Core acceptance cases from Policy Rules v1.0, against a small fixture catalog.
const NOW = new Date("2026-10-24T15:00:00Z");

const svc = (id: string, o: Partial<Service> = {}): Service => ({
  id,
  name: id,
  status: "unknown",
  ceiling: null,
  riskTier: "high",
  killSwitch: false,
  expiresAt: null,
  vendorChanged: false,
  ...o,
});

const assistant = svc("Northbridge Assistant", { status: "approved", ceiling: 3, riskTier: "low", expiresAt: "2027-05-01T00:00:00Z", isDefaultAlternative: true });
const draftpal = svc("DraftPal", { status: "approved", ceiling: 2, riskTier: "low", expiresAt: "2027-04-01T00:00:00Z" });
const meetnotes = svc("MeetNotes AI", { status: "approved", ceiling: 2, riskTier: "medium", expiresAt: "2026-10-23T00:00:00Z" });
const summaraize = svc("SummarAIze");
const freechat = svc("FreeChat Pro", { status: "prohibited" });
const catalog = [assistant, draftpal, meetnotes];

function run(service: Service | null, o: Partial<EvaluateInput> = {}) {
  return evaluateUsage({
    employee: { id: "E-1007", department: "support" },
    service,
    declaredClass: null,
    departmentDefault: 3,
    patternHit: false,
    exceptions: [],
    catalog,
    now: NOW,
    ...o,
  });
}

describe("policy rules", () => {
  it("1: unknown tool, no label, Confidential by default → redirect to the approved tool (R5)", () => {
    const d = run(summaraize);
    expect([d.action, d.rule, d.alternative?.name]).toEqual(["redirect", "R5", "Northbridge Assistant"]);
  });

  it("2: unknown tool with Internal data → coach (R7)", () => {
    expect(run(summaraize, { declaredClass: 2 })).toMatchObject({ action: "coach", rule: "R7" });
  });

  it("3: approved up to Internal, Internal data → allow (R4)", () => {
    expect(run(draftpal, { declaredClass: 2 })).toMatchObject({ action: "allow", rule: "R4" });
  });

  it("4: Confidential data on an Internal-only tool → redirect (R5)", () => {
    expect(run(draftpal, { declaredClass: 3 })).toMatchObject({ action: "redirect", rule: "R5" });
  });

  it("5: same, with no alternative cleared for Confidential → request approval (R5)", () => {
    const d = run(draftpal, { declaredClass: 3, catalog: [draftpal] });
    expect(d).toMatchObject({ action: "request_approval", rule: "R5" });
  });

  it("6: Restricted data → block (R6)", () => {
    expect(run(draftpal, { declaredClass: 4 })).toMatchObject({ action: "block", rule: "R6" });
  });

  it("7: a SIN-format number overrides an Internal label → Restricted, block (R6)", () => {
    const hit = detectRestricted("Client asked about SIN 046 454 286 on file");
    expect(hit).toEqual({ hit: true, kinds: ["SIN"] });
    const d = run(draftpal, { declaredClass: 2, patternHit: hit.hit });
    expect(d).toMatchObject({ action: "block", rule: "R6", classSource: "pattern_check" });
  });

  it("8: prohibited tool → block with an alternative (R1)", () => {
    const d = run(freechat, { declaredClass: 1 });
    expect(d).toMatchObject({ action: "block", rule: "R1" });
    expect(d.alternative).not.toBeNull();
  });

  it("9: expired approval → coach, mark under review, queue re-review", () => {
    const d = run(meetnotes, { declaredClass: 2 });
    expect(d).toMatchObject({ action: "coach", rule: "R7" });
    expect(d.sideEffects).toMatchObject({ markUnderReview: true, queueReReview: true });
  });

  it("10: vendor terms changed → coach, mark under review, queue re-review", () => {
    const d = run({ ...draftpal, vendorChanged: true }, { declaredClass: 2 });
    expect(d).toMatchObject({ action: "coach", rule: "R7" });
    expect(d.sideEffects).toMatchObject({ markUnderReview: true, queueReReview: true });
  });

  it("11: kill switch → block (R0)", () => {
    expect(run({ ...assistant, killSwitch: true }, { declaredClass: 1 })).toMatchObject({ action: "block", rule: "R0" });
  });

  it("12: a valid exception allows (R2); after expiry the normal rule applies again", () => {
    const exceptions = [{ id: "EX-01", serviceId: "SummarAIze", employeeId: "E-1007", maxClass: 3 as DataClass, expiresAt: "2026-10-31T23:59:00Z" }];
    expect(run(summaraize, { exceptions })).toMatchObject({ action: "allow", rule: "R2" });
    expect(run(summaraize, { exceptions, now: new Date("2026-11-01T15:00:00Z") })).toMatchObject({ action: "redirect", rule: "R5" });
  });

  it("13: nobody can approve their own request", () => {
    const req = { id: "REQ-T13", requesterId: "E-1007", serviceId: "SummarAIze", route: "medium" as const, submittedAt: NOW.toISOString(), signatures: [] };
    expect(canSign(req, "E-1007", "governance_lead").ok).toBe(false);
  });

  it("14: lookup failure fails safe — block Restricted, allow Internal with a SecOps alert (R9)", () => {
    expect(run(null, { departmentDefault: 4 })).toMatchObject({ action: "block", rule: "R9" });
    const d = run(null, { declaredClass: 2 });
    expect(d).toMatchObject({ action: "allow_with_alert", rule: "R9" });
    expect(d.sideEffects.alertSecOps).toBe(true);
  });

  it("17: Credit Operations default Restricted → block even on the approved tool (R6)", () => {
    expect(run(assistant, { departmentDefault: 4 })).toMatchObject({ action: "block", rule: "R6" });
  });
});
