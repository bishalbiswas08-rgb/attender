'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Student } from '@/lib/types';
import { useAttendance } from '@/lib/context/AttendanceContext';
import { ThresholdBadge } from '../ui/Badge';
import { Calendar as CalendarIcon, CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

interface StudentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  isOpen,
  onClose,
  student,
}) => {
  const { getStudentStats, threshold, activeClass } = useAttendance();
  const today = new Date();
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(today.getMonth());
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());

  if (!student) return null;

  const stats = getStudentStats(student.id);
  const percentage = stats ? stats.percentage : null;
  const presentCount = stats ? stats.presentCount : 0;
  const absentCount = stats ? stats.absentCount : 0;
  const lateCount = stats ? stats.lateCount : 0;
  const totalClasses = stats ? stats.totalClasses : 0;

  // Generate days in the selected month
  const daysInMonth = new Date(currentYear, selectedMonthIdx + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Month string for looking up records
  const monthPadded = String(selectedMonthIdx + 1).padStart(2, '0');

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="2xl">
      <div className="space-y-6">
        {/* Top Profile Header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shadow-md shrink-0">
            {student.photo_url ? (
              <img src={student.photo_url} alt={student.full_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-2xl text-slate-400">
                {student.full_name[0]}
              </div>
            )}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {student.full_name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Roll Number: <strong className="text-slate-700 dark:text-slate-200">{student.roll_number}</strong> • Class: {activeClass?.name}-{activeClass?.section}
                </p>
              </div>
              <div>
                <ThresholdBadge percentage={percentage} threshold={threshold} />
              </div>
            </div>

            {/* Quick Stat Badges */}
            <div className="grid grid-cols-4 gap-2 mt-4 text-center">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase">Present</span>
                <p className="text-base font-black text-emerald-800 dark:text-emerald-200">{presentCount}</p>
              </div>
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                <span className="text-[10px] font-semibold text-rose-700 dark:text-rose-400 uppercase">Absent</span>
                <p className="text-base font-black text-rose-800 dark:text-rose-200">{absentCount}</p>
              </div>
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase">Late</span>
                <p className="text-base font-black text-amber-800 dark:text-amber-200">{lateCount}</p>
              </div>
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase">Total</span>
                <p className="text-base font-black text-slate-800 dark:text-slate-200">{totalClasses}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Month Selector Tabs */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Monthly Calendar Breakdown
            </h4>

            {/* Month Switcher */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  if (selectedMonthIdx === 0) {
                    setSelectedMonthIdx(11);
                    setCurrentYear((y) => y - 1);
                  } else {
                    setSelectedMonthIdx((m) => m - 1);
                  }
                }}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 text-xs font-bold text-slate-700 dark:text-slate-200 min-w-[110px] text-center">
                {MONTH_NAMES[selectedMonthIdx]} {currentYear}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (selectedMonthIdx === 11) {
                    setSelectedMonthIdx(0);
                    setCurrentYear((y) => y + 1);
                  } else {
                    setSelectedMonthIdx((m) => m + 1);
                  }
                }}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Interactive Day Grid */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-3 px-1">
              <span>{MONTH_NAMES[selectedMonthIdx]} {currentYear}</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> P = Present
                </span>
                <span className="flex items-center gap-1 font-medium text-rose-700 dark:text-rose-400">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> A = Absent
                </span>
                <span className="flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> L = Late
                </span>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {daysArray.map((day) => {
                const dayPadded = String(day).padStart(2, '0');
                const dateKey = `${currentYear}-${monthPadded}-${dayPadded}`;
                const recordStatus = stats?.recordsByDate[dateKey];

                let bgClass = 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200/60 dark:border-slate-800';
                let label = String(day);
                let badge = null;

                if (recordStatus === 'present') {
                  bgClass = 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 font-bold';
                  badge = 'P';
                } else if (recordStatus === 'absent') {
                  bgClass = 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700 font-bold';
                  badge = 'A';
                } else if (recordStatus === 'late') {
                  bgClass = 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700 font-bold';
                  badge = 'L';
                }

                return (
                  <div
                    key={day}
                    className={`h-12 rounded-xl border flex flex-col items-center justify-center p-1 text-xs transition-transform hover:scale-105 ${bgClass}`}
                  >
                    <span className="text-[10px] opacity-75">{day}</span>
                    {badge && <span className="text-xs font-black">{badge}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
          >
            Close Profile
          </button>
        </div>
      </div>
    </Modal>
  );
};
