'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  GraduationCap,
  CheckCircle2,
  XCircle,
  Clock,
  Percent,
  Calendar,
  AlertCircle,
  TrendingUp,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface StudentData {
  linked: boolean;
  message?: string;
  student?: {
    id: string;
    fullName: string;
    rollNumber: string;
    photoUrl: string | null;
    active: boolean;
    class: {
      id: string;
      name: string;
      section: string;
      academic_year: string;
    };
  };
  stats?: {
    presentCount: number;
    absentCount: number;
    lateCount: number;
    totalSessions: number;
    percentage: number | null;
    isBelowThreshold: boolean;
  };
  monthlyBreakdown?: Array<{
    month: string;
    present: number;
    absent: number;
    total: number;
    rate: number;
  }>;
  history?: Array<{
    id: string;
    date: string;
    status: 'present' | 'absent' | 'late';
    source: string;
  }>;
}

export default function StudentDashboardPage() {
  const [data, setData] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/student/me')
      .then((res) => {
        if (!res.ok) throw new Error('Unable to retrieve student profile.');
        return res.json();
      })
      .then((json) => {
        setData(json);
      })
      .catch((err) => {
        setError(err.message || 'Error loading student portal data.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 font-medium">Loading your attendance records...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-3xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-center max-w-md mx-auto my-12 space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-600 dark:text-rose-400 mx-auto" />
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Connection Error</h3>
        <p className="text-xs text-slate-600 dark:text-slate-400">{error}</p>
      </div>
    );
  }

  // Account is not linked to a student record yet
  if (!data?.linked) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-900">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            Enrollment Record Pending
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
            {data?.message || 'Your account is active, but an administrator has not yet linked it to your student enrollment profile.'}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 text-left space-y-2">
          <p className="font-bold text-slate-800 dark:text-slate-200">What should you do?</p>
          <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-slate-400">
            <li>Contact your class teacher or school administrator.</li>
            <li>Provide your student roll number and registered email address.</li>
            <li>Once approved, your full personal attendance history will populate here automatically.</li>
          </ul>
        </div>
      </div>
    );
  }

  const { student, stats, monthlyBreakdown, history } = data;
  const percentage = stats?.percentage !== null && stats?.percentage !== undefined ? stats.percentage : null;

  return (
    <div className="space-y-6">
      {/* Student Profile Card Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white relative overflow-hidden shadow-xl border border-indigo-800/40">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-violet-600 flex items-center justify-center text-2xl font-black text-white shadow-lg shadow-indigo-500/25 shrink-0 border border-white/20">
              {student?.fullName ? student.fullName.charAt(0) : 'S'}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">{student?.fullName}</h1>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                  Enrolled
                </span>
              </div>
              <p className="text-xs text-indigo-200 flex items-center gap-2">
                <span>Roll No: <strong>{student?.rollNumber}</strong></span>
                <span>•</span>
                <span>Class: <strong>{student?.class?.name} - {student?.class?.section}</strong></span>
                <span>•</span>
                <span>Year: <strong>{student?.class?.academic_year}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right sm:text-right">
              <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-300 block">
                Attendance Rate
              </span>
              <span className="text-3xl font-black tracking-tight text-white">
                {percentage !== null ? `${percentage}%` : 'N/A'}
              </span>
            </div>
            <div className={`w-3 h-12 rounded-full ${percentage !== null && percentage >= 75 ? 'bg-emerald-400' : 'bg-amber-400'} shadow-lg shadow-black/30`} />
          </div>
        </div>

        <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card padding="md" className="space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Overall Rate</span>
            <Percent className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {percentage !== null ? `${percentage}%` : 'N/A'}
          </div>
          <p className="text-[11px] text-slate-400">
            {percentage !== null && percentage >= 75 ? 'Healthy attendance standing' : 'Below 75% target'}
          </p>
        </Card>

        <Card padding="md" className="space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Present</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {stats?.presentCount || 0}
          </div>
          <p className="text-[11px] text-slate-400">Recorded sessions present</p>
        </Card>

        <Card padding="md" className="space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Absent</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
            {stats?.absentCount || 0}
          </div>
          <p className="text-[11px] text-slate-400">Recorded sessions absent</p>
        </Card>

        <Card padding="md" className="space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Sessions</span>
            <Calendar className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {stats?.totalSessions || 0}
          </div>
          <p className="text-[11px] text-slate-400">Total sessions evaluated</p>
        </Card>
      </div>

      {/* Middle Grid: Monthly Breakdown & Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Breakdown */}
        <div className="lg:col-span-2 space-y-4">
          <Card padding="lg" className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Monthly Attendance Trends
            </h3>

            {(!monthlyBreakdown || monthlyBreakdown.length === 0) ? (
              <p className="text-xs text-slate-400 py-6 text-center">No monthly attendance records yet.</p>
            ) : (
              <div className="space-y-3 pt-2">
                {monthlyBreakdown.map((m) => (
                  <div key={m.month} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-800 dark:text-slate-200">{m.month}</span>
                      <span className={m.rate >= 75 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                        {m.rate}% ({m.present} of {m.total} sessions)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          m.rate >= 75
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                            : 'bg-gradient-to-r from-amber-500 to-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, m.rate))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Security & Standing Card */}
        <div className="space-y-4">
          <Card padding="md" className="space-y-3">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" /> Academic Standing
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              ATTENDER calculates your attendance directly from verified classroom scans and teacher sessions in real time.
            </p>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Class Standard:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">75% minimum</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Your Status:</span>
                <span className={`font-bold ${percentage !== null && percentage >= 75 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {percentage !== null ? (percentage >= 75 ? 'On Track' : 'At Risk') : 'Pending Data'}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Attendance History Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Your Attendance History</h3>
            <p className="text-xs text-slate-400 mt-0.5">Chronological record of your recorded class attendance</p>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {history?.length || 0} entries
          </span>
        </div>

        {(!history || history.length === 0) ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No attendance sessions recorded yet for your account.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                      {record.date}
                    </td>
                    <td className="py-3 px-4 capitalize text-slate-500">
                      {record.source === 'classroom_scan' ? 'AI Classroom Scan' : 'Individual Check'}
                    </td>
                    <td className="py-3 px-4">
                      {record.status === 'present' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> Present
                        </span>
                      ) : record.status === 'late' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          <Clock className="w-3 h-3" /> Late
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          <XCircle className="w-3 h-3" /> Absent
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
