import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';
import { calculateBunks } from '@/lib/attendance/calculations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authCtx = await getAuthenticatedUser(req);
    if (!authCtx.user || !authCtx.profile) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in to access student portal.' },
        { status: 401 }
      );
    }

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: 'Database service is not configured.' }, { status: 503 });
    }

    const adminClient = createAdminClient();

    // 1. Locate student record linked to this user's profile ID
    const { data: student, error: stdErr } = await adminClient
      .from('students')
      .select('id, full_name, roll_number, photo_url, active, status, status_reason, status_changed_at, class_id, class:class_id(id, name, section, academic_year)')
      .eq('profile_id', authCtx.user.id)
      .maybeSingle();

    if (stdErr) throw stdErr;

    // 2. If no student profile linked yet, return enrollment requests status & available classes
    if (!student) {
      const { data: requests } = await adminClient
        .from('enrollment_requests')
        .select(`
          id,
          class_id,
          status,
          requested_at,
          reviewed_at,
          review_reason,
          submitted_photo_url,
          message,
          class:class_id(id, name, section, academic_year)
        `)
        .eq('user_id', authCtx.user.id)
        .order('created_at', { ascending: false });

      const { data: availableClasses } = await adminClient
        .from('classes')
        .select('id, name, section, academic_year')
        .order('name', { ascending: true });

      return NextResponse.json({
        linked: false,
        profile: {
          id: authCtx.user.id,
          email: authCtx.user.email,
          fullName: authCtx.profile.full_name,
        },
        requests: requests || [],
        availableClasses: availableClasses || [],
        message: 'Your account is active, but not yet linked to an enrolled student record.',
      });
    }

    // 3. Fetch student's assigned teachers
    const { data: classTeachers } = await adminClient
      .from('class_teachers')
      .select('teacher:teacher_id(id, full_name, email)')
      .eq('class_id', student.class_id);

    const teachers = (classTeachers || [])
      .map((ct: any) => ct.teacher)
      .filter(Boolean);

    // 4. Fetch class subjects
    const { data: classSubjectsRaw } = await adminClient
      .from('class_subjects')
      .select(`
        id,
        subject_id,
        teacher_id,
        subject:subject_id(id, name, code, description, active),
        teacher:teacher_id(id, full_name, email)
      `)
      .eq('class_id', student.class_id);

    const classSubjects = (classSubjectsRaw || []).map((cs: any) => ({
      id: cs.id,
      subjectId: cs.subject_id,
      subject: cs.subject,
      teacher: cs.teacher,
    }));

    // Create a subject lookup map
    const subjectMap = new Map<string, any>();
    classSubjects.forEach((cs) => {
      if (cs.subject) {
        subjectMap.set(cs.subject.id, {
          ...cs.subject,
          teacherName: cs.teacher?.full_name,
        });
      }
    });

    // 5. Fetch student's attendance records
    const { data: records, error: recErr } = await adminClient
      .from('attendance')
      .select('id, status, marked_at, session:session_id(id, date, source, subject_id)')
      .eq('student_id', student.id)
      .order('marked_at', { ascending: false });

    if (recErr) throw recErr;

    const attendanceRecords = records || [];

    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;

    // Track per-subject attendance: subjectId -> { present, absent, late, total }
    const subjectAttendanceMap = new Map<string, { present: number; absent: number; late: number; total: number }>();

    // Initialize all assigned subjects in the map
    classSubjects.forEach((cs) => {
      if (cs.subjectId) {
        subjectAttendanceMap.set(cs.subjectId, { present: 0, absent: 0, late: 0, total: 0 });
      }
    });

    const history = attendanceRecords.map((r: any) => {
      const isPresent = r.status === 'present';
      const isAbsent = r.status === 'absent';
      const isLate = r.status === 'late';

      if (isPresent) presentCount++;
      else if (isAbsent) absentCount++;
      else if (isLate) {
        lateCount++;
        presentCount++; // late counts towards present
      }

      const subjId = r.session?.subject_id;
      if (subjId) {
        if (!subjectAttendanceMap.has(subjId)) {
          subjectAttendanceMap.set(subjId, { present: 0, absent: 0, late: 0, total: 0 });
        }
        const sStats = subjectAttendanceMap.get(subjId)!;
        sStats.total++;
        if (isPresent || isLate) sStats.present++;
        else if (isAbsent) sStats.absent++;
        if (isLate) sStats.late++;
      }

      const subjectMeta = subjId ? subjectMap.get(subjId) : null;

      return {
        id: r.id,
        date: r.session?.date || r.marked_at?.split('T')[0],
        status: r.status,
        source: r.session?.source || 'individual',
        subjectId: subjId || null,
        subjectName: subjectMeta?.name || (subjId ? 'Assigned Subject' : 'General Session'),
        subjectCode: subjectMeta?.code || null,
      };
    });

    const totalMarked = presentCount + absentCount;
    const percentage = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 1000) / 10 : null;

    // Overall dynamic bunk calculation
    const overallBunk = calculateBunks(presentCount, totalMarked, 75);

    // Subject-wise stats with individual bunk calculations
    const subjectWiseStats = Array.from(subjectAttendanceMap.entries()).map(([subjId, sData]) => {
      const sMeta = subjectMap.get(subjId);
      const subjPct = sData.total > 0 ? Math.round((sData.present / sData.total) * 1000) / 10 : null;
      const subjBunk = calculateBunks(sData.present, sData.total, 75);

      return {
        subjectId: subjId,
        subjectName: sMeta?.name || 'Class Subject',
        subjectCode: sMeta?.code || '',
        description: sMeta?.description || '',
        teacherName: sMeta?.teacherName || null,
        presentCount: sData.present,
        absentCount: sData.absent,
        lateCount: sData.late,
        totalClasses: sData.total,
        percentage: subjPct,
        isBelowThreshold: subjPct !== null ? subjPct < 75 : false,
        bunkCalculation: subjBunk,
      };
    });

    // Monthly breakdown
    const monthlyStats: Record<string, { present: number; absent: number; total: number }> = {};
    history.forEach((h: any) => {
      const monthKey = h.date?.substring(0, 7) || 'Current';
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = { present: 0, absent: 0, total: 0 };
      }
      if (h.status === 'present' || h.status === 'late') monthlyStats[monthKey].present++;
      else if (h.status === 'absent') monthlyStats[monthKey].absent++;
      monthlyStats[monthKey].total++;
    });

    const isRusticated = student.status === 'RUSTICATED';

    return NextResponse.json({
      linked: true,
      isRusticated,
      student: {
        id: student.id,
        fullName: student.full_name,
        rollNumber: student.roll_number,
        photoUrl: student.photo_url,
        active: student.active,
        status: student.status,
        statusReason: student.status_reason,
        statusChangedAt: student.status_changed_at,
        class: student.class,
      },
      teachers,
      assignedSubjects: classSubjects,
      stats: {
        presentCount,
        absentCount,
        lateCount,
        totalSessions: totalMarked,
        percentage,
        isBelowThreshold: percentage !== null ? percentage < 75 : false,
        bunkCalculation: overallBunk,
      },
      subjectWiseStats,
      monthlyBreakdown: Object.entries(monthlyStats).map(([month, data]) => ({
        month,
        present: data.present,
        absent: data.absent,
        total: data.total,
        rate: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0,
      })),
      history,
    });
  } catch (error: any) {
    console.error('API /api/student/me error:', error);
    return NextResponse.json({ error: error.message || 'Unable to retrieve student profile.' }, { status: 500 });
  }
}
