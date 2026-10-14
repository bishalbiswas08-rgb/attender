'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { AttendanceProvider, useAttendance } from '@/lib/context/AttendanceContext';
import { ToastProvider } from '@/components/ui/Toast';
import { Sparkles, ShieldAlert, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

function DashboardGuard({ children }: { children: React.ReactNode }) {
  const { session, authLoading, isStudent } = useAttendance();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading) {
      if (!session) {
        router.replace('/login');
      } else if (isStudent) {
        router.replace('/student');
      }
    }
  }, [authLoading, session, isStudent, router]);

  // Loading state while restoring session from Supabase
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 selection:bg-indigo-500 selection:text-white">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm animate-in fade-in duration-300">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-xl shadow-indigo-500/25 animate-pulse">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              Restoring Session
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Verifying your authenticated educator account with Supabase...
            </p>
          </div>
          <div className="w-32 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full w-2/3 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated state
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-900/50">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Authentication Required
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              You must be logged in to access ATTENDER classroom rosters, vision scans, and reports. Redirecting to login...
            </p>
          </div>
          <div className="pt-2">
            <Link href="/login" className="w-full">
              <Button
                variant="primary"
                size="md"
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="w-full font-bold shadow-md shadow-indigo-600/25"
              >
                Sign In with Supabase
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ToastProvider>
      <AttendanceProvider>
        <DashboardGuard>
          <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 flex flex-col transition-colors">
            <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
            <div className="flex flex-1 w-full min-w-0 overflow-x-hidden">
              <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
              <main className="flex-1 min-w-0 p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
                {children}
              </main>
            </div>
          </div>
        </DashboardGuard>
      </AttendanceProvider>
    </ToastProvider>
  );
}
