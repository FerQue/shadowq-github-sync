-- ShadowQ database schema · Policy Rules v1.0
-- Postgres / Supabase (Lovable Cloud runs on Supabase, so this works for both).
-- Run once in the Supabase SQL editor, then run the seed script.

create extension if not exists pgcrypto;

-- ---------- Types ----------
create type app_role       as enum ('employee','manager','governance_lead','security','privacy','secops');
create type service_status as enum ('approved','under_review','unknown','prohibited');
create type risk_tier      as enum ('low','medium','high');
create type route          as enum ('low','medium','high');
create type policy_action  as enum ('allow','coach','redirect','request_approval','block','allow_with_alert');
create type request_status as enum ('open','approved','rejected','exception_granted','withdrawn');
-- Data classes are smallint 1–4: 1 Public, 2 Internal, 3 Confidential, 4 Restricted.

-- ---------- Organisation ----------
create table departments (
  id            text primary key,
  name          text not null,
  default_class smallint not null check (default_class between 1 and 4)
);

create table employees (
  id            text primary key,                         -- pseudonymous, e.g. E-1007
  auth_user_id  uuid unique,                              -- Supabase auth.users.id
  display_name  text not null,                            -- only the Privacy role can read names
  department_id text not null references departments(id),
  manager_id    text references employees(id),
  created_at    timestamptz not null default now()
);

create table user_roles (
  employee_id text references employees(id) on delete cascade,
  role        app_role not null,
  primary key (employee_id, role)
);

-- ---------- Registry ----------
create table ai_services (
  id                     text primary key,
  name                   text not null unique,
  vendor                 text,
  category               text,
  embedded_in            text,                            -- AI feature inside an approved SaaS
  status                 service_status not null default 'unknown',
  ceiling                smallint check (ceiling between 1 and 4),
  risk_tier              risk_tier not null default 'high',
  -- vendor profile (null = not answered = counts as the High answer)
  trains_on_inputs       boolean,
  has_dpa                boolean,
  retention_days         integer,
  data_region            text,
  has_assurance          boolean,                         -- SOC 2 Type II or ISO 27001
  sso_and_audit_logs     boolean,
  agentic                boolean,
  -- approval state
  is_default_alternative boolean not null default false,
  kill_switch            boolean not null default false,
  vendor_changed         boolean not null default false,
  approved_at            timestamptz,
  expires_at             timestamptz,
  conditions             text,
  owner_id               text references employees(id),
  first_seen_at          timestamptz not null default now(),
  constraint ceiling_only_when_approved check ((status = 'approved') = (ceiling is not null))
);

-- ---------- Visibility ----------
create table signals (                                    -- raw synthetic source events
  id          bigserial primary key,
  source      text not null check (source in ('sso_grant','gateway','expense','endpoint')),
  employee_id text not null references employees(id),
  service_id  text not null references ai_services(id),
  observed_at timestamptz not null,
  detail      jsonb not null default '{}'
);

create table usage_events (                               -- one per session, deduplicated from signals
  id             bigserial primary key,
  employee_id    text not null references employees(id),
  service_id     text not null references ai_services(id),
  observed_at    timestamptz not null,
  sources        text[] not null,
  declared_class smallint check (declared_class between 1 and 4),
  unique (employee_id, service_id, observed_at)
);

-- ---------- Decisions (metadata only; never prompt or file content) ----------
create table decisions (
  id              uuid primary key default gen_random_uuid(),
  at              timestamptz not null default now(),
  employee_id     text not null references employees(id),
  department_id   text not null references departments(id),
  service_id      text references ai_services(id),
  effective_class smallint check (effective_class between 1 and 4),
  class_source    text check (class_source in ('label','department_default','pattern_check')),
  action          policy_action not null,
  rule            text not null check (rule in ('R0','R1','R2','R3','R4','R5','R6','R7','R9')),
  alternative_id  text references ai_services(id),
  exception_id    text,
  policy_version  text not null
);

-- ---------- Approvals ----------
create table access_requests (
  id              text primary key default ('REQ-' || substr(gen_random_uuid()::text, 1, 6)),
  requester_id    text not null references employees(id),
  service_id      text not null references ai_services(id),
  requested_class smallint not null check (requested_class between 1 and 4),
  route           route not null,
  reason          text not null check (length(trim(reason)) > 0),
  duration_days   integer,
  kind            text not null default 'access' check (kind in ('access','re_review')),
  status          request_status not null default 'open',
  submitted_at    timestamptz not null default now(),
  decided_at      timestamptz,
  escalated_at    timestamptz
);

create table approvals (                                   -- one row per signature
  id          bigserial primary key,
  request_id  text not null references access_requests(id) on delete cascade,
  approver_id text not null references employees(id),
  role        app_role not null,
  decision    text not null check (decision in ('approve','reject','exception')),
  ceiling     smallint check (ceiling between 1 and 4),
  expires_at  timestamptz,
  conditions  text,
  signed_at   timestamptz not null default now(),
  unique (request_id, approver_id),                         -- each signature from a different person
  unique (request_id, role)                                 -- one signature per role
);

