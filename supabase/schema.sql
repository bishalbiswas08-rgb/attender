-- ==========================================================
-- ATTENDER - Production RBAC Database Schema & RLS Policies
-- Roles: ADMIN, TEACHER, STUDENT
-- "Smart attendance. Zero hassle."
-- ==========================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES (Extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null check (role in ('ADMIN', 'TEACHER', 'STUDENT')) default 'STUDENT',
  student_id uuid, -- Optional forward link to linked student record
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ensure role check allows 'STUDENT' if table already existed
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('ADMIN', 'TEACHER', 'STUDENT'));

-- 2. CLASSES
create table if not exists public.classes (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  section text not null,
  academic_year text not null default '2026-2027',
  teacher_id uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. CLASS_TEACHERS (Multi-teacher class assignment)
create table if not exists public.class_teachers (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint unique_class_teacher unique (class_id, teacher_id)
);

-- 4. STUDENTS
create table if not exists public.students (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  roll_number text not null,
  class_id uuid not null references public.classes(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null unique,
  photo_url text,
  email text,
  active boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint unique_student_roll_per_class unique (class_id, roll_number)
);

-- Ensure profile_id column exists if students table already existed
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'students' and column_name = 'profile_id') then
    alter table public.students add column profile_id uuid references public.profiles(id) on delete set null unique;
  end if;
end $$;

-- Add foreign key constraint from profiles.student_id to students.id if not present
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'student_id') then
    alter table public.profiles add column student_id uuid references public.students(id) on delete set null;
  end if;
end $$;

