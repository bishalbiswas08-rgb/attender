import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getAuthenticatedUser, recordAuditLog } from '@/lib/auth/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authCtx = await getAuthenticatedUser(req);
    if (!authCtx.user || !authCtx.profile) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (!authCtx.isAdmin) {
      return NextResponse.json(
        { error: 'Security Violation: Only institutional administrators can reinstate students.' },
        { status: 403 }
      );
    }

    const { studentId } = await req.json();

    if (!studentId) {
      return NextResponse.json({ error: 'Student ID is required.' }, { status: 400 });
    }

    if (!isSupabaseConfigured() && !isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: 'Database service is not configured.' }, { status: 503 });
    }

    const adminClient = isSupabaseAdminConfigured()
      ? createAdminClient()
      : createServerSupabaseClient();

    const { data: student, error: stdErr } = await adminClient
      .from('students')
      .select('id, full_name, roll_number, class_id, status')
      .eq('id', studentId)
      .maybeSingle();

    if (stdErr || !student) {
      return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
    }

    const now = new Date().toISOString();

    const { error: updateErr } = await adminClient
      .from('students')
      .update({
        status: 'ACTIVE',
        active: true,
        status_reason: null,
        status_changed_at: now,
        status_changed_by: authCtx.user.id,
      })
      .eq('id', student.id);

    if (updateErr) throw updateErr;

    // Reactivate student enrollment
    await adminClient
      .from('student_enrollments')
      .update({
        status: 'ACTIVE',
        ended_at: null,
      })
      .eq('student_id', student.id);

    await recordAuditLog({
      actorId: authCtx.user.id,
      action: 'STUDENT_REINSTATED',
      targetType: 'STUDENT',
      targetId: student.id,
      details: {
        studentName: student.full_name,
        classId: student.class_id,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Student ${student.full_name} has been reinstated to active standing.`,
    });
  } catch (error: any) {
    console.error('API /api/admin/students/reinstate error:', error);
    return NextResponse.json(
      { error: error.message || 'Unable to reinstate student.' },
      { status: 500 }
    );
  }
}
