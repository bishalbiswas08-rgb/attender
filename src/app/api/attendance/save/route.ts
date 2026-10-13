import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { classId, date, source, records, imageUrl } = payload;

    if (!classId || !date || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { error: 'Invalid attendance payload. Class ID, date, and student records are required.' },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured() && !isSupabaseAdminConfigured()) {
      return NextResponse.json(
        { error: 'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and credentials in .env.local to save attendance.' },
        { status: 503 }
      );
    }

    const supabase = isSupabaseAdminConfigured()
      ? createAdminClient()
      : createServerSupabaseClient();

    // Check if session exists for this date and class
    const { data: existingSessions, error: sessionFindErr } = await supabase
      .from('attendance_sessions')
      .select('id')
      .eq('class_id', classId)
      .eq('date', date);

    if (sessionFindErr) {
      throw new Error(`Database error querying session: ${sessionFindErr.message}`);
    }

    let sessionId: string;

    if (existingSessions && existingSessions.length > 0) {
      sessionId = existingSessions[0].id;
      // Delete old records for this session to avoid duplicates
      await supabase.from('attendance').delete().eq('session_id', sessionId);
    } else {
      const { data: newSession, error: sessionErr } = await supabase
        .from('attendance_sessions')
        .insert({
          class_id: classId,
          date,
          source: source || 'individual',
          image_url: imageUrl || null,
        })
        .select('id')
        .single();

      if (sessionErr) throw sessionErr;
      sessionId = newSession.id;
    }

    // Insert new attendance rows
    const rowsToInsert = records.map((r: { studentId: string; status: string }) => ({
      session_id: sessionId,
      student_id: r.studentId,
      status: r.status,
      marked_at: new Date().toISOString(),
    }));

    const { error: insertErr } = await supabase.from('attendance').insert(rowsToInsert);
    if (insertErr) throw insertErr;

    return NextResponse.json({
      success: true,
      sessionId,
      count: rowsToInsert.length,
      message: 'Attendance saved successfully to Supabase database.',
    });
  } catch (error: any) {
    console.error('API /api/attendance/save error:', error);
    return NextResponse.json(
      { error: error.message || 'Unable to save attendance.' },
      { status: 500 }
    );
  }
}
