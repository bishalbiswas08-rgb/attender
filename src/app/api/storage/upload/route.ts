import { NextRequest, NextResponse } from 'next/server';
import { uploadToStorage, BUCKET_STUDENT_PHOTOS, BUCKET_ATTENDANCE_IMAGES } from '@/lib/storage/storage';
import { getAuthenticatedUser, recordAuditLog } from '@/lib/auth/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. Enforce authentication server-side
    const authCtx = await getAuthenticatedUser(req);
    if (!authCtx.user || !authCtx.profile) {
      return NextResponse.json(
        { error: 'Authentication required to upload media.' },
        { status: 401 }
      );
    }

    const currentUser = authCtx.user;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const bucket = (formData.get('bucket') as string) || BUCKET_STUDENT_PHOTOS;
    const rawFolder = (formData.get('folder') as string) || 'uploads';

    if (!file) {
      return NextResponse.json({ error: 'No file provided in form data.' }, { status: 400 });
    }

    // 2. Validate bucket destination
    if (bucket !== BUCKET_STUDENT_PHOTOS && bucket !== BUCKET_ATTENDANCE_IMAGES) {
      return NextResponse.json(
        { error: 'Invalid bucket destination. Access restricted to approved private buckets.' },
        { status: 400 }
      );
    }

    // 3. Strict RBAC authorization for bucket targets:
    // - student-photos: ADMIN ONLY (Teachers and students cannot alter student photos)
    // - attendance-images: ADMIN or TEACHER (Students cannot upload attendance images)
    if (bucket === BUCKET_STUDENT_PHOTOS && !authCtx.isAdmin) {
      return NextResponse.json(
        { error: 'Access denied: Only system administrators can upload or modify student profile photos.' },
        { status: 403 }
      );
    }

    if (bucket === BUCKET_ATTENDANCE_IMAGES && authCtx.isStudent) {
      return NextResponse.json(
        { error: 'Access denied: Students cannot upload classroom attendance images.' },
        { status: 403 }
      );
    }

    // 4. File validation: MIME type and file size (max 10MB)
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file format. Only JPEG, PNG, and WebP images are permitted.' },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size exceeds maximum 10MB limit.' },
        { status: 400 }
      );
    }

    // 5. Sanitize folder path against directory traversal
    const folder = rawFolder.replace(/[^a-zA-Z0-9_-]/g, '') || 'uploads';
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(fileExt) ? fileExt : 'jpg';
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${safeExt}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadResult = await uploadToStorage(bucket, fileName, buffer, file.type);

    if (uploadResult.error) {
      return NextResponse.json(
        { error: uploadResult.error || 'Unable to upload image.' },
        { status: 400 }
      );
    }

    // 3. Record audit log
    await recordAuditLog({
      actorId: currentUser.id,
      action: 'MEDIA_UPLOADED',
      targetType: 'STORAGE',
      targetId: `${bucket}/${fileName}`,
      details: {
        bucket,
        fileSize: file.size,
        contentType: file.type,
      },
    });

    return NextResponse.json({
      url: uploadResult.url,
      path: uploadResult.path,
      mode: 'private_storage',
    });
  } catch (error: any) {
    console.error('API /api/storage/upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Unable to upload image.' },
      { status: 500 }
    );
  }
}