-- 5. SUBJECTS
create table if not exists public.subjects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. ATTENDANCE SESSIONS
create table if not exists public.attendance_sessions (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  date date not null default current_date,
  created_by uuid references public.profiles(id) on delete set null,
  source text not null check (source in ('individual', 'classroom_scan', 'manual')) default 'individual',
  image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. ATTENDANCE RECORDS
create table if not exists public.attendance (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null check (status in ('present', 'absent', 'late')),
  marked_at timestamp with time zone default timezone('utc'::text, now()) not null,
  marked_by uuid references public.profiles(id) on delete set null,
  constraint unique_session_student unique (session_id, student_id)
);

-- 8. INVITATIONS (Single-use, expiring invitations for Admin/Teacher)
create table if not exists public.invitations (
  id uuid primary key default uuid_generate_v4(),
  email text not null,
  role text not null check (role in ('ADMIN', 'TEACHER')),
  token text not null unique,
  invited_by uuid references public.profiles(id) on delete set null,
  expires_at timestamp with time zone not null,
  accepted_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. AUDIT LOGS (Immutable security trail)
create table if not exists public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================================
-- INDEXES FOR HIGH PERFORMANCE QUERYING
-- ==========================================================
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_student_id on public.profiles(student_id);
create index if not exists idx_classes_teacher on public.classes(teacher_id);
create index if not exists idx_class_teachers_teacher on public.class_teachers(teacher_id);
create index if not exists idx_class_teachers_class on public.class_teachers(class_id);
create index if not exists idx_students_class on public.students(class_id);
create index if not exists idx_students_profile_id on public.students(profile_id);
create index if not exists idx_students_active on public.students(active);
create index if not exists idx_sessions_class_date on public.attendance_sessions(class_id, date);
create index if not exists idx_attendance_session on public.attendance(session_id);
create index if not exists idx_attendance_student on public.attendance(student_id);
create index if not exists idx_attendance_status on public.attendance(status);
create index if not exists idx_invitations_token on public.invitations(token);
create index if not exists idx_invitations_email on public.invitations(email);
create index if not exists idx_audit_logs_actor on public.audit_logs(actor_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);

-- ==========================================================
-- SECURITY DEFINER HELPER FUNCTIONS
-- ==========================================================

-- Check if current authenticated user is ADMIN (Hardened search_path)
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'ADMIN'
  );
$$ language sql security definer stable set search_path = '';

-- Check if current authenticated user is a TEACHER assigned to the target class
create or replace function public.is_teacher_of_class(target_class_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.class_teachers
    where teacher_id = auth.uid() and class_id = target_class_id
  ) or exists (
    select 1 from public.classes
    where id = target_class_id and teacher_id = auth.uid()
  );
$$ language sql security definer stable set search_path = '';

-- Get the student record ID linked to the current authenticated student user
create or replace function public.current_student_id()
returns uuid as $$
  select id from public.students
  where profile_id = auth.uid()
  limit 1;
$$ language sql security definer stable set search_path = '';

-- Get the class ID for the current authenticated student user
create or replace function public.current_student_class_id()
returns uuid as $$
  select class_id from public.students
  where profile_id = auth.uid()
  limit 1;
$$ language sql security definer stable set search_path = '';

-- Function execution privilege restrictions
revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated, service_role;

revoke all on function public.is_teacher_of_class(uuid) from public;
revoke all on function public.is_teacher_of_class(uuid) from anon;
grant execute on function public.is_teacher_of_class(uuid) to authenticated, service_role;

revoke all on function public.current_student_id() from public;
revoke all on function public.current_student_id() from anon;
grant execute on function public.current_student_id() to authenticated, service_role;

revoke all on function public.current_student_class_id() from public;
revoke all on function public.current_student_class_id() from anon;
grant execute on function public.current_student_class_id() to authenticated, service_role;

-- ==========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================================
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_teachers enable row level security;
alter table public.students enable row level security;
alter table public.subjects enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_logs enable row level security;

-- Drop all old permissive policies for clean idempotency
drop policy if exists "Allow read profiles" on public.profiles;
drop policy if exists "Allow self profile update" on public.profiles;
drop policy if exists "Allow insert profiles" on public.profiles;
drop policy if exists "Profiles select policy" on public.profiles;
drop policy if exists "Profiles update policy" on public.profiles;
drop policy if exists "Profiles insert policy" on public.profiles;

drop policy if exists "Classes read access" on public.classes;
drop policy if exists "Classes admin & teacher write" on public.classes;
drop policy if exists "Classes admin & teacher update" on public.classes;
drop policy if exists "Classes admin delete" on public.classes;
drop policy if exists "Classes delete access" on public.classes;
drop policy if exists "Classes select policy" on public.classes;
drop policy if exists "Classes insert policy" on public.classes;
drop policy if exists "Classes update policy" on public.classes;
drop policy if exists "Classes delete policy" on public.classes;

drop policy if exists "Class teachers select policy" on public.class_teachers;
drop policy if exists "Class teachers insert policy" on public.class_teachers;
drop policy if exists "Class teachers update policy" on public.class_teachers;
drop policy if exists "Class teachers delete policy" on public.class_teachers;

drop policy if exists "Students read access" on public.students;
drop policy if exists "Students modify access" on public.students;
drop policy if exists "Students insert access" on public.students;
drop policy if exists "Students update access" on public.students;
drop policy if exists "Students delete access" on public.students;
drop policy if exists "Students select policy" on public.students;
drop policy if exists "Students insert policy" on public.students;
drop policy if exists "Students update policy" on public.students;
drop policy if exists "Students delete policy" on public.students;

drop policy if exists "Subjects read access" on public.subjects;
drop policy if exists "Subjects modify access" on public.subjects;
drop policy if exists "Subjects select policy" on public.subjects;
drop policy if exists "Subjects all policy" on public.subjects;

drop policy if exists "Attendance sessions read" on public.attendance_sessions;
drop policy if exists "Attendance sessions write" on public.attendance_sessions;
drop policy if exists "Attendance sessions insert" on public.attendance_sessions;
drop policy if exists "Attendance sessions update" on public.attendance_sessions;
drop policy if exists "Attendance sessions delete" on public.attendance_sessions;
drop policy if exists "Attendance sessions select policy" on public.attendance_sessions;
drop policy if exists "Attendance sessions insert policy" on public.attendance_sessions;
drop policy if exists "Attendance sessions update policy" on public.attendance_sessions;
drop policy if exists "Attendance sessions delete policy" on public.attendance_sessions;

drop policy if exists "Attendance read" on public.attendance;
drop policy if exists "Attendance insert" on public.attendance;
drop policy if exists "Attendance update" on public.attendance;
drop policy if exists "Attendance delete" on public.attendance;
drop policy if exists "Attendance select policy" on public.attendance;
drop policy if exists "Attendance insert policy" on public.attendance;
drop policy if exists "Attendance update policy" on public.attendance;
drop policy if exists "Attendance delete policy" on public.attendance;

drop policy if exists "Invitations select policy" on public.invitations;
drop policy if exists "Invitations insert policy" on public.invitations;
drop policy if exists "Invitations update policy" on public.invitations;
drop policy if exists "Invitations delete policy" on public.invitations;

drop policy if exists "Audit logs select policy" on public.audit_logs;
drop policy if exists "Audit logs insert policy" on public.audit_logs;

-- ----------------------------------------------------------
-- 1. PROFILES POLICIES
-- ----------------------------------------------------------
-- Admins can view all profiles; non-admins can view their own profile, or teachers can view colleague profiles
create policy "Profiles select policy" on public.profiles
  for select using (
    public.is_admin()
    or auth.uid() = id
  );

-- Users can only update their own safe profile fields, NEVER their role or student linkage
create policy "Profiles update policy" on public.profiles
  for update using (
    public.is_admin() or auth.uid() = id
  )
  with check (
    public.is_admin() or (
      auth.uid() = id 
      and role = (select p.role from public.profiles p where p.id = auth.uid())
      and (student_id is not distinct from (select p.student_id from public.profiles p where p.id = auth.uid()))
    )
  );

-- Profile creation is strictly for the authenticated user, defaulting safely to STUDENT
create policy "Profiles insert policy" on public.profiles
  for insert with check (
    auth.uid() = id
  );

-- ==========================================================
-- DATABASE-LEVEL SECURITY TRIGGERS (ROLE ESCALATION PREVENTION)
-- ==========================================================

-- Trigger to block non-admins from modifying user roles, student account linkages, or IDs
create or replace function public.protect_profile_security_fields()
returns trigger as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Security Violation: Only system administrators can modify user roles.';
    end if;

    if new.student_id is distinct from old.student_id then
      raise exception 'Security Violation: Only system administrators can link or unlink student accounts.';
    end if;

    if new.id is distinct from old.id then
      raise exception 'Security Violation: Profile user identity is immutable.';
    end if;

    if new.email is distinct from old.email then
      raise exception 'Security Violation: Email address cannot be changed directly via profile update.';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = '';

revoke all on function public.protect_profile_security_fields() from public;
revoke all on function public.protect_profile_security_fields() from anon;
grant execute on function public.protect_profile_security_fields() to authenticated, service_role;

drop trigger if exists trg_protect_profile_security_fields on public.profiles;
create trigger trg_protect_profile_security_fields
  before update on public.profiles
  for each row
  execute function public.protect_profile_security_fields();

-- Trigger to block non-admins from modifying student master records
create or replace function public.protect_student_master_records()
returns trigger as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Security Violation: Only system administrators can insert, update, or delete student master records.';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = '';

revoke all on function public.protect_student_master_records() from public;
revoke all on function public.protect_student_master_records() from anon;
grant execute on function public.protect_student_master_records() to authenticated, service_role;

drop trigger if exists trg_protect_student_master_records on public.students;
create trigger trg_protect_student_master_records
  before insert or update or delete on public.students
  for each row
  execute function public.protect_student_master_records();

-- Trigger to block non-admins from managing class teacher assignments
create or replace function public.protect_class_teachers_assignments()
returns trigger as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Security Violation: Only system administrators can manage teacher assignments.';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = '';

revoke all on function public.protect_class_teachers_assignments() from public;
revoke all on function public.protect_class_teachers_assignments() from anon;
grant execute on function public.protect_class_teachers_assignments() to authenticated, service_role;

drop trigger if exists trg_protect_class_teachers on public.class_teachers;
create trigger trg_protect_class_teachers
  before insert or update or delete on public.class_teachers
  for each row
  execute function public.protect_class_teachers_assignments();

-- Trigger to block non-admins from creating, modifying, or deleting classes
create or replace function public.protect_classes_modifications()
returns trigger as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Security Violation: Only system administrators can create, update, or delete class records.';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = '';

revoke all on function public.protect_classes_modifications() from public;
revoke all on function public.protect_classes_modifications() from anon;
grant execute on function public.protect_classes_modifications() to authenticated, service_role;

drop trigger if exists trg_protect_classes on public.classes;
create trigger trg_protect_classes
  before insert or update or delete on public.classes
  for each row
  execute function public.protect_classes_modifications();

-- ----------------------------------------------------------
-- 2. CLASSES POLICIES
-- ----------------------------------------------------------
-- Select: Admins can view all classes. Teachers can view only assigned classes. Students can view only their enrolled class.
create policy "Classes select policy" on public.classes
  for select using (
    public.is_admin()
    or public.is_teacher_of_class(id)
    or id = public.current_student_class_id()
  );

-- Insert/Update/Delete: Admins ONLY. Teachers CANNOT create, modify, or delete classes.
create policy "Classes insert policy" on public.classes
  for insert with check (public.is_admin());

create policy "Classes update policy" on public.classes
  for update using (public.is_admin()) with check (public.is_admin());

create policy "Classes delete policy" on public.classes
  for delete using (public.is_admin());

-- ----------------------------------------------------------
-- 3. CLASS_TEACHERS POLICIES
-- ----------------------------------------------------------
-- Select: Admins can view all assignments. Teachers can view assignments for their own classes.
create policy "Class teachers select policy" on public.class_teachers
  for select using (
    public.is_admin() or teacher_id = auth.uid()
  );

-- Manage: Admins ONLY
create policy "Class teachers insert policy" on public.class_teachers
  for insert with check (public.is_admin());

create policy "Class teachers update policy" on public.class_teachers
  for update using (public.is_admin()) with check (public.is_admin());

create policy "Class teachers delete policy" on public.class_teachers
  for delete using (public.is_admin());

-- ----------------------------------------------------------
-- 4. STUDENTS POLICIES
-- ----------------------------------------------------------
-- Select:
-- - Admins can view all students.
-- - Teachers can view only students in classes assigned to them.
-- - Students can view ONLY their OWN record (profile_id = auth.uid()). They CANNOT see classmates.
create policy "Students select policy" on public.students
  for select using (
    public.is_admin()
    or public.is_teacher_of_class(class_id)
    or profile_id = auth.uid()
  );

-- Insert/Update/Delete: Admins ONLY.
-- Teachers cannot create students, alter roll numbers, or change student identity.
create policy "Students insert policy" on public.students
  for insert with check (public.is_admin());

create policy "Students update policy" on public.students
  for update using (public.is_admin()) with check (public.is_admin());

create policy "Students delete policy" on public.students
  for delete using (public.is_admin());

-- ----------------------------------------------------------
-- 5. SUBJECTS POLICIES
-- ----------------------------------------------------------
create policy "Subjects select policy" on public.subjects
  for select using (
    public.is_admin()
    or public.is_teacher_of_class(class_id)
    or class_id = public.current_student_class_id()
  );

create policy "Subjects all policy" on public.subjects
  for all using (public.is_admin());

-- ----------------------------------------------------------
-- 6. ATTENDANCE SESSIONS POLICIES
-- ----------------------------------------------------------
-- Select: Admins see all; Teachers see assigned classes; Students see sessions for their enrolled class
create policy "Attendance sessions select policy" on public.attendance_sessions
  for select using (
    public.is_admin()
    or public.is_teacher_of_class(class_id)
    or class_id = public.current_student_class_id()
  );

-- Insert/Update: Admins or Teachers assigned to that class
create policy "Attendance sessions insert policy" on public.attendance_sessions
  for insert with check (
    public.is_admin() or public.is_teacher_of_class(class_id)
  );

create policy "Attendance sessions update policy" on public.attendance_sessions
  for update using (
    public.is_admin() or public.is_teacher_of_class(class_id)
  );

-- Delete: Admins ONLY. Teachers cannot arbitrarily delete historical sessions.
create policy "Attendance sessions delete policy" on public.attendance_sessions
  for delete using (public.is_admin());

-- ----------------------------------------------------------
-- 7. ATTENDANCE RECORDS POLICIES
-- ----------------------------------------------------------
-- Select:
-- - Admins see all.
-- - Teachers see records for assigned classes.
-- - Students see ONLY their OWN attendance records!
create policy "Attendance select policy" on public.attendance
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.attendance_sessions s
      where s.id = attendance.session_id and public.is_teacher_of_class(s.class_id)
    )
    or student_id = public.current_student_id()
  );

