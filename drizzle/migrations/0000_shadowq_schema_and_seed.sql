create extension if not exists pgcrypto;

create type app_role       as enum ('employee','manager','governance_lead','security','privacy','secops');
create type service_status as enum ('approved','under_review','unknown','prohibited');
create type risk_tier      as enum ('low','medium','high');
create type route          as enum ('low','medium','high');
create type policy_action  as enum ('allow','coach','redirect','request_approval','block','allow_with_alert');
create type request_status as enum ('open','approved','rejected','exception_granted','withdrawn');

create table departments (
  id            text primary key,
  name          text not null,
  default_class smallint not null check (default_class between 1 and 4)
);

create table employees (
  id            text primary key,
  auth_user_id  uuid unique,
  display_name  text not null,
  department_id text not null references departments(id),
  manager_id    text references employees(id),
  created_at    timestamptz not null default now()
);

create table user_roles (
  employee_id text references employees(id) on delete cascade,
  role        app_role not null,
  primary key (employee_id, role)
);

create table ai_services (
  id                     text primary key,
  name                   text not null unique,
  vendor                 text,
  category               text,
  embedded_in            text,
  status                 service_status not null default 'unknown',
  ceiling                smallint check (ceiling between 1 and 4),
  risk_tier              risk_tier not null default 'high',
  trains_on_inputs       boolean,
  has_dpa                boolean,
  retention_days         integer,
  data_region            text,
  has_assurance          boolean,
  sso_and_audit_logs     boolean,
  agentic                boolean,
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

create table signals (
  id          bigserial primary key,
  source      text not null check (source in ('sso_grant','gateway','expense','endpoint')),
  employee_id text not null references employees(id),
  service_id  text not null references ai_services(id),
  observed_at timestamptz not null,
  detail      jsonb not null default '{}'
);

create table usage_events (
  id             bigserial primary key,
  employee_id    text not null references employees(id),
  service_id     text not null references ai_services(id),
  observed_at    timestamptz not null,
  sources        text[] not null,
  declared_class smallint check (declared_class between 1 and 4),
  unique (employee_id, service_id, observed_at)
);

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

create table approvals (
  id          bigserial primary key,
  request_id  text not null references access_requests(id) on delete cascade,
  approver_id text not null references employees(id),
  role        app_role not null,
  decision    text not null check (decision in ('approve','reject','exception')),
  ceiling     smallint check (ceiling between 1 and 4),
  expires_at  timestamptz,
  conditions  text,
  signed_at   timestamptz not null default now(),
  unique (request_id, approver_id),
  unique (request_id, role)
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

create table audit_log (
  id             bigserial primary key,
  at             timestamptz not null default now(),
  actor_id       text references employees(id),
  action         text not null,
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

create or replace function current_employee_id() returns text
  language sql stable security definer set search_path = public as $$
  select id from employees where auth_user_id = auth.uid()
$$;

create or replace function has_role(r app_role) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where employee_id = current_employee_id() and role = r)
$$;

create or replace function route_roles(r route) returns app_role[] language sql immutable as $$
  select case r when 'low' then array['manager']::app_role[]
                when 'medium' then array['governance_lead']::app_role[]
                else array['governance_lead','security','privacy']::app_role[] end
$$;

create or replace function can_review(req access_requests) returns boolean
  language sql stable security definer set search_path = public as $$
  select case
    when req.route = 'low' then exists (select 1 from employees e where e.id = req.requester_id and e.manager_id = current_employee_id())
    when req.route = 'medium' then has_role('governance_lead')
    else has_role('governance_lead') or has_role('security') or has_role('privacy')
  end
$$;

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

create or replace view priority_reviews with (security_invoker = true) as
  select d.service_id, s.name, count(distinct d.employee_id) as distinct_employees
  from decisions d join ai_services s on s.id = d.service_id
  where d.action in ('coach','redirect') and d.at >= now() - interval '7 days' and s.status = 'unknown'
  group by d.service_id, s.name
  having count(distinct d.employee_id) >= 5;

create or replace view employees_pseudo with (security_invoker = true) as
  select id, department_id, manager_id from employees;

-- Demo personas: a signed-in user picks which Northbridge employee they act as.
create or replace function claim_persona(p_employee_id text) returns text
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_employee_id not in ('E-1001','E-1002','E-1003','E-1004','E-1005','E-1007','E-1012') then
    raise exception 'Not a demo persona';
  end if;
  update employees set auth_user_id = null where auth_user_id = auth.uid() and id <> p_employee_id;
  update employees set auth_user_id = auth.uid() where id = p_employee_id;
  return p_employee_id;
end $$;

-- Who am I (persona + roles), readable without exposing other names.
create or replace function my_persona() returns jsonb
  language sql stable security definer set search_path = public as $$
  select case when e.id is null then null else jsonb_build_object(
    'id', e.id, 'display_name', e.display_name, 'department_id', e.department_id, 'manager_id', e.manager_id,
    'roles', coalesce((select jsonb_agg(role) from user_roles where employee_id = e.id), '[]'::jsonb)) end
  from (select * from employees where auth_user_id = auth.uid()) e
  right join (select 1) one on true
$$;

-- ---------- Grants ----------
grant select on departments, employees, user_roles, ai_services, signals, usage_events, decisions,
  access_requests, approvals, exceptions, audit_log to authenticated;
grant insert on access_requests to authenticated;
grant update on ai_services to authenticated;
grant all on departments, employees, user_roles, ai_services, signals, usage_events, decisions,
  access_requests, approvals, exceptions, audit_log to service_role;
grant usage, select on all sequences in schema public to service_role;
grant select on employees_pseudo, overdue_requests, priority_reviews to authenticated;
grant execute on function sign_request, set_kill_switch, claim_persona, my_persona to authenticated;

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

create policy read_departments on departments for select to authenticated using (true);
create policy read_registry    on ai_services for select to authenticated using (true);
create policy edit_registry    on ai_services for update to authenticated
  using (has_role('governance_lead')) with check (has_role('governance_lead'));
create policy read_employees on employees for select to authenticated
  using (id = current_employee_id() or has_role('privacy'));
create policy read_roles on user_roles for select to authenticated
  using (employee_id = current_employee_id() or has_role('governance_lead') or has_role('privacy'));
create policy read_signals on signals for select to authenticated
  using (employee_id = current_employee_id() or has_role('governance_lead') or has_role('secops') or has_role('privacy'));
create policy read_usage on usage_events for select to authenticated
  using (employee_id = current_employee_id() or has_role('governance_lead') or has_role('secops') or has_role('privacy'));
create policy read_decisions on decisions for select to authenticated
  using (employee_id = current_employee_id() or has_role('governance_lead') or has_role('secops') or has_role('privacy'));
create policy file_request on access_requests for insert to authenticated
  with check (requester_id = current_employee_id() and status = 'open');
create policy read_requests on access_requests for select to authenticated
  using (requester_id = current_employee_id() or can_review(access_requests));
create policy read_approvals on approvals for select to authenticated
  using (exists (select 1 from access_requests r where r.id = request_id
                 and (r.requester_id = current_employee_id() or can_review(r))));
create policy read_exceptions on exceptions for select to authenticated
  using (employee_id = current_employee_id() or has_role('governance_lead') or has_role('privacy'));
create policy read_audit on audit_log for select to authenticated
  using (has_role('governance_lead') or has_role('privacy'));

-- ---------- Seed: Northbridge Financial (fictional) ----------
insert into departments (id, name, default_class) values
  ('support', 'Customer Support', 3),
  ('engineering', 'Engineering', 3),
  ('finance', 'Finance', 3),
  ('marketing', 'Marketing', 2),
  ('credit_ops', 'Credit Operations', 4),
  ('risk', 'Risk & Compliance', 3),
  ('secops', 'Security Operations', 3);

insert into employees (id, display_name, department_id) values
  ('E-1001', 'Priya Nair', 'risk'),
  ('E-1002', 'Daniel Osei', 'secops'),
  ('E-1003', 'Amira Haddad', 'risk'),
  ('E-1004', 'Sam Whitford', 'secops'),
  ('E-1005', 'Lena Fischer', 'support'),
  ('E-1006', 'Tomás Rivera', 'engineering'),
  ('E-1007', 'Marco Silva', 'support'),
  ('E-1008', 'Hannah Brooks', 'marketing'),
  ('E-1009', 'Wei Zhang', 'engineering'),
  ('E-1010', 'Olivia Martin', 'credit_ops'),
  ('E-1011', 'Jordan Lee', 'support'),
  ('E-1012', 'Fatima Khan', 'support'),
  ('E-1013', 'Ethan Roy', 'support'),
  ('E-1014', 'Chloé Gagnon', 'marketing'),
  ('E-1015', 'Arjun Mehta', 'engineering'),
  ('E-1016', 'Grace Kim', 'finance'),
  ('E-1017', 'Noah Tremblay', 'credit_ops'),
  ('E-1018', 'Sofia Rossi', 'engineering'),
  ('E-1019', 'Ben Carter', 'marketing'),
  ('E-1020', 'Aisha Bello', 'credit_ops'),
  ('E-1021', 'Liam O''Connor', 'finance'),
  ('E-1022', 'Maya Singh', 'finance'),
  ('E-1023', 'Lucas Bouchard', 'marketing'),
  ('E-1024', 'Zoe Anderson', 'support');
update employees set manager_id = 'E-1001' where id = 'E-1003';
update employees set manager_id = 'E-1002' where id = 'E-1004';
update employees set manager_id = 'E-1005' where id = 'E-1007';
update employees set manager_id = 'E-1019' where id = 'E-1008';
update employees set manager_id = 'E-1006' where id = 'E-1009';
update employees set manager_id = 'E-1020' where id = 'E-1010';
update employees set manager_id = 'E-1005' where id = 'E-1011';
update employees set manager_id = 'E-1005' where id = 'E-1012';
update employees set manager_id = 'E-1005' where id = 'E-1013';
update employees set manager_id = 'E-1019' where id = 'E-1014';
update employees set manager_id = 'E-1006' where id = 'E-1015';
update employees set manager_id = 'E-1021' where id = 'E-1016';
update employees set manager_id = 'E-1020' where id = 'E-1017';
update employees set manager_id = 'E-1006' where id = 'E-1018';
update employees set manager_id = 'E-1021' where id = 'E-1022';
update employees set manager_id = 'E-1019' where id = 'E-1023';
update employees set manager_id = 'E-1005' where id = 'E-1024';

insert into user_roles (employee_id, role) values
  ('E-1001', 'employee'), ('E-1001', 'governance_lead'),
  ('E-1002', 'employee'), ('E-1002', 'security'),
  ('E-1003', 'employee'), ('E-1003', 'privacy'),
  ('E-1004', 'employee'), ('E-1004', 'secops'),
  ('E-1005', 'employee'), ('E-1005', 'manager'),
  ('E-1006', 'employee'), ('E-1006', 'manager'),
  ('E-1007', 'employee'), ('E-1008', 'employee'), ('E-1009', 'employee'), ('E-1010', 'employee'),
  ('E-1011', 'employee'), ('E-1012', 'employee'), ('E-1013', 'employee'), ('E-1014', 'employee'),
  ('E-1015', 'employee'), ('E-1016', 'employee'), ('E-1017', 'employee'), ('E-1018', 'employee'),
  ('E-1019', 'employee'), ('E-1019', 'manager'),
  ('E-1020', 'employee'), ('E-1020', 'manager'),
  ('E-1021', 'employee'), ('E-1021', 'manager'),
  ('E-1022', 'employee'), ('E-1023', 'employee'), ('E-1024', 'employee');

insert into ai_services (id, name, vendor, category, embedded_in, status, ceiling, risk_tier, trains_on_inputs, has_dpa, retention_days, data_region, has_assurance, sso_and_audit_logs, agentic, is_default_alternative, approved_at, expires_at, conditions, owner_id, first_seen_at) values
  ('svc-northbridge-assistant', 'Northbridge Assistant', 'Assistly Inc.', 'General assistant', null, 'approved', 3, 'low', false, true, 30, 'Canada', true, true, false, true, '2026-05-01', '2027-05-01', 'Default approved tool. No Restricted data.', 'E-1001', '2026-04-10'),
  ('svc-draftpal', 'DraftPal', 'Wordwise Labs', 'Writing assistant', null, 'approved', 2, 'low', false, true, 30, 'Canada', true, true, false, false, '2026-04-01', '2027-04-01', 'Internal data only.', 'E-1019', '2026-03-15'),
  ('svc-meetnotes', 'MeetNotes AI', 'Notable Systems', 'Meeting notes', null, 'approved', 2, 'medium', false, true, 30, 'United States', true, true, false, false, '2026-04-23', '2026-10-23', 'Internal meetings only; no client calls.', 'E-1005', '2026-04-01'),
  ('svc-slidespark', 'SlideSpark', 'Deckhand Co.', 'Presentations', null, 'approved', 1, 'low', false, true, 30, 'Canada', true, true, false, false, '2026-06-15', '2027-06-15', 'Public content only.', 'E-1019', '2026-06-01'),
  ('svc-linguabridge', 'LinguaBridge', 'Polyglot GmbH', 'Translation', null, 'approved', 2, 'medium', false, true, 90, 'European Union', true, true, false, false, '2026-08-20', '2027-02-16', 'No customer correspondence.', 'E-1005', '2026-08-01'),
  ('svc-codepilot-ent', 'CodePilot Enterprise', 'Forgeworks', 'Coding assistant', null, 'approved', 3, 'low', false, true, 30, 'Canada', true, true, false, false, '2026-07-31', '2027-07-31', 'Engineering only. No production secrets.', 'E-1006', '2026-07-01'),
  ('svc-researchlens', 'ResearchLens', 'Scholarly AI', 'Research', null, 'approved', 1, 'medium', false, true, 30, 'United States', true, true, false, false, '2026-09-01', '2027-03-01', 'Public questions only.', 'E-1001', '2026-08-20'),
  ('svc-brandvoice', 'BrandVoice Studio', 'Tonality Inc.', 'Marketing copy', null, 'approved', 1, 'low', false, true, 30, 'Canada', true, true, false, false, '2026-09-10', '2027-09-10', 'Published campaigns only.', 'E-1019', '2026-09-01'),
  ('svc-helpdesk-copilot', 'HelpDesk Copilot', 'Support desk vendor', 'Ticket summaries', 'Support desk platform', 'under_review', null, 'medium', false, true, 30, 'United States', true, true, false, false, null, null, null, null, '2026-10-02'),
  ('svc-crm-insights', 'CRM Insights AI', 'CRM vendor', 'Sales insights', 'CRM platform', 'under_review', null, 'medium', false, true, 60, 'United States', true, true, false, false, null, null, null, null, '2026-10-05'),
  ('svc-sheetgenius', 'SheetGenius', 'Gridline', 'Spreadsheet AI', null, 'under_review', null, 'high', null, true, 30, 'Canada', true, true, false, false, null, null, null, null, '2026-09-28'),
  ('svc-transcripto', 'Transcripto', 'Voxa', 'Call transcription', null, 'under_review', null, 'high', false, true, null, 'Canada', true, true, false, false, null, null, null, null, '2026-10-12'),
  ('svc-summaraize', 'SummarAIze', 'Unknown', 'Summarizer', null, 'unknown', null, 'high', null, null, null, null, null, null, null, false, null, null, null, null, '2026-10-17'),
  ('svc-codebuddy', 'CodeBuddy', 'Unknown', 'Coding assistant', null, 'unknown', null, 'high', null, null, null, null, null, null, null, false, null, null, null, null, '2026-10-19'),
  ('svc-quicktranscribe', 'QuickTranscribe', 'Unknown', 'Transcription', null, 'unknown', null, 'high', null, null, null, null, null, null, null, false, null, null, null, null, '2026-10-15'),
  ('svc-pdfchat', 'PDFChat', 'Unknown', 'Document Q&A', null, 'unknown', null, 'high', null, null, null, null, null, null, null, false, null, null, null, null, '2026-10-20'),
  ('svc-mailmagic', 'MailMagic', 'Unknown', 'Email extension', null, 'unknown', null, 'high', null, null, null, null, null, null, null, false, null, null, null, null, '2026-10-11'),
  ('svc-promptbox', 'PromptBox', 'Unknown', 'Browser extension', null, 'unknown', null, 'high', null, null, null, null, null, null, null, false, null, null, null, null, '2026-10-21'),
  ('svc-imageforge', 'ImageForge', 'Unknown', 'Image generation', null, 'unknown', null, 'high', null, null, null, null, null, null, null, false, null, null, null, null, '2026-10-09'),
  ('svc-noteninja', 'NoteNinja', 'Unknown', 'Note taking', null, 'unknown', null, 'high', null, null, null, null, null, null, null, false, null, null, null, null, '2026-10-22'),
  ('svc-taxbot', 'TaxBot Lite', 'Unknown', 'Tax helper', null, 'unknown', null, 'high', null, null, null, null, null, null, null, false, null, null, null, null, '2026-10-18'),
  ('svc-chartwhiz', 'ChartWhiz', 'Unknown', 'Charting', null, 'unknown', null, 'high', null, null, null, null, null, null, null, false, null, null, null, null, '2026-10-14'),
  ('svc-freechat-pro', 'FreeChat Pro', 'FreeChat LLC', 'Consumer chatbot', null, 'prohibited', null, 'high', true, false, null, null, null, null, null, false, null, null, 'Trains on user inputs; no contract available.', null, '2026-03-02'),
  ('svc-docdump', 'DocDump AI', 'Unknown', 'Document uploader', null, 'prohibited', null, 'high', true, null, null, null, null, null, null, false, null, null, 'Public sharing of uploaded files by default.', null, '2026-05-19'),
  ('svc-autoagent-x', 'AutoAgent X', 'Unknown', 'Autonomous agent', null, 'prohibited', null, 'high', null, null, null, null, null, null, true, false, null, null, 'Acts in other systems with the user''s credentials.', null, '2026-08-07');

insert into signals (source, employee_id, service_id, observed_at) values
  ('gateway', 'E-1007', 'svc-summaraize', '2026-10-18T14:05:00.000Z'),
  ('endpoint', 'E-1007', 'svc-summaraize', '2026-10-18T14:06:00.000Z'),
  ('gateway', 'E-1011', 'svc-summaraize', '2026-10-19T16:40:00.000Z'),
  ('gateway', 'E-1012', 'svc-summaraize', '2026-10-20T13:12:00.000Z'),
  ('sso_grant', 'E-1012', 'svc-summaraize', '2026-10-20T13:13:00.000Z'),
  ('gateway', 'E-1013', 'svc-summaraize', '2026-10-21T15:22:00.000Z'),
  ('gateway', 'E-1008', 'svc-summaraize', '2026-10-22T18:03:00.000Z'),
  ('gateway', 'E-1024', 'svc-summaraize', '2026-10-23T14:47:00.000Z'),
  ('expense', 'E-1024', 'svc-summaraize', '2026-10-23T14:48:00.000Z'),
  ('endpoint', 'E-1009', 'svc-codebuddy', '2026-10-19T20:10:00.000Z'),
  ('endpoint', 'E-1015', 'svc-codebuddy', '2026-10-22T17:30:00.000Z'),
  ('gateway', 'E-1015', 'svc-codebuddy', '2026-10-22T17:31:00.000Z'),
  ('sso_grant', 'E-1008', 'svc-draftpal', '2026-10-20T15:00:00.000Z'),
  ('gateway', 'E-1008', 'svc-draftpal', '2026-10-20T15:01:00.000Z'),
  ('gateway', 'E-1014', 'svc-draftpal', '2026-10-21T19:45:00.000Z'),
  ('sso_grant', 'E-1023', 'svc-brandvoice', '2026-10-22T14:30:00.000Z'),
  ('gateway', 'E-1016', 'svc-sheetgenius', '2026-10-21T16:05:00.000Z'),
  ('expense', 'E-1016', 'svc-sheetgenius', '2026-10-21T16:06:00.000Z'),
  ('gateway', 'E-1022', 'svc-sheetgenius', '2026-10-23T13:50:00.000Z'),
  ('sso_grant', 'E-1012', 'svc-helpdesk-copilot', '2026-10-22T12:20:00.000Z'),
  ('gateway', 'E-1010', 'svc-taxbot', '2026-10-20T21:15:00.000Z'),
  ('gateway', 'E-1017', 'svc-pdfchat', '2026-10-21T18:00:00.000Z'),
  ('endpoint', 'E-1017', 'svc-pdfchat', '2026-10-21T18:01:00.000Z'),
  ('gateway', 'E-1014', 'svc-freechat-pro', '2026-10-19T22:10:00.000Z'),
  ('sso_grant', 'E-1018', 'svc-codepilot-ent', '2026-10-22T16:00:00.000Z'),
  ('gateway', 'E-1018', 'svc-codepilot-ent', '2026-10-22T16:01:00.000Z'),
  ('sso_grant', 'E-1005', 'svc-meetnotes', '2026-10-23T15:30:00.000Z'),
  ('endpoint', 'E-1019', 'svc-promptbox', '2026-10-23T19:40:00.000Z');

insert into usage_events (employee_id, service_id, observed_at, sources, declared_class) values
  ('E-1007', 'svc-summaraize', '2026-10-18T14:05:00Z', array['gateway', 'endpoint'], null),
  ('E-1011', 'svc-summaraize', '2026-10-19T16:40:00Z', array['gateway'], null),
  ('E-1012', 'svc-summaraize', '2026-10-20T13:12:00Z', array['gateway', 'sso_grant'], null),
  ('E-1013', 'svc-summaraize', '2026-10-21T15:22:00Z', array['gateway'], null),
  ('E-1008', 'svc-summaraize', '2026-10-22T18:03:00Z', array['gateway'], 2),
  ('E-1024', 'svc-summaraize', '2026-10-23T14:47:00Z', array['gateway', 'expense'], null),
  ('E-1009', 'svc-codebuddy', '2026-10-19T20:10:00Z', array['endpoint'], null),
  ('E-1015', 'svc-codebuddy', '2026-10-22T17:30:00Z', array['endpoint', 'gateway'], null),
  ('E-1008', 'svc-draftpal', '2026-10-20T15:00:00Z', array['sso_grant', 'gateway'], 2),
  ('E-1014', 'svc-draftpal', '2026-10-21T19:45:00Z', array['gateway'], 2),
  ('E-1023', 'svc-brandvoice', '2026-10-22T14:30:00Z', array['sso_grant'], 1),
  ('E-1016', 'svc-sheetgenius', '2026-10-21T16:05:00Z', array['gateway', 'expense'], null),
  ('E-1022', 'svc-sheetgenius', '2026-10-23T13:50:00Z', array['gateway'], 2),
  ('E-1012', 'svc-helpdesk-copilot', '2026-10-22T12:20:00Z', array['sso_grant'], null),
  ('E-1010', 'svc-taxbot', '2026-10-20T21:15:00Z', array['gateway'], null),
  ('E-1017', 'svc-pdfchat', '2026-10-21T18:00:00Z', array['gateway', 'endpoint'], null),
  ('E-1014', 'svc-freechat-pro', '2026-10-19T22:10:00Z', array['gateway'], 1),
  ('E-1018', 'svc-codepilot-ent', '2026-10-22T16:00:00Z', array['sso_grant', 'gateway'], 3),
  ('E-1005', 'svc-meetnotes', '2026-10-23T15:30:00Z', array['sso_grant'], 2),
  ('E-1019', 'svc-promptbox', '2026-10-23T19:40:00Z', array['endpoint'], null);

insert into decisions (at, employee_id, department_id, service_id, effective_class, class_source, action, rule, alternative_id, policy_version) values
  ('2026-10-18T14:05:00Z', 'E-1007', 'support', 'svc-summaraize', 3, 'department_default', 'redirect', 'R5', 'svc-northbridge-assistant', '1.0'),
  ('2026-10-19T16:40:00Z', 'E-1011', 'support', 'svc-summaraize', 3, 'department_default', 'redirect', 'R5', 'svc-northbridge-assistant', '1.0'),
  ('2026-10-20T13:12:00Z', 'E-1012', 'support', 'svc-summaraize', 3, 'department_default', 'redirect', 'R5', 'svc-northbridge-assistant', '1.0'),
  ('2026-10-21T15:22:00Z', 'E-1013', 'support', 'svc-summaraize', 3, 'department_default', 'redirect', 'R5', 'svc-northbridge-assistant', '1.0'),
  ('2026-10-22T18:03:00Z', 'E-1008', 'marketing', 'svc-summaraize', 2, 'label', 'coach', 'R7', 'svc-northbridge-assistant', '1.0'),
  ('2026-10-23T14:47:00Z', 'E-1024', 'support', 'svc-summaraize', 3, 'department_default', 'redirect', 'R5', 'svc-northbridge-assistant', '1.0'),
  ('2026-10-19T20:10:00Z', 'E-1009', 'engineering', 'svc-codebuddy', 3, 'department_default', 'redirect', 'R5', 'svc-northbridge-assistant', '1.0'),
  ('2026-10-22T17:30:00Z', 'E-1015', 'engineering', 'svc-codebuddy', 3, 'department_default', 'redirect', 'R5', 'svc-northbridge-assistant', '1.0'),
  ('2026-10-20T15:00:00Z', 'E-1008', 'marketing', 'svc-draftpal', 2, 'label', 'allow', 'R4', null, '1.0'),
  ('2026-10-21T19:45:00Z', 'E-1014', 'marketing', 'svc-draftpal', 2, 'label', 'allow', 'R4', null, '1.0'),
  ('2026-10-22T14:30:00Z', 'E-1023', 'marketing', 'svc-brandvoice', 1, 'label', 'allow', 'R4', null, '1.0'),
  ('2026-10-21T16:05:00Z', 'E-1016', 'finance', 'svc-sheetgenius', 3, 'department_default', 'redirect', 'R5', 'svc-northbridge-assistant', '1.0'),
  ('2026-10-23T13:50:00Z', 'E-1022', 'finance', 'svc-sheetgenius', 2, 'label', 'coach', 'R7', 'svc-northbridge-assistant', '1.0'),
  ('2026-10-22T12:20:00Z', 'E-1012', 'support', 'svc-helpdesk-copilot', 3, 'department_default', 'redirect', 'R5', 'svc-northbridge-assistant', '1.0'),
  ('2026-10-20T21:15:00Z', 'E-1010', 'credit_ops', 'svc-taxbot', 4, 'department_default', 'block', 'R6', null, '1.0'),
  ('2026-10-21T18:00:00Z', 'E-1017', 'credit_ops', 'svc-pdfchat', 4, 'department_default', 'block', 'R6', null, '1.0'),
  ('2026-10-19T22:10:00Z', 'E-1014', 'marketing', 'svc-freechat-pro', 1, 'label', 'block', 'R1', 'svc-northbridge-assistant', '1.0'),
  ('2026-10-22T16:00:00Z', 'E-1018', 'engineering', 'svc-codepilot-ent', 3, 'label', 'allow', 'R4', null, '1.0'),
  ('2026-10-23T15:30:00Z', 'E-1005', 'support', 'svc-meetnotes', 2, 'label', 'coach', 'R7', 'svc-northbridge-assistant', '1.0'),
  ('2026-10-23T19:40:00Z', 'E-1019', 'marketing', 'svc-promptbox', 2, 'department_default', 'coach', 'R7', 'svc-northbridge-assistant', '1.0');

insert into audit_log (at, actor_id, action, entity, entity_id, details) values
  ('2026-10-18T14:05:00Z', null, 'decision', 'ai_service', 'svc-summaraize', '{"employee":"E-1007","action":"redirect","rule":"R5","class":3}'::jsonb),
  ('2026-10-19T16:40:00Z', null, 'decision', 'ai_service', 'svc-summaraize', '{"employee":"E-1011","action":"redirect","rule":"R5","class":3}'::jsonb),
  ('2026-10-20T13:12:00Z', null, 'decision', 'ai_service', 'svc-summaraize', '{"employee":"E-1012","action":"redirect","rule":"R5","class":3}'::jsonb),
  ('2026-10-21T15:22:00Z', null, 'decision', 'ai_service', 'svc-summaraize', '{"employee":"E-1013","action":"redirect","rule":"R5","class":3}'::jsonb),
  ('2026-10-22T18:03:00Z', null, 'decision', 'ai_service', 'svc-summaraize', '{"employee":"E-1008","action":"coach","rule":"R7","class":2}'::jsonb),
  ('2026-10-23T14:47:00Z', null, 'decision', 'ai_service', 'svc-summaraize', '{"employee":"E-1024","action":"redirect","rule":"R5","class":3}'::jsonb),
  ('2026-10-19T20:10:00Z', null, 'decision', 'ai_service', 'svc-codebuddy', '{"employee":"E-1009","action":"redirect","rule":"R5","class":3}'::jsonb),
  ('2026-10-22T17:30:00Z', null, 'decision', 'ai_service', 'svc-codebuddy', '{"employee":"E-1015","action":"redirect","rule":"R5","class":3}'::jsonb),
  ('2026-10-20T15:00:00Z', null, 'decision', 'ai_service', 'svc-draftpal', '{"employee":"E-1008","action":"allow","rule":"R4","class":2}'::jsonb),
  ('2026-10-21T19:45:00Z', null, 'decision', 'ai_service', 'svc-draftpal', '{"employee":"E-1014","action":"allow","rule":"R4","class":2}'::jsonb),
  ('2026-10-22T14:30:00Z', null, 'decision', 'ai_service', 'svc-brandvoice', '{"employee":"E-1023","action":"allow","rule":"R4","class":1}'::jsonb),
  ('2026-10-21T16:05:00Z', null, 'decision', 'ai_service', 'svc-sheetgenius', '{"employee":"E-1016","action":"redirect","rule":"R5","class":3}'::jsonb),
  ('2026-10-23T13:50:00Z', null, 'decision', 'ai_service', 'svc-sheetgenius', '{"employee":"E-1022","action":"coach","rule":"R7","class":2}'::jsonb),
  ('2026-10-22T12:20:00Z', null, 'decision', 'ai_service', 'svc-helpdesk-copilot', '{"employee":"E-1012","action":"redirect","rule":"R5","class":3}'::jsonb),
  ('2026-10-20T21:15:00Z', null, 'decision', 'ai_service', 'svc-taxbot', '{"employee":"E-1010","action":"block","rule":"R6","class":4}'::jsonb),
  ('2026-10-21T18:00:00Z', null, 'decision', 'ai_service', 'svc-pdfchat', '{"employee":"E-1017","action":"block","rule":"R6","class":4}'::jsonb),
  ('2026-10-19T22:10:00Z', null, 'decision', 'ai_service', 'svc-freechat-pro', '{"employee":"E-1014","action":"block","rule":"R1","class":1}'::jsonb),
  ('2026-10-22T16:00:00Z', null, 'decision', 'ai_service', 'svc-codepilot-ent', '{"employee":"E-1018","action":"allow","rule":"R4","class":3}'::jsonb),
  ('2026-10-23T15:30:00Z', null, 'decision', 'ai_service', 'svc-meetnotes', '{"employee":"E-1005","action":"coach","rule":"R7","class":2}'::jsonb),
  ('2026-10-23T19:40:00Z', null, 'decision', 'ai_service', 'svc-promptbox', '{"employee":"E-1019","action":"coach","rule":"R7","class":2}'::jsonb);

insert into access_requests (id, requester_id, service_id, requested_class, route, reason, duration_days, submitted_at) values
  ('REQ-102', 'E-1012', 'svc-helpdesk-copilot', 3, 'medium', 'Summarize long ticket threads before escalation.', 90, '2026-10-20T14:00:00Z');