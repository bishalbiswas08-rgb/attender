'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react';
import { useAttendance } from '@/lib/context/AttendanceContext';

interface ThresholdAlertProps {
  count: number;
  threshold: number;
}

export const ThresholdAlert: React.FC<ThresholdAlertProps> = ({ count, threshold }) => {
  if (count <= 0) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-amber-950 dark:text-amber-100">
            Attendance Warning: {count} {count === 1 ? 'student is' : 'students are'} below {threshold}% attendance
          </h4>
          <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
            Automated alerts flag students at risk of falling behind minimum attendance policy.
          </p>
        </div>
      </div>

      <Link
        href="/dashboard/reports"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 transition-colors shrink-0 self-start sm:self-auto"
      >
        <span>View At-Risk Report</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
};
