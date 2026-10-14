import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getAuthenticatedUser, recordAuditLog } from '@/lib/auth/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function validateImageMime(buffer: Buffer): string | null {
  // Check magic bytes
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

    if (authCtx.isRusticated) {
      return NextResponse.json(
        { error: 'Account restricted: Rusticated students cannot submit photographs.' },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image file uploaded.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Image exceeds the maximum allowed size of 10 MB.' },
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

    // 1. Locate student linked to this profile
    let studentId = authCtx.studentId;
    if (!studentId) {
      const { data: std } = await adminClient
        .from('students')
        .select('id')
        .eq('profile_id', authCtx.user.id)
        .maybeSingle();

      studentId = std?.id || null;
    }

    if (!studentId) {
      return NextResponse.json(
        { error: 'No student profile record found to associate with photograph.' },
        { status: 404 }
      );
    }

    // 2. Upload to Supabase Storage bucket 'student-photos'
    const extension = verifiedMime === 'image/png' ? 'png' : verifiedMime === 'image/webp' ? 'webp' : 'jpg';
    const sanitizedFileName = `student_${studentId}_${Date.now()}.${extension}`;
    const storagePath = `photos/${sanitizedFileName}`;

    let finalPhotoUrl = '';

    const { data: uploadData, error: uploadErr } = await adminClient.storage
      .from('student-photos')
      .upload(storagePath, buffer, {
        contentType: verifiedMime,
        upsert: true,
      });

    if (uploadErr) {
      console.warn('[student/photo] Storage upload fallback to base64 data URL:', uploadErr.message);
      // Base64 data URL fallback if storage bucket is not created
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
      .eq('id', studentId);

    if (updateErr) throw updateErr;

    // 4. Record audit log
    await recordAuditLog({
      actorId: authCtx.user.id,
      action: 'STUDENT_PHOTO_SUBMITTED',
      targetType: 'STUDENT',
      targetId: studentId,
      details: {
        fileSize: file.size,
        mimeType: verifiedMime,
      },
    });

    return NextResponse.json({
      success: true,
      photoUrl: finalPhotoUrl,
      message: 'Profile photo updated successfully.',
    });
  } catch (error: any) {
    console.error('API /api/student/photo error:', error);
    return NextResponse.json(
      { error: error.message || 'Unable to update profile photo.' },
      { status: 500 }
    );
  }
}
