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

    const { requestId } = await req.json();
    if (!requestId) {
      return NextResponse.json({ error: 'Request ID is required.' }, { status: 400 });
    }

    if (!isSupabaseConfigured() && !isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: 'Database service is not configured.' }, { status: 503 });
    }

    const adminClient = isSupabaseAdminConfigured()
      ? createAdminClient()
      : createServerSupabaseClient();

    // Verify request belongs to caller and is PENDING
    const { data: request, error: findErr } = await adminClient
      .from('enrollment_requests')
      .select('id, user_id, status, class_id')
      .eq('id', requestId)
      .maybeSingle();

    if (findErr || !request) {
      return NextResponse.json({ error: 'Enrollment request not found.' }, { status: 404 });
    }

    if (request.user_id !== authCtx.user.id && !authCtx.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized to withdraw this request.' }, { status: 403 });
    }

    if (request.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Cannot withdraw request with status "${request.status}".` },
        { status: 400 }
      );
    }

    const { error: updateErr } = await adminClient
      .from('enrollment_requests')
      .update({
        status: 'WITHDRAWN',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateErr) throw updateErr;

    await recordAuditLog({
      actorId: authCtx.user.id,
      action: 'ENROLLMENT_WITHDRAWN',
      targetType: 'ENROLLMENT_REQUEST',
      targetId: requestId,
      details: { classId: request.class_id },
    });

    return NextResponse.json({ success: true, message: 'Enrollment request withdrawn.' });
  } catch (error: any) {
    console.error('API /api/student/enrollment/withdraw error:', error);
    return NextResponse.json(
      { error: error.message || 'Unable to withdraw enrollment request.' },
      { status: 500 }
    );
  }
}
