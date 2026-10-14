import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authCtx = await getAuthenticatedUser(req);
    if (!authCtx.user || !authCtx.isAdmin) {
      return NextResponse.json(
        { error: 'Access denied: Only system administrators can inspect audit logs.' },
        { status: 403 }
      );
    }

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: 'Supabase admin is not configured.' }, { status: 503 });
    }

    const adminClient = createAdminClient();
    const { data: logs, error } = await adminClient
      .from('audit_logs')
      .select('*, actor:actor_id(full_name, email, role)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    return NextResponse.json({ logs: logs || [] });
  } catch (error: any) {
    console.error('API /api/admin/audit-logs error:', error);
    return NextResponse.json({ error: error.message || 'Unable to retrieve audit logs.' }, { status: 500 });
  }
}
