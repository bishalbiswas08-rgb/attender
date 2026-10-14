import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getAuthenticatedUser, recordAuditLog } from '@/lib/auth/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authCtx = await getAuthenticatedUser(req);
    if (!authCtx.user || !authCtx.profile) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (!isSupabaseConfigured() && !isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: 'Database service is not configured.' }, { status: 503 });
    }

    const adminClient = isSupabaseAdminConfigured()
      ? createAdminClient()
      : createServerSupabaseClient();

    const { data: subjects, error: subErr } = await adminClient
      .from('subjects')
      .select('id, name, code, description, active, created_at')
      .order('name', { ascending: true });

    if (subErr) throw subErr;

    return NextResponse.json({ subjects: subjects || [] });
  } catch (error: any) {
    console.error('API /api/admin/subjects GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Unable to retrieve subjects.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCtx = await getAuthenticatedUser(req);
    if (!authCtx.user || !authCtx.profile) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (!authCtx.isAdmin) {
      return NextResponse.json(
        { error: 'Security Violation: Only institutional administrators can create subjects.' },
        { status: 403 }
      );
    }

    const { name, code, description } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Subject name is required.' }, { status: 400 });
    }

    if (!isSupabaseConfigured() && !isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: 'Database service is not configured.' }, { status: 503 });
    }

    const adminClient = isSupabaseAdminConfigured()
      ? createAdminClient()
      : createServerSupabaseClient();

    const trimmedName = name.trim();
    const trimmedCode = code?.trim() || null;

    const { data: newSubject, error: insErr } = await adminClient
      .from('subjects')
      .insert({
        name: trimmedName,
        code: trimmedCode,
        description: description?.trim() || null,
        active: true,
      })
      .select('*')
      .single();

    if (insErr) throw insErr;

    await recordAuditLog({
      actorId: authCtx.user.id,
      action: 'SUBJECT_CREATED',
      targetType: 'SUBJECT',
      targetId: newSubject.id,
      details: {
        name: trimmedName,
        code: trimmedCode,
      },
    });

    return NextResponse.json({
      success: true,
      subject: newSubject,
      message: `Subject "${trimmedName}" created successfully.`,
    });
  } catch (error: any) {
    console.error('API /api/admin/subjects POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Unable to create subject.' },
      { status: 500 }
    );
  }
}
