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
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (authCtx.isStudent) {
      return NextResponse.json(
        { error: 'Access forbidden. Students cannot review enrollment requests.' },
        { status: 403 }
      );
    }

    if (!isSupabaseConfigured() && !isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: 'Database service is not configured.' }, { status: 503 });
    }

    const adminClient = isSupabaseAdminConfigured()
      ? createAdminClient()
      : createServerSupabaseClient();

    let query = adminClient
      .from('enrollment_requests')
      .select(`
        id,
        user_id,
        student_id,
        class_id,
        status,
        requested_at,
        reviewed_at,
        review_reason,
        submitted_photo_url,
        message,
        class:class_id(id, name, section, academic_year),
        user:user_id(id, full_name, email),
        student:student_id(id, full_name, roll_number, photo_url, status),
        reviewer:reviewed_by(id, full_name, email)
      `)
      .order('requested_at', { ascending: false });

    // If teacher (and not admin), filter strictly by assigned classes
    if (!authCtx.isAdmin) {
      // Find classes assigned to this teacher
      const { data: assignedClasses } = await adminClient
        .from('class_teachers')
        .select('class_id')
        .eq('teacher_id', authCtx.user.id);

      const { data: legacyClasses } = await adminClient
        .from('classes')
        .select('id')
        .eq('teacher_id', authCtx.user.id);

      const assignedClassIds = Array.from(
        new Set([
          ...(assignedClasses || []).map((c: any) => c.class_id),
          ...(legacyClasses || []).map((c: any) => c.id),
        ])
      );

      if (assignedClassIds.length === 0) {
        return NextResponse.json({ requests: [] });
      }

      query = query.in('class_id', assignedClassIds);
    }

    const { data: requests, error: err } = await query;
    if (err) throw err;

    return NextResponse.json({ requests: requests || [] });
  } catch (error: any) {
    console.error('API /api/teacher/enrollment-requests error:', error);
    return NextResponse.json(
      { error: error.message || 'Unable to fetch enrollment requests.' },
      { status: 500 }
    );
  }
}
