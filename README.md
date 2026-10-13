# ATTENDER

> **"Smart attendance. Zero hassle."**

ATTENDER is a modern AI-powered classroom attendance management web application built with **Next.js**, **TypeScript**, **Tailwind CSS**, **Supabase** (PostgreSQL, Storage, Authentication, RLS), and **Google Gemini API**.

---

## ⚡ Key Features

- **🚀 Under-60s Attendance Workflow:**
  1. Open class roster &rarr;
  2. Snap classroom photograph &rarr;
  3. AI recognizes visible frontal faces &rarr;
  4. Teacher reviews detections &rarr;
  5. One-click save to database.

- **📸 Classroom AI Scan Pipeline (`recognizeClassroomAttendance`):**
  - Live webcam stream with front/back camera support on mobile.
  - Photo upload & high-resolution sample loader for instant testing.
  - Server-side Gemini Vision pipeline returning structured JSON with confidence and bounding boxes.
  - Visual Review Screen: side-by-side photo with face markers, 🟢 Detected Present and 🔴 Not Detected rosters, clickable instant toggles to correct AI false positives before saving.

- **⚡ Fast Individual Attendance:**
  - Fast 3-state card toggle: `Unmarked &rarr; Present &rarr; Absent &rarr; Unmarked`.
  - Explicit P / A / L controls and mass actions (Mark All Present, Mark All Absent, Clear All).
  - Sticky live counter banner (Present, Absent, Unmarked, Today's Rate).
  - Does not write to DB until `[ SAVE ATTENDANCE ]` is confirmed.

- **📊 Dynamic Attendance Calculations:**
  - Formula: $\text{Attendance Percentage} = \left(\frac{\text{Present Classes}}{\text{Total Classes}}\right) \times 100$.
  - Computed on the fly without stale stored percentage states.
  - Monthly, weekly, and calendar breakdowns (P = Present, A = Absent, L = Late).

- **⚠️ Attendance Threshold Alerts:**
  - Administrator-configurable minimum threshold (default 75%).
  - Real-time warning badges (`⚠️ Attendance: 68.4%`) and dashboard banner alerts.

- **🤖 ATTENDER AI Assistant:**
  - Natural-language query interface powered by Gemini.
  - Answers questions such as:
    - *"Who has attendance below 75%?"*
    - *"Who has the best attendance?"*
    - *"How many students were absent today?"*
    - *"Which student has missed the most classes?"*
    - *"Summarize October attendance."*
  - Strict server-controlled data access: provides structured JSON context to Gemini; never allows raw SQL execution.

- **📁 Reports & CSV Export:**
  - Daily, weekly, monthly, student, and class breakdown reports.
  - Instant CSV file generation and print/PDF-optimized layout.

- **🔒 Enterprise Security & Roles:**
  - `ADMIN` and `TEACHER` role architecture.
  - Supabase Row Level Security (RLS) policies.
  - Zero browser exposure of Supabase Secret or Gemini API keys.

---

## 🛠️ Tech Stack

- **Framework:** Next.js 14 (App Router, Server Actions, Route Handlers)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS (Dark/Light mode support, modern SaaS aesthetics)
- **Database:** Supabase PostgreSQL with RLS & unique constraints
- **Storage:** Supabase Storage (`student-photos` and `attendance-images` buckets)
- **Authentication:** Supabase Auth (Email/Password, user roles in profiles table)
- **AI Vision & Assistant:** Google Gemini API (`gemini-1.5-flash`)
- **Icons & UI:** Lucide React, Canvas Confetti

---

## 📂 Project Architecture

```
src/
├── app/
│   ├── layout.tsx                # Root layout with font and metadata
│   ├── page.tsx                  # SaaS landing page & hero
│   ├── login/page.tsx            # Supabase Auth login & demo quick-switch
│   ├── dashboard/
│   │   ├── layout.tsx            # Authenticated layout with Header & Sidebar
│   │   ├── page.tsx              # Main dashboard: metrics, charts, quick actions
│   │   ├── scan/page.tsx         # Classroom Scan with webcam & AI vision pipeline
│   │   ├── individual/page.tsx   # Fast card-toggle individual attendance
│   │   ├── students/page.tsx     # Student management & roster
│   │   ├── classes/page.tsx      # Class management & sections
│   │   ├── reports/page.tsx      # Reports & CSV export
│   │   ├── ai-assistant/page.tsx # ATTENDER AI chat interface
│   │   └── settings/page.tsx     # Threshold configuration & service status
│   └── api/
│       ├── attendance/scan/      # Server Gemini vision face detection endpoint
│       ├── attendance/save/      # Server deduplicated attendance session saver
│       ├── ai/chat/              # Controlled ATTENDER AI query route
│       └── storage/upload/       # Supabase Storage photo uploader
├── components/
│   ├── ui/                       # Button, Card, Badge, Modal, Toast, Skeleton, ConfirmDialog
│   ├── layout/                   # Header, Sidebar, RoleIndicator
│   ├── attendance/               # ClassroomScanner, ClassroomReviewModal, StudentAttendanceCard, DetectionOverlay, AttendanceStatsBar
│   ├── students/                 # StudentCard, StudentModal, StudentProfileModal
│   ├── dashboard/                # StatCard, AttendanceChart, ThresholdAlert, RecentActivityList
│   └── ai/                       # ChatDrawer
├── lib/
│   ├── ai/                       # Gemini recognition abstraction & ATTENDER AI engine
│   ├── attendance/               # Dynamic attendance calculations & formulas
│   ├── supabase/                 # Browser client, SSR client, Admin client
│   ├── storage/                  # Supabase Storage bucket utilities
│   ├── data/                     # Realistic seed data & fallback persistence
│   └── types/                    # TypeScript interfaces
└── supabase/
    └── schema.sql                # Complete PostgreSQL tables, RLS & Storage policies
```

---

## ⚙️ Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-or-publishable-key
SUPABASE_SECRET_KEY=your-supabase-service-role-secret-key

# Google Gemini API Key
GEMINI_API_KEY=your-gemini-api-key

# Attendance Threshold Percentage
NEXT_PUBLIC_ATTENDANCE_THRESHOLD=75
```

> **Note:** ATTENDER is built to be resilient. If credentials are not yet entered, it automatically runs in an interactive Demo / Local mode with realistic student rosters, photo markers, and calculation engines so every screen can be verified immediately.

---

## 🗄️ Supabase Database & Storage Setup

1. Open your project on [Supabase](https://supabase.com).
2. Go to the **SQL Editor**.
3. Open `supabase/schema.sql` from this repository and run the SQL commands.
   - Creates `profiles`, `classes`, `students`, `subjects`, `attendance_sessions`, `attendance` tables.
   - Configures Primary Keys, Foreign Keys, Unique Constraint `(session_id, student_id)` to prevent duplicate records.
   - Creates indexes on foreign keys and timestamps.
   - Enables Row Level Security (RLS) with Admin & Teacher policies.
   - Creates Storage buckets: `student-photos` and `attendance-images` with public read and authenticated write policies.
   - Sets up trigger to automatically create profile records upon `auth.users` registration.

---

## 💻 Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run development server:**
   ```bash
   npm run dev
   ```

3. **Open browser:**
   Navigate to [http://localhost:3000](http://localhost:3000).

4. **Production Build Verification:**
   ```bash
   npm run build
   npm run start
   ```

---

## 🚀 Vercel Deployment

1. Push your repository to GitHub or GitLab.
2. In the [Vercel Dashboard](https://vercel.com), click **Add New &rarr; Project** and import the repository.
3. In **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
   - `GEMINI_API_KEY`
   - `NEXT_PUBLIC_ATTENDANCE_THRESHOLD`
4. Click **Deploy**. Vercel will build and host the application globally.
