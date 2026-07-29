-- Backup: Expert A Draft test-fixture cleanup (2026-07-28)
-- Scope: profiles.id = 69652ef7-a625-4fbc-b6fe-4cc3bc9f392a (user_id e65c8e6f-6dc0-40e0-862b-09958c8699be)
-- Captured via execute_sql (row_to_json) against production project oqrxdvwlsbwkhihsvqvt immediately before DELETE.
-- Restore: run these INSERT statements in order (auth.users -> profiles -> licenses) if rollback is needed.

-- auth.users
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at,
  email_change_token_new, email_change, email_change_sent_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at,
  phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at,
  confirmed_at, email_change_token_current, email_change_confirm_status, banned_until,
  reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous
) VALUES (
  '00000000-0000-0000-0000-000000000000', 'e65c8e6f-6dc0-40e0-862b-09958c8699be', 'authenticated', 'authenticated',
  'kikero1882@naver.com', '$2a$10$AorZaftbXYy29UN5p7OxX.W5m9fUIfzI/3HE5q2soWWBLCxO2myAi',
  '2026-07-19T03:43:53.413021+00:00', NULL, '', '2026-07-19T03:43:41.015213+00:00', '', NULL,
  '', '', NULL, '2026-07-19T13:56:44.222958+00:00',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"sub":"e65c8e6f-6dc0-40e0-862b-09958c8699be","email":"kikero1882@naver.com","email_verified":true,"phone_verified":false}'::jsonb,
  NULL, '2026-07-19T03:43:40.95811+00:00', '2026-07-19T13:56:44.242678+00:00',
  NULL, NULL, '', '', NULL,
  '2026-07-19T03:43:53.413021+00:00', '', 0, NULL,
  '', NULL, false, NULL, false
);

-- public.profiles
INSERT INTO profiles (
  id, user_id, display_name, profession, headline, introduction, total_experience_years,
  region, profile_image_path, verification_status, is_public, submitted_at, approved_at,
  created_at, updated_at, terms_agreed_at
) VALUES (
  '69652ef7-a625-4fbc-b6fe-4cc3bc9f392a', 'e65c8e6f-6dc0-40e0-862b-09958c8699be', 'Expert A Draft',
  NULL, NULL, NULL, NULL, NULL, NULL, 'draft', false, NULL, NULL,
  '2026-07-19T13:51:54.995522+00:00', '2026-07-19T13:51:54.995522+00:00', NULL
);

-- public.licenses (3 rows)
INSERT INTO licenses (
  id, profile_id, license_name, issuing_organization, acquired_date, license_number_encrypted,
  document_path_private, verification_status, is_public, created_at, updated_at, category
) VALUES
  ('1bc82fef-5bfd-4602-8a3e-8ceb7a74ee82', '69652ef7-a625-4fbc-b6fe-4cc3bc9f392a', 'PT License', NULL, NULL, NULL, NULL, 'not_submitted', false, '2026-07-19T14:11:41.926024+00:00', '2026-07-19T14:11:41.926024+00:00', NULL),
  ('8e6362e0-c5ef-408a-99d2-eefa48eb3bd4', '69652ef7-a625-4fbc-b6fe-4cc3bc9f392a', 'Kubernetes Certification', NULL, NULL, NULL, NULL, 'pending', false, '2026-07-19T17:02:03.237245+00:00', '2026-07-19T17:02:03.237245+00:00', NULL),
  ('9789a21e-0142-4bb7-9ba9-418329737b14', '69652ef7-a625-4fbc-b6fe-4cc3bc9f392a', 'Case3: Draft License', NULL, NULL, NULL, NULL, 'pending', false, '2026-07-19T17:41:24.561489+00:00', '2026-07-19T17:41:24.561489+00:00', NULL);

-- Confirmed at backup time: no rows in public.experiences / public.educations / public.workplaces / public.profile_specialties
-- reference this profile_id, and no objects in storage.objects contain this user_id in their path.
