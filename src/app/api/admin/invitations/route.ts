import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getAuthenticatedUser, generateInvitationToken, recordAuditLog } from '@/lib/auth/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/invitations - List all system invitations (Admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const authCtx = await getAuthenticatedUser(req);
    if (!authCtx.user || !authCtx.isAdmin) {
      return NextResponse.json(
        { error: 'Access denied: Only system administrators can view invitations.' },
        { status: 403 }
      );
    }

    const adminClient = isSupabaseAdminConfigured()
      ? createAdminClient()
      : null;

    if (!adminClient) {
      return NextResponse.json({ error: 'Supabase admin is not configured.' }, { status: 503 });
    }

    const { data: invitations, error } = await adminClient
      .from('invitations')
      .select('*, inviter:invited_by(full_name, email)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ invitations: invitations || [] });
  } catch (error: any) {
    console.error('API /api/admin/invitations GET error:', error);
    return NextResponse.json({ error: error.message || 'Unable to retrieve invitations.' }, { status: 500 });
  }
}

/**
 * POST /api/admin/invitations - Create a single-use expiring invitation for Admin or Teacher (Admin only)
 */
export async function POST(req: NextRequest) {
  try {
    const authCtx = await getAuthenticatedUser(req);
    if (!authCtx.user || !authCtx.isAdmin) {
      return NextResponse.json(
        { error: 'Access denied: Only system administrators can generate invitations.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { email, role } = body;

    if (!email || !role || !['ADMIN', 'TEACHER'].includes(role)) {
      return NextResponse.json(
        { error: 'Valid email and role (ADMIN or TEACHER) are required.' },
        { status: 400 }
      );
    }

    const adminClient = isSupabaseAdminConfigured()
      ? createAdminClient()
      : null;

    if (!adminClient) {
      return NextResponse.json({ error: 'Supabase admin is not configured.' }, { status: 503 });
    }

    const token = generateInvitationToken();
    // Valid for 7 days
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invitation, error } = await adminClient
      .from('invitations')
      .insert({
        email: email.toLowerCase().trim(),
        role,
        token,
        invited_by: authCtx.user.id,
        expires_at: expiresAt,
      })
      .select('*')
      .single();

    if (error) throw error;

    await recordAuditLog({
      actorId: authCtx.user.id,
      action: 'INVITATION_GENERATED',
      targetType: 'INVITATION',
      targetId: invitation.id,
      details: {
        email: email.toLowerCase().trim(),
        role,
        expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      invitation,
      message: `Single-use invitation generated for ${email} with role ${role}.`,
    });
  } catch (error: any) {
    console.error('API /api/admin/invitations POST error:', error);
    return NextResponse.json({ error: error.message || 'Unable to create invitation.' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/invitations - Revoke an invitation (Admin only)
 */
export async function DELETE(req: NextRequest) {
  try {
    const authCtx = await getAuthenticatedUser(req);
    if (!authCtx.user || !authCtx.isAdmin) {
      return NextResponse.json(
        { error: 'Access denied: Only system administrators can revoke invitations.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Invitation ID is required.' }, { status: 400 });
    }

    const adminClient = isSupabaseAdminConfigured()
      ? createAdminClient()
      : null;

    if (!adminClient) {
      return NextResponse.json({ error: 'Supabase admin is not configured.' }, { status: 503 });
    }

    const { error } = await adminClient.from('invitations').delete().eq('id', id);
    if (error) throw error;

    await recordAuditLog({
      actorId: authCtx.user.id,
      action: 'INVITATION_REVOKED',
      targetType: 'INVITATION',
      targetId: id,
    });

    return NextResponse.json({ success: true, message: 'Invitation revoked successfully.' });
  } catch (error: any) {
    console.error('API /api/admin/invitations DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Unable to delete invitation.' }, { status: 500 });
  }
}
