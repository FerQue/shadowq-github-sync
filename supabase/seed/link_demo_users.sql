-- Run after creating the six demo logins in Authentication › Users.
-- Paste each user's ID (a UUID) in place of the placeholder.
update employees set auth_user_id = '<uuid>' where id = 'E-1001';  -- Priya Nair · AI Governance Lead
update employees set auth_user_id = '<uuid>' where id = 'E-1007';  -- Marco Silva · employee (Support)
update employees set auth_user_id = '<uuid>' where id = 'E-1005';  -- Lena Fischer · Support manager (low-route approver)
update employees set auth_user_id = '<uuid>' where id = 'E-1002';  -- Daniel Osei · Security approver
update employees set auth_user_id = '<uuid>' where id = 'E-1003';  -- Amira Haddad · Privacy Officer
update employees set auth_user_id = '<uuid>' where id = 'E-1004';  -- Sam Whitford · SecOps (kill switch)
