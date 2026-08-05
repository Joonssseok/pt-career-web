


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."cancel_account_deletion"() RETURNS TABLE("ok" boolean, "error" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_deletion_requested_at TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  SELECT id, deletion_requested_at INTO v_profile_id, v_deletion_requested_at
  FROM public.profiles WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT;
    RETURN;
  END IF;

  IF v_deletion_requested_at IS NULL THEN
    RETURN QUERY SELECT FALSE, 'No pending deletion request'::TEXT;
    RETURN;
  END IF;

  UPDATE public.profiles SET deletion_requested_at = NULL WHERE id = v_profile_id;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;


ALTER FUNCTION "public"."cancel_account_deletion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_max_primary_specialty"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  primary_count INTEGER;
BEGIN
  IF NEW.is_primary = true THEN
    SELECT COUNT(*) INTO primary_count
    FROM profile_specialties
    WHERE profile_id = NEW.profile_id AND is_primary = true;

    IF TG_OP = 'INSERT' THEN
      IF primary_count >= 1 THEN
        RAISE EXCEPTION 'Profile can have at most 1 primary specialty';
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.is_primary = false AND primary_count >= 1 THEN
        RAISE EXCEPTION 'Profile can have at most 1 primary specialty';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_max_primary_specialty"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_max_specialties"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  specialty_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO specialty_count
  FROM profile_specialties
  WHERE profile_id = NEW.profile_id;

  IF TG_OP = 'INSERT' THEN
    specialty_count := specialty_count + 1;
  END IF;

  IF specialty_count > 3 THEN
    RAISE EXCEPTION 'Profile cannot have more than 3 specialties';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_max_specialties"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."demote_profile_if_approved"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  IF auth.uid() IS NULL OR is_admin(auth.uid()) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(OLD) - 'owner_visible' - 'updated_at')
       IS NOT DISTINCT FROM (to_jsonb(NEW) - 'owner_visible' - 'updated_at') THEN
      RETURN NEW; -- 공개 여부만 바뀐 경우 재검토를 유발하지 않는다
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_profile_id := OLD.profile_id;
  ELSE
    v_profile_id := NEW.profile_id;
  END IF;

  UPDATE public.profiles
  SET verification_status = 'pending',
      is_public = false,
      approved_at = NULL,
      submitted_at = now()
  WHERE id = v_profile_id AND verification_status = 'approved';

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."demote_profile_if_approved"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_audit_log"("p_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_to" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_action_type" "text" DEFAULT NULL::"text", "p_admin_user_id" "uuid" DEFAULT NULL::"uuid", "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "created_at" timestamp with time zone, "action_type" "text", "memo" "text", "target_profile_id" "uuid", "target_display_name" "text", "target_license_name" "text", "admin_user_id" "uuid", "admin_email" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can view the audit log';
  END IF;

  RETURN QUERY
  SELECT
    aa.id,
    aa.created_at,
    aa.action_type,
    aa.memo,
    aa.target_profile_id,
    p.display_name,
    l.license_name,
    aa.admin_user_id,
    u.email::TEXT
  FROM public.admin_actions aa
  LEFT JOIN public.profiles p ON p.id = aa.target_profile_id
  LEFT JOIN public.licenses l ON l.id = aa.target_license_id
  LEFT JOIN auth.users u ON u.id = aa.admin_user_id
  WHERE aa.action_type IN ('profile_approved', 'profile_rejected', 'license_verified', 'license_rejected')
    AND (p_from IS NULL OR aa.created_at >= p_from)
    AND (p_to IS NULL OR aa.created_at <= p_to)
    AND (p_action_type IS NULL OR aa.action_type = p_action_type)
    AND (p_admin_user_id IS NULL OR aa.admin_user_id = p_admin_user_id)
  ORDER BY aa.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;


ALTER FUNCTION "public"."get_admin_audit_log"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_action_type" "text", "p_admin_user_id" "uuid", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_dashboard_stats"() RETURNS TABLE("total_signups" bigint, "draft_count" bigint, "pending_count" bigint, "approved_count" bigint, "rejected_count" bigint, "public_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can view dashboard stats';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM auth.users),
    (SELECT count(*) FROM public.profiles WHERE verification_status = 'draft'),
    (SELECT count(*) FROM public.profiles WHERE verification_status = 'pending'),
    (SELECT count(*) FROM public.profiles WHERE verification_status = 'approved'),
    (SELECT count(*) FROM public.profiles WHERE verification_status = 'rejected'),
    (SELECT count(*) FROM public.profiles WHERE is_public = true);
END;
$$;


ALTER FUNCTION "public"."get_admin_dashboard_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_review_kpis"() RETURNS TABLE("pending_count" bigint, "approved_count" bigint, "rejected_count" bigint, "avg_processing_hours" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can view review KPIs';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.profiles WHERE verification_status = 'pending'),
    (SELECT count(*) FROM public.admin_actions WHERE action_type = 'profile_approved'),
    (SELECT count(*) FROM public.admin_actions WHERE action_type = 'profile_rejected'),
    (
      SELECT AVG(EXTRACT(EPOCH FROM (aa.created_at - p.submitted_at)) / 3600.0)
      FROM public.admin_actions aa
      JOIN public.profiles p ON p.id = aa.target_profile_id
      WHERE aa.action_type IN ('profile_approved', 'profile_rejected')
        AND p.submitted_at IS NOT NULL
    );
END;
$$;


ALTER FUNCTION "public"."get_admin_review_kpis"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_users_list"() RETURNS TABLE("user_id" "uuid", "email" "text", "role" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can view the admin list';
  END IF;

  RETURN QUERY
  SELECT au.user_id, u.email::TEXT, au.role
  FROM public.admin_users au
  JOIN auth.users u ON u.id = au.user_id
  ORDER BY u.email;
END;
$$;


ALTER FUNCTION "public"."get_admin_users_list"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_own_rejection_reason"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_reason TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT aa.memo INTO v_reason
  FROM admin_actions aa
  JOIN profiles p ON p.id = aa.target_profile_id
  WHERE p.user_id = auth.uid()
    AND aa.action_type = 'profile_rejected'
  ORDER BY aa.created_at DESC
  LIMIT 1;

  RETURN v_reason;
END;
$$;


ALTER FUNCTION "public"."get_own_rejection_reason"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_licenses"("p_profile_id" "uuid") RETURNS TABLE("license_name" "text", "issuing_organization" "text", "acquired_date" "date", "category" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT l.license_name, l.issuing_organization, l.acquired_date, l.category
  FROM public.licenses l
  WHERE l.profile_id = p_profile_id
    AND l.verification_status = 'verified'
    AND l.is_public = true
    AND l.owner_visible = true;
$$;


ALTER FUNCTION "public"."get_public_licenses"("p_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  admin_role TEXT;
BEGIN
  SELECT role INTO admin_role
  FROM admin_users
  WHERE admin_users.user_id = $1;

  RETURN admin_role IS NOT NULL;
END;
$_$;


ALTER FUNCTION "public"."is_admin"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_profile_public_approved"("profile_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = $1 AND is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL
  );
END;
$_$;


ALTER FUNCTION "public"."is_profile_public_approved"("profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_user_profile_public_approved"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = p_user_id AND is_public = true AND verification_status = 'approved' AND deletion_requested_at IS NULL
  );
END;
$$;


ALTER FUNCTION "public"."is_user_profile_public_approved"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_license_verification"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_admin(auth.uid()) THEN
    IF NEW.verification_status = 'verified' AND OLD.verification_status != 'verified' THEN
      RAISE EXCEPTION 'Permission denied: only admins can verify licenses';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."protect_license_verification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_profile_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF current_setting('app.profile_review_removed_bypass', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND NOT is_admin(auth.uid()) THEN
    IF NEW.verification_status != OLD.verification_status THEN
      IF NOT (
        (OLD.verification_status IN ('draft', 'rejected') AND NEW.verification_status = 'pending')
        OR (OLD.verification_status = 'approved' AND NEW.verification_status = 'pending')
      ) THEN
        RAISE EXCEPTION 'Permission denied: cannot modify verification_status';
      END IF;
    END IF;
    IF NEW.is_public != OLD.is_public THEN
      IF NOT (
        OLD.verification_status = 'approved'
        AND NEW.verification_status = 'pending'
        AND NEW.is_public = false
      ) THEN
        RAISE EXCEPTION 'Permission denied: cannot modify is_public';
      END IF;
    END IF;
    IF NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      IF NOT (
        OLD.verification_status = 'approved'
        AND NEW.verification_status = 'pending'
        AND NEW.approved_at IS NULL
      ) THEN
        RAISE EXCEPTION 'Permission denied: cannot modify approved_at';
      END IF;
    END IF;
    IF NEW.user_id != OLD.user_id THEN
      RAISE EXCEPTION 'Permission denied: cannot modify user_id';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."protect_profile_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_profile_specialties"("p_specialties" "jsonb") RETURNS TABLE("ok" boolean, "error" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_status TEXT;
  v_count INT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  SELECT id, verification_status INTO v_profile_id, v_status
  FROM public.profiles WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT;
    RETURN;
  END IF;

  IF v_status NOT IN ('draft', 'rejected', 'approved') THEN
    RETURN QUERY SELECT FALSE, 'Profile status does not allow specialty modification'::TEXT;
    RETURN;
  END IF;

  IF jsonb_typeof(p_specialties) <> 'array' THEN
    RETURN QUERY SELECT FALSE, 'Invalid payload'::TEXT;
    RETURN;
  END IF;

  v_count := jsonb_array_length(p_specialties);
  IF v_count IS NULL OR v_count < 1 OR v_count > 3 THEN
    RETURN QUERY SELECT FALSE, 'Must select 1-3 specialties'::TEXT;
    RETURN;
  END IF;

  IF v_count != (SELECT COUNT(DISTINCT (s->>'specialty_id')) FROM jsonb_array_elements(p_specialties) AS s) THEN
    RETURN QUERY SELECT FALSE, 'Duplicate specialty IDs not allowed'::TEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_specialties) AS s
    WHERE NOT EXISTS (
      SELECT 1 FROM public.specialties WHERE id = (s->>'specialty_id')::uuid AND is_active = true
    )
  ) THEN
    RETURN QUERY SELECT FALSE, 'One or more specialties do not exist'::TEXT;
    RETURN;
  END IF;

  BEGIN
    DELETE FROM public.profile_specialties WHERE profile_id = v_profile_id;
    INSERT INTO public.profile_specialties (profile_id, specialty_id, is_primary, display_order, owner_visible)
    SELECT
      v_profile_id,
      (s->>'specialty_id')::uuid,
      (ord = 1),
      (ord - 1),
      COALESCE((s->>'owner_visible')::boolean, TRUE)
    FROM jsonb_array_elements(p_specialties) WITH ORDINALITY AS t(s, ord);
    RETURN QUERY SELECT TRUE, ''::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, 'Failed to update specialties'::TEXT;
  END;
END;
$$;


ALTER FUNCTION "public"."replace_profile_specialties"("p_specialties" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_account_deletion"() RETURNS TABLE("ok" boolean, "error" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_deletion_requested_at TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  IF is_admin(v_user_id) THEN
    RETURN QUERY SELECT FALSE, '관리자 계정은 이 화면에서 탈퇴할 수 없습니다'::TEXT;
    RETURN;
  END IF;

  SELECT id, deletion_requested_at INTO v_profile_id, v_deletion_requested_at
  FROM public.profiles WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT;
    RETURN;
  END IF;

  IF v_deletion_requested_at IS NULL THEN
    UPDATE public.profiles SET deletion_requested_at = now() WHERE id = v_profile_id;
  END IF;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;


ALTER FUNCTION "public"."request_account_deletion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."review_expert_profile"("p_target_user_id" "uuid", "p_decision" "text", "p_rejection_reason" "text" DEFAULT NULL::"text") RETURNS TABLE("ok" boolean, "error" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_profile_id UUID;
BEGIN
  IF NOT is_admin(v_admin_id) THEN
    RETURN QUERY SELECT FALSE, 'Only admins can review profiles'::TEXT;
    RETURN;
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RETURN QUERY SELECT FALSE, 'Decision must be "approved" or "rejected"'::TEXT;
    RETURN;
  END IF;

  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = p_target_user_id AND verification_status = 'pending';

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile must be in pending state for review'::TEXT;
    RETURN;
  END IF;

  UPDATE public.profiles
  SET verification_status = p_decision,
      approved_at = CASE WHEN p_decision = 'approved' THEN now() ELSE NULL END,
      is_public = CASE WHEN p_decision = 'approved' THEN true ELSE false END
  WHERE id = v_profile_id;

  INSERT INTO public.admin_actions (admin_user_id, target_profile_id, action_type, memo)
  VALUES (
    v_admin_id,
    v_profile_id,
    CASE WHEN p_decision = 'approved' THEN 'profile_approved' ELSE 'profile_rejected' END,
    p_rejection_reason
  );

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;


ALTER FUNCTION "public"."review_expert_profile"("p_target_user_id" "uuid", "p_decision" "text", "p_rejection_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."review_license"("p_license_id" "uuid", "p_decision" "text", "p_memo" "text" DEFAULT NULL::"text") RETURNS TABLE("ok" boolean, "error" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_profile_id uuid;
BEGIN
  IF NOT is_admin(v_admin_id) THEN
    RETURN QUERY SELECT FALSE, 'Only admins can review licenses'::TEXT; RETURN;
  END IF;

  IF p_decision NOT IN ('verified', 'rejected') THEN
    RETURN QUERY SELECT FALSE, 'Decision must be verified or rejected'::TEXT; RETURN;
  END IF;

  SELECT profile_id INTO v_profile_id FROM public.licenses WHERE id = p_license_id;
  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'License not found'::TEXT; RETURN;
  END IF;

  UPDATE public.licenses
  SET verification_status = p_decision,
      is_public = (p_decision = 'verified')
  WHERE id = p_license_id;

  INSERT INTO public.admin_actions (admin_user_id, target_profile_id, target_license_id, action_type, memo)
  VALUES (
    v_admin_id, v_profile_id, p_license_id,
    CASE WHEN p_decision = 'verified' THEN 'license_verified' ELSE 'license_rejected' END,
    p_memo
  );

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;


ALTER FUNCTION "public"."review_license"("p_license_id" "uuid", "p_decision" "text", "p_memo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_own_academic_records"("p_records" "jsonb") RETURNS TABLE("ok" boolean, "error" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  SELECT id, verification_status INTO v_profile_id, v_status
  FROM public.profiles WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT;
    RETURN;
  END IF;

  IF v_status NOT IN ('draft', 'rejected', 'approved') THEN
    RETURN QUERY SELECT FALSE, 'Profile status does not allow academic record modification'::TEXT;
    RETURN;
  END IF;

  IF jsonb_typeof(p_records) <> 'array' THEN
    RETURN QUERY SELECT FALSE, 'Invalid payload'::TEXT;
    RETURN;
  END IF;

  DELETE FROM public.academic_records WHERE profile_id = v_profile_id;

  INSERT INTO public.academic_records (
    profile_id, level, degree, school_name, major, start_date, end_date, display_order, owner_visible
  )
  SELECT
    v_profile_id,
    r->>'level',
    CASE WHEN r->>'level' = 'graduate' THEN NULLIF(r->>'degree', '') ELSE NULL END,
    r->>'school_name',
    CASE WHEN r->>'level' IN ('graduate', 'university') THEN NULLIF(r->>'major', '') ELSE NULL END,
    NULLIF(r->>'start_date', '')::DATE,
    NULLIF(r->>'end_date', '')::DATE,
    (ord - 1),
    COALESCE((r->>'owner_visible')::BOOLEAN, TRUE)
  FROM jsonb_array_elements(p_records) WITH ORDINALITY AS t(r, ord);

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;


ALTER FUNCTION "public"."save_own_academic_records"("p_records" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_own_educations"("p_educations" "jsonb") RETURNS TABLE("ok" boolean, "error" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  SELECT id, verification_status INTO v_profile_id, v_status
  FROM public.profiles WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT;
    RETURN;
  END IF;

  IF v_status NOT IN ('draft', 'rejected', 'approved') THEN
    RETURN QUERY SELECT FALSE, 'Profile status does not allow education modification'::TEXT;
    RETURN;
  END IF;

  IF jsonb_typeof(p_educations) <> 'array' THEN
    RETURN QUERY SELECT FALSE, 'Invalid payload'::TEXT;
    RETURN;
  END IF;

  DELETE FROM public.educations WHERE profile_id = v_profile_id;

  INSERT INTO public.educations (
    profile_id, education_name, organization_name, start_date, completion_date, description, display_order, owner_visible
  )
  SELECT
    v_profile_id,
    e->>'education_name',
    NULLIF(e->>'organization_name', ''),
    NULLIF(e->>'start_date', '')::DATE,
    NULLIF(e->>'completion_date', '')::DATE,
    NULLIF(e->>'description', ''),
    (ord - 1),
    COALESCE((e->>'owner_visible')::BOOLEAN, TRUE)
  FROM jsonb_array_elements(p_educations) WITH ORDINALITY AS t(e, ord);

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;


ALTER FUNCTION "public"."save_own_educations"("p_educations" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_own_experiences"("p_experiences" "jsonb") RETURNS TABLE("ok" boolean, "error" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  SELECT id, verification_status INTO v_profile_id, v_status
  FROM public.profiles WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT;
    RETURN;
  END IF;

  IF v_status NOT IN ('draft', 'rejected', 'approved') THEN
    RETURN QUERY SELECT FALSE, 'Profile status does not allow experience modification'::TEXT;
    RETURN;
  END IF;

  IF jsonb_typeof(p_experiences) <> 'array' THEN
    RETURN QUERY SELECT FALSE, 'Invalid payload'::TEXT;
    RETURN;
  END IF;

  DELETE FROM public.experiences WHERE profile_id = v_profile_id;

  INSERT INTO public.experiences (
    profile_id, organization_name, position, start_date, end_date, is_current, display_order, owner_visible
  )
  SELECT
    v_profile_id,
    e->>'organization_name',
    e->>'position',
    NULLIF(e->>'start_date', '')::DATE,
    NULLIF(e->>'end_date', '')::DATE,
    COALESCE((e->>'is_current')::BOOLEAN, FALSE),
    (ord - 1),
    COALESCE((e->>'owner_visible')::BOOLEAN, TRUE)
  FROM jsonb_array_elements(p_experiences) WITH ORDINALITY AS t(e, ord);

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;


ALTER FUNCTION "public"."save_own_experiences"("p_experiences" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_own_gallery_images"("p_images" "jsonb") RETURNS TABLE("ok" boolean, "error" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  SELECT id, verification_status INTO v_profile_id, v_status
  FROM public.profiles WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT;
    RETURN;
  END IF;

  IF v_status NOT IN ('draft', 'rejected', 'approved') THEN
    RETURN QUERY SELECT FALSE, 'Profile status does not allow gallery modification'::TEXT;
    RETURN;
  END IF;

  IF jsonb_typeof(p_images) <> 'array' THEN
    RETURN QUERY SELECT FALSE, 'Invalid payload'::TEXT;
    RETURN;
  END IF;

  IF jsonb_array_length(p_images) > 10 THEN
    RETURN QUERY SELECT FALSE, '이미지는 최대 10장까지 등록할 수 있습니다'::TEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_images) AS img
    WHERE COALESCE(img->>'image_path', '') = ''
      OR img->>'image_path' NOT LIKE v_user_id::TEXT || '/%'
  ) THEN
    RETURN QUERY SELECT FALSE, 'Invalid image path'::TEXT;
    RETURN;
  END IF;

  DELETE FROM public.profile_gallery_images WHERE profile_id = v_profile_id;

  INSERT INTO public.profile_gallery_images (
    profile_id, image_path, caption, display_order, owner_visible
  )
  SELECT
    v_profile_id,
    img->>'image_path',
    NULLIF(img->>'caption', ''),
    (ord - 1),
    COALESCE((img->>'owner_visible')::BOOLEAN, TRUE)
  FROM jsonb_array_elements(p_images) WITH ORDINALITY AS t(img, ord);

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;


ALTER FUNCTION "public"."save_own_gallery_images"("p_images" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_own_licenses"("p_licenses" "jsonb") RETURNS TABLE("ok" boolean, "error" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  SELECT id, verification_status INTO v_profile_id, v_status
  FROM public.profiles WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT;
    RETURN;
  END IF;

  IF v_status NOT IN ('draft', 'rejected', 'approved') THEN
    RETURN QUERY SELECT FALSE, 'Profile status does not allow license modification'::TEXT;
    RETURN;
  END IF;

  IF jsonb_typeof(p_licenses) <> 'array' THEN
    RETURN QUERY SELECT FALSE, 'Invalid payload'::TEXT;
    RETURN;
  END IF;

  -- Part A: evidence file is now mandatory for every license row.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_licenses) AS l
    WHERE COALESCE(l->>'document_path_private', '') = ''
  ) THEN
    RETURN QUERY SELECT FALSE, '증빙 파일이 없는 자격증은 저장할 수 없습니다'::TEXT;
    RETURN;
  END IF;

  -- Evidence files live in a private bucket under ${user_id}/; refuse paths
  -- pointing outside the caller's own folder, since this runs as the owner.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_licenses) AS l
    WHERE COALESCE(l->>'document_path_private', '') <> ''
      AND l->>'document_path_private' NOT LIKE v_user_id::TEXT || '/%'
  ) THEN
    RETURN QUERY SELECT FALSE, 'Invalid document path'::TEXT;
    RETURN;
  END IF;

  DELETE FROM public.licenses WHERE profile_id = v_profile_id;

  INSERT INTO public.licenses (
    profile_id, license_name, category, issuing_organization, acquired_date, document_path_private, owner_visible
  )
  SELECT
    v_profile_id,
    l->>'license_name',
    NULLIF(l->>'category', ''),
    NULLIF(l->>'issuing_organization', ''),
    NULLIF(l->>'acquired_date', '')::DATE,
    NULLIF(l->>'document_path_private', ''),
    COALESCE((l->>'owner_visible')::BOOLEAN, TRUE)
  FROM jsonb_array_elements(p_licenses) AS l;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$_$;


ALTER FUNCTION "public"."save_own_licenses"("p_licenses" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_own_profile"("p_display_name" "text", "p_profession" "text", "p_headline" "text", "p_introduction" "text", "p_profile_image_path" "text") RETURNS TABLE("ok" boolean, "error" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  SELECT id, verification_status INTO v_profile_id, v_status
  FROM public.profiles WHERE user_id = v_user_id;

  IF v_profile_id IS NOT NULL AND v_status = 'pending' THEN
    RETURN QUERY SELECT FALSE, 'Profile status does not allow editing'::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.profiles (user_id, display_name, profession, headline, introduction, profile_image_path)
  VALUES (v_user_id, p_display_name, p_profession, p_headline, p_introduction, p_profile_image_path)
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    profession = EXCLUDED.profession,
    headline = EXCLUDED.headline,
    introduction = EXCLUDED.introduction,
    profile_image_path = EXCLUDED.profile_image_path,
    updated_at = now();

  RETURN QUERY SELECT TRUE, ''::TEXT;
EXCEPTION WHEN check_violation THEN
  RETURN QUERY SELECT FALSE, 'Invalid profession'::TEXT;
END;
$$;


ALTER FUNCTION "public"."save_own_profile"("p_display_name" "text", "p_profession" "text", "p_headline" "text", "p_introduction" "text", "p_profile_image_path" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."profile_specialties" (
    "profile_id" "uuid" NOT NULL,
    "specialty_id" "uuid" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "owner_visible" boolean DEFAULT true NOT NULL,
    CONSTRAINT "profile_specialties_display_order_check" CHECK (("display_order" >= 0))
);


ALTER TABLE "public"."profile_specialties" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "display_name" "text",
    "profession" "text",
    "headline" "text",
    "introduction" "text",
    "total_experience_years" integer,
    "region" "text",
    "profile_image_path" "text",
    "verification_status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "is_public" boolean DEFAULT false NOT NULL,
    "submitted_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "terms_agreed_at" timestamp with time zone,
    "deletion_requested_at" timestamp with time zone,
    "owner_visible" boolean DEFAULT true NOT NULL,
    "experience_period_visible" boolean DEFAULT true NOT NULL,
    CONSTRAINT "profession_valid" CHECK ((("profession" IS NULL) OR ("profession" = ANY (ARRAY['물리치료사'::"text", '퍼스널 트레이너'::"text", '건강운동관리사'::"text", '선수트레이너'::"text", '필라테스 강사'::"text", '재활운동 전문가'::"text"])))),
    CONSTRAINT "profiles_total_experience_years_check" CHECK (("total_experience_years" >= 0)),
    CONSTRAINT "profiles_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['draft'::"text", 'pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."specialties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."specialties" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workplaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "center_name" "text" NOT NULL,
    "address" "text",
    "address_detail" "text",
    "region" "text",
    "latitude" double precision,
    "longitude" double precision,
    "phone" "text",
    "website_url" "text",
    "external_contact_url" "text",
    "is_current" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_location_public" boolean DEFAULT false NOT NULL,
    "owner_visible" boolean DEFAULT true NOT NULL,
    CONSTRAINT "workplaces_latitude_check" CHECK ((("latitude" >= ('-90'::integer)::double precision) AND ("latitude" <= (90)::double precision))),
    CONSTRAINT "workplaces_longitude_check" CHECK ((("longitude" >= ('-180'::integer)::double precision) AND ("longitude" <= (180)::double precision)))
);


ALTER TABLE "public"."workplaces" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."public_expert_list" WITH ("security_invoker"='true') AS
 SELECT "p"."id",
    "p"."display_name",
    "p"."profession",
    "p"."headline",
    "p"."total_experience_years",
    "p"."profile_image_path",
        CASE
            WHEN ("w"."is_location_public" AND "w"."owner_visible") THEN "w"."region"
            ELSE NULL::"text"
        END AS "workplace_region",
        CASE
            WHEN ("w"."is_location_public" AND "w"."owner_visible") THEN "w"."center_name"
            ELSE NULL::"text"
        END AS "workplace_center_name",
    COALESCE("spec"."specialties", '[]'::"jsonb") AS "specialties"
   FROM (("public"."profiles" "p"
     LEFT JOIN "public"."workplaces" "w" ON (("w"."profile_id" = "p"."id")))
     LEFT JOIN LATERAL ( SELECT "jsonb_agg"("jsonb_build_object"('slug', "s"."slug", 'name', "s"."name", 'is_primary', "ps"."is_primary") ORDER BY "ps"."display_order") AS "specialties"
           FROM ("public"."profile_specialties" "ps"
             JOIN "public"."specialties" "s" ON (("s"."id" = "ps"."specialty_id")))
          WHERE (("ps"."profile_id" = "p"."id") AND ("ps"."owner_visible" = true))) "spec" ON (true))
  WHERE (("p"."is_public" = true) AND ("p"."verification_status" = 'approved'::"text") AND ("p"."deletion_requested_at" IS NULL) AND ("p"."owner_visible" = true));


ALTER VIEW "public"."public_expert_list" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_public_experts"("p_profession" "text" DEFAULT NULL::"text", "p_region" "text" DEFAULT NULL::"text", "p_specialty_slug" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0) RETURNS SETOF "public"."public_expert_list"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT *
  FROM public.public_expert_list l
  WHERE (p_profession IS NULL OR l.profession = p_profession)
    AND (p_region IS NULL OR l.workplace_region = p_region)
    AND (
      p_specialty_slug IS NULL
      OR l.specialties @> jsonb_build_array(jsonb_build_object('slug', p_specialty_slug))
    )
  ORDER BY l.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;


ALTER FUNCTION "public"."search_public_experts"("p_profession" "text", "p_region" "text", "p_specialty_slug" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_own_academic_record_visibility"("p_record_id" "uuid", "p_visible" boolean) RETURNS TABLE("ok" boolean, "error" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT; RETURN;
  END IF;

  UPDATE public.academic_records ar
  SET owner_visible = p_visible
  FROM public.profiles p
  WHERE ar.id = p_record_id AND ar.profile_id = p.id AND p.user_id = v_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN QUERY SELECT FALSE, 'Academic record not found'::TEXT; RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;


ALTER FUNCTION "public"."set_own_academic_record_visibility"("p_record_id" "uuid", "p_visible" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_own_education_visibility"("p_education_id" "uuid", "p_visible" boolean) RETURNS TABLE("ok" boolean, "error" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT; RETURN;
  END IF;

  UPDATE public.educations ed
  SET owner_visible = p_visible
  FROM public.profiles p
  WHERE ed.id = p_education_id AND ed.profile_id = p.id AND p.user_id = v_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN QUERY SELECT FALSE, 'Education not found'::TEXT; RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;


ALTER FUNCTION "public"."set_own_education_visibility"("p_education_id" "uuid", "p_visible" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_own_experience_period_visibility"("p_visible" boolean) RETURNS TABLE("ok" boolean, "error" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT; RETURN;
  END IF;

  UPDATE public.profiles
  SET experience_period_visible = p_visible
  WHERE user_id = v_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT; RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;


ALTER FUNCTION "public"."set_own_experience_period_visibility"("p_visible" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_own_experience_visibility"("p_experience_id" "uuid", "p_visible" boolean) RETURNS TABLE("ok" boolean, "error" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT; RETURN;
  END IF;

  UPDATE public.experiences e
  SET owner_visible = p_visible
  FROM public.profiles p
  WHERE e.id = p_experience_id AND e.profile_id = p.id AND p.user_id = v_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN QUERY SELECT FALSE, 'Experience not found'::TEXT; RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;


ALTER FUNCTION "public"."set_own_experience_visibility"("p_experience_id" "uuid", "p_visible" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_own_gallery_image_visibility"("p_image_id" "uuid", "p_visible" boolean) RETURNS TABLE("ok" boolean, "error" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT; RETURN;
  END IF;

  UPDATE public.profile_gallery_images g
  SET owner_visible = p_visible
  FROM public.profiles p
  WHERE g.id = p_image_id AND g.profile_id = p.id AND p.user_id = v_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN QUERY SELECT FALSE, 'Image not found'::TEXT; RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;


ALTER FUNCTION "public"."set_own_gallery_image_visibility"("p_image_id" "uuid", "p_visible" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_own_license_visibility"("p_license_id" "uuid", "p_visible" boolean) RETURNS TABLE("ok" boolean, "error" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT; RETURN;
  END IF;

  UPDATE public.licenses l
  SET owner_visible = p_visible
  FROM public.profiles p
  WHERE l.id = p_license_id AND l.profile_id = p.id AND p.user_id = v_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN QUERY SELECT FALSE, 'License not found'::TEXT; RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;


ALTER FUNCTION "public"."set_own_license_visibility"("p_license_id" "uuid", "p_visible" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_own_profile_visibility"("p_visible" boolean) RETURNS TABLE("ok" boolean, "error" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT; RETURN;
  END IF;

  UPDATE public.profiles
  SET owner_visible = p_visible
  WHERE user_id = v_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT; RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;


ALTER FUNCTION "public"."set_own_profile_visibility"("p_visible" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_own_specialty_visibility"("p_specialty_id" "uuid", "p_visible" boolean) RETURNS TABLE("ok" boolean, "error" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT; RETURN;
  END IF;

  UPDATE public.profile_specialties ps
  SET owner_visible = p_visible
  FROM public.profiles p
  WHERE ps.specialty_id = p_specialty_id AND ps.profile_id = p.id AND p.user_id = v_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN QUERY SELECT FALSE, 'Specialty not found'::TEXT; RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;


ALTER FUNCTION "public"."set_own_specialty_visibility"("p_specialty_id" "uuid", "p_visible" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_own_workplace_visibility"("p_visible" boolean) RETURNS TABLE("ok" boolean, "error" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT; RETURN;
  END IF;

  UPDATE public.workplaces w
  SET owner_visible = p_visible
  FROM public.profiles p
  WHERE w.profile_id = p.id AND p.user_id = v_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN QUERY SELECT FALSE, 'Workplace not found'::TEXT; RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;


ALTER FUNCTION "public"."set_own_workplace_visibility"("p_visible" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_profile"() RETURNS TABLE("ok" boolean, "error" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_image TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  SELECT id, profile_image_path
    INTO v_profile_id, v_image
  FROM public.profiles WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile not found'::TEXT;
    RETURN;
  END IF;

  IF v_image IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Profile image is required for submission'::TEXT;
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.experiences WHERE profile_id = v_profile_id)
     AND NOT EXISTS (SELECT 1 FROM public.licenses WHERE profile_id = v_profile_id) THEN
    RETURN QUERY SELECT FALSE, 'At least one experience or license is required for submission'::TEXT;
    RETURN;
  END IF;

  PERFORM set_config('app.profile_review_removed_bypass', 'true', true);

  UPDATE public.profiles
  SET verification_status = 'approved',
      is_public = true,
      approved_at = now(),
      submitted_at = now()
  WHERE id = v_profile_id;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;


ALTER FUNCTION "public"."submit_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."academic_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "level" "text" NOT NULL,
    "degree" "text",
    "school_name" "text" NOT NULL,
    "major" "text",
    "start_date" "date",
    "end_date" "date",
    "display_order" integer DEFAULT 0 NOT NULL,
    "owner_visible" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "academic_records_degree_check" CHECK ((("degree" IS NULL) OR ("degree" = ANY (ARRAY['석사'::"text", '박사'::"text"])))),
    CONSTRAINT "academic_records_degree_scope_check" CHECK ((("level" = 'graduate'::"text") OR ("degree" IS NULL))),
    CONSTRAINT "academic_records_display_order_check" CHECK (("display_order" >= 0)),
    CONSTRAINT "academic_records_level_check" CHECK (("level" = ANY (ARRAY['graduate'::"text", 'university'::"text", 'high_school'::"text", 'middle_school'::"text"]))),
    CONSTRAINT "academic_records_major_scope_check" CHECK ((("level" = ANY (ARRAY['graduate'::"text", 'university'::"text"])) OR ("major" IS NULL)))
);


ALTER TABLE "public"."academic_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_user_id" "uuid" NOT NULL,
    "target_profile_id" "uuid",
    "target_license_id" "uuid",
    "action_type" "text" NOT NULL,
    "memo" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_actions_action_type_check" CHECK (("action_type" = ANY (ARRAY['profile_submitted'::"text", 'profile_approved'::"text", 'profile_rejected'::"text", 'license_verified'::"text", 'license_rejected'::"text", 'profile_hidden'::"text", 'profile_restored'::"text"])))
);


ALTER TABLE "public"."admin_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_users" (
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "admin_users_role_check" CHECK (("role" = ANY (ARRAY['super_admin'::"text", 'moderator'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."admin_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."educations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "education_name" "text" NOT NULL,
    "organization_name" "text",
    "completion_date" "date",
    "description" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "owner_visible" boolean DEFAULT true NOT NULL,
    "start_date" "date",
    CONSTRAINT "educations_display_order_check" CHECK (("display_order" >= 0))
);


ALTER TABLE "public"."educations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."experiences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "organization_name" "text" NOT NULL,
    "position" "text",
    "start_date" "date",
    "end_date" "date",
    "is_current" boolean DEFAULT false NOT NULL,
    "description" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "owner_visible" boolean DEFAULT true NOT NULL,
    CONSTRAINT "experiences_check" CHECK ((("end_date" IS NULL) OR ("end_date" >= "start_date"))),
    CONSTRAINT "experiences_display_order_check" CHECK (("display_order" >= 0))
);


ALTER TABLE "public"."experiences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."licenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "license_name" "text" NOT NULL,
    "issuing_organization" "text",
    "acquired_date" "date",
    "license_number_encrypted" "text",
    "document_path_private" "text",
    "verification_status" "text" DEFAULT 'not_submitted'::"text" NOT NULL,
    "is_public" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "category" "text",
    "owner_visible" boolean DEFAULT true NOT NULL,
    CONSTRAINT "licenses_category_check" CHECK (("category" = ANY (ARRAY['국가면허'::"text", '국가자격'::"text", '민간자격'::"text", '교육수료'::"text", '세미나수료'::"text", '교육활동'::"text", '봉사활동'::"text"]))),
    CONSTRAINT "licenses_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['not_submitted'::"text", 'pending'::"text", 'verified'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."licenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_gallery_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "image_path" "text" NOT NULL,
    "caption" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "owner_visible" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."profile_gallery_images" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."public_expert_detail" WITH ("security_invoker"='true') AS
 SELECT "p"."id",
    "p"."display_name",
    "p"."profession",
    "p"."headline",
    "p"."introduction",
    "p"."total_experience_years",
    "p"."profile_image_path",
        CASE
            WHEN ("w"."is_location_public" AND "w"."owner_visible") THEN "w"."region"
            ELSE NULL::"text"
        END AS "workplace_region",
        CASE
            WHEN ("w"."is_location_public" AND "w"."owner_visible") THEN "w"."center_name"
            ELSE NULL::"text"
        END AS "workplace_center_name",
        CASE
            WHEN ("w"."is_location_public" AND "w"."owner_visible") THEN "w"."website_url"
            ELSE NULL::"text"
        END AS "workplace_website_url",
    COALESCE("spec"."specialties", '[]'::"jsonb") AS "specialties",
    COALESCE("exp"."experiences", '[]'::"jsonb") AS "experiences",
    COALESCE("edu"."educations", '[]'::"jsonb") AS "educations",
    COALESCE("lic"."licenses", '[]'::"jsonb") AS "licenses",
        CASE
            WHEN ("w"."is_location_public" AND "w"."owner_visible") THEN "w"."address"
            ELSE NULL::"text"
        END AS "workplace_address",
        CASE
            WHEN ("w"."is_location_public" AND "w"."owner_visible") THEN "w"."address_detail"
            ELSE NULL::"text"
        END AS "workplace_address_detail",
        CASE
            WHEN ("w"."is_location_public" AND "w"."owner_visible") THEN "w"."phone"
            ELSE NULL::"text"
        END AS "workplace_phone",
        CASE
            WHEN ("w"."is_location_public" AND "w"."owner_visible") THEN "w"."external_contact_url"
            ELSE NULL::"text"
        END AS "workplace_external_contact_url",
        CASE
            WHEN ("w"."is_location_public" AND "w"."owner_visible") THEN "w"."latitude"
            ELSE NULL::double precision
        END AS "workplace_latitude",
        CASE
            WHEN ("w"."is_location_public" AND "w"."owner_visible") THEN "w"."longitude"
            ELSE NULL::double precision
        END AS "workplace_longitude",
    COALESCE("acad"."academic_records", '[]'::"jsonb") AS "academic_records"
   FROM (((((("public"."profiles" "p"
     LEFT JOIN "public"."workplaces" "w" ON (("w"."profile_id" = "p"."id")))
     LEFT JOIN LATERAL ( SELECT "jsonb_agg"("jsonb_build_object"('slug', "s"."slug", 'name', "s"."name", 'is_primary', "ps"."is_primary") ORDER BY "ps"."display_order") AS "specialties"
           FROM ("public"."profile_specialties" "ps"
             JOIN "public"."specialties" "s" ON (("s"."id" = "ps"."specialty_id")))
          WHERE (("ps"."profile_id" = "p"."id") AND ("ps"."owner_visible" = true))) "spec" ON (true))
     LEFT JOIN LATERAL ( SELECT "jsonb_agg"("jsonb_build_object"('level', "ar"."level", 'degree', "ar"."degree", 'school_name', "ar"."school_name", 'major', "ar"."major", 'start_date', "ar"."start_date", 'end_date', "ar"."end_date") ORDER BY "ar"."display_order") AS "academic_records"
           FROM "public"."academic_records" "ar"
          WHERE (("ar"."profile_id" = "p"."id") AND ("ar"."owner_visible" = true))) "acad" ON (true))
     LEFT JOIN LATERAL ( SELECT "jsonb_agg"("jsonb_build_object"('organization_name', "e"."organization_name", 'position', "e"."position", 'start_date',
                CASE
                    WHEN "p"."experience_period_visible" THEN "e"."start_date"
                    ELSE NULL::"date"
                END, 'end_date',
                CASE
                    WHEN "p"."experience_period_visible" THEN "e"."end_date"
                    ELSE NULL::"date"
                END, 'is_current', "e"."is_current", 'description', "e"."description") ORDER BY "e"."display_order") AS "experiences"
           FROM "public"."experiences" "e"
          WHERE (("e"."profile_id" = "p"."id") AND ("e"."owner_visible" = true))) "exp" ON (true))
     LEFT JOIN LATERAL ( SELECT "jsonb_agg"("jsonb_build_object"('education_name', "ed"."education_name", 'organization_name', "ed"."organization_name", 'completion_date', "ed"."completion_date", 'description', "ed"."description") ORDER BY "ed"."display_order") AS "educations"
           FROM "public"."educations" "ed"
          WHERE (("ed"."profile_id" = "p"."id") AND ("ed"."owner_visible" = true))) "edu" ON (true))
     LEFT JOIN LATERAL ( SELECT "jsonb_agg"("jsonb_build_object"('license_name', "gpl"."license_name", 'issuing_organization', "gpl"."issuing_organization", 'acquired_date', "gpl"."acquired_date", 'category', "gpl"."category")) AS "licenses"
           FROM "public"."get_public_licenses"("p"."id") "gpl"("license_name", "issuing_organization", "acquired_date", "category")) "lic" ON (true))
  WHERE (("p"."is_public" = true) AND ("p"."verification_status" = 'approved'::"text") AND ("p"."deletion_requested_at" IS NULL) AND ("p"."owner_visible" = true));


ALTER VIEW "public"."public_expert_detail" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."share_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "share_type" "text" NOT NULL,
    "referrer_domain" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "share_events_share_type_check" CHECK (("share_type" = ANY (ARRAY['copy_link'::"text", 'native_share'::"text", 'kakao'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."share_events" OWNER TO "postgres";


ALTER TABLE ONLY "public"."academic_records"
    ADD CONSTRAINT "academic_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_actions"
    ADD CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."educations"
    ADD CONSTRAINT "educations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."experiences"
    ADD CONSTRAINT "experiences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."licenses"
    ADD CONSTRAINT "licenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_gallery_images"
    ADD CONSTRAINT "profile_gallery_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_specialties"
    ADD CONSTRAINT "profile_specialties_pkey" PRIMARY KEY ("profile_id", "specialty_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."share_events"
    ADD CONSTRAINT "share_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."specialties"
    ADD CONSTRAINT "specialties_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."specialties"
    ADD CONSTRAINT "specialties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."specialties"
    ADD CONSTRAINT "specialties_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."specialties"
    ADD CONSTRAINT "specialties_sort_order_key" UNIQUE ("sort_order");



ALTER TABLE ONLY "public"."workplaces"
    ADD CONSTRAINT "workplaces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workplaces"
    ADD CONSTRAINT "workplaces_profile_id_key" UNIQUE ("profile_id");



CREATE INDEX "idx_academic_records_display_order" ON "public"."academic_records" USING "btree" ("display_order");



CREATE INDEX "idx_academic_records_profile_id" ON "public"."academic_records" USING "btree" ("profile_id");



CREATE INDEX "idx_admin_actions_admin_user_id" ON "public"."admin_actions" USING "btree" ("admin_user_id");



CREATE INDEX "idx_admin_actions_created_at" ON "public"."admin_actions" USING "btree" ("created_at");



CREATE INDEX "idx_admin_actions_target_license_id" ON "public"."admin_actions" USING "btree" ("target_license_id");



CREATE INDEX "idx_admin_actions_target_profile_id" ON "public"."admin_actions" USING "btree" ("target_profile_id");



CREATE INDEX "idx_admin_users_role" ON "public"."admin_users" USING "btree" ("role");



CREATE INDEX "idx_educations_display_order" ON "public"."educations" USING "btree" ("display_order");



CREATE INDEX "idx_educations_profile_id" ON "public"."educations" USING "btree" ("profile_id");



CREATE INDEX "idx_experiences_display_order" ON "public"."experiences" USING "btree" ("display_order");



CREATE INDEX "idx_experiences_profile_id" ON "public"."experiences" USING "btree" ("profile_id");



CREATE INDEX "idx_licenses_profile_id" ON "public"."licenses" USING "btree" ("profile_id");



CREATE INDEX "idx_licenses_verification_status" ON "public"."licenses" USING "btree" ("verification_status");



CREATE INDEX "idx_profile_gallery_images_profile_id" ON "public"."profile_gallery_images" USING "btree" ("profile_id");



CREATE INDEX "idx_profile_specialties_is_primary" ON "public"."profile_specialties" USING "btree" ("is_primary");



CREATE INDEX "idx_profile_specialties_specialty_id" ON "public"."profile_specialties" USING "btree" ("specialty_id");



CREATE INDEX "idx_profiles_is_public" ON "public"."profiles" USING "btree" ("is_public");



CREATE INDEX "idx_profiles_user_id" ON "public"."profiles" USING "btree" ("user_id");



CREATE INDEX "idx_profiles_verification_status" ON "public"."profiles" USING "btree" ("verification_status");



CREATE INDEX "idx_share_events_created_at" ON "public"."share_events" USING "btree" ("created_at");



CREATE INDEX "idx_share_events_profile_id" ON "public"."share_events" USING "btree" ("profile_id");



CREATE INDEX "idx_share_events_share_type" ON "public"."share_events" USING "btree" ("share_type");



CREATE INDEX "idx_specialties_is_active" ON "public"."specialties" USING "btree" ("is_active");



CREATE INDEX "idx_specialties_slug" ON "public"."specialties" USING "btree" ("slug");



CREATE INDEX "idx_workplaces_is_current" ON "public"."workplaces" USING "btree" ("is_current");



CREATE INDEX "idx_workplaces_profile_id" ON "public"."workplaces" USING "btree" ("profile_id");



CREATE OR REPLACE TRIGGER "check_max_primary_specialty_before_insert" BEFORE INSERT ON "public"."profile_specialties" FOR EACH ROW EXECUTE FUNCTION "public"."check_max_primary_specialty"();



CREATE OR REPLACE TRIGGER "check_max_primary_specialty_before_update" BEFORE UPDATE ON "public"."profile_specialties" FOR EACH ROW EXECUTE FUNCTION "public"."check_max_primary_specialty"();



CREATE OR REPLACE TRIGGER "check_max_specialties_before_insert" BEFORE INSERT ON "public"."profile_specialties" FOR EACH ROW EXECUTE FUNCTION "public"."check_max_specialties"();



CREATE OR REPLACE TRIGGER "protect_license_verification_before_update" BEFORE UPDATE ON "public"."licenses" FOR EACH ROW EXECUTE FUNCTION "public"."protect_license_verification"();



CREATE OR REPLACE TRIGGER "protect_profile_columns_before_update" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."protect_profile_columns"();



CREATE OR REPLACE TRIGGER "update_academic_records_updated_at" BEFORE UPDATE ON "public"."academic_records" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_educations_updated_at" BEFORE UPDATE ON "public"."educations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_experiences_updated_at" BEFORE UPDATE ON "public"."experiences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_licenses_updated_at" BEFORE UPDATE ON "public"."licenses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_workplaces_updated_at" BEFORE UPDATE ON "public"."workplaces" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."academic_records"
    ADD CONSTRAINT "academic_records_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_actions"
    ADD CONSTRAINT "admin_actions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("user_id");



ALTER TABLE ONLY "public"."admin_actions"
    ADD CONSTRAINT "admin_actions_target_license_id_fkey" FOREIGN KEY ("target_license_id") REFERENCES "public"."licenses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_actions"
    ADD CONSTRAINT "admin_actions_target_profile_id_fkey" FOREIGN KEY ("target_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."educations"
    ADD CONSTRAINT "educations_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."experiences"
    ADD CONSTRAINT "experiences_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."licenses"
    ADD CONSTRAINT "licenses_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_gallery_images"
    ADD CONSTRAINT "profile_gallery_images_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_specialties"
    ADD CONSTRAINT "profile_specialties_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_specialties"
    ADD CONSTRAINT "profile_specialties_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "public"."specialties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."share_events"
    ADD CONSTRAINT "share_events_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workplaces"
    ADD CONSTRAINT "workplaces_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE "public"."academic_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_actions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_all" ON "public"."academic_records" TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin_all" ON "public"."educations" TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin_all" ON "public"."experiences" TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin_all" ON "public"."licenses" TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin_all" ON "public"."profile_specialties" TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin_all" ON "public"."profiles" TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin_all" ON "public"."specialties" TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin_all" ON "public"."workplaces" TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin_delete" ON "public"."admin_users" FOR DELETE TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin_insert" ON "public"."admin_actions" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin"("auth"."uid"()) AND ("admin_user_id" IN ( SELECT "admin_users"."user_id"
   FROM "public"."admin_users"
  WHERE ("public"."is_admin"("auth"."uid"()) = true)))));



CREATE POLICY "admin_insert" ON "public"."admin_users" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin_insert" ON "public"."share_events" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin_select" ON "public"."admin_actions" FOR SELECT TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin_select" ON "public"."admin_users" FOR SELECT TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin_select" ON "public"."share_events" FOR SELECT TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin_update" ON "public"."admin_users" FOR UPDATE TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



ALTER TABLE "public"."admin_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "anon_select_public" ON "public"."academic_records" FOR SELECT TO "anon" USING ((("owner_visible" = true) AND ("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."is_public" = true) AND ("profiles"."verification_status" = 'approved'::"text") AND ("profiles"."deletion_requested_at" IS NULL) AND ("profiles"."owner_visible" = true))))));



CREATE POLICY "anon_select_public" ON "public"."educations" FOR SELECT TO "anon" USING ((("owner_visible" = true) AND ("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."is_public" = true) AND ("profiles"."verification_status" = 'approved'::"text") AND ("profiles"."deletion_requested_at" IS NULL) AND ("profiles"."owner_visible" = true))))));



CREATE POLICY "anon_select_public" ON "public"."experiences" FOR SELECT TO "anon" USING ((("owner_visible" = true) AND ("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."is_public" = true) AND ("profiles"."verification_status" = 'approved'::"text") AND ("profiles"."deletion_requested_at" IS NULL) AND ("profiles"."owner_visible" = true))))));



CREATE POLICY "anon_select_public" ON "public"."licenses" FOR SELECT TO "anon" USING ((("verification_status" = 'verified'::"text") AND ("is_public" = true) AND ("owner_visible" = true) AND ("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."is_public" = true) AND ("profiles"."verification_status" = 'approved'::"text") AND ("profiles"."deletion_requested_at" IS NULL) AND ("profiles"."owner_visible" = true))))));



CREATE POLICY "anon_select_public" ON "public"."profile_gallery_images" FOR SELECT TO "anon" USING ((("owner_visible" = true) AND ("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."is_public" = true) AND ("profiles"."verification_status" = 'approved'::"text") AND ("profiles"."deletion_requested_at" IS NULL) AND ("profiles"."owner_visible" = true))))));



CREATE POLICY "anon_select_public" ON "public"."profile_specialties" FOR SELECT TO "anon" USING ((("owner_visible" = true) AND ("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."is_public" = true) AND ("profiles"."verification_status" = 'approved'::"text") AND ("profiles"."deletion_requested_at" IS NULL) AND ("profiles"."owner_visible" = true))))));



CREATE POLICY "anon_select_public" ON "public"."profiles" FOR SELECT TO "anon" USING ((("is_public" = true) AND ("verification_status" = 'approved'::"text") AND ("deletion_requested_at" IS NULL) AND ("owner_visible" = true)));



CREATE POLICY "anon_select_public" ON "public"."workplaces" FOR SELECT TO "anon" USING ((("is_location_public" = true) AND ("owner_visible" = true) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "workplaces"."profile_id") AND ("profiles"."is_public" = true) AND ("profiles"."verification_status" = 'approved'::"text") AND ("profiles"."deletion_requested_at" IS NULL) AND ("profiles"."owner_visible" = true))))));



CREATE POLICY "auth_insert_own" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "auth_select_own" ON "public"."licenses" FOR SELECT TO "authenticated" USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("auth"."uid"() = "profiles"."user_id"))));



CREATE POLICY "auth_select_own_or_public" ON "public"."academic_records" FOR SELECT TO "authenticated" USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("auth"."uid"() = "profiles"."user_id"))));



CREATE POLICY "auth_select_own_or_public" ON "public"."educations" FOR SELECT TO "authenticated" USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("auth"."uid"() = "profiles"."user_id"))));



CREATE POLICY "auth_select_own_or_public" ON "public"."experiences" FOR SELECT TO "authenticated" USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("auth"."uid"() = "profiles"."user_id"))));



CREATE POLICY "auth_select_own_or_public" ON "public"."profile_specialties" FOR SELECT TO "authenticated" USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("auth"."uid"() = "profiles"."user_id"))));



CREATE POLICY "auth_select_own_or_public" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "auth_select_own_or_public" ON "public"."workplaces" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "workplaces"."profile_id") AND ("profiles"."user_id" = "auth"."uid"())))) OR (("is_location_public" = true) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "workplaces"."profile_id") AND ("profiles"."is_public" = true) AND ("profiles"."verification_status" = 'approved'::"text") AND ("profiles"."deletion_requested_at" IS NULL)))))));



