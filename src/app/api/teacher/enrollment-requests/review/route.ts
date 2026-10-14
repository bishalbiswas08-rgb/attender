import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getAuthenticatedUser, verifyClassAccess, recordAuditLog } from '@/lib/auth/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authCtx = await getAuthenticatedUser(req);
    if (!authCtx.user || !authCtx.profile) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (authCtx.isStudent) {
      return NextResponse.json(
        { error: 'Access forbidden: Students cannot review enrollment requests.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const requestId = body.requestId;
    const action = body.action || body.decision;
    const rollNumber = body.rollNumber;
    const reason = body.reason;

    if (!requestId || !action || !['accept', 'reject', 'request_photo'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid request payload. Request ID and action (accept | reject | request_photo) are required.' },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured() && !isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: 'Database service is not configured.' }, { status: 503 });
    }

    const adminClient = isSupabaseAdminConfigured()
      ? createAdminClient()
      : createServerSupabaseClient();

    // 1. Fetch the enrollment request
    const { data: request, error: fetchErr } = await adminClient
      .from('enrollment_requests')
      .select('*, student:student_id(*), class:class_id(*), user:user_id(*)')
      .eq('id', requestId)
      .maybeSingle();

    if (fetchErr || !request) {
      return NextResponse.json({ error: 'Enrollment request not found.' }, { status: 404 });
    }

    // 2. Verify authorization for the requested class
    const hasClassAccess = await verifyClassAccess(authCtx, request.class_id);
    if (!hasClassAccess) {
      return NextResponse.json(
        { error: 'Access denied: You are not assigned to manage enrollments for this class.' },
        { status: 403 }
      );
    }

    if (request.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Cannot review request that is already ${request.status}.` },
        { status: 400 }
      );
    }

    // Check if target student is rusticated
    if (request.student?.status === 'RUSTICATED') {
      return NextResponse.json(
        { error: 'Cannot enroll student: This student is currently rusticated by administration.' },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();

    // 3. ACTION: ACCEPT
    if (action === 'accept') {
      const assignedRoll = rollNumber?.trim() || request.student?.roll_number;

      if (!assignedRoll || assignedRoll === 'PENDING') {
        return NextResponse.json(
          { error: 'A valid roll number must be assigned upon accepting enrollment.' },
          { status: 400 }
        );
      }

      // Check duplicate roll number in class
      const { data: duplicateStudent } = await adminClient
        .from('students')
        .select('id, full_name')
        .eq('class_id', request.class_id)
        .eq('roll_number', assignedRoll)
        .eq('status', 'ACTIVE')
        .neq('id', request.student_id || '')
        .maybeSingle();

      if (duplicateStudent) {
        return NextResponse.json(
          {
            error: `Roll number "${assignedRoll}" is already assigned to student ${duplicateStudent.full_name} in this class.`,
          },
          { status: 409 }
        );
      }

      // Update student record
      const studentUpdate: Record<string, any> = {
        class_id: request.class_id,
        roll_number: assignedRoll,
        active: true,
        status: 'ACTIVE',
      };

      if (request.submitted_photo_url) {
        studentUpdate.photo_url = request.submitted_photo_url;
      }

      const { error: studentErr } = await adminClient
        .from('students')
        .update(studentUpdate)
        .eq('id', request.student_id);

      if (studentErr) throw studentErr;

      // Update enrollment request
      const { error: reqUpdateErr } = await adminClient
        .from('enrollment_requests')
        .update({
          status: 'ACCEPTED',
          reviewed_at: now,
          reviewed_by: authCtx.user.id,
          review_reason: reason?.trim() || 'Enrollment accepted by educator.',
          updated_at: now,
        })
        .eq('id', requestId);

      if (reqUpdateErr) throw reqUpdateErr;

      // Deactivate any previous active student enrollment for this student
      await adminClient
        .from('student_enrollments')
        .update({ status: 'INACTIVE', ended_at: now })
        .eq('student_id', request.student_id)
        .eq('status', 'ACTIVE');

      // Insert new active student enrollment
      await adminClient.from('student_enrollments').insert({
        student_id: request.student_id,
        class_id: request.class_id,
        roll_number: assignedRoll,
        status: 'ACTIVE',
        enrolled_at: now,
      });

      // Audit logs
      await recordAuditLog({
        actorId: authCtx.user.id,
        action: 'ENROLLMENT_ACCEPTED',
        targetType: 'ENROLLMENT_REQUEST',
        targetId: requestId,
        details: {
          classId: request.class_id,
          studentId: request.student_id,
          assignedRoll,
          reviewedBy: authCtx.user.email,
        },
      });

      await recordAuditLog({
        actorId: authCtx.user.id,
        action: 'ROLL_NUMBER_ASSIGNED',
        targetType: 'STUDENT',
        targetId: request.student_id,
        details: {
          classId: request.class_id,
          rollNumber: assignedRoll,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Student enrolled successfully in ${request.class?.name || 'class'} with roll number ${assignedRoll}.`,
      });
    }

    // 4. ACTION: REJECT
    if (action === 'reject') {
      const rejectReason = reason?.trim() || 'Enrollment request was not approved.';

      const { error: reqRejectErr } = await adminClient
        .from('enrollment_requests')
        .update({
          status: 'REJECTED',
          reviewed_at: now,
          reviewed_by: authCtx.user.id,
          review_reason: rejectReason,
          updated_at: now,
        })
        .eq('id', requestId);

      if (reqRejectErr) throw reqRejectErr;

      await recordAuditLog({
        actorId: authCtx.user.id,
        action: 'ENROLLMENT_REJECTED',
        targetType: 'ENROLLMENT_REQUEST',
        targetId: requestId,
        details: {
          classId: request.class_id,
          studentId: request.student_id,
          reason: rejectReason,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Enrollment request rejected.',
      });
    }

    // 5. ACTION: REQUEST PHOTO REPLACEMENT
    if (action === 'request_photo') {
      const photoReason = reason?.trim() || 'Please upload a clearer, frontal profile photo.';

      const { error: reqPhotoErr } = await adminClient
        .from('enrollment_requests')
        .update({
          review_reason: photoReason,
          updated_at: now,
        })
        .eq('id', requestId);

      if (reqPhotoErr) throw reqPhotoErr;

      return NextResponse.json({
        success: true,
        message: 'Requested student to upload a new profile photograph.',
      });
    }

    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (error: any) {
    console.error('API /api/teacher/enrollment-requests/review error:', error);
    return NextResponse.json(
      { error: error.message || 'Unable to review enrollment request.' },
      { status: 500 }
    );
  }
}