create table exceptions (
  id            text primary key,
  service_id    text not null references ai_services(id),
  employee_id   text references employees(id),
  department_id text references departments(id),
  max_class     smallint not null check (max_class between 1 and 4),
  expires_at    timestamptz not null,
  granted_by    text not null references employees(id),
  request_id    text references access_requests(id),
  constraint one_scope check ((employee_id is null) <> (department_id is null))
);

-- ---------- Audit (append-only) ----------
create table audit_log (
  id             bigserial primary key,
  at             timestamptz not null default now(),
  actor_id       text references employees(id),           -- null = system
  action         text not null,                           -- e.g. decision, sign, kill_switch, status_change
  entity         text not null,
  entity_id      text not null,
  details        jsonb not null default '{}',
  policy_version text not null default '1.0'
);

create or replace function audit_log_is_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append-only: % is not allowed', tg_op;
end $$;
create trigger audit_log_no_update before update or delete on audit_log
  for each row execute function audit_log_is_append_only();
create trigger audit_log_no_truncate before truncate on audit_log
  for each statement execute function audit_log_is_append_only();

-- ---------- Segregation of duties (enforced even for admins) ----------
create or replace function approvals_enforce_sod() returns trigger language plpgsql as $$
declare req access_requests;
begin
  select * into req from access_requests where id = new.request_id;
  if req.requester_id = new.approver_id then
    raise exception 'Segregation of duties: you cannot approve your own request';
  end if;
  if not exists (select 1 from user_roles where employee_id = new.approver_id and role = new.role) then
    raise exception 'Approver % does not hold role %', new.approver_id, new.role;
  end if;
  if req.status <> 'open' then
    raise exception 'Request % is already %', req.id, req.status;
  end if;
  return new;
end $$;
create trigger approvals_sod before insert on approvals
  for each row execute function approvals_enforce_sod();

-- ---------- Helpers for row-level security ----------
create or replace function current_employee_id() returns text
  language sql stable security definer set search_path = public as $$
  select id from employees where auth_user_id = auth.uid()
$$;

create or replace function has_role(r app_role) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where employee_id = current_employee_id() and role = r)
$$;

-- Approvers needed per route (mirrors ROUTES in the policy code)
create or replace function route_roles(r route) returns app_role[] language sql immutable as $$
  select case r when 'low' then array['manager']::app_role[]
                when 'medium' then array['governance_lead']::app_role[]
                else array['governance_lead','security','privacy']::app_role[] end
$$;

-- Can the signed-in user see (and act on) this request?
create or replace function can_review(req access_requests) returns boolean
  language sql stable security definer set search_path = public as $$
  select case
    when req.route = 'low' then exists (select 1 from employees e where e.id = req.requester_id and e.manager_id = current_employee_id())
    when req.route = 'medium' then has_role('governance_lead')
    else has_role('governance_lead') or has_role('security') or has_role('privacy')
  end
$$;

-- Sign a request: the only way the app writes approvals. SoD trigger still applies.
create or replace function sign_request(p_request_id text, p_role app_role, p_decision text,
  p_ceiling smallint default null, p_expires_at timestamptz default null, p_conditions text default null)
returns text language plpgsql security definer set search_path = public as $$
declare me text := current_employee_id(); req access_requests; needed app_role[]; signed int;
begin
  select * into req from access_requests where id = p_request_id for update;
  if req is null then raise exception 'No request %', p_request_id; end if;
  if not has_role(p_role) then raise exception 'You do not hold role %', p_role; end if;
  needed := route_roles(req.route);
  if not p_role = any(needed) then raise exception 'The % route does not need a % signature', req.route, p_role; end if;
  if p_role = 'manager' and not exists (select 1 from employees where id = req.requester_id and manager_id = me) then
    raise exception 'Only the requester''s manager can sign the low route';
  end if;
  insert into approvals(request_id, approver_id, role, decision, ceiling, expires_at, conditions)
    values (p_request_id, me, p_role, p_decision, p_ceiling, p_expires_at, p_conditions);
  insert into audit_log(actor_id, action, entity, entity_id, details)
    values (me, 'sign', 'access_request', p_request_id, jsonb_build_object('role', p_role, 'decision', p_decision, 'ceiling', p_ceiling));

  if p_decision = 'reject' then
    update access_requests set status = 'rejected', decided_at = now() where id = p_request_id;
    return 'rejected';
  end if;
  select count(*) into signed from approvals where request_id = p_request_id and decision <> 'reject';
  if signed = array_length(needed, 1) then
    update access_requests set status = 'approved', decided_at = now() where id = p_request_id;
    update ai_services set status = 'approved', ceiling = coalesce(p_ceiling, req.requested_class),
      approved_at = now(), vendor_changed = false,
      expires_at = coalesce(p_expires_at, now() + case req.route when 'low' then interval '365 days'
                                                              when 'medium' then interval '180 days'
                                                              else interval '90 days' end),
      conditions = coalesce(p_conditions, conditions)
    where id = req.service_id;
    insert into audit_log(actor_id, action, entity, entity_id, details)
      values (me, 'status_change', 'ai_service', req.service_id, jsonb_build_object('status', 'approved', 'request', p_request_id));
    return 'approved';
  end if;
  return 'signed';
