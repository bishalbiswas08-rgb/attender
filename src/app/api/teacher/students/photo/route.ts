import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getAuthenticatedUser, verifyClassAccess, recordAuditLog } from '@/lib/auth/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

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
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (authCtx.isStudent) {
      return NextResponse.json(
        { error: 'Access forbidden: Students cannot update other students photos.' },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const studentId = formData.get('studentId') as string | null;
    const file = formData.get('file') as File | null;

    if (!studentId) {
      return NextResponse.json({ error: 'Student ID is required.' }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: 'No image file uploaded.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Image exceeds maximum allowed size of 10 MB.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const verifiedMime = validateImageMime(buffer);

    if (!verifiedMime || !ALLOWED_MIME_TYPES.has(verifiedMime)) {
      return NextResponse.json(
        { error: 'Invalid file format. Only JPEG, PNG, and WebP images are permitted.' },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured() && !isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: 'Database service is not configured.' }, { status: 503 });
    }

    const adminClient = isSupabaseAdminConfigured()
      ? createAdminClient()
      : createServerSupabaseClient();

    // 1. Locate student and check teacher's authorization for that student's class
    const { data: student, error: stdErr } = await adminClient
      .from('students')
      .select('id, full_name, class_id, status')
      .eq('id', studentId)
      .maybeSingle();

    if (stdErr || !student) {
      return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
    }

    const hasAccess = await verifyClassAccess(authCtx, student.class_id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied: You are not authorized to update students in this class.' },
        { status: 403 }
      );
    }

    // 2. Upload to storage bucket
    const extension = verifiedMime === 'image/png' ? 'png' : verifiedMime === 'image/webp' ? 'webp' : 'jpg';
    const sanitizedFileName = `student_${student.id}_${Date.now()}.${extension}`;
    const storagePath = `photos/${sanitizedFileName}`;

    let finalPhotoUrl = '';

    const { error: uploadErr } = await adminClient.storage
      .from('student-photos')
      .upload(storagePath, buffer, {
        contentType: verifiedMime,
        upsert: true,
      });

    if (uploadErr) {
      console.warn('[teacher/students/photo] Storage fallback to base64 data URL:', uploadErr.message);
      finalPhotoUrl = `data:${verifiedMime};base64,${buffer.toString('base64')}`;
    } else {
      const { data: signedData, error: signErr } = await adminClient.storage
        .from('student-photos')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year private signed URL
      finalPhotoUrl = (!signErr && signedData?.signedUrl) ? signedData.signedUrl : storagePath;
    }

    // 3. Update student record
    const { error: updateErr } = await adminClient
      .from('students')
      .update({ photo_url: finalPhotoUrl })
      .eq('id', student.id);

    if (updateErr) throw updateErr;

    // 4. Record audit log
    await recordAuditLog({
      actorId: authCtx.user.id,
      action: 'STUDENT_PHOTO_UPDATED',
      targetType: 'STUDENT',
      targetId: student.id,
      details: {
        studentName: student.full_name,
        classId: student.class_id,
        fileSize: file.size,
        mimeType: verifiedMime,
      },
    });

    return NextResponse.json({
      success: true,
      photoUrl: finalPhotoUrl,
      message: `Profile photograph updated for ${student.full_name}.`,
    });
  } catch (error: any) {
    console.error('API /api/teacher/students/photo error:', error);
    return NextResponse.json(
      { error: error.message || 'Unable to update student photo.' },
      { status: 500 }
    );
  }
}
