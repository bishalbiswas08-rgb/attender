import { createClient, isSupabaseConfigured } from '../supabase/client';
import { createAdminClient, isSupabaseAdminConfigured } from '../supabase/admin';

export const BUCKET_STUDENT_PHOTOS = 'student-photos';
export const BUCKET_ATTENDANCE_IMAGES = 'attendance-images';

/**
 * Uploads a file to Supabase storage.
 * Works with File, Blob, or Buffer.
 */
export async function uploadToStorage(
  bucket: string,
  filePath: string,
  file: File | Blob | Buffer,
  contentType?: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    if (!isSupabaseConfigured() && !isSupabaseAdminConfigured()) {
      return {
        url: null,
        error: 'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and credentials to your environment variables.',
      };
    }

    const client = isSupabaseAdminConfigured() ? createAdminClient() : createClient();

    const { data, error } = await client.storage
      .from(bucket)
      .upload(filePath, file, {
        upsert: true,
        contentType: contentType || 'image/jpeg',
      });

    if (error) {
      console.error(`[Storage] Upload error for ${bucket}/${filePath}:`, error);
      return {
        url: null,
        error: `Storage error: ${error.message}. Please verify bucket "${bucket}" exists in Supabase.`,
      };
    }

    const { data: publicUrlData } = client.storage.from(bucket).getPublicUrl(data.path);

    return { url: publicUrlData.publicUrl, error: null };
  } catch (err: any) {
    console.error('[Storage] Exception:', err);
    return { url: null, error: err.message || 'Unable to upload image.' };
  }
}