end $$;

-- Kill switch: Security Operations and the AI Governance Lead only.
create or replace function set_kill_switch(p_service_id text, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (has_role('secops') or has_role('governance_lead')) then
    raise exception 'Only Security Operations or the AI Governance Lead can use the kill switch';
  end if;
  update ai_services set kill_switch = p_on where id = p_service_id;
  insert into audit_log(actor_id, action, entity, entity_id, details)
    values (current_employee_id(), 'kill_switch', 'ai_service', p_service_id, jsonb_build_object('on', p_on));
end $$;

-- Escalation: open requests past their target (1/2/5 business days) go to the CISO office.
create or replace function business_days_between(a timestamptz, b timestamptz) returns integer
  language sql immutable as $$
  select count(*)::int from generate_series(a::date + 1, b::date, interval '1 day') d
  where extract(isodow from d) < 6
$$;

create or replace view overdue_requests with (security_invoker = true) as
  select r.*, business_days_between(r.submitted_at, now()) as business_days_open,
         case r.route when 'low' then 1 when 'medium' then 2 else 5 end as target_days,
         'CISO office' as escalate_to
  from access_requests r
  where r.status = 'open'
    and business_days_between(r.submitted_at, now()) > case r.route when 'low' then 1 when 'medium' then 2 else 5 end;

-- Demand signal: 5+ different employees coached or redirected on one Unknown tool in 7 days.
create or replace view priority_reviews with (security_invoker = true) as
  select d.service_id, s.name, count(distinct d.employee_id) as distinct_employees
  from decisions d join ai_services s on s.id = d.service_id
  where d.action in ('coach','redirect') and d.at >= now() - interval '7 days' and s.status = 'unknown'
  group by d.service_id, s.name
  having count(distinct d.employee_id) >= 5;

-- Pseudonymous view for dashboards (no names). Runs as owner on purpose: it exposes no names.
create or replace view employees_pseudo as
  select id, department_id, manager_id from employees;

-- ---------- Row-level security ----------
alter table departments     enable row level security;
alter table employees       enable row level security;
alter table user_roles      enable row level security;
alter table ai_services     enable row level security;
alter table signals         enable row level security;
alter table usage_events    enable row level security;
alter table decisions       enable row level security;
alter table access_requests enable row level security;
alter table approvals       enable row level security;
alter table exceptions      enable row level security;
alter table audit_log       enable row level security;

-- Everyone signed in can read departments and the registry.
create policy read_departments on departments for select to authenticated using (true);
create policy read_registry    on ai_services for select to authenticated using (true);
-- Only the AI Governance Lead edits the registry directly (kill switch goes through set_kill_switch).
create policy edit_registry    on ai_services for update to authenticated
  using (has_role('governance_lead')) with check (has_role('governance_lead'));

-- Names are private: you see your own row; the Privacy Officer sees all.
create policy read_employees on employees for select to authenticated
  using (id = current_employee_id() or has_role('privacy'));
create policy read_roles on user_roles for select to authenticated
  using (employee_id = current_employee_id() or has_role('governance_lead') or has_role('privacy'));

-- Monitoring data: your own, or governance, SecOps and Privacy.
create policy read_signals on signals for select to authenticated
  using (employee_id = current_employee_id() or has_role('governance_lead') or has_role('secops') or has_role('privacy'));
create policy read_usage on usage_events for select to authenticated
  using (employee_id = current_employee_id() or has_role('governance_lead') or has_role('secops') or has_role('privacy'));
create policy read_decisions on decisions for select to authenticated
  using (employee_id = current_employee_id() or has_role('governance_lead') or has_role('secops') or has_role('privacy'));
-- decisions, signals, usage_events are written only by the evaluate-usage function (service role).

-- Requests: file your own; see your own or the ones routed to you.
create policy file_request on access_requests for insert to authenticated
  with check (requester_id = current_employee_id() and status = 'open');
create policy read_requests on access_requests for select to authenticated
  using (requester_id = current_employee_id() or can_review(access_requests));
create policy read_approvals on approvals for select to authenticated
  using (exists (select 1 from access_requests r where r.id = request_id
                 and (r.requester_id = current_employee_id() or can_review(r))));
-- approvals are written only through sign_request().

create policy read_exceptions on exceptions for select to authenticated
  using (employee_id = current_employee_id() or has_role('governance_lead') or has_role('privacy'));

-- Audit log: readable by governance and privacy; no one can update or delete (trigger).
create policy read_audit on audit_log for select to authenticated
  using (has_role('governance_lead') or has_role('privacy'));

grant select on employees_pseudo, overdue_requests, priority_reviews to authenticated;
grant execute on function sign_request, set_kill_switch to authenticated;
