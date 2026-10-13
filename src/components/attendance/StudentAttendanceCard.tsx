'use client';

import React from 'react';
import { Student, AttendanceStatus } from '@/lib/types';
import { ThresholdBadge } from '../ui/Badge';
import { Check, X, Clock, HelpCircle, Eye } from 'lucide-react';

interface StudentAttendanceCardProps {
  student: Student;
  currentPercentage: number | null;
  status: AttendanceStatus | 'unmarked';
  onToggle: (studentId: string) => void;
  onSetStatus: (studentId: string, status: AttendanceStatus | 'unmarked') => void;
  onViewProfile?: (student: Student) => void;
  threshold?: number;
}

export const StudentAttendanceCard: React.FC<StudentAttendanceCardProps> = ({
  student,
  currentPercentage,
  status,
  onToggle,
  onSetStatus,
  onViewProfile,
  threshold = 75,
}) => {
  // Card styles depending on status
  const getCardStyle = () => {
    if (status === 'present') {
      return 'border-emerald-500/80 bg-emerald-50/40 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20';
    }
    if (status === 'absent') {
      return 'border-rose-500/80 bg-rose-50/40 dark:bg-rose-950/20 ring-2 ring-rose-500/20';
    }
    if (status === 'late') {
      return 'border-amber-500/80 bg-amber-50/40 dark:bg-amber-950/20 ring-2 ring-amber-500/20';
    }
    return 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700';
  };

  return (
    <div
      onClick={() => onToggle(student.id)}
      className={`group relative select-none rounded-2xl border p-4 transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md ${getCardStyle()}`}
    >
      <div className="flex items-start gap-3.5">
        {/* Student Photo with indicator */}
        <div className="relative shrink-0">
          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-800 shadow-sm">
            {student.photo_url ? (
              <img
                src={student.photo_url}
                alt={student.full_name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-slate-400 text-lg">
                {student.full_name.charAt(0)}
              </div>
            )}
          </div>

          {/* Quick status badge indicator overlay */}
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center shadow-md border-2 border-white dark:border-slate-900">
            {status === 'present' && (
              <span className="w-full h-full rounded-full bg-emerald-500 flex items-center justify-center text-white">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </span>
            )}
            {status === 'absent' && (
              <span className="w-full h-full rounded-full bg-rose-500 flex items-center justify-center text-white">
                <X className="w-3.5 h-3.5 stroke-[3]" />
              </span>
            )}
            {status === 'late' && (
              <span className="w-full h-full rounded-full bg-amber-500 flex items-center justify-center text-white">
                <Clock className="w-3.5 h-3.5 stroke-[3]" />
              </span>
            )}
            {status === 'unmarked' && (
              <span className="w-full h-full rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500">
                <HelpCircle className="w-3 h-3" />
              </span>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {student.full_name}
            </h4>
            {onViewProfile && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewProfile(student);
                }}
                className="p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity"
                title="View student profile & calendar"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            <span>Roll No: <strong className="text-slate-700 dark:text-slate-200">{student.roll_number}</strong></span>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Attendance:</span>
            <ThresholdBadge percentage={currentPercentage} threshold={threshold} />
          </div>
        </div>
      </div>

      {/* Explicit Toggle Buttons at bottom */}
      <div
        className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onSetStatus(student.id, 'present')}
          className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
            status === 'present'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700'
          }`}
        >
          <Check className="w-3 h-3" /> P
        </button>

        <button
          type="button"
          onClick={() => onSetStatus(student.id, 'absent')}
          className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
            status === 'absent'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700'
          }`}
        >
          <X className="w-3 h-3" /> A
        </button>

        <button
          type="button"
          onClick={() => onSetStatus(student.id, 'late')}
          className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
            status === 'late'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700'
          }`}
        >
          <Clock className="w-3 h-3" /> L
        </button>
      </div>
    </div>
  );
};
