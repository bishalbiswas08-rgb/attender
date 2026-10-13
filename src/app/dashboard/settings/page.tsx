'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAttendance } from '@/lib/context/AttendanceContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RoleBadge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import {
  Settings,
  Percent,
  Database,
  Sparkles,
  Shield,
  Key,
  CheckCircle2,
  AlertCircle,
  Save,
  LogOut,
} from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const {
    threshold,
    setThreshold,
    user,
    setUserRole,
    isSupabaseLive,
    isGeminiLive,
    signOut,
  } = useAttendance();

  const { success } = useToast();
  const [localThreshold, setLocalThreshold] = useState(threshold);

  const handleSaveThreshold = (e: React.FormEvent) => {
    e.preventDefault();
    setThreshold(Number(localThreshold));
    success('Threshold Updated', `Minimum attendance threshold set to ${localThreshold}%.`);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Settings className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
          Settings & Configuration
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configure attendance thresholds, inspect database connection status, and test roles.
        </p>
      </div>

      {/* Threshold Configuration Card */}
      <Card padding="lg" className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Percent className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Minimum Attendance Threshold
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Students whose dynamic attendance percentage falls below this value will trigger visual alerts and at-risk notifications across dashboards.
            </p>
          </div>
          <span className="px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black text-sm">
            {threshold}%
          </span>
        </div>

        <form onSubmit={handleSaveThreshold} className="flex items-center gap-3 pt-2">
          <div className="relative w-40">
            <input
              type="number"
              min="1"
              max="100"
              value={localThreshold}
              onChange={(e) => setLocalThreshold(Number(e.target.value))}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="absolute right-4 top-2 text-slate-400 text-sm font-bold">%</span>
          </div>

          <Button variant="primary" size="md" type="submit" leftIcon={<Save className="w-4 h-4" />}>
            Save Threshold
          </Button>
        </form>
      </Card>

      {/* System Status: Supabase & Gemini */}
      <Card padding="lg" className="space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          Backend & AI Services Status
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Supabase Status */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-500" /> Supabase PostgreSQL & Storage
              </span>
              {isSupabaseLive ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500">
                  Local Mode Active
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isSupabaseLive
                ? 'RLS policies and Storage buckets (student-photos, attendance-images) are linked.'
                : 'Running in fast local storage mode. To sync with cloud PostgreSQL, provide NEXT_PUBLIC_SUPABASE_URL in .env.local.'}
            </p>
          </div>

          {/* Gemini AI Status */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Gemini Vision & Assistant
              </span>
              {isGeminiLive ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  Simulation / Key Pending
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isGeminiLive
                ? 'Gemini multimodal vision and conversational assistant are active.'
                : 'Using built-in intelligent simulator for face detection and analytics until GEMINI_API_KEY is supplied.'}
            </p>
          </div>
        </div>
      </Card>

      {/* Role Management Card */}
      <Card padding="lg" className="space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          Active Account & Role
        </h3>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold text-base flex items-center justify-center shrink-0">
              {user?.full_name ? user.full_name[0] : 'U'}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {user?.full_name || 'Authenticated User'}
              </p>
              <p className="text-xs text-slate-400">{user?.email || 'user@attender.edu'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <RoleBadge role={user?.role || 'TEACHER'} />
            <button
              onClick={() => setUserRole(user?.role === 'ADMIN' ? 'TEACHER' : 'ADMIN')}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1"
            >
              Toggle to {user?.role === 'ADMIN' ? 'TEACHER' : 'ADMIN'}
            </button>
          </div>
        </div>

        {/* Visible Logout Section */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Session Management
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Securely sign out of ATTENDER on this browser session.
            </p>
          </div>

          <Button
            variant="danger"
            size="md"
            onClick={async () => {
              await signOut();
              router.push('/login');
            }}
            leftIcon={<LogOut className="w-4 h-4" />}
            className="font-bold shadow-sm"
          >
            Log Out
          </Button>
        </div>
      </Card>
    </div>
  );
}
