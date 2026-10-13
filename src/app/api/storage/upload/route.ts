import { NextRequest, NextResponse } from 'next/server';
import { uploadToStorage } from '@/lib/storage/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const bucket = (formData.get('bucket') as string) || 'student-photos';
    const folder = (formData.get('folder') as string) || 'uploads';

    if (!file) {
      return NextResponse.json({ error: 'No file provided in form data' }, { status: 400 });
    }

    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadResult = await uploadToStorage(bucket, fileName, buffer, file.type);

    if (uploadResult.error) {
      return NextResponse.json(
        { error: uploadResult.error || 'Unable to upload image.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ url: uploadResult.url, mode: 'supabase_storage' });
  } catch (error: any) {
    console.error('API /api/storage/upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Unable to upload image.' },
      { status: 500 }
    );
  }
}
