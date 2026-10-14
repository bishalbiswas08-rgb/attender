import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getAuthenticatedUser, recordAuditLog } from '@/lib/auth/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function validateImageMime(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const authCtx = await getAuthenticatedUser(req);
    if (!authCtx.user || !authCtx.profile) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in to request class enrollment.' },
        { status: 401 }
      );
    }

    if (authCtx.isRusticated) {
      return NextResponse.json(
        { error: 'Account restricted: You have been rusticated and cannot request new class enrollments.' },
        { status: 403 }
      );
    }

    if (authCtx.isAdmin) {
      return NextResponse.json(
        { error: 'Administrators do not need to submit student enrollment requests.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { classId, message, submittedPhotoUrl, photoBase64 } = body;

    if (!classId) {
      return NextResponse.json(
        { error: 'Class ID is required to request enrollment.' },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured() && !isSupabaseAdminConfigured()) {
      return NextResponse.json(
        { error: 'Database service is not configured.' },
        { status: 503 }
      );
    }

    const adminClient = isSupabaseAdminConfigured()
      ? createAdminClient()
      : createServerSupabaseClient();

    // Process photoBase64 if provided
    let finalPhotoUrl = submittedPhotoUrl || null;
    if (photoBase64) {
      try {
        const cleanBase64 = photoBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        const verifiedMime = validateImageMime(buffer);
        if (verifiedMime && ALLOWED_MIME_TYPES.has(verifiedMime)) {
          const extension = verifiedMime === 'image/png' ? 'png' : verifiedMime === 'image/webp' ? 'webp' : 'jpg';
          const sanitizedFileName = `request_${authCtx.user.id}_${Date.now()}.${extension}`;
          const storagePath = `enrollments/${sanitizedFileName}`;
          const { error: upErr } = await adminClient.storage
            .from('student-photos')
            .upload(storagePath, buffer, { contentType: verifiedMime, upsert: true });

          if (!upErr) {
            const { data: signedData } = await adminClient.storage
              .from('student-photos')
              .createSignedUrl(storagePath, 60 * 60 * 24 * 365);
            finalPhotoUrl = signedData?.signedUrl || storagePath;
          } else {
            finalPhotoUrl = photoBase64;
          }
        }
      } catch (pErr) {
        console.warn('Error processing enrollment photo base64:', pErr);
        finalPhotoUrl = photoBase64;
      }
    }

    // 1. Verify target class exists
    const { data: targetClass, error: classErr } = await adminClient
      .from('classes')
      .select('id, name, section')
      .eq('id', classId)
      .maybeSingle();

    if (classErr || !targetClass) {
      return NextResponse.json(
        { error: 'The selected class does not exist or has been archived.' },
        { status: 404 }
      );
    }

    // 2. Check if student already has a PENDING request for this class
    const { data: existingPending } = await adminClient
      .from('enrollment_requests')
      .select('id')
      .eq('user_id', authCtx.user.id)
      .eq('class_id', classId)
      .eq('status', 'PENDING')
      .maybeSingle();

    if (existingPending) {
      return NextResponse.json(
        { error: 'You already have a pending enrollment request for this class.' },
        { status: 409 }
      );
    }

    // 3. Find or initialize the student master record for this profile
    let studentId = authCtx.studentId;

    if (!studentId) {
      const { data: existingStudent } = await adminClient
        .from('students')
        .select('*')
        .eq('profile_id', authCtx.user.id)
        .maybeSingle();

      if (existingStudent) {
        if (existingStudent.status === 'RUSTICATED') {
          return NextResponse.json(
            { error: 'Account restricted: You have been rusticated.' },
            { status: 403 }
          );
        }
        studentId = existingStudent.id;
      } else {
        // Create student record linked to this user's profile
        const studentPayload: Record<string, any> = {
          full_name: authCtx.profile.full_name,
          email: authCtx.user.email,
          profile_id: authCtx.user.id,
          roll_number: 'PENDING',
          class_id: classId,
          photo_url: finalPhotoUrl || null,
          active: false, // inactive until accepted by teacher/admin
        };

        let newStudent: any = null;
        const { data: stdWithStatus, error: createStdErr } = await adminClient
          .from('students')
          .insert({ ...studentPayload, status: 'INACTIVE' })
          .select('id')
          .maybeSingle();

        if (createStdErr) {
          // If status column doesn't exist in table schema, retry without status
          if (createStdErr.message.includes('status') || createStdErr.code === '42703') {
            const { data: stdWithoutStatus, error: retryErr } = await adminClient
              .from('students')
              .insert(studentPayload)
              .select('id')
              .maybeSingle();

            if (retryErr) {
              throw new Error(`Failed to initialize student profile: ${retryErr.message}`);
            }
            newStudent = stdWithoutStatus;
          } else {
            throw new Error(`Failed to initialize student profile: ${createStdErr.message}`);
          }
        } else {
          newStudent = stdWithStatus;
        }

        if (!newStudent?.id) {
          throw new Error('Failed to initialize student profile record.');
        }

        studentId = newStudent.id;

        // Link to profile
        await adminClient
          .from('profiles')
          .update({ student_id: studentId })
          .eq('id', authCtx.user.id);
      }
    }

    // 4. Create the enrollment request
    const { data: newRequest, error: reqErr } = await adminClient
      .from('enrollment_requests')
      .insert({
        user_id: authCtx.user.id,
        student_id: studentId,
        class_id: classId,
        status: 'PENDING',
        message: message?.trim() || null,
        submitted_photo_url: finalPhotoUrl || null,
      })
      .select('*, class:class_id(id, name, section, academic_year)')
      .single();

    if (reqErr) {
      throw new Error(`Database error creating enrollment request: ${reqErr.message}`);
    }

    // 5. Audit log
    await recordAuditLog({
      actorId: authCtx.user.id,
      action: 'ENROLLMENT_REQUESTED',
      targetType: 'ENROLLMENT_REQUEST',
      targetId: newRequest.id,
      details: {
        classId,
        className: `${targetClass.name} - ${targetClass.section}`,
        studentId,
        userEmail: authCtx.user.email,
      },
    });

    return NextResponse.json({
      success: true,
      request: newRequest,
      message: `Enrollment request submitted for ${targetClass.name} - ${targetClass.section}. Awaiting teacher review.`,
    });
  } catch (error: any) {
    console.error('API /api/student/enrollment/request error:', error);
    return NextResponse.json(
      { error: error.message || 'Unable to submit enrollment request.' },
      { status: 500 }
    );
  }
}
