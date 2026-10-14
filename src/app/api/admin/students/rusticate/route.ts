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

    // STRICT: ADMIN ONLY
    if (!authCtx.isAdmin) {
      return NextResponse.json(
        { error: 'Security Violation: Only institutional administrators can rusticate students.' },
        { status: 403 }
      );
    }

    const { studentId, reason } = await req.json();

    if (!studentId) {
      return NextResponse.json({ error: 'Student ID is required.' }, { status: 400 });
    }

    const rusticationReason = reason?.trim() || 'Administrative disciplinary action.';

    if (!isSupabaseConfigured() && !isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: 'Database service is not configured.' }, { status: 503 });
    }

    const adminClient = isSupabaseAdminConfigured()
      ? createAdminClient()
      : createServerSupabaseClient();

    // 1. Find student
    const { data: student, error: stdErr } = await adminClient
      .from('students')
      .select('id, full_name, roll_number, class_id, status')
      .eq('id', studentId)
      .maybeSingle();

    if (stdErr || !student) {
      return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
    }

    if (student.status === 'RUSTICATED') {
      return NextResponse.json({ error: 'Student is already rusticated.' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // 2. Update student status to RUSTICATED (active = false, preserves historical records)
    const { error: updateErr } = await adminClient
      .from('students')
      .update({
        status: 'RUSTICATED',
        active: false,
        status_reason: rusticationReason,
        status_changed_at: now,
        status_changed_by: authCtx.user.id,
      })
      .eq('id', student.id);

    if (updateErr) throw updateErr;

    // 3. Mark active enrollment as RUSTICATED
    await adminClient
      .from('student_enrollments')
      .update({
        status: 'RUSTICATED',
        ended_at: now,
      })
      .eq('student_id', student.id)
      .eq('status', 'ACTIVE');

    // 4. Cancel any pending enrollment requests
    await adminClient
      .from('enrollment_requests')
      .update({
        status: 'REJECTED',
        reviewed_at: now,
        reviewed_by: authCtx.user.id,
        review_reason: `Automatic rejection: Student rusticated (${rusticationReason}).`,
      })
      .eq('student_id', student.id)
      .eq('status', 'PENDING');

    // 5. Record audit log
    await recordAuditLog({
      actorId: authCtx.user.id,
      action: 'STUDENT_RUSTICATED',
      targetType: 'STUDENT',
      targetId: student.id,
      details: {
        studentName: student.full_name,
        rollNumber: student.roll_number,
        classId: student.class_id,
        reason: rusticationReason,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Student ${student.full_name} has been rusticated. Portal access suspended and historical records preserved.`,
    });
  } catch (error: any) {
    console.error('API /api/admin/students/rusticate error:', error);
    return NextResponse.json(
      { error: error.message || 'Unable to rusticate student.' },
      { status: 500 }
    );
  }
}
