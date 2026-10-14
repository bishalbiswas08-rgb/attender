'use client';

import React, { useState, useEffect } from 'react';
import { useAttendance } from '@/lib/context/AttendanceContext';
import { StudentAttendanceCard } from '@/components/attendance/StudentAttendanceCard';
import { AttendanceStatsBar } from '@/components/attendance/AttendanceStatsBar';
import { StudentProfileModal } from '@/components/students/StudentProfileModal';
import { StudentModal } from '@/components/students/StudentModal';
import { Student, AttendanceStatus } from '@/lib/types';
import { UserCheck, Calendar, Search, Users, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import confetti from 'canvas-confetti';

export default function IndividualAttendancePage() {
  const {
    classStudents,
    activeClass,
    activeClassId,
    classes,
    addStudent,
    saveAttendanceSession,
    getStudentStats,
    threshold,
    records,
    sessions,
  } = useAttendance();

  const [targetDate, setTargetDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState<Student | null>(null);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Status mapping: studentId -> 'present' | 'absent' | 'late' | 'unmarked'
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus | 'unmarked'>>({});

  // When class or target date changes, prefill with existing saved records for that date (if any)
  useEffect(() => {
    const existingSession = sessions.find(
      (s) => s.class_id === activeClassId && s.date === targetDate
    );

    const initialMap: Record<string, AttendanceStatus | 'unmarked'> = {};

    if (existingSession) {
      const sessionRecords = records.filter((r) => r.session_id === existingSession.id);
      const recordMap = new Map<string, AttendanceStatus>();
      sessionRecords.forEach((r) => recordMap.set(r.student_id, r.status));

      classStudents.forEach((std) => {
        initialMap[std.id] = recordMap.get(std.id) || 'unmarked';
      });
    } else {
      classStudents.forEach((std) => {
        initialMap[std.id] = 'unmarked';
      });
    }

    setStatusMap(initialMap);
  }, [activeClassId, targetDate, classStudents, sessions, records]);

  // Fast cycle toggle: UNMARKED -> PRESENT -> ABSENT -> UNMARKED
  const handleToggle = (studentId: string) => {
    setStatusMap((prev) => {
      const current = prev[studentId] || 'unmarked';
      let nextStatus: AttendanceStatus | 'unmarked';

      if (current === 'unmarked') nextStatus = 'present';
      else if (current === 'present') nextStatus = 'absent';
      else if (current === 'absent') nextStatus = 'unmarked';
      else nextStatus = 'present';

      return { ...prev, [studentId]: nextStatus };
    });
  };

  const handleSetStatus = (studentId: string, status: AttendanceStatus | 'unmarked') => {
    setStatusMap((prev) => ({ ...prev, [studentId]: status }));
  };

  // Bulk actions
  const handleMarkAllPresent = () => {
    const updated: Record<string, AttendanceStatus | 'unmarked'> = {};
    classStudents.forEach((s) => (updated[s.id] = 'present'));
    setStatusMap(updated);
  };

  const handleMarkAllAbsent = () => {
    const updated: Record<string, AttendanceStatus | 'unmarked'> = {};
    classStudents.forEach((s) => (updated[s.id] = 'absent'));
    setStatusMap(updated);
  };

  const handleClearAll = () => {
    const updated: Record<string, AttendanceStatus | 'unmarked'> = {};
    classStudents.forEach((s) => (updated[s.id] = 'unmarked'));
    setStatusMap(updated);
  };

  // Count summaries
  const presentCount = Object.values(statusMap).filter(
    (s) => s === 'present' || s === 'late'
  ).length;
  const absentCount = Object.values(statusMap).filter((s) => s === 'absent').length;
  const unmarkedCount = Math.max(0, classStudents.length - (presentCount + absentCount));

  // Save to Database
  const handleSave = async () => {
    if (classStudents.length === 0) return;
    setIsSaving(true);
    try {
      const attendanceRecords = classStudents.map((s) => ({
        studentId: s.id,
        status: statusMap[s.id] === 'unmarked' ? ('absent' as AttendanceStatus) : (statusMap[s.id] as AttendanceStatus),
      }));

      await saveAttendanceSession({
        classId: activeClassId,
        date: targetDate,
        source: 'individual',
        records: attendanceRecords,
      });

      // Celebration
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch {}
    } catch (err) {
      console.error('Error saving individual attendance:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Filter students by search
  const filteredStudents = classStudents.filter((s) => {
    const q = searchQuery.toLowerCase();
    return s.full_name.toLowerCase().includes(q) || s.roll_number.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Title & Controls Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <UserCheck className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              Individual Attendance
            </h1>
            {activeClass && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                {activeClass.name} - {activeClass.section}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Tap student card to toggle: <strong>Unmarked &rarr; Present &rarr; Absent</strong>. Attendance writes to database upon clicking Save.
          </p>
        </div>

        {/* Date Selector & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full md:w-auto min-w-0">
          <div className="flex items-center justify-between sm:justify-start gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold shadow-sm w-full sm:w-auto">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer text-xs"
            />
          </div>

          <div className="relative w-full sm:w-auto">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student..."
              className="pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-48 shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Sticky Real-Time Stats Bar */}
      {classStudents.length > 0 && (
        <AttendanceStatsBar
          presentCount={presentCount}
          absentCount={absentCount}
          unmarkedCount={unmarkedCount}
          totalCount={classStudents.length}
          onMarkAllPresent={handleMarkAllPresent}
          onMarkAllAbsent={handleMarkAllAbsent}
          onClearAll={handleClearAll}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}

      {/* Student Cards Grid */}
      {classStudents.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 min-w-0">
          {filteredStudents.map((student) => {
            const stats = getStudentStats(student.id);
            const currentPct = stats ? stats.percentage : null;
            const status = statusMap[student.id] || 'unmarked';

            return (
              <StudentAttendanceCard
                key={student.id}
                student={student}
                currentPercentage={currentPct}
                status={status}
                onToggle={handleToggle}
                onSetStatus={handleSetStatus}
                onViewProfile={(std) => setSelectedStudentForProfile(std)}
                threshold={threshold}
              />
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {classes.length === 0 ? 'No classes yet.' : 'No students yet in this class.'}
            </h4>
            <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mt-1">
              {classes.length === 0
                ? 'Create a class first to start taking attendance.'
                : 'Add students to this class roster to start taking individual attendance.'}
            </p>
          </div>
          <div className="pt-2">
            {classes.length === 0 ? (
              <Button
                variant="primary"
                onClick={() => (window.location.href = '/dashboard/classes')}
                leftIcon={<UserPlus className="w-4 h-4" />}
              >
                CREATE CLASS FIRST
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => setIsAddStudentOpen(true)}
                leftIcon={<UserPlus className="w-4 h-4" />}
                className="font-bold shadow-md shadow-emerald-600/20"
              >
                ADD STUDENT
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Student Profile Modal */}
      <StudentProfileModal
        isOpen={Boolean(selectedStudentForProfile)}
        onClose={() => setSelectedStudentForProfile(null)}
        student={selectedStudentForProfile}
      />

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
