import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getAuthenticatedUser, verifyClassAccess, recordAuditLog } from '@/lib/auth/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authCtx = await getAuthenticatedUser(req);
    if (!authCtx.user || !authCtx.profile) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (authCtx.isStudent) {
      return NextResponse.json(
        { error: 'Access forbidden: Students cannot assign or change roll numbers.' },
        { status: 403 }
      );
    }

    const { studentId, rollNumber } = await req.json();

    if (!studentId || !rollNumber || !rollNumber.trim()) {
      return NextResponse.json(
        { error: 'Student ID and non-empty roll number are required.' },
        { status: 400 }
      );
    }

    const trimmedRoll = rollNumber.trim();

    if (!isSupabaseConfigured() && !isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: 'Database service is not configured.' }, { status: 503 });
    }

    const adminClient = isSupabaseAdminConfigured()
      ? createAdminClient()
      : createServerSupabaseClient();

    // 1. Fetch target student
    const { data: student, error: stdErr } = await adminClient
      .from('students')
      .select('id, full_name, roll_number, class_id, status')
      .eq('id', studentId)
      .maybeSingle();

    if (stdErr || !student) {
      return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
    }

    // 2. Authorization check: Teacher must be assigned to student's class, or be Admin
    const hasAccess = await verifyClassAccess(authCtx, student.class_id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied: You are not authorized to modify students in this class.' },
        { status: 403 }
      );
    }

    // 3. Check duplicate roll number in this class
    const { data: existingStudent } = await adminClient
      .from('students')
      .select('id, full_name')
      .eq('class_id', student.class_id)
      .eq('roll_number', trimmedRoll)
      .eq('status', 'ACTIVE')
      .neq('id', student.id)
      .maybeSingle();

    if (existingStudent) {
      return NextResponse.json(
        {
          error: `Roll number "${trimmedRoll}" is already assigned to active student ${existingStudent.full_name} in this class.`,
        },
        { status: 409 }
      );
    }

    const oldRoll = student.roll_number;

    // 4. Update student roll number
    const { error: updateErr } = await adminClient
      .from('students')
      .update({ roll_number: trimmedRoll })
      .eq('id', student.id);

    if (updateErr) throw updateErr;

    // Also update active student enrollment record if exists
    await adminClient
      .from('student_enrollments')
      .update({ roll_number: trimmedRoll })
      .eq('student_id', student.id)
      .eq('status', 'ACTIVE');

    // 5. Audit log
    await recordAuditLog({
      actorId: authCtx.user.id,
      action: 'ROLL_NUMBER_CHANGED',
      targetType: 'STUDENT',
      targetId: student.id,
      details: {
        classId: student.class_id,
        studentName: student.full_name,
        oldRoll,
        newRoll: trimmedRoll,
      },
    });

    return NextResponse.json({
      success: true,
      rollNumber: trimmedRoll,
      message: `Roll number updated to ${trimmedRoll} for ${student.full_name}.`,
    });
  } catch (error: any) {
    console.error('API /api/teacher/students/roll-number error:', error);
    return NextResponse.json(
      { error: error.message || 'Unable to update roll number.' },
      { status: 500 }
    );
  }
}