CREATE POLICY "auth_select_public" ON "public"."academic_records" FOR SELECT TO "authenticated" USING ((("owner_visible" = true) AND ("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."is_public" = true) AND ("profiles"."verification_status" = 'approved'::"text") AND ("profiles"."deletion_requested_at" IS NULL) AND ("profiles"."owner_visible" = true))))));



CREATE POLICY "auth_select_public" ON "public"."educations" FOR SELECT TO "authenticated" USING ((("owner_visible" = true) AND ("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."is_public" = true) AND ("profiles"."verification_status" = 'approved'::"text") AND ("profiles"."deletion_requested_at" IS NULL) AND ("profiles"."owner_visible" = true))))));



CREATE POLICY "auth_select_public" ON "public"."experiences" FOR SELECT TO "authenticated" USING ((("owner_visible" = true) AND ("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."is_public" = true) AND ("profiles"."verification_status" = 'approved'::"text") AND ("profiles"."deletion_requested_at" IS NULL) AND ("profiles"."owner_visible" = true))))));



CREATE POLICY "auth_select_public" ON "public"."profile_specialties" FOR SELECT TO "authenticated" USING ((("owner_visible" = true) AND ("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."is_public" = true) AND ("profiles"."verification_status" = 'approved'::"text") AND ("profiles"."deletion_requested_at" IS NULL) AND ("profiles"."owner_visible" = true))))));



CREATE POLICY "auth_select_public" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("is_public" = true) AND ("verification_status" = 'approved'::"text") AND ("deletion_requested_at" IS NULL) AND ("owner_visible" = true)));



CREATE POLICY "auth_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "authenticated_select_public" ON "public"."profile_gallery_images" FOR SELECT TO "authenticated" USING ((("owner_visible" = true) AND ("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."is_public" = true) AND ("profiles"."verification_status" = 'approved'::"text") AND ("profiles"."deletion_requested_at" IS NULL) AND ("profiles"."owner_visible" = true))))));



CREATE POLICY "deny_delete" ON "public"."admin_actions" FOR DELETE USING (false);



CREATE POLICY "deny_delete" ON "public"."share_events" FOR DELETE USING (false);



CREATE POLICY "deny_non_admin_delete" ON "public"."admin_users" FOR DELETE USING (false);



CREATE POLICY "deny_non_admin_insert" ON "public"."admin_actions" FOR INSERT WITH CHECK (false);



CREATE POLICY "deny_non_admin_insert" ON "public"."admin_users" FOR INSERT WITH CHECK (false);



CREATE POLICY "deny_non_admin_select" ON "public"."admin_actions" FOR SELECT USING (false);



CREATE POLICY "deny_non_admin_select" ON "public"."admin_users" FOR SELECT USING (false);



CREATE POLICY "deny_non_admin_update" ON "public"."admin_users" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "deny_select" ON "public"."share_events" FOR SELECT USING (false);



CREATE POLICY "deny_update" ON "public"."admin_actions" FOR UPDATE USING (false);



CREATE POLICY "deny_update" ON "public"."share_events" FOR UPDATE USING (false);



ALTER TABLE "public"."educations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."experiences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."licenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "owner_all" ON "public"."profile_gallery_images" TO "authenticated" USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "owner_delete" ON "public"."academic_records" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "academic_records"."profile_id") AND ("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."verification_status" = ANY (ARRAY['draft'::"text", 'rejected'::"text", 'approved'::"text"]))))));



