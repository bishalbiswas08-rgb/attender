'use client';

import React from 'react';
import { ClassroomScanner } from '@/components/attendance/ClassroomScanner';
import { useAttendance } from '@/lib/context/AttendanceContext';
import { Camera, Sparkles, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ClassroomScanPage() {
  const { activeClass } = useAttendance();

  return (
    <div className="space-y-6">
      {/* Page Title & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard"
              className="text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
            </Link>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Camera className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
              Classroom Scan
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
              {activeClass?.name} - {activeClass?.section}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Zero-hassle frontal AI recognition pipeline. Detects students and prompts review before saving.
          </p>
        </div>
      </div>

      {/* Main Scanner Stage */}
      <ClassroomScanner />
    </div>
  );
}
