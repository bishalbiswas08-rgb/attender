'use client';

import React, { useState } from 'react';
import { useAttendance } from '@/lib/context/AttendanceContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ThresholdBadge } from '@/components/ui/Badge';
import {
  FileBarChart2,
  Download,
  Printer,
  Calendar,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

export default function ReportsPage() {
  const {
    students,
    activeClass,
    classes,
    threshold,
    getStudentStats,
    dashboardMetrics,
  } = useAttendance();

  const { success } = useToast();
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly' | 'student'>('monthly');
  const today = new Date();
  const currentMonthName = today.toLocaleString('default', { month: 'long', year: 'numeric' });
  const [selectedMonth, setSelectedMonth] = useState(currentMonthName);
  const [sortField, setSortField] = useState<'roll' | 'name' | 'percentage'>('roll');
  const [sortAsc, setSortAsc] = useState(true);

  // Generate dynamic recent months
  const recentMonths = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
  });

  // Filter students for active class
  const classStudents = students.filter((s) => s.class_id === activeClass?.id && s.active);

  // Build rows with dynamically computed stats
  const rows = classStudents.map((s) => {
    const stats = getStudentStats(s.id);
    return {
      student: s,
      roll: s.roll_number,
      name: s.full_name,
      present: stats ? stats.presentCount : 0,
      absent: stats ? stats.absentCount : 0,
      late: stats ? stats.lateCount : 0,
      total: stats ? stats.totalClasses : 0,
      percentage: stats ? stats.percentage : null,
      isBelow: stats ? stats.isBelowThreshold : false,
    };
  });

  // Sort rows
  rows.sort((a, b) => {
    if (sortField === 'roll') {
      const numA = parseInt(a.roll) || 0;
      const numB = parseInt(b.roll) || 0;
      return sortAsc ? numA - numB : numB - numA;
    }
    if (sortField === 'name') {
      return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    }
    const valA = a.percentage ?? -1;
    const valB = b.percentage ?? -1;
    return sortAsc ? valA - valB : valB - valA;
  });

  // Export to CSV
  const exportCSV = () => {
    const headers = ['Roll Number', 'Student Name', 'Class', 'Present', 'Absent', 'Late', 'Total', 'Attendance %', 'Status'];
    const csvContent = [
      headers.join(','),
      ...rows.map((r) =>
        [
          `"${r.roll}"`,
          `"${r.name}"`,
          `"${activeClass ? `${activeClass.name}-${activeClass.section}` : 'N/A'}"`,
          r.present,
          r.absent,
          r.late,
          r.total,
          r.percentage !== null ? `"${r.percentage}%"` : '"N/A"',
          `"${r.isBelow ? 'Below Threshold' : 'Good'}"`,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `attender-report-${activeClass?.name || 'class'}-${activeClass?.section || 'roster'}-${reportType}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    success('Report Exported', 'CSV report downloaded successfully.');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <FileBarChart2 className="w-7 h-7 text-indigo-600 dark:text-indigo-400 shrink-0" />
            Attendance Reports
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Comprehensive audit reports, dynamic monthly ratios, and exportable rosters.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
          <Button
            variant="outline"
            size="md"
            onClick={handlePrint}
            leftIcon={<Printer className="w-4 h-4 text-slate-600" />}
            className="flex-1 sm:flex-initial"
          >
            Print / PDF
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={exportCSV}
            leftIcon={<Download className="w-4 h-4" />}
            className="flex-1 sm:flex-initial font-bold shadow-md shadow-indigo-600/20"
          >
            EXPORT CSV
          </Button>
        </div>
      </div>

      {/* Filter and Mode Bar */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
        {/* Report Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs w-full md:w-auto overflow-x-auto">
          {(['daily', 'weekly', 'monthly', 'student'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setReportType(type)}
              className={`flex-1 md:flex-initial px-3 sm:px-3.5 py-1.5 rounded-lg font-bold capitalize transition-colors whitespace-nowrap ${
                reportType === type
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {type} Report
            </button>
          ))}
        </div>

        {/* Class and Range Pickers */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] text-slate-500 font-medium sm:hidden">Month:</span>
            </div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer font-medium"
            >
              {recentMonths.map((m) => (
                <option key={m} value={m} className="bg-white dark:bg-slate-900">
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Overview Metric Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 min-w-0">
          <span className="text-xs font-bold text-slate-500 uppercase">Class Average</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {dashboardMetrics.overallPercentage !== null ? `${dashboardMetrics.overallPercentage}%` : 'N/A'}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 min-w-0">
          <span className="text-xs font-bold text-slate-500 uppercase">Total Enrolled</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {classStudents.length}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 min-w-0">
          <span className="text-xs font-bold text-slate-500 uppercase">Meeting Threshold</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {classStudents.length - dashboardMetrics.studentsBelowThreshold}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 min-w-0">
          <span className="text-xs font-bold text-slate-500 uppercase">Below {threshold}%</span>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {dashboardMetrics.studentsBelowThreshold}
          </p>
        </div>
      </div>

      {/* Roster Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {activeClass?.name} - {activeClass?.section} Detailed Breakdown
          </h3>
          <span className="text-xs text-slate-400">{rows.length} records</span>
        </div>

        {rows.length === 0 ? (
          <div className="text-center py-12 p-6 space-y-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No attendance data available.
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {classStudents.length === 0
                ? 'No students enrolled in this class yet. Add students from the Students tab.'
                : 'Take attendance using Classroom Scan or Individual Mark to view reports.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th
                    onClick={() => {
                      setSortField('roll');
                      setSortAsc(!sortAsc);
                    }}
                    className="py-3 px-4 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>Roll</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => {
                      setSortField('name');
                      setSortAsc(!sortAsc);
                    }}
                    className="py-3 px-4 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>Student Name</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">Present</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">Absent</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">Late</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">Total</th>
                  <th
                    onClick={() => {
                      setSortField('percentage');
                      setSortAsc(!sortAsc);
                    }}
                    className="py-3 px-4 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 text-center whitespace-nowrap"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Attendance %</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {rows.map((row) => (
                  <tr key={row.student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {row.roll}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                          {row.student.photo_url ? (
                            <img src={row.student.photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-bold text-slate-400">
                              {row.name[0]}
                            </div>
                          )}
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {row.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center text-emerald-700 dark:text-emerald-400 font-bold whitespace-nowrap">
                      {row.present}
                    </td>
                    <td className="py-3 px-4 text-center text-rose-700 dark:text-rose-400 font-bold whitespace-nowrap">
                      {row.absent}
                    </td>
                    <td className="py-3 px-4 text-center text-amber-600 font-bold whitespace-nowrap">
                      {row.late}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {row.total}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <ThresholdBadge percentage={row.percentage} threshold={threshold} />
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {row.isBelow ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                          <AlertTriangle className="w-3 h-3" /> At Risk
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" /> Good
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
