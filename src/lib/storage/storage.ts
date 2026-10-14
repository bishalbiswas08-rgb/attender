import { createClient, isSupabaseConfigured } from '../supabase/client';
import { createAdminClient, isSupabaseAdminConfigured } from '../supabase/admin';

export const BUCKET_STUDENT_PHOTOS = 'student-photos';
export const BUCKET_ATTENDANCE_IMAGES = 'attendance-images';

/**
 * Uploads a file to Supabase private storage using the server admin client.
 * Works with File, Blob, or Buffer.
 */
export async function uploadToStorage(
  bucket: string,
  filePath: string,
  file: File | Blob | Buffer,
  contentType?: string
): Promise<{ url: string | null; path: string | null; error: string | null }> {
  try {
    if (!isSupabaseConfigured() && !isSupabaseAdminConfigured()) {
      return {
        url: null,
        path: null,
        error: 'Supabase is not configured. Add credentials to your environment variables.',
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
        path: null,
        error: `Storage error: ${error.message}. Please verify bucket "${bucket}" exists in Supabase.`,
      };
    }

    // For private buckets, generate a temporary signed URL valid for 24 hours
    const { data: signedData, error: signErr } = await client.storage
      .from(bucket)
      .createSignedUrl(data.path, 86400);

    const signedUrl = signedData?.signedUrl || null;

    return { url: signedUrl, path: data.path, error: null };
  } catch (err: any) {
    console.error('[Storage] Exception:', err);
    return { url: null, path: null, error: err.message || 'Unable to upload image.' };
  }
}

/**
 * Creates a short-lived signed URL for private bucket access
 */
export async function getSignedStorageUrl(
  bucket: string,
  filePath: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  try {
    if (!isSupabaseConfigured() && !isSupabaseAdminConfigured()) {
      return null;
    }

    const client = isSupabaseAdminConfigured() ? createAdminClient() : createClient();
    const cleanPath = filePath.replace(/^.*\/storage\/v1\/object\/[^/]+\/[^/]+\//, '');

    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUrl(cleanPath, expiresInSeconds);

    if (error) {
      console.warn(`[Storage] Signed URL error: ${error.message}`);
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    console.error('[Storage] getSignedStorageUrl error:', err);
    return null;
  }
}