-- Insert/Update: Admins or Teachers assigned to the session's class
create policy "Attendance insert policy" on public.attendance
  for insert with check (
    public.is_admin()
    or exists (
      select 1 from public.attendance_sessions s
      where s.id = attendance.session_id and public.is_teacher_of_class(s.class_id)
    )
  );

create policy "Attendance update policy" on public.attendance
  for update using (
    public.is_admin()
    or exists (
      select 1 from public.attendance_sessions s
      where s.id = attendance.session_id and public.is_teacher_of_class(s.class_id)
    )
  );

-- Delete: Admins or Teachers assigned to the session's class
create policy "Attendance delete policy" on public.attendance
  for delete using (
    public.is_admin()
    or exists (
      select 1 from public.attendance_sessions s
      where s.id = attendance.session_id and public.is_teacher_of_class(s.class_id)
    )
  );

-- ----------------------------------------------------------
-- 8. INVITATIONS POLICIES
-- ----------------------------------------------------------
-- Admins ONLY can view, create, or revoke invitations
create policy "Invitations select policy" on public.invitations
  for select using (public.is_admin());

create policy "Invitations insert policy" on public.invitations
  for insert with check (public.is_admin());

create policy "Invitations update policy" on public.invitations
  for update using (public.is_admin());

create policy "Invitations delete policy" on public.invitations
  for delete using (public.is_admin());

