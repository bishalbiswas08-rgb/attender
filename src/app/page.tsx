import Link from 'next/link';
import {
  Sparkles,
  Camera,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Bot,
  ArrowRight,
  TrendingUp,
  Users,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AuthCallbackDetector } from '@/components/auth/AuthCallbackDetector';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col selection:bg-indigo-500 selection:text-white">
      <AuthCallbackDetector />
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 backdrop-blur-md sticky top-0 z-30 bg-slate-950/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white">
                ATTENDER
              </span>
              <p className="text-[10px] text-slate-400 font-medium tracking-wide">
                Smart attendance. Zero hassle.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <button className="text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl text-slate-300 hover:text-white transition-colors">
                Sign In
              </button>
            </Link>
            <Link href="/dashboard">
              <Button
                variant="scan"
                size="md"
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="font-bold text-xs sm:text-sm"
              >
                Launch App
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-20 pb-24 lg:pt-28 lg:pb-32">
          {/* Subtle glow lights */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute top-1/3 left-1/3 w-[300px] h-[200px] bg-blue-500/15 rounded-full blur-[90px] pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            {/* Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-700/50 text-indigo-300 text-xs font-bold mb-8 shadow-inner animate-in fade-in duration-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Next-Gen AI Classroom Attendance</span>
            </div>

            {/* Tagline & Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight max-w-4xl mx-auto leading-[1.1]">
              Smart attendance. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
                Zero hassle.
              </span>
            </h1>

            <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto font-normal leading-relaxed">
              ATTENDER transforms classroom roll call. Instruct your students to look at the camera, snap a photo, and let server-side Gemini Vision identify the entire room in under 60 seconds.
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/dashboard/scan">
                <Button
                  variant="scan"
                  size="xl"
                  leftIcon={<Camera className="w-5 h-5 text-white" />}
                  className="w-full sm:w-auto font-black shadow-indigo-500/40"
                >
                  SCAN CLASSROOM NOW
                </Button>
              </Link>

              <Link href="/dashboard">
                <Button
                  variant="secondary"
                  size="xl"
                  className="w-full sm:w-auto font-bold bg-slate-900 text-slate-200 border-slate-800 hover:bg-slate-800"
                >
                  Open Dashboard
                </Button>
              </Link>
            </div>

            {/* Speed Principle Banner */}
            <div className="mt-16 max-w-3xl mx-auto p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-center justify-around gap-4 text-xs font-medium text-slate-300">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold">1</div>
                <span>Open Class</span>
              </div>
              <span className="hidden sm:inline text-slate-600">&rarr;</span>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold">2</div>
                <span>Snap Classroom</span>
              </div>
              <span className="hidden sm:inline text-slate-600">&rarr;</span>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold">3</div>
                <span>Review Faces</span>
              </div>
              <span className="hidden sm:inline text-slate-600">&rarr;</span>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-600/30 text-emerald-400 flex items-center justify-center font-bold">4</div>
                <span>Confirm & Save</span>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Highlights Grid */}
        <section className="py-20 border-t border-slate-900 bg-slate-900/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                Built for High-Speed Education
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-2">
                Engineered with Supabase PostgreSQL, Storage, Row Level Security, and Gemini AI.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                  <Camera className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold">Frontal AI Vision Scan</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Uses server-side Gemini multi-modal vision to locate visible faces, matches with registered roster photos, and renders bounding boxes with confidence scores.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold">Teacher Review Control</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Never blindly writes attendance. Teachers inspect detected (🟢) versus undetected (🔴) students, tap to override any mistakes, and confirm in seconds.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                  <Bot className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold">ATTENDER AI Assistant</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Ask natural-language questions like &ldquo;Who has attendance below 75%?&rdquo; or &ldquo;Summarize October attendance.&rdquo; Secured behind strict server data extraction.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-8 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400">ATTENDER</span>
            <span>&bull;</span>
            <span>Smart attendance. Zero hassle.</span>
          </div>
          <div>
            <span>Powered by Next.js, Supabase & Gemini API</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
