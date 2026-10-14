import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getAuthenticatedUser, recordAuditLog } from '@/lib/auth/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authCtx = await getAuthenticatedUser(req);
    if (!authCtx.user || !authCtx.profile) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in to accept your invitation.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Invitation token is required.' }, { status: 400 });
    }

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: 'Supabase admin is not configured.' }, { status: 503 });
    }

    const adminClient = createAdminClient();
    const { data: invite, error: fetchErr } = await adminClient
      .from('invitations')
      .select('*')
      .eq('token', token.trim())
      .maybeSingle();

    if (fetchErr || !invite) {
      return NextResponse.json({ error: 'Invalid or unknown invitation token.' }, { status: 400 });
    }

    if (invite.accepted_at) {
      return NextResponse.json({ error: 'This invitation has already been accepted.' }, { status: 400 });
    }

    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'This invitation has expired.' }, { status: 400 });
    }

    // Verify email match (case-insensitive)
    const userEmail = (authCtx.user.email || '').toLowerCase().trim();
    const inviteEmail = (invite.email || '').toLowerCase().trim();

    if (userEmail !== inviteEmail) {
      return NextResponse.json(
        { error: `This invitation was issued to "${invite.email}". Please sign in with that exact email address to accept.` },
        { status: 403 }
      );
    }

    // Mark invitation accepted
    await adminClient
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    // Update profile role
    await adminClient
      .from('profiles')
      .update({ role: invite.role })
      .eq('id', authCtx.user.id);

    // Record in audit log
    await recordAuditLog({
      actorId: authCtx.user.id,
      action: 'INVITATION_ACCEPTED',
      targetType: 'PROFILE',
      targetId: authCtx.user.id,
      details: {
        email: userEmail,
        role: invite.role,
        invitationId: invite.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Invitation accepted! Your account has been promoted to ${invite.role}.`,
      role: invite.role,
    });
  } catch (error: any) {
    console.error('API /api/auth/invitation/accept error:', error);
    return NextResponse.json({ error: error.message || 'Unable to accept invitation.' }, { status: 500 });
  }
}