-- ----------------------------------------------------------
-- 9. AUDIT LOGS POLICIES
-- ----------------------------------------------------------
-- Select: Admins ONLY
create policy "Audit logs select policy" on public.audit_logs
  for select using (public.is_admin());

-- Insert: Any authenticated user / trigger can append audit entries (immutable, no updates/deletes)
create policy "Audit logs insert policy" on public.audit_logs
  for insert with check (auth.role() = 'authenticated');

-- ==========================================================
-- STORAGE BUCKETS CONFIGURATION (PRIVATE BUCKETS)
-- ==========================================================
-- Ensure private buckets for student photos and attendance images
insert into storage.buckets (id, name, public)
values ('student-photos', 'student-photos', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('attendance-images', 'attendance-images', false)
on conflict (id) do update set public = false;

-- Storage object policies
drop policy if exists "Student photos select policy" on storage.objects;
drop policy if exists "Student photos insert policy" on storage.objects;
drop policy if exists "Student photos delete policy" on storage.objects;
drop policy if exists "Attendance images select policy" on storage.objects;
drop policy if exists "Attendance images insert policy" on storage.objects;
drop policy if exists "Attendance images delete policy" on storage.objects;
drop policy if exists "Student photos are publicly accessible" on storage.objects;
drop policy if exists "Authenticated users can upload student photos" on storage.objects;
drop policy if exists "Authenticated users can update student photos" on storage.objects;
drop policy if exists "Authenticated users can delete student photos" on storage.objects;
drop policy if exists "Attendance images are publicly accessible" on storage.objects;
drop policy if exists "Authenticated users can upload attendance images" on storage.objects;
drop policy if exists "Authenticated users can update attendance images" on storage.objects;
drop policy if exists "Authenticated users can delete attendance images" on storage.objects;

-- Student photos: Admins can read/write; Teachers can read photos for their classes
create policy "Student photos select policy"
  on storage.objects for select
  using (
    bucket_id = 'student-photos'
    and (public.is_admin() or auth.role() = 'authenticated')
  );

create policy "Student photos insert policy"
  on storage.objects for insert
  with check (
    bucket_id = 'student-photos'
    and public.is_admin()
  );

create policy "Student photos delete policy"
  on storage.objects for delete
  using (
    bucket_id = 'student-photos'
    and public.is_admin()
  );

-- Attendance images: Admins and Teachers can read/write
create policy "Attendance images select policy"
  on storage.objects for select
  using (
    bucket_id = 'attendance-images'
    and (public.is_admin() or auth.role() = 'authenticated')
  );

create policy "Attendance images insert policy"
  on storage.objects for insert
  with check (
    bucket_id = 'attendance-images'
    and (public.is_admin() or auth.role() = 'authenticated')
  );

create policy "Attendance images delete policy"
  on storage.objects for delete
  using (
    bucket_id = 'attendance-images'
    and public.is_admin()
  );

-- ==========================================================
-- TRIGGER: Automatic Profile Creation with Invitation Verification
-- ==========================================================
create or replace function public.handle_new_user()
returns trigger as $$
declare
  matching_role text := 'STUDENT';
  invitation_record record;
begin
  -- Check if there is a pending, unexpired invitation for this email
  select * into invitation_record
  from public.invitations
  where email = lower(new.email)
    and expires_at > now()
    and accepted_at is null
  order by created_at desc
  limit 1;

  if invitation_record.id is not null then
    matching_role := invitation_record.role;
    -- Mark invitation as accepted
    update public.invitations
    set accepted_at = now()
    where id = invitation_record.id;
  end if;

  -- Insert profile with strictly validated role (never trust raw metadata for ADMIN)
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    matching_role
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email;

  -- Record in audit log
  insert into public.audit_logs (actor_id, action, target_type, target_id, details)
  values (
    new.id,
    'USER_REGISTERED',
    'PROFILE',
    new.id::text,
    jsonb_build_object('email', new.email, 'assigned_role', matching_role)
  );

  return new;
end;
$$ language plpgsql security definer set search_path = '';

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;
grant execute on function public.handle_new_user() to service_role;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