CREATE POLICY "owner_delete" ON "public"."educations" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "educations"."profile_id") AND ("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."verification_status" = ANY (ARRAY['draft'::"text", 'rejected'::"text", 'approved'::"text"]))))));



CREATE POLICY "owner_delete" ON "public"."experiences" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "experiences"."profile_id") AND ("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."verification_status" = ANY (ARRAY['draft'::"text", 'rejected'::"text", 'approved'::"text"]))))));



CREATE POLICY "owner_delete" ON "public"."licenses" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "licenses"."profile_id") AND ("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."verification_status" = ANY (ARRAY['draft'::"text", 'rejected'::"text", 'approved'::"text"]))))));



CREATE POLICY "owner_delete" ON "public"."profile_specialties" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "profile_specialties"."profile_id") AND ("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."verification_status" = ANY (ARRAY['draft'::"text", 'rejected'::"text"]))))));



CREATE POLICY "owner_delete" ON "public"."workplaces" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "workplaces"."profile_id") AND ("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."verification_status" = ANY (ARRAY['draft'::"text", 'rejected'::"text", 'approved'::"text"]))))));



CREATE POLICY "owner_insert" ON "public"."academic_records" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "academic_records"."profile_id") AND ("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."verification_status" = ANY (ARRAY['draft'::"text", 'rejected'::"text", 'approved'::"text"]))))));



CREATE POLICY "owner_insert" ON "public"."educations" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "educations"."profile_id") AND ("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."verification_status" = ANY (ARRAY['draft'::"text", 'rejected'::"text", 'approved'::"text"]))))));



CREATE POLICY "owner_insert" ON "public"."experiences" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "experiences"."profile_id") AND ("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."verification_status" = ANY (ARRAY['draft'::"text", 'rejected'::"text", 'approved'::"text"]))))));



CREATE POLICY "owner_insert" ON "public"."licenses" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "licenses"."profile_id") AND ("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."verification_status" = ANY (ARRAY['draft'::"text", 'rejected'::"text", 'approved'::"text"]))))));



CREATE POLICY "owner_insert" ON "public"."profile_specialties" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "profile_specialties"."profile_id") AND ("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."verification_status" = ANY (ARRAY['draft'::"text", 'rejected'::"text"]))))));



CREATE POLICY "owner_insert" ON "public"."workplaces" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "workplaces"."profile_id") AND ("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."verification_status" = ANY (ARRAY['draft'::"text", 'rejected'::"text", 'approved'::"text"]))))));



CREATE POLICY "owner_update" ON "public"."academic_records" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "academic_records"."profile_id") AND ("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."verification_status" = ANY (ARRAY['draft'::"text", 'rejected'::"text", 'approved'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "academic_records"."profile_id") AND ("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."verification_status" = ANY (ARRAY['draft'::"text", 'rejected'::"text", 'approved'::"text"]))))));



