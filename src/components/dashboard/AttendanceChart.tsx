'use client';

import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { AttendanceSession, AttendanceRecord } from '@/lib/types';
import { BarChart3, TrendingUp, PieChart, CalendarX2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../ui/Button';

interface AttendanceChartProps {
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
  presentCount: number;
  absentCount: number;
  overallPercentage: number | null;
}

export const AttendanceChart: React.FC<AttendanceChartProps> = ({
  sessions,
  records,
  presentCount,
  absentCount,
  overallPercentage,
}) => {
  const [chartType, setChartType] = useState<'timeline' | 'distribution'>('timeline');

  // Compute actual session trend points from real Supabase records
  const trendData = sessions
    .slice(0, 10)
    .reverse()
    .map((session) => {
      const sessionRecords = records.filter((r) => r.session_id === session.id);
      const pres = sessionRecords.filter((r) => r.status === 'present' || r.status === 'late').length;
      const abs = sessionRecords.filter((r) => r.status === 'absent').length;
      const total = pres + abs;
      const rate = total > 0 ? Math.round((pres / total) * 100) : 0;

      // Format date e.g. "Oct 12"
      const dateParts = session.date.split('-');
      const formattedDate = dateParts.length === 3 ? `${dateParts[1]}/${dateParts[2]}` : session.date;

      return {
        date: formattedDate,
        rate,
        present: pres,
        absent: abs,
        isScan: session.source === 'classroom_scan',
      };
    });

  const totalMarked = presentCount + absentCount;
  const presentPct = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : null;
  const absentPct = presentPct !== null ? 100 - presentPct : null;

  // If there are zero sessions recorded yet in Supabase
  if (sessions.length === 0) {
    return (
      <Card padding="lg" className="text-center py-12 space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center mx-auto">
          <CalendarX2 className="w-6 h-6" />
        </div>
        <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
          No attendance recorded yet
        </h4>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Perform a classroom scan or mark individual attendance to populate analytics and attendance trends over time.
        </p>
        <div className="pt-2">
          <Link href="/dashboard/scan">
            <Button variant="scan" size="sm">
              Scan Classroom
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="md" className="space-y-4">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Attendance Analytics & Trends
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Calculated from actual Supabase sessions ({sessions.length} sessions recorded)
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
          <button
            onClick={() => setChartType('timeline')}
            className={`px-3 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
              chartType === 'timeline'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" /> Sessions
          </button>
          <button
            onClick={() => setChartType('distribution')}
            className={`px-3 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
              chartType === 'distribution'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" /> Today&apos;s Ratio
          </button>
        </div>
      </div>

      {/* Chart Body */}
      {chartType === 'timeline' ? (
        <div className="space-y-4 pt-2">
          {/* Bar Chart Representation */}
          <div className="h-44 flex items-end justify-between gap-2 sm:gap-4 pt-4 px-2 border-b border-slate-100 dark:border-slate-800">
            {trendData.map((item, idx) => {
              const heightPct = Math.max(15, Math.min(100, item.rate));
              const isLatest = idx === trendData.length - 1;

              return (
                <div key={`${item.date}-${idx}`} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="relative w-full flex items-end justify-center h-32">
                    {/* Tooltip */}
                    <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-10">
                      {item.rate}% ({item.present}P / {item.absent}A)
                    </div>

                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full max-w-[28px] rounded-t-lg transition-all duration-300 ${
                        isLatest
                          ? 'bg-gradient-to-t from-indigo-600 to-blue-500 shadow-md shadow-indigo-500/30'
                          : item.rate < 75
                          ? 'bg-amber-400 dark:bg-amber-500'
                          : 'bg-emerald-400/80 hover:bg-emerald-500'
                      }`}
                    />
                  </div>
                  <span className={`text-[10px] font-medium truncate ${isLatest ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
                    {item.date}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Normal (&ge;75%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> Below Threshold
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600" /> Latest Session
            </span>
          </div>
        </div>
      ) : (
        /* Present vs Absent Ratio View */
        <div className="py-6 space-y-5">
          {totalMarked > 0 ? (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Present ({presentPct}%)
                  </span>
                  <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" /> Absent ({absentPct}%)
                  </span>
                </div>

                {/* Progress Bar Stack */}
                <div className="h-5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex p-1 border border-slate-200 dark:border-slate-700">
                  <div
                    style={{ width: `${presentPct}%` }}
                    className="h-full bg-emerald-500 rounded-l-full transition-all duration-500"
                  />
                  <div
                    style={{ width: `${absentPct}%` }}
                    className="h-full bg-rose-500 rounded-r-full transition-all duration-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">Today&apos;s Present</p>
                  <p className="text-xl font-black text-emerald-800 dark:text-emerald-200 mt-1">{presentCount}</p>
                </div>
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                  <p className="text-xs text-rose-700 dark:text-rose-300 font-semibold">Today&apos;s Absent</p>
                  <p className="text-xl font-black text-rose-800 dark:text-rose-200 mt-1">{absentCount}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-6 text-xs text-slate-500">
              No attendance recorded for today yet.
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
