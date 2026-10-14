import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getAuthenticatedUser, verifyClassAccess, verifySubjectAccess, recordAuditLog } from '@/lib/auth/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. Enforce authentication and RBAC authorization server-side
    const authCtx = await getAuthenticatedUser(req);
    if (!authCtx.user || !authCtx.profile) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in to record attendance.' },
        { status: 401 }
      );
    }

    const currentUser = authCtx.user;

    if (authCtx.isStudent) {
      return NextResponse.json(
        { error: 'Access forbidden. Students cannot record or modify attendance.' },
        { status: 403 }
      );
    }

    const payload = await req.json();
    const { classId, subjectId, date, source, records, imageUrl } = payload;

    if (!classId || !date || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { error: 'Invalid attendance payload. Class ID, date, and student records are required.' },
        { status: 400 }
      );
    }

    // 2. Verify authorization for the target class (IDOR protection)
    const hasClassAccess = await verifyClassAccess(authCtx, classId);
    if (!hasClassAccess) {
      return NextResponse.json(
        { error: 'Access denied: You are not authorized to record attendance for this class.' },
        { status: 403 }
      );
    }

    // If subjectId is provided, verify subject access
    if (subjectId) {
      const hasSubjectAccess = await verifySubjectAccess(authCtx, classId, subjectId);
      if (!hasSubjectAccess) {
        return NextResponse.json(
          { error: 'Access denied: You are not assigned to teach this subject in this class.' },
          { status: 403 }
        );
      }
    }

    if (!isSupabaseConfigured() && !isSupabaseAdminConfigured()) {
      return NextResponse.json(
        { error: 'Supabase is not configured. Add credentials in .env.local to save attendance.' },
        { status: 503 }
      );
    }

    const supabase = isSupabaseAdminConfigured()
      ? createAdminClient()
      : createServerSupabaseClient();

    // 3. Verify that all submitted student IDs belong to this class AND are ACTIVE (not RUSTICATED)
    const studentIds = records.map((r: { studentId: string }) => r.studentId);
    const { data: validStudents, error: validStdErr } = await supabase
      .from('students')
      .select('id, full_name, status, active')
      .eq('class_id', classId)
      .in('id', studentIds);

    if (validStdErr) {
      throw new Error(`Database error verifying roster: ${validStdErr.message}`);
    }

    const validStudentMap = new Map((validStudents || []).map((s: any) => [s.id, s]));
    const invalidStudents = records.filter((r: { studentId: string }) => !validStudentMap.has(r.studentId));

    if (invalidStudents.length > 0) {
      return NextResponse.json(
        {
          error: `Access denied: One or more student IDs in this submission do not belong to class ${classId}.`,
        },
        { status: 403 }
      );
    }

    // Check for rusticated/inactive students
    const rusticated = records.find((r: { studentId: string }) => {
      const s = validStudentMap.get(r.studentId);
      return s?.status === 'RUSTICATED' || s?.active === false;
    });

    if (rusticated) {
      const s = validStudentMap.get(rusticated.studentId);
      return NextResponse.json(
        {
          error: `Cannot record attendance for ${s?.full_name || 'student'}: Account is rusticated or inactive.`,
        },
        { status: 400 }
      );
    }

    const validStatuses = ['present', 'absent', 'late'];
    const hasInvalidStatus = records.some((r: { status: string }) => !validStatuses.includes(r.status));
    if (hasInvalidStatus) {
      return NextResponse.json(
        { error: 'Invalid attendance status. Status must be present, absent, or late.' },
        { status: 400 }
      );
    }

    const filteredRecords = records;

    // 4. Check if session exists for this date, class, and subject
    let sessionQuery = supabase
      .from('attendance_sessions')
      .select('id')
      .eq('class_id', classId)
      .eq('date', date);

    if (subjectId) {
      sessionQuery = sessionQuery.eq('subject_id', subjectId);
    } else {
      sessionQuery = sessionQuery.is('subject_id', null);
    }

    const { data: existingSessions, error: sessionFindErr } = await sessionQuery;

    if (sessionFindErr) {
      throw new Error(`Database error querying session: ${sessionFindErr.message}`);
    }

    let sessionId: string;

    if (existingSessions && existingSessions.length > 0) {
      sessionId = existingSessions[0].id;
      // Delete old records for this session to avoid duplicates
      await supabase.from('attendance').delete().eq('session_id', sessionId);
    } else {
      const { data: newSession, error: sessionErr } = await supabase
        .from('attendance_sessions')
        .insert({
          class_id: classId,
          subject_id: subjectId || null,
          date,
          created_by: currentUser.id,
          source: source || 'individual',
          image_url: imageUrl || null,
        })
        .select('id')
        .single();

      if (sessionErr) throw sessionErr;
      sessionId = newSession.id;
    }

    // 5. Insert new attendance rows with verified marked_by
    const rowsToInsert = filteredRecords.map((r: { studentId: string; status: string }) => ({
      session_id: sessionId,
      student_id: r.studentId,
      status: r.status,
      marked_by: currentUser.id,
      marked_at: new Date().toISOString(),
    }));

    const { error: insertErr } = await supabase.from('attendance').insert(rowsToInsert);
    if (insertErr) throw insertErr;

    // 6. Record audit log
    await recordAuditLog({
      actorId: currentUser.id,
      action: 'ATTENDANCE_SAVED',
      targetType: 'ATTENDANCE_SESSION',
      targetId: sessionId,
      details: {
        classId,
        subjectId: subjectId || null,
        date,
        source: source || 'individual',
        recordCount: rowsToInsert.length,
      },
    });

    return NextResponse.json({
      success: true,
      sessionId,
      count: rowsToInsert.length,
      message: 'Attendance saved successfully with verified authorization.',
    });
  } catch (error: any) {
    console.error('API /api/attendance/save error:', error);
    return NextResponse.json(
      { error: error.message || 'Unable to save attendance.' },
      { status: 500 }
    );
  }
}
