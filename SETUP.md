# ATTENDER — Setup & Deployment Guide

> **"Smart attendance. Zero hassle."**  
> Modern AI-powered classroom attendance management web application built with **Next.js 14**, **TypeScript**, **Tailwind CSS**, **Supabase** (PostgreSQL, Storage, Auth, RLS), and **Google Gemini Vision AI**.

---

## 1. Prerequisites

- **Node.js**: `v18.x` or higher (tested on `v20.x`)
- **npm** or **pnpm** / **yarn**
- A free **[Supabase](https://supabase.com)** account and project
- A **[Google AI Studio](https://aistudio.google.com/)** Gemini API key

---

## 2. Environment Variables

Create a `.env.local` file in the project root (`g:\ATTENDER\.env.local`):

```bash
# Supabase Configuration (Client-side & Server-side)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase Elevated Service Role Key (Server-side ONLY - Never expose to browser)
SUPABASE_SECRET_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Google Gemini Vision & Assistant API Key (Server-side ONLY - Never expose to browser)
GEMINI_API_KEY=AIzaSy...
```

### Security Guarantees:
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are safe for browser use and are subject to Row Level Security (RLS).
- `SUPABASE_SECRET_KEY` and `GEMINI_API_KEY` are strictly server-side keys used inside `/api/*` endpoints and are never bundled into the client browser.

---

## 3. Supabase Database Setup

1. Open your **[Supabase Dashboard](https://supabase.com/dashboard)**.
2. Select your project and navigate to the **SQL Editor** tab.
3. Open the schema script located at [`supabase/schema.sql`](./supabase/schema.sql).
4. Copy and paste the entire script into the Supabase SQL Editor and click **Run**.

### What `supabase/schema.sql` configures:
- **Tables**:
  - `profiles`: Linked directly to Supabase `auth.users` with roles (`TEACHER`, `ADMIN`).
  - `classes`: Class name, section, academic year, assigned teacher.
  - `students`: Roll number, full name, class foreign key, photo URL, active flag.
  - `subjects`: Academic subjects mapped to classes and teachers.
  - `attendance_sessions`: Daily attendance session records with source tracking (`individual`, `classroom_scan`, `manual`).
  - `attendance`: Individual student attendance records with strict unique constraint `(session_id, student_id)`.
- **Performance Indexes**: High-speed indexing on foreign keys and date lookups.
- **Row Level Security (RLS)**: Fine-grained security policies on all tables so authenticated educators only access authorized data.
- **Signup Trigger**: Automatically creates a matching profile in `public.profiles` whenever a new user signs up through Supabase Auth.
- **Storage Buckets**: Automatically initializes storage buckets and access policies.

---

## 4. Supabase Storage Buckets

The application requires two Supabase Storage buckets:
1. `student-photos`: Stores profile photographs of registered students used for facial recognition and student cards.
2. `attendance-images`: Stores wide-angle classroom scan photographs captured by educators.

If you ran `supabase/schema.sql`, the buckets and public access policies are configured automatically. You can also verify or create them in the Supabase Dashboard under **Storage**:

| Bucket Name | Public Bucket | Permitted MIME Types | Max Size |
| :--- | :--- | :--- | :--- |
| `student-photos` | **Yes** (Public) | `image/*` | 5 MB |
| `attendance-images` | **Yes** (Public) | `image/*` | 10 MB |

---

## 5. Google Gemini API Setup

ATTENDER uses Google's latest Gemini models for classroom computer vision and natural-language attendance querying:
- **Classroom Vision Attendance**: Detects frontal student faces in classroom photos and accurately matches them against enrolled student roster photos.
- **Natural Language Assistant**: Answers complex queries such as *"Who missed the most classes this month?"* or *"Which students are below 75%?"*.

### Getting your API Key:
1. Visit **[Google AI Studio](https://aistudio.google.com/app/apikey)**.
2. Click **Create API Key**.
3. Copy the key and paste it as `GEMINI_API_KEY` in your `.env.local`.

---

## 6. Running Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. **Open the application**:
   Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 7. First-Time Walkthrough & User Flow

1. **Create an Account**:
   - Go to `/login` and select **Create Account**.
   - Enter your name, email, password, and select your role (**Teacher** or **Admin**).
2. **Create a Class**:
   - Navigate to **Classes** (`/dashboard/classes`).
   - Click **`[ CREATE CLASS ]`** (e.g. Name: `Grade 10`, Section: `A`, Academic Year: `2026-2027`).
3. **Add Students**:
   - Navigate to **Students** (`/dashboard/students`).
   - Click **`[ ADD STUDENT ]`**.
   - Enter the student's name, roll number, and upload a clear frontal face photograph.
   - The photo is automatically uploaded to Supabase Storage `student-photos`, and the record is stored in PostgreSQL.
4. **Mark Attendance**:
   - **Classroom Scan**: Go to **Scan Attendance** (`/dashboard/scan`). Snap a photo using your webcam or upload a wide classroom photo. Gemini AI will match faces against the student roster and present a review dialog before saving.
   - **Individual Mark**: Go to **Individual Attendance** (`/dashboard/individual`). Tap any student card to toggle between **Present**, **Absent**, and **Late**. Click **`[ SAVE ATTENDANCE ]`**.
5. **View Reports & Audit**:
   - Go to **Reports** (`/dashboard/reports`) to view dynamic attendance percentages, students below threshold, and export rosters to CSV.
6. **Query with ATTENDER AI**:
   - Open the **AI Assistant** drawer on any dashboard page to ask questions about attendance records in plain English.

---

## 8. Deployment to Vercel

1. Push your code to a GitHub / GitLab repository.
2. Go to **[Vercel](https://vercel.com/)** and click **Add New Project**.
3. Import your ATTENDER repository.
4. In the **Environment Variables** section, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
   - `GEMINI_API_KEY`
5. Click **Deploy**.
6. Your production-ready AI attendance system is now live!
