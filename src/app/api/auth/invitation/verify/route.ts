import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ valid: false, error: 'Token is required.' }, { status: 400 });
    }

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({ valid: false, error: 'Supabase admin is not configured.' }, { status: 503 });
    }

    const adminClient = createAdminClient();
    const { data: invite, error } = await adminClient
      .from('invitations')
      .select('id, email, role, expires_at, accepted_at')
      .eq('token', token.trim())
      .maybeSingle();

    if (error || !invite) {
      return NextResponse.json({
        valid: false,
        error: 'Invalid or unknown invitation token.',
      });
    }

    if (invite.accepted_at) {
      return NextResponse.json({
        valid: false,
        error: 'This invitation has already been accepted.',
      });
    }

    const isExpired = new Date(invite.expires_at).getTime() < Date.now();
    if (isExpired) {
      return NextResponse.json({
        valid: false,
        error: 'This invitation token has expired. Please request a new invitation.',
      });
    }

    return NextResponse.json({
      valid: true,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expires_at,
    });
  } catch (error: any) {
    console.error('API /api/auth/invitation/verify error:', error);
    return NextResponse.json({ valid: false, error: 'Unable to verify invitation.' }, { status: 500 });
  }
}
