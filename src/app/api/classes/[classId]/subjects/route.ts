import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getAuthenticatedUser, verifyClassAccess, recordAuditLog } from '@/lib/auth/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{
    classId: string;
  }>;
}

// GET /api/classes/[classId]/subjects - List subjects assigned to this class
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { classId } = await params;
    const authCtx = await getAuthenticatedUser(req);
    if (!authCtx.user || !authCtx.profile) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: 'Database service unavailable.' }, { status: 503 });
    }

    const adminClient = createAdminClient();

    // Check authorization: Admin, teacher with access to class, or enrolled student in this class
    if (!authCtx.isAdmin) {
      if (authCtx.isTeacher) {
        const hasAccess = await verifyClassAccess(authCtx, classId);
        if (!hasAccess) {
          return NextResponse.json({ error: 'Access denied to this class.' }, { status: 403 });
        }
      } else if (authCtx.isStudent) {
        // Verify student belongs to this class
        const { data: std } = await adminClient
          .from('students')
          .select('id, class_id')
          .eq('profile_id', authCtx.user.id)
          .maybeSingle();

        if (!std || std.class_id !== classId) {
          return NextResponse.json({ error: 'Access denied: You are not enrolled in this class.' }, { status: 403 });
        }
      }
    }

    const { data: classSubjects, error: csErr } = await adminClient
      .from('class_subjects')
      .select(`
        id,
        class_id,
        subject_id,
        teacher_id,
        subject:subject_id(id, name, code, description, active),
        teacher:teacher_id(id, full_name, email)
      `)
      .eq('class_id', classId)
      .order('created_at', { ascending: true });

    if (csErr) throw csErr;

    const formatted = (classSubjects || []).map((cs: any) => ({
      id: cs.id,
      classId: cs.class_id,
      subjectId: cs.subject_id,
      teacherId: cs.teacher_id,
      subject: cs.subject ? {
        id: cs.subject.id,
        name: cs.subject.name,
        code: cs.subject.code,
        description: cs.subject.description,
        active: cs.subject.active ?? true,
      } : null,
      teacher: cs.teacher ? {
        id: cs.teacher.id,
        fullName: cs.teacher.full_name,
        email: cs.teacher.email,
      } : null,
    }));

    return NextResponse.json({ classSubjects: formatted });
  } catch (error: any) {
    console.error('API /api/classes/[classId]/subjects GET error:', error);
    return NextResponse.json({ error: error.message || 'Unable to fetch class subjects.' }, { status: 500 });
  }
}

// POST /api/classes/[classId]/subjects - Assign subject to class (Admin only)
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { classId } = await params;
    const authCtx = await getAuthenticatedUser(req);
    if (!authCtx.user || !authCtx.isAdmin) {
      return NextResponse.json({ error: 'Access denied: Only administrators can assign subjects to classes.' }, { status: 403 });
    }

    const body = await req.json();
    const { subjectId, teacherId } = body;

    if (!subjectId) {
      return NextResponse.json({ error: 'Subject ID is required.' }, { status: 400 });
    }

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: 'Database service unavailable.' }, { status: 503 });
    }

    const adminClient = createAdminClient();

    // Verify class exists
    const { data: cls, error: clsErr } = await adminClient
      .from('classes')
      .select('id, name')
      .eq('id', classId)
      .maybeSingle();

    if (clsErr || !cls) {
      return NextResponse.json({ error: 'Class not found.' }, { status: 404 });
    }

    // Verify subject exists
    const { data: subj, error: subjErr } = await adminClient
      .from('subjects')
      .select('id, name, code')
      .eq('id', subjectId)
      .maybeSingle();

    if (subjErr || !subj) {
      return NextResponse.json({ error: 'Subject not found.' }, { status: 404 });
    }

    // Verify teacher if provided
    if (teacherId) {
      const { data: teacherProfile } = await adminClient
        .from('profiles')
        .select('id, role')
        .eq('id', teacherId)
        .maybeSingle();

      if (!teacherProfile || (teacherProfile.role !== 'TEACHER' && teacherProfile.role !== 'ADMIN')) {
        return NextResponse.json({ error: 'Designated user is not a teacher or admin.' }, { status: 400 });
      }
    }

    // Upsert assignment into class_subjects
    const { data: assignment, error: assignErr } = await adminClient
      .from('class_subjects')
      .upsert(
        {
          class_id: classId,
          subject_id: subjectId,
          teacher_id: teacherId || null,
        },
        { onConflict: 'class_id,subject_id' }
      )
      .select()
      .single();

    if (assignErr) throw assignErr;

    await recordAuditLog({
      actorId: authCtx.user.id,
      action: 'SUBJECT_ASSIGNED_TO_CLASS',
      targetType: 'CLASS_SUBJECT',
      targetId: assignment.id,
      details: { classId, subjectId, teacherId },
    });

    return NextResponse.json({
      success: true,
      message: `${subj.name} assigned to class ${cls.name}.`,
      assignment,
    });
  } catch (error: any) {
    console.error('API /api/classes/[classId]/subjects POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to assign subject to class.' }, { status: 500 });
  }
}

// DELETE /api/classes/[classId]/subjects - Remove subject from class (Admin only)
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { classId } = await params;
    const authCtx = await getAuthenticatedUser(req);
    if (!authCtx.user || !authCtx.isAdmin) {
      return NextResponse.json({ error: 'Access denied: Only administrators can unassign subjects.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const subjectId = searchParams.get('subjectId');

    if (!subjectId) {
      return NextResponse.json({ error: 'Subject ID parameter is required.' }, { status: 400 });
    }

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: 'Database service unavailable.' }, { status: 503 });
    }

    const adminClient = createAdminClient();

    const { error: delErr } = await adminClient
      .from('class_subjects')
      .delete()
      .eq('class_id', classId)
      .eq('subject_id', subjectId);

    if (delErr) throw delErr;

    await recordAuditLog({
      actorId: authCtx.user.id,
      action: 'SUBJECT_REMOVED_FROM_CLASS',
      targetType: 'CLASS_SUBJECT',
      targetId: `${classId}:${subjectId}`,
      details: { classId, subjectId },
    });

    return NextResponse.json({
      success: true,
      message: 'Subject removed from class successfully.',
    });
  } catch (error: any) {
    console.error('API /api/classes/[classId]/subjects DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Failed to remove subject from class.' }, { status: 500 });
  }
}
