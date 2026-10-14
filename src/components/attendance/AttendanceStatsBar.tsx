'use client';

import React from 'react';
import { Button } from '../ui/Button';
import { Save, CheckCheck, XCircle, RotateCcw } from 'lucide-react';

interface AttendanceStatsBarProps {
  presentCount: number;
  absentCount: number;
  unmarkedCount: number;
  totalCount: number;
  onMarkAllPresent: () => void;
  onMarkAllAbsent: () => void;
  onClearAll: () => void;
  onSave: () => void;
  isSaving?: boolean;
}

export const AttendanceStatsBar: React.FC<AttendanceStatsBarProps> = ({
  presentCount,
  absentCount,
  unmarkedCount,
  totalCount,
  onMarkAllPresent,
  onMarkAllAbsent,
  onClearAll,
  onSave,
  isSaving = false,
}) => {
  const presentPct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  return (
    <div className="sticky top-16 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-sm mb-6 transition-all min-w-0">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Metric badges */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium">Present:</span>
            <span className="text-sm font-black">{presentCount}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="text-xs font-medium">Absent:</span>
            <span className="text-sm font-black">{absentCount}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            <span className="text-xs font-medium">Unmarked:</span>
            <span className="text-sm font-black">{unmarkedCount}</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200">
            <span className="text-xs font-medium">Today&apos;s Rate:</span>
            <span className="text-sm font-black">{presentPct}%</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 w-full lg:w-auto">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={onMarkAllPresent}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 transition-colors flex items-center gap-1 min-h-[36px]"
              title="Mark all registered students present"
            >
              <CheckCheck className="w-3.5 h-3.5" /> All Present
            </button>
            <button
              onClick={onMarkAllAbsent}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 transition-colors flex items-center gap-1 min-h-[36px]"
              title="Mark all registered students absent"
            >
              <XCircle className="w-3.5 h-3.5" /> All Absent
            </button>
            <button
              onClick={onClearAll}
              className="text-xs font-medium px-2 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 min-h-[36px]"
              title="Reset all to unmarked"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          </div>

          <Button
            variant="success"
            size="md"
            onClick={onSave}
            isLoading={isSaving}
            leftIcon={<Save className="w-4 h-4" />}
            className="shadow-md shadow-emerald-600/20 px-6 font-bold w-full sm:w-auto"
          >
            SAVE ATTENDANCE
          </Button>
        </div>
      </div>
    </div>
  );
};
