-- ==========================================================
-- ATTENDER: Student Enrollment, Subject-Wise Attendance,
-- Roll Number Management, Photo Handling & Rustication Hardening
-- Migration: 20261015_student_enrollment_subject_attendance.sql
-- ==========================================================

-- 1. Extend public.students with status & rustication tracking
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE'
  CHECK (status IN ('ACTIVE', 'INACTIVE', 'RUSTICATED', 'SUSPENDED'));

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS status_reason TEXT;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS status_changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Enforce unique roll number within the same active class
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_unique_roll_per_class
  ON public.students(class_id, roll_number)
  WHERE status = 'ACTIVE' AND roll_number IS NOT NULL AND roll_number != '';

-- 2. Create public.enrollment_requests table
CREATE TABLE IF NOT EXISTS public.enrollment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_reason TEXT,
  submitted_photo_url TEXT,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Prevent duplicate active (PENDING) requests for the same student/class
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_enrollment_request
  ON public.enrollment_requests(user_id, class_id)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_enrollment_requests_class ON public.enrollment_requests(class_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_requests_user ON public.enrollment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_requests_status ON public.enrollment_requests(status);

-- 3. Create public.student_enrollments table
CREATE TABLE IF NOT EXISTS public.student_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  roll_number TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'RUSTICATED')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_student_enrollment
  ON public.student_enrollments(student_id)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_student_enrollments_class ON public.student_enrollments(class_id);

-- Backfill student_enrollments from existing students
INSERT INTO public.student_enrollments (student_id, class_id, roll_number, status, enrolled_at)
SELECT id, class_id, roll_number, status, created_at
FROM public.students
WHERE class_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 4. Extend public.subjects & Create public.class_subjects
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS code TEXT;

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

