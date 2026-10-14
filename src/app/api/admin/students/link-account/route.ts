import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getAuthenticatedUser, recordAuditLog } from '@/lib/auth/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authCtx = await getAuthenticatedUser(req);
    if (!authCtx.user || !authCtx.isAdmin) {
      return NextResponse.json(
        { error: 'Access denied: Only system administrators can link student accounts.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { studentId, userEmail, action } = body; // action: 'link' | 'unlink'

    if (!studentId) {
      return NextResponse.json({ error: 'Student ID is required.' }, { status: 400 });
    }

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: 'Supabase admin is not configured.' }, { status: 503 });
    }

    const adminClient = createAdminClient();

    // Verify student exists
    const { data: student, error: stdErr } = await adminClient
      .from('students')
      .select('id, full_name, roll_number, profile_id')
      .eq('id', studentId)
      .maybeSingle();

    if (stdErr || !student) {
      return NextResponse.json({ error: 'Student record not found.' }, { status: 404 });
    }

    if (action === 'unlink') {
      const oldProfileId = student.profile_id;

      await adminClient
        .from('students')
        .update({ profile_id: null })
        .eq('id', studentId);

      if (oldProfileId) {
        await adminClient
          .from('profiles')
          .update({ student_id: null })
          .eq('id', oldProfileId);
      }

      await recordAuditLog({
        actorId: authCtx.user.id,
        action: 'STUDENT_ACCOUNT_UNLINKED',
        targetType: 'STUDENT',
        targetId: studentId,
        details: { studentName: student.full_name, previousProfileId: oldProfileId },
      });

      return NextResponse.json({
        success: true,
        message: `Account unlinked from ${student.full_name}.`,
      });
    }

    if (!userEmail) {
      return NextResponse.json({ error: 'User email is required to link account.' }, { status: 400 });
    }

    // Find profile by email
    const { data: userProfile, error: pErr } = await adminClient
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('email', userEmail.toLowerCase().trim())
      .maybeSingle();

    if (pErr || !userProfile) {
      return NextResponse.json(
        { error: `No registered account found with email "${userEmail}". The student must create their login account first.` },
        { status: 404 }
      );
    }

    // Link student record and profile
    await adminClient
      .from('students')
      .update({ profile_id: userProfile.id })
      .eq('id', studentId);

    await adminClient
      .from('profiles')
      .update({ student_id: studentId, role: 'STUDENT' })
      .eq('id', userProfile.id);

    await recordAuditLog({
      actorId: authCtx.user.id,
      action: 'STUDENT_ACCOUNT_LINKED',
      targetType: 'STUDENT',
      targetId: studentId,
      details: {
        studentName: student.full_name,
        rollNumber: student.roll_number,
        userEmail: userProfile.email,
        userId: userProfile.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${student.full_name} successfully linked to portal account (${userProfile.email}).`,
    });
  } catch (error: any) {
    console.error('API /api/admin/students/link-account error:', error);
    return NextResponse.json({ error: error.message || 'Unable to link student account.' }, { status: 500 });
  }
}