CREATE POLICY "owner_update" ON "public"."educations" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "educations"."profile_id") AND ("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."verification_status" = ANY (ARRAY['draft'::"text", 'rejected'::"text", 'approved'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "educations"."profile_id") AND ("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."verification_status" = ANY (ARRAY['draft'::"text", 'rejected'::"text", 'approved'::"text"]))))));



CREATE POLICY "owner_update" ON "public"."experiences" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "experiences"."profile_id") AND ("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."verification_status" = ANY (ARRAY['draft'::"text", 'rejected'::"text", 'approved'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "experiences"."profile_id") AND ("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."verification_status" = ANY (ARRAY['draft'::"text", 'rejected'::"text", 'approved'::"text"]))))));



CREATE POLICY "owner_update" ON "public"."licenses" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "licenses"."profile_id") AND ("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."verification_status" = ANY (ARRAY['draft'::"text", 'rejected'::"text", 'approved'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "licenses"."profile_id") AND ("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."verification_status" = ANY (ARRAY['draft'::"text", 'rejected'::"text", 'approved'::"text"]))))));



CREATE POLICY "owner_update" ON "public"."profile_specialties" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "profile_specialties"."profile_id") AND ("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."verification_status" = ANY (ARRAY['draft'::"text", 'rejected'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "profile_specialties"."profile_id") AND ("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."verification_status" = ANY (ARRAY['draft'::"text", 'rejected'::"text"]))))));



