import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getAuthenticatedUser, recordAuditLog } from '@/lib/auth/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Bootstrap endpoint for creating the first administrator account.
 * Security requirements:
 * 1. Requires server-side secret ADMIN_BOOTSTRAP_SECRET (never exposed to client).
 * 2. Uses timing-safe secret comparison.
 * 3. Requires an authenticated user session.
 * 4. Only works when NO administrator currently exists in public.profiles.
 * 5. Protected against repeated abuse; permanently shuts down once an admin is active.
 */
export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json(
        { error: 'Supabase admin client is not configured. Verify SUPABASE_SECRET_KEY in server environment.' },
        { status: 503 }
      );
    }

    const adminClient = createAdminClient();
    const { count, error: countErr } = await adminClient
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'ADMIN');

    if (countErr) {
      throw new Error(`Failed to check existing admin accounts: ${countErr.message}`);
    }

    const adminExists = Boolean(count && count > 0);

    return NextResponse.json({
      available: !adminExists,
      adminExists,
      message: adminExists
        ? 'Bootstrap already completed. An administrator account already exists.'
        : 'First-admin bootstrap is available.',
    });
  } catch (error: any) {
    console.error('API /api/admin/bootstrap GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Unable to check bootstrap status.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const bootstrapSecret = process.env.ADMIN_BOOTSTRAP_SECRET;
    if (!bootstrapSecret) {
      return NextResponse.json(
        { error: 'Bootstrap service is not configured. Set ADMIN_BOOTSTRAP_SECRET in your server environment.' },
        { status: 503 }
      );
    }

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json(
        { error: 'Supabase admin client is not configured. Verify SUPABASE_SECRET_KEY in server environment.' },
        { status: 503 }
      );
    }

    // 1. Authenticate caller
    const authCtx = await getAuthenticatedUser(req);
    if (!authCtx.user || !authCtx.profile) {
      return NextResponse.json(
        { error: 'Authentication required. Sign in before claiming administrator bootstrap privileges.' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const secret = (req.headers.get('x-admin-bootstrap-secret') || body.secret || '').trim();

    if (!secret) {
      return NextResponse.json(
        { error: 'Bootstrap secret is required.' },
        { status: 401 }
      );
    }

    // 2. Timing-safe comparison to prevent side-channel timing attacks
    const secretBuffer = Buffer.from(secret);
    const expectedBuffer = Buffer.from(bootstrapSecret);

    if (
      secretBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(secretBuffer, expectedBuffer)
    ) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid bootstrap secret.' },
        { status: 401 }
      );
    }

    const adminClient = createAdminClient();

    // 3. Verify that NO administrator exists yet in the database
    const { count, error: countErr } = await adminClient
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'ADMIN');

    if (countErr) {
      throw new Error(`Failed to check existing admin accounts: ${countErr.message}`);
    }

    if (count && count > 0) {
      return NextResponse.json(
        {
          error:
            'Bootstrap closed: An administrator account already exists. Additional administrators must be invited by an existing administrator.',
        },
        { status: 403 }
      );
    }

    // 4. Promote authenticated caller to ADMIN
    const { error: updateErr } = await adminClient
      .from('profiles')
      .update({ role: 'ADMIN' })
      .eq('id', authCtx.user.id);

    if (updateErr) throw updateErr;

    // Also update auth.users metadata
    try {
      await adminClient.auth.admin.updateUserById(authCtx.user.id, {
        user_metadata: {
          ...authCtx.user.user_metadata,
          role: 'ADMIN',
        },
      });
    } catch (metaErr) {
      console.warn('[Bootstrap] user_metadata update notice:', metaErr);
    }

    // 5. Record immutable audit log
    await recordAuditLog({
      actorId: authCtx.user.id,
      action: 'INITIAL_ADMIN_BOOTSTRAPPED',
      targetType: 'PROFILE',
      targetId: authCtx.user.id,
      details: {
        email: authCtx.user.email,
        method: 'ADMIN_BOOTSTRAP_SECRET',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Account successfully elevated to system administrator.',
      userId: authCtx.user.id,
      email: authCtx.user.email,
      role: 'ADMIN',
    });
  } catch (error: any) {
    console.error('API /api/admin/bootstrap error:', error);
    return NextResponse.json(
      { error: error.message || 'Unable to bootstrap administrator.' },
      { status: 500 }
    );
  }
}
