import React from 'react';
import { AttendanceStatus, UserRole } from '@/lib/types';
import { Check, X, Clock, AlertTriangle, ShieldCheck, GraduationCap } from 'lucide-react';

interface StatusBadgeProps {
  status: AttendanceStatus | 'unmarked';
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  if (status === 'present') {
    return (
      <span
        className={`inline-flex items-center gap-1 font-medium rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800 ${sizeClasses}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
        Present
      </span>
    );
  }

  if (status === 'absent') {
    return (
      <span
        className={`inline-flex items-center gap-1 font-medium rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300/60 dark:border-rose-800 ${sizeClasses}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-rose-600 dark:bg-rose-400" />
        Absent
      </span>
    );
  }

  if (status === 'late') {
    return (
      <span
        className={`inline-flex items-center gap-1 font-medium rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800 ${sizeClasses}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
        Late
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300/60 dark:border-slate-700 ${sizeClasses}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
      Unmarked
    </span>
  );
};

interface RoleBadgeProps {
  role: UserRole;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => {
  if (role === 'ADMIN') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
        <ShieldCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
        ADMIN
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
      <GraduationCap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
      TEACHER
    </span>
  );
};

interface ThresholdBadgeProps {
  percentage: number | null | undefined;
  threshold?: number;
}

export const ThresholdBadge: React.FC<ThresholdBadgeProps> = ({ percentage, threshold = 75 }) => {
  if (percentage === null || percentage === undefined) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
        N/A
      </span>
    );
  }

  const isBelow = percentage < threshold;

  if (isBelow) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
        <AlertTriangle className="w-3 h-3 text-amber-500" />
        {percentage}%
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
      {percentage}%
    </span>
  );
};
