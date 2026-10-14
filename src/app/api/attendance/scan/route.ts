import { NextRequest, NextResponse } from 'next/server';
import { recognizeClassroomAttendance } from '@/lib/ai/recognition';
import { Student } from '@/lib/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getAuthenticatedUser, verifyClassAccess, verifySubjectAccess, recordAuditLog } from '@/lib/auth/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sanitizeErrorMessage(msg: string): string {
  return msg
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_KEY]')
    .replace(/key=[^&\s]+/gi, 'key=[REDACTED]');
}

export async function POST(req: NextRequest) {
  try {
    // 1. Enforce authentication and RBAC authorization server-side
    const authCtx = await getAuthenticatedUser(req);
    if (!authCtx.user || !authCtx.profile) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in to access scanner services.' },
        { status: 401 }
      );
    }

    const currentUser = authCtx.user;

    if (authCtx.isStudent) {
      return NextResponse.json(
        { error: 'Access forbidden. Students cannot perform classroom scans.' },
        { status: 403 }
      );
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your-gemini-api-key') {
      return NextResponse.json(
        { error: 'Gemini AI is not configured. Please set GEMINI_API_KEY in your server environment variables.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { imageBase64, mimeType, classId, className, subjectId } = body;

    if (!classId) {
      return NextResponse.json(
        { error: 'Class ID is required to scan attendance. Please select a class.' },
        { status: 400 }
      );
    }

    // 2. Verify authorization for the requested class (IDOR protection)
    const hasClassAccess = await verifyClassAccess(authCtx, classId);
    if (!hasClassAccess) {
      return NextResponse.json(
        { error: 'Access denied: You are not authorized to scan this class.' },
        { status: 403 }
      );
    }

    if (subjectId) {
      const hasSubjectAccess = await verifySubjectAccess(authCtx, classId, subjectId);
      if (!hasSubjectAccess) {
        return NextResponse.json(
          { error: 'Access denied: You are not assigned to teach this subject in this class.' },
          { status: 403 }
        );
      }
    }

    if (!imageBase64) {
      return NextResponse.json({ error: 'Classroom image is required.' }, { status: 400 });
    }

    let studentsToRecognize: Student[] = [];
    let resolvedClassName = className || 'Classroom';

    // 3. Fetch registered students from Supabase using authorized server query
    // Strictly exclude rusticated and inactive students
    if (isSupabaseAdminConfigured() || isSupabaseConfigured()) {
      const supabase = isSupabaseAdminConfigured()
        ? createAdminClient()
        : createServerSupabaseClient();

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
        .neq('status', 'RUSTICATED')
        .order('roll_number', { ascending: true });

      if (dbErr) {
        console.error('[attendance/scan] Supabase error fetching students:', sanitizeErrorMessage(dbErr.message));
      } else if (dbStudents && dbStudents.length > 0) {
        studentsToRecognize = dbStudents as Student[];
      }
    }

    if (!studentsToRecognize || studentsToRecognize.length === 0) {
      console.warn(`[attendance/scan] Aborting: No active eligible students in class "${classId}".`);
      return NextResponse.json(
        { error: 'No active eligible students found in this class (rusticated/inactive students excluded).' },
        { status: 400 }
      );
    }

    // 4. Call server-side isolated recognition pipeline
    const scanResult = await recognizeClassroomAttendance({
      imageBase64: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
      mimeType: mimeType || 'image/jpeg',
      students: studentsToRecognize,
      className: resolvedClassName,
    });

    // 5. Audit log
    await recordAuditLog({
      actorId: currentUser.id,
      action: 'CLASSROOM_SCAN_PERFORMED',
      targetType: 'CLASS',
      targetId: classId,
      details: {
        enrolledCount: studentsToRecognize.length,
        detectedCount: scanResult.detectedStudents?.length || 0,
        subjectId: subjectId || null,
      },
    });

    return NextResponse.json(scanResult);
  } catch (error: any) {
    const rawMsg = error?.message || 'Unable to analyze classroom attendance.';
    const safeError = sanitizeErrorMessage(rawMsg);
    console.error('[attendance/scan] Handler error:', safeError);

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
