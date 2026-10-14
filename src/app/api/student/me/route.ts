import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';
import { calculateBunks } from '@/lib/attendance/calculations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  let authenticatedUserId: string | null = null;

  try {
    // 1. Verify Server Environment Configuration (Item 9)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasAdminSecret = isSupabaseAdminConfigured();
    const hasClientConfig = isSupabaseConfigured();

    if (!supabaseUrl || (!hasAdminSecret && !hasClientConfig)) {
      console.error('[Student Profile Error] Missing server-side configuration: Database service credentials not configured.');
      return NextResponse.json(
        {
          error: 'Server configuration error: Database service credentials are not configured on this environment.',
          code: 'ENV_CONFIG_MISSING',
        },
        { status: 503 }
      );
    }

    // 2. Authentication Check — Derives identity ONLY from authenticated session (Item 1, 4)
    const authCtx = await getAuthenticatedUser(req);
    authenticatedUserId = authCtx.user?.id || null;

    // Safe Diagnostic Logging (Item 8)
    console.log('[Student Profile] Auth check:', {
      userId: authenticatedUserId,
      role: authCtx.role,
      hasProfile: !!authCtx.profile,
      profileStudentId: authCtx.profile?.student_id || null,
    });

    if (!authCtx.user || !authCtx.profile) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in to access the student portal.' },
        { status: 401 }
      );
    }

    // Strict role check: Must be STUDENT
    if (authCtx.role !== 'STUDENT') {
      return NextResponse.json(
        { error: 'Access denied: The student portal is strictly restricted to student accounts.' },
        { status: 403 }
      );
    }

    const dbClient = hasAdminSecret ? createAdminClient() : createServerSupabaseClient();

    // 3. Resolve the actual database relationship (Item 2)
    // auth.users.id -> public.profiles.id -> public.profiles.student_id -> public.students.id
    let student: any = null;

    // Path A: Via public.profiles.student_id
    if (authCtx.profile.student_id) {
      const { data: stdById, error: stdByIdErr } = await dbClient
        .from('students')
        .select('*')
        .eq('id', authCtx.profile.student_id)
        .maybeSingle();

      if (stdByIdErr) {
        console.warn('[Student Profile] Warning querying student by profile.student_id:', stdByIdErr.message);
      } else if (stdById) {
        student = stdById;
      }
    }

    // Path B: Fallback via public.students.profile_id
    if (!student) {
      const { data: stdByProfile, error: stdByProfileErr } = await dbClient
        .from('students')
        .select('*')
        .eq('profile_id', authCtx.user.id)
        .maybeSingle();

      if (stdByProfileErr) {
        console.warn('[Student Profile] Warning querying student by students.profile_id:', stdByProfileErr.message);
      } else if (stdByProfile) {
        student = stdByProfile;

        // Auto-synchronize profile.student_id if missing
        if (!authCtx.profile.student_id && hasAdminSecret) {
          try {
            await dbClient
              .from('profiles')
              .update({ student_id: stdByProfile.id })
              .eq('id', authCtx.user.id);
          } catch {}
        }
      }
    }

    // Path C: Fallback via student email match
    if (!student && authCtx.user.email) {
      const { data: stdByEmail, error: stdByEmailErr } = await dbClient
        .from('students')
        .select('*')
        .ilike('email', authCtx.user.email.trim())
        .maybeSingle();

      if (!stdByEmailErr && stdByEmail) {
        student = stdByEmail;

        // Link account both ways if service role is available
        if (hasAdminSecret) {
          try {
            await dbClient
              .from('students')
              .update({ profile_id: authCtx.user.id })
              .eq('id', stdByEmail.id);
            await dbClient
              .from('profiles')
              .update({ student_id: stdByEmail.id })
              .eq('id', authCtx.user.id);
          } catch {}
        }
      }
    }

    // Safe Diagnostic Logging (Item 8)
    console.log('[Student Profile] Student record resolution:', {
      userId: authenticatedUserId,
      foundStudent: !!student,
      studentId: student?.id || null,
      classId: student?.class_id || null,
    });

    // 4. Handle Unlinked / Unenrolled State Gracefully (Item 2, 5)
    if (!student) {
      let requests: any[] = [];
      try {
        const { data: reqsData, error: reqsErr } = await dbClient
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
          .order('requested_at', { ascending: false });

        if (!reqsErr && reqsData) {
          requests = reqsData;
        }
      } catch (err: any) {
        console.warn('[Student Profile] Enrollment requests query error (table may not exist yet):', err?.message);
      }

      let availableClasses: any[] = [];
      try {
        const { data: classesData, error: classesErr } = await dbClient
          .from('classes')
          .select('id, name, section, academic_year')
          .order('name', { ascending: true });

        if (!classesErr && classesData) {
          availableClasses = classesData;
        }
      } catch (err: any) {
        console.warn('[Student Profile] Classes query warning:', err?.message);
      }

      return NextResponse.json({
        status: 'NOT_ENROLLED',
        linked: false,
        profile: {
          id: authCtx.user.id,
          email: authCtx.user.email,
          fullName: authCtx.profile.full_name,
        },
        requests,
        availableClasses,
        message: 'Student profile not linked yet. Submit an enrollment request to get started.',
      });
    }

    // 5. Enrolled Student: Resolve Class, Teachers, Subjects, Attendance
    let classItem: any = null;
    if (student.class_id) {
      try {
        const { data: clsData } = await dbClient
          .from('classes')
          .select('id, name, section, academic_year')
          .eq('id', student.class_id)
          .maybeSingle();
        classItem = clsData;
      } catch (err: any) {
        console.warn('[Student Profile] Class lookup warning:', err?.message);
      }
    }

    // Fetch assigned teachers for student's class
    let teachers: any[] = [];
    if (student.class_id) {
      try {
        const { data: ctData } = await dbClient
          .from('class_teachers')
          .select('teacher:teacher_id(id, full_name, email)')
          .eq('class_id', student.class_id);

        if (ctData) {
          teachers = ctData.map((ct: any) => ct.teacher).filter(Boolean);
        }
      } catch (err: any) {
        console.warn('[Student Profile] Teachers lookup warning:', err?.message);
      }
    }

    // Fetch assigned subjects
    let classSubjects: any[] = [];
    const subjectMap = new Map<string, any>();

    if (student.class_id) {
      // Strategy 1: class_subjects modular mapping
      try {
        const { data: csRaw } = await dbClient
          .from('class_subjects')
          .select(`
            id,
            subject_id,
            teacher_id,
            subject:subject_id(id, name, code, description, active),
            teacher:teacher_id(id, full_name, email)
          `)
          .eq('class_id', student.class_id);

        if (csRaw && csRaw.length > 0) {
          classSubjects = csRaw.map((cs: any) => ({
            id: cs.id,
            subjectId: cs.subject_id,
            subject: cs.subject,
            teacher: cs.teacher,
          }));
        }
      } catch {}

      // Strategy 2: Direct subjects table where class_id matches
      if (classSubjects.length === 0) {
        try {
          const { data: directSubjects } = await dbClient
            .from('subjects')
            .select('id, name, code, description, active, teacher_id')
            .eq('class_id', student.class_id);

          if (directSubjects && directSubjects.length > 0) {
            classSubjects = directSubjects.map((s: any) => ({
              id: s.id,
              subjectId: s.id,
              subject: s,
              teacher: null,
            }));
          }
        } catch {}
      }

      classSubjects.forEach((cs) => {
        if (cs.subject) {
          subjectMap.set(cs.subject.id, {
            ...cs.subject,
            teacherName: cs.teacher?.full_name,
          });
        }
      });
    }

    // Fetch student's attendance records (strictly filtered to student.id — Item 7)
    let attendanceRecords: any[] = [];
    try {
      const { data: records, error: recErr } = await dbClient
        .from('attendance')
        .select('id, status, marked_at, session:session_id(id, date, source, subject_id)')
        .eq('student_id', student.id)
        .order('marked_at', { ascending: false });

      if (!recErr && records) {
        attendanceRecords = records;
      }
    } catch (err: any) {
      console.warn('[Student Profile] Attendance lookup warning:', err?.message);
    }

    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;

    const subjectAttendanceMap = new Map<string, { present: number; absent: number; late: number; total: number }>();

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
        presentCount++;
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

    const studentStatus = student.status || (student.active ? 'ACTIVE' : 'INACTIVE');
    const isRusticated = studentStatus === 'RUSTICATED';

    return NextResponse.json({
      status: 'ENROLLED',
      linked: true,
      isRusticated,
      student: {
        id: student.id,
        fullName: student.full_name,
        rollNumber: student.roll_number,
        photoUrl: student.photo_url,
        active: student.active,
        status: studentStatus,
        statusReason: student.status_reason || null,
        statusChangedAt: student.status_changed_at || null,
        class: classItem,
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
    // Safe Diagnostic Logging (Item 8)
    console.error('[Student Profile Error]', {
      userId: authenticatedUserId,
      errorMessage: error?.message,
      errorCode: error?.code,
    });
    return NextResponse.json(
      { error: error?.message || 'Unable to retrieve student profile.' },
      { status: 500 }
    );
  }
}
