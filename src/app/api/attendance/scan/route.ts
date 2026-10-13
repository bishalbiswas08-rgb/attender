import { NextRequest, NextResponse } from 'next/server';
import { recognizeClassroomAttendance } from '@/lib/ai/recognition';
import { Student } from '@/lib/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sanitizeErrorMessage(msg: string): string {
  return msg
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_KEY]')
    .replace(/key=[^&\s]+/gi, 'key=[REDACTED]');
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your-gemini-api-key') {
      return NextResponse.json(
        { error: 'Gemini AI is not configured. Please set GEMINI_API_KEY in your server environment variables.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { imageBase64, mimeType, classId, students: clientStudents, className } = body;

    console.log(`[attendance/scan] Stage 1: Received scan request for classId="${classId || 'unspecified'}"`);

    if (!classId) {
      return NextResponse.json(
        { error: 'Class ID is required to scan attendance. Please select a class.' },
        { status: 400 }
      );
    }

    if (!imageBase64) {
      return NextResponse.json({ error: 'Classroom image is required.' }, { status: 400 });
    }

    let studentsToRecognize: Student[] = [];
    let resolvedClassName = className || 'Classroom';

    // Authenticate and fetch registered students from Supabase
    if (isSupabaseAdminConfigured() || isSupabaseConfigured()) {
      const supabase = isSupabaseAdminConfigured()
        ? createAdminClient()
        : createServerSupabaseClient();

      // Fetch class details if class name is not provided
      if (!className) {
        const { data: classData } = await supabase
          .from('classes')
          .select('name, section')
          .eq('id', classId)
          .maybeSingle();

        if (classData) {
          resolvedClassName = `${classData.name}${classData.section ? ` - ${classData.section}` : ''}`;
        }
      }

      const { data: dbStudents, error: dbErr } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', classId)
        .eq('active', true)
        .order('roll_number', { ascending: true });

      if (dbErr) {
        console.error('[attendance/scan] Supabase error fetching students:', sanitizeErrorMessage(dbErr.message));
      } else if (dbStudents && dbStudents.length > 0) {
        studentsToRecognize = dbStudents as Student[];
      }
    } else if (Array.isArray(clientStudents) && clientStudents.length > 0) {
      studentsToRecognize = clientStudents;
    }

    if (!studentsToRecognize || studentsToRecognize.length === 0) {
      console.warn(`[attendance/scan] Aborting: No students enrolled in class "${classId}".`);
      return NextResponse.json(
        { error: 'No active students enrolled in this class. Please add students before scanning.' },
        { status: 400 }
      );
    }

    // Call server-side isolated recognition pipeline
    const scanResult = await recognizeClassroomAttendance({
      imageBase64: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
      mimeType: mimeType || 'image/jpeg',
      students: studentsToRecognize,
      className: resolvedClassName,
    });

    return NextResponse.json(scanResult);
  } catch (error: any) {
    const rawMsg = error?.message || 'Unable to analyze classroom attendance.';
    const safeError = sanitizeErrorMessage(rawMsg);
    console.error('[attendance/scan] Handler error:', safeError);

    // Requirement 5: Return clean user-facing error if transient issues persist
    if (
      safeError.includes('temporarily busy') ||
      safeError.includes('503') ||
      safeError.includes('high demand') ||
      safeError.includes('spikes in demand') ||
      safeError.includes('overloaded') ||
      safeError.includes('429')
    ) {
      return NextResponse.json(
        { error: 'Gemini is temporarily busy. Please try the scan again in a moment.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: safeError },
      { status: 500 }
    );
  }
}

