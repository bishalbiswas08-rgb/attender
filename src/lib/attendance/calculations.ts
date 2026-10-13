import { AttendanceRecord, AttendanceSession, Student, StudentAttendanceStats } from '../types';

export const DEFAULT_THRESHOLD = 75;

/**
 * Calculates dynamic attendance percentage given present and total count.
 * Returns null if total <= 0, representing "N/A".
 * Formula: (Present / Total Attendance Sessions) * 100
 */
export function calculatePercentage(present: number, total: number): number | null {
  if (total <= 0) return null;
  const pct = (present / total) * 100;
  return Math.round(pct * 100) / 100; // Round to 2 decimal places e.g. 85.71%
}

/**
 * Format percentage helper: renders "85.71%" or "N/A"
 */
export function formatPercentage(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return 'N/A';
  return `${pct}%`;
}

/**
 * Calculates student attendance stats across actual Supabase attendance records.
 */
export function calculateStudentStats(
  student: Student,
  records: AttendanceRecord[],
  threshold = DEFAULT_THRESHOLD
): StudentAttendanceStats {
  const studentRecords = records.filter((r) => r.student_id === student.id);

  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  const recordsByDate: Record<string, 'present' | 'absent' | 'late'> = {};

  studentRecords.forEach((record) => {
    if (record.status === 'present') presentCount++;
    else if (record.status === 'absent') absentCount++;
    else if (record.status === 'late') lateCount++;

    const dateKey = record.marked_at ? record.marked_at.split('T')[0] : '';
    if (dateKey) {
      recordsByDate[dateKey] = record.status;
    }
  });

  const totalClasses = presentCount + absentCount + lateCount;
  const percentage = calculatePercentage(presentCount, totalClasses);
  const isBelowThreshold = percentage !== null && percentage < threshold;

  return {
    studentId: student.id,
    studentName: student.full_name,
    rollNumber: student.roll_number,
    photoUrl: student.photo_url,
    presentCount,
    absentCount,
    lateCount,
    totalClasses,
    percentage,
    isBelowThreshold,
    recordsByDate,
  };
}

/**
 * Calculates aggregated stats for a class or range of sessions.
 */
export function calculateClassStats(
  students: Student[],
  records: AttendanceRecord[],
  threshold = DEFAULT_THRESHOLD
) {
  if (students.length === 0) {
    return {
      studentStats: [],
      totalPresent: 0,
      totalAbsent: 0,
      totalLate: 0,
      totalClasses: 0,
      overallPercentage: null as number | null,
      lowAttendanceStudents: [],
    };
  }

  const studentStats = students.map((s) => calculateStudentStats(s, records, threshold));

  const totalClasses = studentStats.reduce((acc, s) => acc + s.totalClasses, 0);
  const totalPresent = studentStats.reduce((acc, s) => acc + s.presentCount, 0);
  const totalAbsent = studentStats.reduce((acc, s) => acc + s.absentCount, 0);
  const totalLate = studentStats.reduce((acc, s) => acc + s.lateCount, 0);

  const overallPercentage = calculatePercentage(totalPresent, totalClasses);
  const lowAttendanceStudents = studentStats.filter((s) => s.isBelowThreshold);

  return {
    studentStats,
    totalPresent,
    totalAbsent,
    totalLate,
    totalClasses,
    overallPercentage,
    lowAttendanceStudents,
  };
}

/**
 * Filter records for a specific date (YYYY-MM-DD)
 */
export function filterRecordsByDate(
  records: AttendanceRecord[],
  sessions: AttendanceSession[],
  targetDate: string
): AttendanceRecord[] {
  const sessionIdsOnDate = new Set(
    sessions.filter((s) => s.date === targetDate).map((s) => s.id)
  );
  return records.filter((r) => sessionIdsOnDate.has(r.session_id));
}

/**
 * Filter records for a given month (YYYY-MM)
 */
export function filterRecordsByMonth(
  records: AttendanceRecord[],
  sessions: AttendanceSession[],
  yearMonth: string // e.g. "2026-10"
): AttendanceRecord[] {
  const sessionIdsInMonth = new Set(
    sessions.filter((s) => s.date.startsWith(yearMonth)).map((s) => s.id)
  );
  return records.filter((r) => sessionIdsInMonth.has(r.session_id));
}