CREATE POLICY "owner_update" ON "public"."workplaces" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "workplaces"."profile_id") AND ("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."verification_status" = ANY (ARRAY['draft'::"text", 'rejected'::"text", 'approved'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "workplaces"."profile_id") AND ("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."verification_status" = ANY (ARRAY['draft'::"text", 'rejected'::"text", 'approved'::"text"]))))));



ALTER TABLE "public"."profile_gallery_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_specialties" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public_insert_shared_profile" ON "public"."share_events" FOR INSERT WITH CHECK ("public"."is_profile_public_approved"("profile_id"));



CREATE POLICY "public_select_active" ON "public"."specialties" FOR SELECT USING (("is_active" = true));



ALTER TABLE "public"."share_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."specialties" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workplaces" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."cancel_account_deletion"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_account_deletion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_account_deletion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_max_primary_specialty"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_max_primary_specialty"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_max_primary_specialty"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_max_specialties"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_max_specialties"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_max_specialties"() TO "service_role";



GRANT ALL ON FUNCTION "public"."demote_profile_if_approved"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."demote_profile_if_approved"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_admin_audit_log"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_action_type" "text", "p_admin_user_id" "uuid", "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_admin_audit_log"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_action_type" "text", "p_admin_user_id" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_audit_log"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_action_type" "text", "p_admin_user_id" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_admin_dashboard_stats"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_admin_dashboard_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_dashboard_stats"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_admin_review_kpis"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_admin_review_kpis"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_review_kpis"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_admin_users_list"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_admin_users_list"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_users_list"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_own_rejection_reason"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_own_rejection_reason"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_own_rejection_reason"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_licenses"("p_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_licenses"("p_profile_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_public_licenses"("p_profile_id" "uuid") TO "anon";



