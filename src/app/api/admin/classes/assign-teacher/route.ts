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
        { error: 'Access denied: Only system administrators can assign teachers to classes.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { classId, teacherId, action } = body; // action: 'assign' | 'unassign'

    if (!classId || !teacherId) {
      return NextResponse.json(
        { error: 'Class ID and Teacher ID are required.' },
        { status: 400 }
      );
    }

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: 'Supabase admin is not configured.' }, { status: 503 });
    }

    const adminClient = createAdminClient();

    // Verify teacher has TEACHER or ADMIN role
    const { data: teacherProfile, error: tErr } = await adminClient
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('id', teacherId)
      .maybeSingle();

    if (tErr || !teacherProfile) {
      return NextResponse.json({ error: 'Selected teacher was not found in profiles.' }, { status: 404 });
    }

    if (teacherProfile.role !== 'TEACHER' && teacherProfile.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Selected user is not registered as an educator.' },
        { status: 400 }
      );
    }

    if (action === 'unassign') {
      await adminClient
        .from('class_teachers')
        .delete()
        .eq('class_id', classId)
        .eq('teacher_id', teacherId);

      // If class had this teacher as primary teacher_id, clear or pick next
      const { data: remainingTeachers } = await adminClient
        .from('class_teachers')
        .select('teacher_id')
        .eq('class_id', classId)
        .limit(1);

      const nextTeacherId = remainingTeachers?.[0]?.teacher_id || null;
      await adminClient
        .from('classes')
        .update({ teacher_id: nextTeacherId })
        .eq('id', classId);

      await recordAuditLog({
        actorId: authCtx.user.id,
        action: 'TEACHER_UNASSIGNED_FROM_CLASS',
        targetType: 'CLASS_TEACHER',
        targetId: `${classId}:${teacherId}`,
        details: { classId, teacherId },
      });

      return NextResponse.json({
        success: true,
        message: `${teacherProfile.full_name} unassigned from class.`,
      });
    } else {
      // Assign
      const { error: insErr } = await adminClient
        .from('class_teachers')
        .upsert(
          { class_id: classId, teacher_id: teacherId },
          { onConflict: 'class_id,teacher_id' }
        );

      if (insErr) throw insErr;

      // Ensure class has a primary teacher_id set
      await adminClient
        .from('classes')
        .update({ teacher_id: teacherId })
        .eq('id', classId)
        .is('teacher_id', null);

      await recordAuditLog({
        actorId: authCtx.user.id,
        action: 'TEACHER_ASSIGNED_TO_CLASS',
        targetType: 'CLASS_TEACHER',
        targetId: `${classId}:${teacherId}`,
        details: { classId, teacherId },
      });

      return NextResponse.json({
        success: true,
        message: `${teacherProfile.full_name} assigned to class successfully.`,
      });
    }
  } catch (error: any) {
    console.error('API /api/admin/classes/assign-teacher error:', error);
    return NextResponse.json({ error: error.message || 'Unable to update class assignment.' }, { status: 500 });
  }
}
