import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authCtx = await getAuthenticatedUser(req);
    if (!authCtx.user || !authCtx.profile) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      );
    }

    if (!isSupabaseConfigured() && !isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: 'Database service is not configured.' }, { status: 503 });
    }

    const adminClient = isSupabaseAdminConfigured()
      ? createAdminClient()
      : createServerSupabaseClient();

    // 1. Fetch user's enrollment requests
    const { data: requests, error: reqErr } = await adminClient
      .from('enrollment_requests')
      .select('*, class:class_id(id, name, section, academic_year), reviewer:reviewed_by(full_name, email)')
      .eq('user_id', authCtx.user.id)
      .order('requested_at', { ascending: false });

    if (reqErr) throw reqErr;

    // 2. Fetch available classes for enrollment
    const { data: classes, error: classErr } = await adminClient
      .from('classes')
      .select('id, name, section, academic_year')
      .order('name', { ascending: true });

    if (classErr) throw classErr;

    // 3. Check active student record and enrollment
    let studentRecord = null;
    let activeEnrollment = null;

    if (authCtx.studentId) {
      const { data: std } = await adminClient
        .from('students')
        .select('id, full_name, roll_number, photo_url, active, status, status_reason, class:class_id(id, name, section, academic_year)')
        .eq('id', authCtx.studentId)
        .maybeSingle();

      studentRecord = std;

      const { data: enrollment } = await adminClient
        .from('student_enrollments')
        .select('*, class:class_id(id, name, section, academic_year)')
        .eq('student_id', authCtx.studentId)
        .eq('status', 'ACTIVE')
        .maybeSingle();

      activeEnrollment = enrollment;
    }

    return NextResponse.json({
      success: true,
      isRusticated: authCtx.isRusticated || studentRecord?.status === 'RUSTICATED',
      rusticationReason: studentRecord?.status_reason || null,
      student: studentRecord,
      activeEnrollment,
      requests: requests || [],
      availableClasses: classes || [],
    });
  } catch (error: any) {
    console.error('API /api/student/enrollment/status error:', error);
    return NextResponse.json(
      { error: error.message || 'Unable to retrieve enrollment status.' },
      { status: 500 }
    );
  }
}
