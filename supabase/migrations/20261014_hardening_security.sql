-- ==========================================================
-- ATTENDER - Final Production Security Hardening Migration
-- Migration: 20261014_hardening_security.sql
-- Run this in your Supabase SQL Editor
-- ==========================================================

-- 1. Hardened SECURITY DEFINER Helper Functions (Safe search_path = '')
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMIN'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION public.is_teacher_of_class(target_class_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_teachers
    WHERE teacher_id = auth.uid() AND class_id = target_class_id
  ) OR EXISTS (
    SELECT 1 FROM public.classes
    WHERE id = target_class_id AND teacher_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION public.current_student_id()
RETURNS uuid AS $$
  SELECT id FROM public.students
  WHERE profile_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION public.current_student_class_id()
RETURNS uuid AS $$
  SELECT class_id FROM public.students
  WHERE profile_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

-- Revoke default public execution & grant strictly to authorized roles
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_teacher_of_class(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_teacher_of_class(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_class(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.current_student_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_student_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_student_id() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.current_student_class_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_student_class_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_student_class_id() TO authenticated, service_role;

-- 2. Database-Level Role Escalation & Account Linkage Protection
CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
RETURNS trigger AS $$
BEGIN
  -- If caller is authenticated and NOT an admin:
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    -- Block role escalation
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Security Violation: Only system administrators can modify user roles.';
    END IF;

    -- Block student_id tampering / account hijacking
    IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
      RAISE EXCEPTION 'Security Violation: Only system administrators can link or unlink student accounts.';
    END IF;

    -- Block ID tampering
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Security Violation: Profile user identity is immutable.';
    END IF;

    -- Block Email tampering
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Security Violation: Email address cannot be changed directly via profile update.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.protect_profile_security_fields() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_profile_security_fields() FROM anon;
GRANT EXECUTE ON FUNCTION public.protect_profile_security_fields() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_protect_profile_security_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_security_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_security_fields();

-- 3. Database-Level Student Master Record Protection (Teachers and Students cannot tamper)
CREATE OR REPLACE FUNCTION public.protect_student_master_records()
RETURNS trigger AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Security Violation: Only system administrators can insert, update, or delete student master records.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.protect_student_master_records() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_student_master_records() FROM anon;
GRANT EXECUTE ON FUNCTION public.protect_student_master_records() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_protect_student_master_records ON public.students;
CREATE TRIGGER trg_protect_student_master_records
  BEFORE INSERT OR UPDATE OR DELETE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_student_master_records();

-- 4. Database-Level Class Teacher Assignments Protection
CREATE OR REPLACE FUNCTION public.protect_class_teachers_assignments()
RETURNS trigger AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Security Violation: Only system administrators can manage teacher assignments.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.protect_class_teachers_assignments() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_class_teachers_assignments() FROM anon;
GRANT EXECUTE ON FUNCTION public.protect_class_teachers_assignments() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_protect_class_teachers ON public.class_teachers;
CREATE TRIGGER trg_protect_class_teachers
  BEFORE INSERT OR UPDATE OR DELETE ON public.class_teachers
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_class_teachers_assignments();

-- 5. Database-Level Class Creation / Modification Protection
CREATE OR REPLACE FUNCTION public.protect_classes_modifications()
RETURNS trigger AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Security Violation: Only system administrators can create, update, or delete class records.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.protect_classes_modifications() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_classes_modifications() FROM anon;
GRANT EXECUTE ON FUNCTION public.protect_classes_modifications() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_protect_classes ON public.classes;
CREATE TRIGGER trg_protect_classes
  BEFORE INSERT OR UPDATE OR DELETE ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_classes_modifications();

-- 6. Hardened Profiles RLS Policy
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
CREATE POLICY "Profiles update policy" ON public.profiles
  FOR UPDATE USING (
    public.is_admin() OR auth.uid() = id
  )
  WITH CHECK (
    public.is_admin() OR (
      auth.uid() = id 
      AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
      AND (student_id IS NOT DISTINCT FROM (SELECT p.student_id FROM public.profiles p WHERE p.id = auth.uid()))
    )
  );

-- 7. Audit Logs Immutability
REVOKE UPDATE, DELETE ON public.audit_logs FROM PUBLIC;
REVOKE UPDATE, DELETE ON public.audit_logs FROM anon;
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated;

-- 8. Hardened handle_new_user Trigger Function (search_path = '' and no public execute)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  matching_role text := 'STUDENT';
  invitation_record record;
BEGIN
  -- Strict lookup of valid, unexpired, unused invitation for the registered email
  SELECT id, role INTO invitation_record
  FROM public.invitations
  WHERE lower(email) = lower(NEW.email)
    AND expires_at > now()
    AND accepted_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF invitation_record.id IS NOT NULL THEN
    matching_role := invitation_record.role;
    UPDATE public.invitations
    SET accepted_at = now()
    WHERE id = invitation_record.id;
  END IF;

  -- Insert profile, defaulting to STUDENT unless valid invitation verified
  -- Client metadata role is IGNORED completely
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    matching_role
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email;

  INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, details)
  VALUES (
    NEW.id,
    'USER_REGISTERED',
    'PROFILE',
    NEW.id::text,
    jsonb_build_object('email', NEW.email, 'assigned_role', matching_role)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
