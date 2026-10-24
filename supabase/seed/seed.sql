-- ShadowQ seed data · Northbridge Financial (fictional) · Policy Rules v1.0
-- All people, vendors and events are synthetic. Run after the schema script.
-- Demo 'today' is 2026-10-24T15:00:00Z; decisions below were computed with the same policy code.

begin;

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
  ('E-1001', 'employee'),
  ('E-1001', 'governance_lead'),
  ('E-1002', 'employee'),
  ('E-1002', 'security'),
  ('E-1003', 'employee'),
  ('E-1003', 'privacy'),
  ('E-1004', 'employee'),
  ('E-1004', 'secops'),
  ('E-1005', 'employee'),
  ('E-1005', 'manager'),
  ('E-1006', 'employee'),
  ('E-1006', 'manager'),
  ('E-1007', 'employee'),
  ('E-1008', 'employee'),
  ('E-1009', 'employee'),
  ('E-1010', 'employee'),
  ('E-1011', 'employee'),
  ('E-1012', 'employee'),
  ('E-1013', 'employee'),
  ('E-1014', 'employee'),
  ('E-1015', 'employee'),
  ('E-1016', 'employee'),
  ('E-1017', 'employee'),
  ('E-1018', 'employee'),
  ('E-1019', 'employee'),
  ('E-1019', 'manager'),
  ('E-1020', 'employee'),
  ('E-1020', 'manager'),
  ('E-1021', 'employee'),
  ('E-1021', 'manager'),
  ('E-1022', 'employee'),
  ('E-1023', 'employee'),
  ('E-1024', 'employee');

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

-- Raw signals and the deduplicated usage events built from them
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

-- Decisions for those sessions, as evaluate-usage would have written them
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

-- One open request already past its 2-business-day target (escalation demo)
insert into access_requests (id, requester_id, service_id, requested_class, route, reason, duration_days, submitted_at) values
  ('REQ-102', 'E-1012', 'svc-helpdesk-copilot', 3, 'medium', 'Summarize long ticket threads before escalation.', 90, '2026-10-20T14:00:00Z');

commit;

-- After creating the demo logins in Supabase Auth, link each one, for example:
-- update employees set auth_user_id = '<uuid from Authentication › Users>' where id = 'E-1007';  -- Marco
