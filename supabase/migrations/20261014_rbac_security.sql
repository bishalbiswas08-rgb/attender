-- ==========================================================
-- ATTENDER - Idempotent Migration: RBAC & Data Security
-- Run this in your Supabase SQL Editor
-- ==========================================================

-- 1. Update Profiles Role Constraint & Add Student Link
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('ADMIN', 'TEACHER', 'STUDENT'));

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'student_id') then
    alter table public.profiles add column student_id uuid references public.students(id) on delete set null;
  end if;
end $$;

-- 2. Add Profile Link to Students Table
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'students' and column_name = 'profile_id') then
    alter table public.students add column profile_id uuid references public.profiles(id) on delete set null unique;
  end if;
end $$;

-- 3. Create CLASS_TEACHERS Table (Multi-teacher class assignment)
create table if not exists public.class_teachers (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint unique_class_teacher unique (class_id, teacher_id)
);

-- Backfill class_teachers from existing classes.teacher_id
insert into public.class_teachers (class_id, teacher_id)
select id, teacher_id from public.classes
where teacher_id is not null
on conflict (class_id, teacher_id) do nothing;

-- 4. Create INVITATIONS Table
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

-- 5. Create AUDIT_LOGS Table
create table if not exists public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Indexes
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_student_id on public.profiles(student_id);
create index if not exists idx_classes_teacher on public.classes(teacher_id);
create index if not exists idx_class_teachers_teacher on public.class_teachers(teacher_id);
create index if not exists idx_class_teachers_class on public.class_teachers(class_id);
create index if not exists idx_students_profile_id on public.students(profile_id);
create index if not exists idx_invitations_token on public.invitations(token);
create index if not exists idx_invitations_email on public.invitations(email);
create index if not exists idx_audit_logs_actor on public.audit_logs(actor_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);

-- 7. Security Definer Helper Functions
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'ADMIN'
  );
$$ language sql security definer stable;

create or replace function public.is_teacher_of_class(target_class_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.class_teachers
    where teacher_id = auth.uid() and class_id = target_class_id
  ) or exists (
    select 1 from public.classes
    where id = target_class_id and teacher_id = auth.uid()
  );
$$ language sql security definer stable;

create or replace function public.current_student_id()
returns uuid as $$
  select id from public.students
  where profile_id = auth.uid()
  limit 1;
$$ language sql security definer stable;

create or replace function public.current_student_class_id()
returns uuid as $$
  select class_id from public.students
  where profile_id = auth.uid()
  limit 1;
$$ language sql security definer stable;

-- 8. Enable RLS on All Tables
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_teachers enable row level security;
alter table public.students enable row level security;
alter table public.subjects enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_logs enable row level security;

-- 9. Drop Old Permissive Policies
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

-- 10. Re-create Strict Role-Based Policies
create policy "Profiles select policy" on public.profiles
  for select using (
    public.is_admin() or auth.uid() = id
  );

create policy "Profiles update policy" on public.profiles
  for update using (
    public.is_admin() or auth.uid() = id
  )
  with check (
    public.is_admin() or (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()))
  );

create policy "Profiles insert policy" on public.profiles
  for insert with check (
    auth.uid() = id
  );

create policy "Classes select policy" on public.classes
  for select using (
    public.is_admin()
    or public.is_teacher_of_class(id)
    or id = public.current_student_class_id()
  );

create policy "Classes insert policy" on public.classes
  for insert with check (public.is_admin());

create policy "Classes update policy" on public.classes
  for update using (public.is_admin()) with check (public.is_admin());

create policy "Classes delete policy" on public.classes
  for delete using (public.is_admin());

create policy "Class teachers select policy" on public.class_teachers
  for select using (
    public.is_admin() or teacher_id = auth.uid()
  );

create policy "Class teachers insert policy" on public.class_teachers
  for insert with check (public.is_admin());

create policy "Class teachers update policy" on public.class_teachers
  for update using (public.is_admin()) with check (public.is_admin());

create policy "Class teachers delete policy" on public.class_teachers
  for delete using (public.is_admin());

create policy "Students select policy" on public.students
  for select using (
    public.is_admin()
    or public.is_teacher_of_class(class_id)
    or profile_id = auth.uid()
  );

create policy "Students insert policy" on public.students
  for insert with check (public.is_admin());

create policy "Students update policy" on public.students
  for update using (public.is_admin()) with check (public.is_admin());

create policy "Students delete policy" on public.students
  for delete using (public.is_admin());

create policy "Subjects select policy" on public.subjects
  for select using (
    public.is_admin()
    or public.is_teacher_of_class(class_id)
    or class_id = public.current_student_class_id()
  );

create policy "Subjects all policy" on public.subjects
  for all using (public.is_admin());

create policy "Attendance sessions select policy" on public.attendance_sessions
  for select using (
    public.is_admin()
    or public.is_teacher_of_class(class_id)
    or class_id = public.current_student_class_id()
  );

create policy "Attendance sessions insert policy" on public.attendance_sessions
  for insert with check (
    public.is_admin() or public.is_teacher_of_class(class_id)
  );

create policy "Attendance sessions update policy" on public.attendance_sessions
  for update using (
    public.is_admin() or public.is_teacher_of_class(class_id)
  );

create policy "Attendance sessions delete policy" on public.attendance_sessions
  for delete using (public.is_admin());

create policy "Attendance select policy" on public.attendance
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.attendance_sessions s
      where s.id = attendance.session_id and public.is_teacher_of_class(s.class_id)
    )
    or student_id = public.current_student_id()
  );

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

create policy "Attendance delete policy" on public.attendance
  for delete using (
    public.is_admin()
    or exists (
      select 1 from public.attendance_sessions s
      where s.id = attendance.session_id and public.is_teacher_of_class(s.class_id)
    )
  );

create policy "Invitations select policy" on public.invitations
  for select using (public.is_admin());

create policy "Invitations insert policy" on public.invitations
  for insert with check (public.is_admin());

create policy "Invitations update policy" on public.invitations
  for update using (public.is_admin());

create policy "Invitations delete policy" on public.invitations
  for delete using (public.is_admin());

create policy "Audit logs select policy" on public.audit_logs
  for select using (public.is_admin());

create policy "Audit logs insert policy" on public.audit_logs
  for insert with check (auth.role() = 'authenticated');

-- 11. Storage Private Buckets & Strict RLS
insert into storage.buckets (id, name, public)
values ('student-photos', 'student-photos', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('attendance-images', 'attendance-images', false)
on conflict (id) do update set public = false;

drop policy if exists "Student photos select policy" on storage.objects;
drop policy if exists "Student photos insert policy" on storage.objects;
drop policy if exists "Student photos delete policy" on storage.objects;
drop policy if exists "Attendance images select policy" on storage.objects;
drop policy if exists "Attendance images insert policy" on storage.objects;
drop policy if exists "Attendance images delete policy" on storage.objects;

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

-- 12. Trigger Function with Automatic Invitation Validation
create or replace function public.handle_new_user()
returns trigger as $$
declare
  matching_role text := 'STUDENT';
  invitation_record record;
begin
  select * into invitation_record
  from public.invitations
  where email = lower(new.email)
    and expires_at > now()
    and accepted_at is null
  order by created_at desc
  limit 1;

  if invitation_record.id is not null then
    matching_role := invitation_record.role;
    update public.invitations
    set accepted_at = now()
    where id = invitation_record.id;
  end if;

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
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
