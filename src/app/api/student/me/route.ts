import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authCtx = await getAuthenticatedUser(req);
    if (!authCtx.user || !authCtx.profile) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in to access student portal.' },
        { status: 401 }
      );
    }

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: 'Database service is not configured.' }, { status: 503 });
    }

    const adminClient = createAdminClient();

    // 1. Locate student record explicitly linked to this user's profile ID
    const { data: student, error: stdErr } = await adminClient
      .from('students')
      .select('id, full_name, roll_number, photo_url, active, class:class_id(id, name, section, academic_year)')
      .eq('profile_id', authCtx.user.id)
      .maybeSingle();

    if (stdErr) throw stdErr;

    if (!student) {
      return NextResponse.json({
        linked: false,
        profile: {
          id: authCtx.user.id,
          email: authCtx.user.email,
          fullName: authCtx.profile.full_name,
        },
        message: 'Your account is active, but not yet linked to a student enrollment record. Please contact your administrator.',
      });
    }

    // 2. Fetch only THIS student's attendance records
    const { data: records, error: recErr } = await adminClient
      .from('attendance')
      .select('id, status, marked_at, session:session_id(id, date, source)')
      .eq('student_id', student.id)
      .order('marked_at', { ascending: false });

    if (recErr) throw recErr;

    const attendanceRecords = records || [];

    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;

    const history = attendanceRecords.map((r: any) => {
      if (r.status === 'present') presentCount++;
      else if (r.status === 'absent') absentCount++;
      else if (r.status === 'late') {
        lateCount++;
        presentCount++; // late counts towards present
      }

      return {
        id: r.id,
        date: r.session?.date || r.marked_at?.split('T')[0],
        status: r.status,
        source: r.session?.source || 'individual',
      };
    });

    const totalMarked = presentCount + absentCount;
    const percentage = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 1000) / 10 : null;

    // Monthly breakdown
    const monthlyStats: Record<string, { present: number; absent: number; total: number }> = {};
    history.forEach((h: any) => {
      const monthKey = h.date?.substring(0, 7) || 'Current';
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = { present: 0, absent: 0, total: 0 };
      }
      if (h.status === 'present' || h.status === 'late') monthlyStats[monthKey].present++;
      else if (h.status === 'absent') monthlyStats[monthKey].absent++;
      monthlyStats[monthKey].total++;
    });

    return NextResponse.json({
      linked: true,
      student: {
        id: student.id,
        fullName: student.full_name,
        rollNumber: student.roll_number,
        photoUrl: student.photo_url,
        active: student.active,
        class: student.class,
      },
      stats: {
        presentCount,
        absentCount,
        lateCount,
        totalSessions: totalMarked,
        percentage,
        isBelowThreshold: percentage !== null ? percentage < 75 : false,
      },
      monthlyBreakdown: Object.entries(monthlyStats).map(([month, data]) => ({
        month,
        present: data.present,
        absent: data.absent,
        total: data.total,
        rate: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0,
      })),
      history,
    });
  } catch (error: any) {
    console.error('API /api/student/me error:', error);
    return NextResponse.json({ error: error.message || 'Unable to retrieve student profile.' }, { status: 500 });
  }
}