-- Allow subjects to be modular across classes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' and table_name = 'subjects' and column_name = 'class_id' and is_nullable = 'NO') THEN
    ALTER TABLE public.subjects ALTER COLUMN class_id DROP NOT NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.class_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT unique_class_subject UNIQUE (class_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_class_subjects_class ON public.class_subjects(class_id);
CREATE INDEX IF NOT EXISTS idx_class_subjects_subject ON public.class_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_class_subjects_teacher ON public.class_subjects(teacher_id);

-- Backfill class_subjects from legacy subjects table
INSERT INTO public.class_subjects (class_id, subject_id, teacher_id)
SELECT class_id, id, teacher_id
FROM public.subjects
WHERE class_id IS NOT NULL
ON CONFLICT (class_id, subject_id) DO NOTHING;

-- 5. Ensure public.attendance_sessions has subject_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' and table_name = 'attendance_sessions' and column_name = 'subject_id') THEN
    ALTER TABLE public.attendance_sessions ADD COLUMN subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_subject ON public.attendance_sessions(subject_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_class_subject_date ON public.attendance_sessions(class_id, subject_id, date);

-- 6. Helper Functions for Subject & Class Authorization
CREATE OR REPLACE FUNCTION public.is_teacher_of_subject(target_class_id uuid, target_subject_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_subjects
    WHERE class_id = target_class_id AND subject_id = target_subject_id AND teacher_id = auth.uid()
  ) OR public.is_teacher_of_class(target_class_id)
  OR public.is_admin();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

REVOKE ALL ON FUNCTION public.is_teacher_of_subject(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_teacher_of_subject(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_subject(uuid, uuid) TO authenticated, service_role;

-- 7. Update Student Master Record Protection Trigger
-- Admins: full access.
-- Teachers of the class: may update photo_url and roll_number for enrolled active students in their assigned class.
-- Student himself: may update photo_url only for their own linked profile.
CREATE OR REPLACE FUNCTION public.protect_student_master_records()
RETURNS trigger AS $$
BEGIN
  -- Service role / internal server operations (auth.uid() IS NULL) always allowed
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Administrators have full authority
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Block non-admin inserts or deletes
  IF TG_OP = 'INSERT' OR TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Security Violation: Only system administrators can register or remove student master records directly.';
  END IF;

  -- Updates:
  IF TG_OP = 'UPDATE' THEN
    -- A. Check if caller is teacher of the student's class
    IF public.is_teacher_of_class(OLD.class_id) THEN
      -- Teacher can only update photo_url or roll_number, CANNOT rusticate, change class, or unlink profile
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION 'Security Violation: Teachers cannot rusticate or change student academic status.';
      END IF;
      IF NEW.class_id IS DISTINCT FROM OLD.class_id THEN
        RAISE EXCEPTION 'Security Violation: Teachers cannot transfer students across classes directly.';
      END IF;
      IF NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
        RAISE EXCEPTION 'Security Violation: Teachers cannot modify student account linkages.';
      END IF;
      RETURN NEW;
    END IF;

    -- B. Check if caller is the student themselves updating their own profile
    IF OLD.profile_id = auth.uid() THEN
      -- Student can ONLY update their own photo_url
      IF NEW.roll_number IS DISTINCT FROM OLD.roll_number THEN
        RAISE EXCEPTION 'Security Violation: Students cannot modify their roll number.';
      END IF;
      IF NEW.class_id IS DISTINCT FROM OLD.class_id THEN
        RAISE EXCEPTION 'Security Violation: Students cannot reassign their class.';
      END IF;
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION 'Security Violation: Students cannot alter their enrollment status.';
      END IF;
      IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
        RAISE EXCEPTION 'Security Violation: Students cannot alter their official full name.';
      END IF;
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Security Violation: Unauthorized update to student record.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 8. Enable Row Level Security on New Tables
ALTER TABLE public.enrollment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;

-- 9. Enrollment Requests Policies
DROP POLICY IF EXISTS "Enrollment requests select policy" ON public.enrollment_requests;
CREATE POLICY "Enrollment requests select policy" ON public.enrollment_requests
  FOR SELECT USING (
    public.is_admin()
    OR public.is_teacher_of_class(class_id)
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Enrollment requests insert policy" ON public.enrollment_requests;
CREATE POLICY "Enrollment requests insert policy" ON public.enrollment_requests
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR public.is_admin()
  );

DROP POLICY IF EXISTS "Enrollment requests update policy" ON public.enrollment_requests;
CREATE POLICY "Enrollment requests update policy" ON public.enrollment_requests
  FOR UPDATE USING (
    public.is_admin()
    OR public.is_teacher_of_class(class_id)
    OR (user_id = auth.uid() AND status = 'PENDING')
  );

DROP POLICY IF EXISTS "Enrollment requests delete policy" ON public.enrollment_requests;
CREATE POLICY "Enrollment requests delete policy" ON public.enrollment_requests
  FOR DELETE USING (
    public.is_admin() OR (user_id = auth.uid() AND status = 'PENDING')
  );

-- 10. Student Enrollments Policies
DROP POLICY IF EXISTS "Student enrollments select policy" ON public.student_enrollments;
CREATE POLICY "Student enrollments select policy" ON public.student_enrollments
  FOR SELECT USING (
    public.is_admin()
    OR public.is_teacher_of_class(class_id)
    OR student_id = public.current_student_id()
  );

DROP POLICY IF EXISTS "Student enrollments admin modify policy" ON public.student_enrollments;
CREATE POLICY "Student enrollments admin modify policy" ON public.student_enrollments
  FOR ALL USING (public.is_admin());

-- 11. Class Subjects Policies
DROP POLICY IF EXISTS "Class subjects select policy" ON public.class_subjects;
CREATE POLICY "Class subjects select policy" ON public.class_subjects
  FOR SELECT USING (
    public.is_admin()
    OR public.is_teacher_of_class(class_id)
    OR class_id = public.current_student_class_id()
  );

DROP POLICY IF EXISTS "Class subjects all policy" ON public.class_subjects;
CREATE POLICY "Class subjects all policy" ON public.class_subjects
  FOR ALL USING (public.is_admin());

-- 12. Update Attendance Sessions RLS with Subject Check
DROP POLICY IF EXISTS "Attendance sessions select policy" ON public.attendance_sessions;
CREATE POLICY "Attendance sessions select policy" ON public.attendance_sessions
  FOR SELECT USING (
    public.is_admin()
    OR public.is_teacher_of_class(class_id)
    OR class_id = public.current_student_class_id()
  );

DROP POLICY IF EXISTS "Attendance sessions insert policy" ON public.attendance_sessions;
CREATE POLICY "Attendance sessions insert policy" ON public.attendance_sessions
  FOR INSERT WITH CHECK (
    public.is_admin()
    OR (
      public.is_teacher_of_class(class_id)
      AND (subject_id IS NULL OR public.is_teacher_of_subject(class_id, subject_id))
    )
  );
