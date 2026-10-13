'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAttendance } from '@/lib/context/AttendanceContext';
import { useToast } from '@/components/ui/Toast';
import { StatCard } from '@/components/dashboard/StatCard';
import { AttendanceChart } from '@/components/dashboard/AttendanceChart';
import { ThresholdAlert } from '@/components/dashboard/ThresholdAlert';
import { RecentActivityList } from '@/components/dashboard/RecentActivityList';
import { StudentModal } from '@/components/students/StudentModal';
import { Button } from '@/components/ui/Button';
import {
  Camera,
  UserCheck,
  UserPlus,
  Users,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Percent,
  Sparkles,
  ArrowRight,
  GraduationCap,
  Plus,
} from 'lucide-react';

export default function DashboardPage() {
  const { success } = useToast();
  const {
    activeClass,
    dashboardMetrics,
    threshold,
    recentActivities,
    classes,
    activeClassId,
    addStudent,
    sessions,
    records,
    isSupabaseLive,
  } = useAttendance();

  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);

  // Check if arriving from successful email confirmation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('confirmed') === 'true') {
        success('Email Confirmed', 'Your email address has been verified. Welcome to ATTENDER!');
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [success]);

  return (
    <div className="space-y-6">
      {/* Supabase connection warning banner if env is not configured */}
      {!isSupabaseLive && (
        <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-800/80 text-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span>
              <strong>Supabase Setup Notice:</strong> Add your <code className="bg-indigo-900/60 px-1.5 py-0.5 rounded text-white">NEXT_PUBLIC_SUPABASE_URL</code> and credentials in <code className="bg-indigo-900/60 px-1.5 py-0.5 rounded text-white">.env.local</code> to activate live database sync and storage.
            </span>
          </div>
          <Link
            href="/dashboard/settings"
            className="font-bold underline hover:text-white shrink-0"
          >
            Settings & Setup &rarr;
          </Link>
        </div>
      )}

      {/* Welcome & Quick Action Hero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Dashboard
            </h1>
            {activeClass && (
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
                {activeClass.name} - {activeClass.section}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {activeClass
              ? `Real-time classroom attendance overview • Academic Year ${activeClass.academic_year}`
              : 'Classroom attendance overview'}
          </p>
        </div>

        {/* Quick Actions Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/dashboard/scan">
            <Button
              variant="scan"
              size="md"
              leftIcon={<Camera className="w-4 h-4 text-white" />}
              className="font-bold shadow-md shadow-indigo-600/25"
            >
              SCAN CLASSROOM
            </Button>
          </Link>

          <Link href="/dashboard/individual">
            <Button
              variant="secondary"
              size="md"
              leftIcon={<UserCheck className="w-4 h-4 text-emerald-600" />}
              className="font-bold"
            >
              MARK INDIVIDUAL
            </Button>
          </Link>

          <Button
            variant="outline"
            size="md"
            onClick={() => setIsAddStudentOpen(true)}
            leftIcon={<UserPlus className="w-4 h-4 text-indigo-600" />}
            className="font-bold"
          >
            ADD STUDENT
          </Button>
        </div>
      </div>

      {/* Empty State: If no classes created yet */}
      {classes.length === 0 && (
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <GraduationCap className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Start by creating a class and adding students
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
              Create your first class roster (e.g. Class XII-A), register your students with frontal photos, and take attendance in seconds.
            </p>
          </div>
          <div className="pt-2">
            <Link href="/dashboard/classes">
              <Button variant="primary" size="lg" leftIcon={<Plus className="w-5 h-5" />}>
                Create Your First Class
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Threshold Alert if students are under 75% */}
      <ThresholdAlert
        count={dashboardMetrics.studentsBelowThreshold}
        threshold={threshold}
      />

      {/* Primary Attendance Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Present Today"
          value={dashboardMetrics.todayPresent}
          subtitle={
            dashboardMetrics.todayPercentage !== null
              ? `${dashboardMetrics.todayPercentage}% attendance rate`
              : 'No sessions today'
          }
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="emerald"
        />

        <StatCard
          title="Absent Today"
          value={dashboardMetrics.todayAbsent}
          subtitle="Unexcused or missing"
          icon={<XCircle className="w-5 h-5" />}
          color="rose"
        />

        <StatCard
          title="Unmarked"
          value={dashboardMetrics.todayUnmarked}
          subtitle={`Out of ${dashboardMetrics.todayTotal} enrolled`}
          icon={<HelpCircle className="w-5 h-5" />}
          color="slate"
        />

        <StatCard
          title="Overall Attendance"
          value={
            dashboardMetrics.overallPercentage !== null
              ? `${dashboardMetrics.overallPercentage}%`
              : 'N/A'
          }
          subtitle={`Class standard: ${threshold}% minimum`}
          icon={<Percent className="w-5 h-5" />}
          color="indigo"
          badge={
            dashboardMetrics.overallPercentage !== null
              ? dashboardMetrics.overallPercentage >= threshold
                ? 'Healthy'
                : 'Needs Attention'
              : undefined
          }
        />
      </div>

      {/* Middle Grid: Charts & Live Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Charts (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <AttendanceChart
            sessions={sessions}
            records={records}
            presentCount={dashboardMetrics.todayPresent}
            absentCount={dashboardMetrics.todayAbsent}
            overallPercentage={dashboardMetrics.overallPercentage}
          />

          {/* Quick Classroom Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-900 to-slate-900 text-white relative overflow-hidden shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative z-10 max-w-lg space-y-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider">
                <Sparkles className="w-3 h-3 text-amber-300" /> Fast Workflow
              </span>
              <h3 className="text-lg font-black tracking-tight">
                Complete Attendance Under 60 Seconds
              </h3>
              <p className="text-xs text-indigo-200">
                Position your mobile or laptop camera, instruct &ldquo;Everyone look at the camera,&rdquo; and let Gemini AI verify all visible frontal faces against the roster.
              </p>
            </div>

            <Link href="/dashboard/scan" className="relative z-10 shrink-0">
              <Button
                variant="primary"
                size="md"
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="bg-white text-indigo-900 hover:bg-indigo-50 font-bold border-none"
              >
                Launch Scanner
              </Button>
            </Link>

            <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-indigo-500/20 rounded-full blur-2xl" />
          </div>
        </div>

        {/* Right: Live Activity & Class Info (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <RecentActivityList activities={recentActivities} />

          {/* At-a-glance Roster card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Class Roster Summary
              </h4>
              <Link
                href="/dashboard/students"
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                View All
              </Link>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {dashboardMetrics.todayTotal} active students registered in {activeClass ? `${activeClass.name}-${activeClass.section}` : 'class'}.
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <span className="text-slate-500">Below {threshold}% Attendance:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                {dashboardMetrics.studentsBelowThreshold} student(s)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Student Modal */}
      <StudentModal
        isOpen={isAddStudentOpen}
        onClose={() => setIsAddStudentOpen(false)}
        classes={classes}
        defaultClassId={activeClassId}
        onSave={addStudent}
      />
    </div>
  );
}
