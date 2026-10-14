import { AttendanceRecord, AttendanceSession, Student, StudentAttendanceStats, AttendanceStatus } from '../types';

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
  const recordsByDate: Record<string, AttendanceStatus> = {};

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

/**
 * Calculates dynamic Allowed Bunks or Needed Recovery Classes.
 *
 * Formulas:
 * Let P = classes attended (present + late)
 * Let T = total classes evaluated
 * Let R = required attendance percentage as a decimal (e.g. 0.75 for 75%)
 *
 * 1. If currently SAFE (P / T >= R):
 *    Find max B such that P / (T + B) >= R => B <= P / R - T
 *    B = floor(P / R - T)
 *
 * 2. If currently AT RISK (P / T < R):
 *    Find min A such that (P + A) / (T + A) >= R => A >= (R * T - P) / (1 - R)
 *    A = ceil((R * T - P) / (1 - R))
 */
export function calculateBunks(
  present: number,
  total: number,
  threshold = DEFAULT_THRESHOLD
): import('../types').BunkCalculation {
  const reqDecimal = threshold / 100;

  if (total <= 0) {
    return {
      allowedBunks: 0,
      recoveryNeeded: 0,
      isSafe: true,
      message: 'No classes held yet.',
      currentPercentage: null,
      requiredPercentage: threshold,
      attended: 0,
      total: 0,
    };
  }

  const currentPct = (present / total) * 100;
  const roundedPct = Math.round(currentPct * 100) / 100;

  if (currentPct >= threshold) {
    const maxBunks = Math.floor(present / reqDecimal - total);
    const safeBunks = Math.max(0, maxBunks);
    return {
      allowedBunks: safeBunks,
      recoveryNeeded: 0,
      isSafe: true,
      message:
        safeBunks === 0
          ? 'On threshold limit — do not miss next class.'
          : `You're safe to miss ${safeBunks} more ${safeBunks === 1 ? 'class' : 'classes'}.`,
      currentPercentage: roundedPct,
      requiredPercentage: threshold,
      attended: present,
      total,
    };
  } else {
    // Need consecutive attendances
    const needed = Math.ceil((reqDecimal * total - present) / (1 - reqDecimal));
    const safeNeeded = Math.max(1, needed);
    return {
      allowedBunks: 0,
      recoveryNeeded: safeNeeded,
      isSafe: false,
      message: `Attend next ${safeNeeded} consecutive ${safeNeeded === 1 ? 'class' : 'classes'} to reach ${threshold}%.`,
      currentPercentage: roundedPct,
      requiredPercentage: threshold,
      attended: present,
      total,
    };
  }
}

/**
 * Calculates subject-wise attendance statistics for a student.
 */
export function calculateSubjectStats(
  studentId: string,
  subject: import('../types').Subject,
  records: AttendanceRecord[],
  sessions: AttendanceSession[],
  threshold = DEFAULT_THRESHOLD
): import('../types').SubjectAttendanceStats {
  // Find sessions for this subject
  const subjectSessionMap = new Map(
    sessions.filter((s) => s.subject_id === subject.id).map((s) => [s.id, s])
  );

  const studentSubjectRecords = records.filter(
    (r) => r.student_id === studentId && subjectSessionMap.has(r.session_id)
  );

  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;

  studentSubjectRecords.forEach((r) => {
    if (r.status === 'present') presentCount++;
    else if (r.status === 'absent') absentCount++;
    else if (r.status === 'late') {
      lateCount++;
      presentCount++; // late counts towards present
    }
  });

  const totalClasses = studentSubjectRecords.length;
  const percentage = calculatePercentage(presentCount, totalClasses);
  const isBelowThreshold = percentage !== null && percentage < threshold;
  const bunkCalculation = calculateBunks(presentCount, totalClasses, threshold);

  return {
    subjectId: subject.id,
    subjectName: subject.name,
    subjectCode: subject.code,
    teacherName: subject.teacher?.full_name,
    presentCount,
    absentCount,
    lateCount,
    totalClasses,
    percentage,
    isBelowThreshold,
    bunkCalculation,
  };
}