REVOKE ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_profile_public_approved"("profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_profile_public_approved"("profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_profile_public_approved"("profile_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_user_profile_public_approved"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_user_profile_public_approved"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_user_profile_public_approved"("p_user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."is_user_profile_public_approved"("p_user_id" "uuid") TO "anon";



GRANT ALL ON FUNCTION "public"."protect_license_verification"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_license_verification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_license_verification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_profile_columns"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_profile_columns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_profile_columns"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."replace_profile_specialties"("p_specialties" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."replace_profile_specialties"("p_specialties" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."replace_profile_specialties"("p_specialties" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."request_account_deletion"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_account_deletion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_account_deletion"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."review_expert_profile"("p_target_user_id" "uuid", "p_decision" "text", "p_rejection_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."review_expert_profile"("p_target_user_id" "uuid", "p_decision" "text", "p_rejection_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."review_expert_profile"("p_target_user_id" "uuid", "p_decision" "text", "p_rejection_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."review_license"("p_license_id" "uuid", "p_decision" "text", "p_memo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."review_license"("p_license_id" "uuid", "p_decision" "text", "p_memo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."review_license"("p_license_id" "uuid", "p_decision" "text", "p_memo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_own_academic_records"("p_records" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_own_academic_records"("p_records" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_own_academic_records"("p_records" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_own_educations"("p_educations" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_own_educations"("p_educations" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_own_educations"("p_educations" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_own_experiences"("p_experiences" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_own_experiences"("p_experiences" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_own_experiences"("p_experiences" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_own_gallery_images"("p_images" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_own_gallery_images"("p_images" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_own_gallery_images"("p_images" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_own_licenses"("p_licenses" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_own_licenses"("p_licenses" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_own_licenses"("p_licenses" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_own_profile"("p_display_name" "text", "p_profession" "text", "p_headline" "text", "p_introduction" "text", "p_profile_image_path" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_own_profile"("p_display_name" "text", "p_profession" "text", "p_headline" "text", "p_introduction" "text", "p_profile_image_path" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_own_profile"("p_display_name" "text", "p_profession" "text", "p_headline" "text", "p_introduction" "text", "p_profile_image_path" "text") TO "service_role";



GRANT ALL ON TABLE "public"."profile_specialties" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_specialties" TO "service_role";



GRANT SELECT("profile_id") ON TABLE "public"."profile_specialties" TO "anon";



GRANT SELECT("specialty_id") ON TABLE "public"."profile_specialties" TO "anon";



GRANT SELECT("is_primary") ON TABLE "public"."profile_specialties" TO "anon";



GRANT SELECT("display_order") ON TABLE "public"."profile_specialties" TO "anon";



GRANT SELECT("owner_visible") ON TABLE "public"."profile_specialties" TO "anon";
GRANT SELECT("owner_visible"),UPDATE("owner_visible") ON TABLE "public"."profile_specialties" TO "authenticated";



GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("display_name") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("profession") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("headline") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("introduction") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("total_experience_years") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("profile_image_path") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("verification_status") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("is_public") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("deletion_requested_at") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("owner_visible") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("owner_visible"),UPDATE("owner_visible") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("experience_period_visible") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT,MAINTAIN ON TABLE "public"."specialties" TO "anon";
GRANT ALL ON TABLE "public"."specialties" TO "authenticated";
GRANT ALL ON TABLE "public"."specialties" TO "service_role";



GRANT ALL ON TABLE "public"."workplaces" TO "authenticated";
GRANT ALL ON TABLE "public"."workplaces" TO "service_role";



GRANT SELECT("profile_id") ON TABLE "public"."workplaces" TO "anon";



GRANT SELECT("center_name") ON TABLE "public"."workplaces" TO "anon";



GRANT SELECT("address") ON TABLE "public"."workplaces" TO "anon";



GRANT SELECT("address_detail") ON TABLE "public"."workplaces" TO "anon";



GRANT SELECT("region") ON TABLE "public"."workplaces" TO "anon";



GRANT SELECT("latitude") ON TABLE "public"."workplaces" TO "anon";



GRANT SELECT("longitude") ON TABLE "public"."workplaces" TO "anon";



GRANT SELECT("phone") ON TABLE "public"."workplaces" TO "anon";



GRANT SELECT("website_url") ON TABLE "public"."workplaces" TO "anon";



GRANT SELECT("external_contact_url") ON TABLE "public"."workplaces" TO "anon";



GRANT SELECT("is_location_public") ON TABLE "public"."workplaces" TO "anon";



GRANT SELECT("owner_visible") ON TABLE "public"."workplaces" TO "anon";
GRANT SELECT("owner_visible"),UPDATE("owner_visible") ON TABLE "public"."workplaces" TO "authenticated";



GRANT SELECT,MAINTAIN ON TABLE "public"."public_expert_list" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."public_expert_list" TO "authenticated";
GRANT ALL ON TABLE "public"."public_expert_list" TO "service_role";



GRANT ALL ON FUNCTION "public"."search_public_experts"("p_profession" "text", "p_region" "text", "p_specialty_slug" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_public_experts"("p_profession" "text", "p_region" "text", "p_specialty_slug" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_public_experts"("p_profession" "text", "p_region" "text", "p_specialty_slug" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_own_academic_record_visibility"("p_record_id" "uuid", "p_visible" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_own_academic_record_visibility"("p_record_id" "uuid", "p_visible" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_own_academic_record_visibility"("p_record_id" "uuid", "p_visible" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_own_education_visibility"("p_education_id" "uuid", "p_visible" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_own_education_visibility"("p_education_id" "uuid", "p_visible" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_own_education_visibility"("p_education_id" "uuid", "p_visible" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_own_experience_period_visibility"("p_visible" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_own_experience_period_visibility"("p_visible" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_own_experience_period_visibility"("p_visible" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_own_experience_visibility"("p_experience_id" "uuid", "p_visible" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_own_experience_visibility"("p_experience_id" "uuid", "p_visible" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_own_experience_visibility"("p_experience_id" "uuid", "p_visible" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_own_gallery_image_visibility"("p_image_id" "uuid", "p_visible" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_own_gallery_image_visibility"("p_image_id" "uuid", "p_visible" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_own_gallery_image_visibility"("p_image_id" "uuid", "p_visible" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_own_license_visibility"("p_license_id" "uuid", "p_visible" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_own_license_visibility"("p_license_id" "uuid", "p_visible" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_own_license_visibility"("p_license_id" "uuid", "p_visible" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_own_profile_visibility"("p_visible" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_own_profile_visibility"("p_visible" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_own_profile_visibility"("p_visible" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_own_specialty_visibility"("p_specialty_id" "uuid", "p_visible" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_own_specialty_visibility"("p_specialty_id" "uuid", "p_visible" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_own_specialty_visibility"("p_specialty_id" "uuid", "p_visible" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_own_workplace_visibility"("p_visible" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_own_workplace_visibility"("p_visible" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_own_workplace_visibility"("p_visible" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_profile"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."academic_records" TO "authenticated";
GRANT ALL ON TABLE "public"."academic_records" TO "service_role";



GRANT SELECT("profile_id") ON TABLE "public"."academic_records" TO "anon";



GRANT SELECT("level") ON TABLE "public"."academic_records" TO "anon";



GRANT SELECT("degree") ON TABLE "public"."academic_records" TO "anon";



GRANT SELECT("school_name") ON TABLE "public"."academic_records" TO "anon";



GRANT SELECT("major") ON TABLE "public"."academic_records" TO "anon";



GRANT SELECT("start_date") ON TABLE "public"."academic_records" TO "anon";



GRANT SELECT("end_date") ON TABLE "public"."academic_records" TO "anon";



GRANT SELECT("display_order") ON TABLE "public"."academic_records" TO "anon";



GRANT SELECT("owner_visible") ON TABLE "public"."academic_records" TO "anon";



GRANT ALL ON TABLE "public"."admin_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_actions" TO "service_role";



GRANT ALL ON TABLE "public"."admin_users" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_users" TO "service_role";



GRANT ALL ON TABLE "public"."educations" TO "authenticated";
GRANT ALL ON TABLE "public"."educations" TO "service_role";



GRANT SELECT("profile_id") ON TABLE "public"."educations" TO "anon";



GRANT SELECT("education_name") ON TABLE "public"."educations" TO "anon";



GRANT SELECT("organization_name") ON TABLE "public"."educations" TO "anon";



GRANT SELECT("completion_date") ON TABLE "public"."educations" TO "anon";



GRANT SELECT("description") ON TABLE "public"."educations" TO "anon";



GRANT SELECT("display_order") ON TABLE "public"."educations" TO "anon";



GRANT SELECT("owner_visible") ON TABLE "public"."educations" TO "anon";
GRANT SELECT("owner_visible"),UPDATE("owner_visible") ON TABLE "public"."educations" TO "authenticated";



GRANT ALL ON TABLE "public"."experiences" TO "authenticated";
GRANT ALL ON TABLE "public"."experiences" TO "service_role";



GRANT SELECT("profile_id") ON TABLE "public"."experiences" TO "anon";



GRANT SELECT("organization_name") ON TABLE "public"."experiences" TO "anon";



GRANT SELECT("position") ON TABLE "public"."experiences" TO "anon";



GRANT SELECT("start_date") ON TABLE "public"."experiences" TO "anon";



GRANT SELECT("end_date") ON TABLE "public"."experiences" TO "anon";



GRANT SELECT("is_current") ON TABLE "public"."experiences" TO "anon";



GRANT SELECT("description") ON TABLE "public"."experiences" TO "anon";



GRANT SELECT("display_order") ON TABLE "public"."experiences" TO "anon";



GRANT SELECT("owner_visible") ON TABLE "public"."experiences" TO "anon";
GRANT SELECT("owner_visible"),UPDATE("owner_visible") ON TABLE "public"."experiences" TO "authenticated";



GRANT ALL ON TABLE "public"."licenses" TO "authenticated";
GRANT ALL ON TABLE "public"."licenses" TO "service_role";



GRANT SELECT("profile_id") ON TABLE "public"."licenses" TO "anon";



GRANT SELECT("license_name") ON TABLE "public"."licenses" TO "anon";



GRANT SELECT("issuing_organization") ON TABLE "public"."licenses" TO "anon";



GRANT SELECT("acquired_date") ON TABLE "public"."licenses" TO "anon";



GRANT SELECT("verification_status") ON TABLE "public"."licenses" TO "anon";



GRANT SELECT("is_public") ON TABLE "public"."licenses" TO "anon";



GRANT SELECT("category") ON TABLE "public"."licenses" TO "anon";



GRANT SELECT("owner_visible") ON TABLE "public"."licenses" TO "anon";
GRANT SELECT("owner_visible"),UPDATE("owner_visible") ON TABLE "public"."licenses" TO "authenticated";



GRANT ALL ON TABLE "public"."profile_gallery_images" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_gallery_images" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."profile_gallery_images" TO "anon";
GRANT SELECT("id") ON TABLE "public"."profile_gallery_images" TO "authenticated";



GRANT SELECT("profile_id") ON TABLE "public"."profile_gallery_images" TO "anon";
GRANT SELECT("profile_id") ON TABLE "public"."profile_gallery_images" TO "authenticated";



GRANT SELECT("image_path") ON TABLE "public"."profile_gallery_images" TO "anon";
GRANT SELECT("image_path") ON TABLE "public"."profile_gallery_images" TO "authenticated";



GRANT SELECT("caption") ON TABLE "public"."profile_gallery_images" TO "anon";
GRANT SELECT("caption") ON TABLE "public"."profile_gallery_images" TO "authenticated";



GRANT SELECT("display_order") ON TABLE "public"."profile_gallery_images" TO "anon";
GRANT SELECT("display_order") ON TABLE "public"."profile_gallery_images" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."profile_gallery_images" TO "anon";
GRANT SELECT("created_at") ON TABLE "public"."profile_gallery_images" TO "authenticated";



GRANT SELECT("owner_visible") ON TABLE "public"."profile_gallery_images" TO "anon";
GRANT SELECT("owner_visible"),UPDATE("owner_visible") ON TABLE "public"."profile_gallery_images" TO "authenticated";



GRANT SELECT,MAINTAIN ON TABLE "public"."public_expert_detail" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."public_expert_detail" TO "authenticated";
GRANT ALL ON TABLE "public"."public_expert_detail" TO "service_role";



GRANT ALL ON TABLE "public"."share_events" TO "service_role";
GRANT INSERT ON TABLE "public"."share_events" TO "authenticated";
GRANT INSERT ON TABLE "public"."share_events" TO "anon";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































