-- ==========================================================
-- ATTENDER - Supabase Database Schema & RLS Policies
-- "Smart attendance. Zero hassle."
-- ==========================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES (Extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null check (role in ('ADMIN', 'TEACHER')) default 'TEACHER',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. CLASSES
create table if not exists public.classes (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  section text not null,
  academic_year text not null default '2026-2027',
  teacher_id uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. STUDENTS
create table if not exists public.students (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  roll_number text not null,
  class_id uuid not null references public.classes(id) on delete cascade,
  photo_url text,
  email text,
  active boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint unique_student_roll_per_class unique (class_id, roll_number)
);

-- 4. SUBJECTS
create table if not exists public.subjects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. ATTENDANCE SESSIONS
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

-- 6. ATTENDANCE RECORDS
create table if not exists public.attendance (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null check (status in ('present', 'absent', 'late')),
  marked_at timestamp with time zone default timezone('utc'::text, now()) not null,
  marked_by uuid references public.profiles(id) on delete set null,
  -- Constraint: Prevent duplicate attendance records for the same student in the same session
  constraint unique_session_student unique (session_id, student_id)
);

-- ==========================================================
-- INDEXES FOR HIGH PERFORMANCE QUERYING
-- ==========================================================
create index if not exists idx_students_class on public.students(class_id);
create index if not exists idx_students_active on public.students(active);
create index if not exists idx_sessions_class_date on public.attendance_sessions(class_id, date);
create index if not exists idx_attendance_session on public.attendance(session_id);
create index if not exists idx_attendance_student on public.attendance(student_id);
create index if not exists idx_attendance_status on public.attendance(status);

-- ==========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================================
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.subjects enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance enable row level security;

-- Drop existing policies first to guarantee safe, idempotent execution
drop policy if exists "Allow read profiles" on public.profiles;
drop policy if exists "Allow self profile update" on public.profiles;
drop policy if exists "Allow insert profiles" on public.profiles;

drop policy if exists "Classes read access" on public.classes;
drop policy if exists "Classes admin & teacher write" on public.classes;
drop policy if exists "Classes admin & teacher update" on public.classes;
drop policy if exists "Classes admin delete" on public.classes;
drop policy if exists "Classes delete access" on public.classes;

drop policy if exists "Students read access" on public.students;
drop policy if exists "Students modify access" on public.students;
drop policy if exists "Students insert access" on public.students;
drop policy if exists "Students update access" on public.students;
drop policy if exists "Students delete access" on public.students;

drop policy if exists "Subjects read access" on public.subjects;
drop policy if exists "Subjects modify access" on public.subjects;

drop policy if exists "Attendance sessions read" on public.attendance_sessions;
drop policy if exists "Attendance sessions write" on public.attendance_sessions;
drop policy if exists "Attendance sessions insert" on public.attendance_sessions;
drop policy if exists "Attendance sessions update" on public.attendance_sessions;
drop policy if exists "Attendance sessions delete" on public.attendance_sessions;

drop policy if exists "Attendance read" on public.attendance;
drop policy if exists "Attendance insert" on public.attendance;
drop policy if exists "Attendance update" on public.attendance;
drop policy if exists "Attendance delete" on public.attendance;

-- Helper function to check if current user is ADMIN
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'ADMIN'
  );
$$ language sql security definer;

-- Profiles: Authenticated users can view profiles, users can update/insert own profile
create policy "Allow read profiles" on public.profiles
  for select using (auth.role() = 'authenticated');

create policy "Allow self profile update" on public.profiles
  for update using (auth.uid() = id);

create policy "Allow insert profiles" on public.profiles
  for insert with check (auth.role() = 'authenticated' or auth.uid() = id);

-- Classes Policies: Authenticated educators can manage classes
create policy "Classes read access" on public.classes
  for select using (auth.role() = 'authenticated');

create policy "Classes admin & teacher write" on public.classes
  for insert with check (auth.role() = 'authenticated');

create policy "Classes admin & teacher update" on public.classes
  for update using (auth.role() = 'authenticated');

create policy "Classes delete access" on public.classes
  for delete using (auth.role() = 'authenticated');

-- Students Policies: Authenticated educators can manage student records
create policy "Students read access" on public.students
  for select using (auth.role() = 'authenticated');

create policy "Students insert access" on public.students
  for insert with check (auth.role() = 'authenticated');

create policy "Students update access" on public.students
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Students delete access" on public.students
  for delete using (auth.role() = 'authenticated');

-- Subjects Policies
create policy "Subjects read access" on public.subjects
  for select using (auth.role() = 'authenticated');

create policy "Subjects modify access" on public.subjects
  for all using (auth.role() = 'authenticated');

-- Attendance Sessions & Records Policies
create policy "Attendance sessions read" on public.attendance_sessions
  for select using (auth.role() = 'authenticated');

create policy "Attendance sessions insert" on public.attendance_sessions
  for insert with check (auth.role() = 'authenticated');

create policy "Attendance sessions update" on public.attendance_sessions
  for update using (auth.role() = 'authenticated');

create policy "Attendance sessions delete" on public.attendance_sessions
  for delete using (auth.role() = 'authenticated');

create policy "Attendance read" on public.attendance
  for select using (auth.role() = 'authenticated');

create policy "Attendance insert" on public.attendance
  for insert with check (auth.role() = 'authenticated');

create policy "Attendance update" on public.attendance
  for update using (auth.role() = 'authenticated');

create policy "Attendance delete" on public.attendance
  for delete using (auth.role() = 'authenticated');

-- ==========================================================
-- STORAGE BUCKETS CONFIGURATION (Run in Supabase SQL editor)
-- ==========================================================
-- 1. Create storage buckets
insert into storage.buckets (id, name, public)
values ('student-photos', 'student-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('attendance-images', 'attendance-images', true)
on conflict (id) do nothing;

-- Drop existing storage policies for idempotency
drop policy if exists "Student photos are publicly accessible" on storage.objects;
drop policy if exists "Authenticated users can upload student photos" on storage.objects;
drop policy if exists "Authenticated users can update student photos" on storage.objects;
drop policy if exists "Authenticated users can delete student photos" on storage.objects;

drop policy if exists "Attendance images are publicly accessible" on storage.objects;
drop policy if exists "Authenticated users can upload attendance images" on storage.objects;
drop policy if exists "Authenticated users can update attendance images" on storage.objects;
drop policy if exists "Authenticated users can delete attendance images" on storage.objects;

-- 2. Storage Policies for student-photos
create policy "Student photos are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'student-photos' );

create policy "Authenticated users can upload student photos"
  on storage.objects for insert
  with check ( bucket_id = 'student-photos' and auth.role() = 'authenticated' );

create policy "Authenticated users can update student photos"
  on storage.objects for update
  using ( bucket_id = 'student-photos' and auth.role() = 'authenticated' );

create policy "Authenticated users can delete student photos"
  on storage.objects for delete
  using ( bucket_id = 'student-photos' and auth.role() = 'authenticated' );

-- 3. Storage Policies for attendance-images
create policy "Attendance images are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'attendance-images' );

create policy "Authenticated users can upload attendance images"
  on storage.objects for insert
  with check ( bucket_id = 'attendance-images' and auth.role() = 'authenticated' );

create policy "Authenticated users can update attendance images"
  on storage.objects for update
  using ( bucket_id = 'attendance-images' and auth.role() = 'authenticated' );

create policy "Authenticated users can delete attendance images"
  on storage.objects for delete
  using ( bucket_id = 'attendance-images' and auth.role() = 'authenticated' );

-- ==========================================================
-- TRIGGER: Automatic Profile Creation on User Signup
-- ==========================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'TEACHER')
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
