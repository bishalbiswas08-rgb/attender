'use client';

import React from 'react';
import { Student } from '@/lib/types';
import { ThresholdBadge } from '../ui/Badge';
import { Edit2, Trash2, Calendar, Mail } from 'lucide-react';
import { useAttendance } from '@/lib/context/AttendanceContext';

interface StudentCardProps {
  student: Student;
  onEdit: (student: Student) => void;
  onDelete: (studentId: string) => void;
  onViewProfile: (student: Student) => void;
}

export const StudentCard: React.FC<StudentCardProps> = ({
  student,
  onEdit,
  onDelete,
  onViewProfile,
}) => {
  const { getStudentStats, threshold, classes, isAdmin } = useAttendance();
  const stats = getStudentStats(student.id);
  const percentage = stats ? stats.percentage : null;

  const studentClass = classes.find((c) => c.id === student.class_id);

  return (
    <div className="group rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 flex flex-col justify-between w-full min-w-0 overflow-hidden">
      <div className="min-w-0">
        {/* Top Info */}
        <div className="flex items-start gap-3.5 sm:gap-4 min-w-0">
          <div
            onClick={() => onViewProfile(student)}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shrink-0 cursor-pointer shadow-sm group-hover:scale-105 transition-transform"
          >
            {student.photo_url ? (
              <img
                src={student.photo_url}
                alt={student.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-slate-400 text-lg sm:text-xl">
                {student.full_name.charAt(0)}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h4
              onClick={() => onViewProfile(student)}
              className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              {student.full_name}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              Roll No: <span className="font-semibold text-slate-700 dark:text-slate-200">{student.roll_number}</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {studentClass ? `${studentClass.name}-${studentClass.section}` : 'Class'}
            </p>

            <div className="flex items-center gap-1.5 sm:gap-2 mt-2 flex-wrap">
              <span className="text-[11px] text-slate-500 shrink-0">Attendance:</span>
              <ThresholdBadge percentage={percentage} threshold={threshold} />
            </div>
          </div>
        </div>

        {student.email && (
          <div className="flex items-center gap-1.5 mt-3 text-[11px] text-slate-400 min-w-0 overflow-hidden">
            <Mail className="w-3 h-3 shrink-0" />
            <span className="truncate break-all">{student.email}</span>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 sm:pt-4 mt-3 sm:mt-4 border-t border-slate-100 dark:border-slate-800/80">
        <button
          onClick={() => onViewProfile(student)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors py-1"
        >
          <Calendar className="w-3.5 h-3.5" /> View Profile
        </button>

        {isAdmin && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(student)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
              title="Edit student"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(student.id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
              title="Delete student"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
