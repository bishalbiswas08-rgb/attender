import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { UserRole, Profile } from '@/lib/types';
import { User } from '@supabase/supabase-js';

export interface AuthContext {
  user: User | null;
  profile: Profile | null;
  role: UserRole;
  isAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
}

/**
 * Retrieves the currently authenticated Supabase user and their verified database profile.
 * Never trusts client-supplied roles or metadata.
 */
export async function getAuthenticatedUser(req?: NextRequest): Promise<AuthContext> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return {
      user: null,
      profile: null,
      role: 'STUDENT',
      isAdmin: false,
      isTeacher: false,
      isStudent: false,
    };
  }

  // Fetch real profile from DB using admin client to ensure bypass of RLS self-lookup issues
  let profile: Profile | null = null;
  const adminClient = isSupabaseAdminConfigured() ? createAdminClient() : supabase;

  const { data: dbProfile } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (dbProfile) {
    profile = dbProfile as Profile;
  } else {
    // If profile row doesn't exist yet, query invitations to see if invited as ADMIN/TEACHER
    const { data: invite } = await adminClient
      .from('invitations')
      .select('role')
      .eq('email', authUser.email?.toLowerCase())
      .gt('expires_at', new Date().toISOString())
      .is('accepted_at', null)
      .order('created_at', { ascending: false })
      .maybeSingle();

    const assignedRole: UserRole = (invite?.role as UserRole) || 'STUDENT';

    const { data: newProfile } = await adminClient
      .from('profiles')
      .insert({
        id: authUser.id,
        full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
        email: authUser.email || '',
        role: assignedRole,
      })
      .select('*')
      .maybeSingle();

    profile = (newProfile as Profile) || {
      id: authUser.id,
      full_name: authUser.user_metadata?.full_name || 'User',
      email: authUser.email || '',
      role: assignedRole,
      created_at: new Date().toISOString(),
    };
  }

  const role = profile.role || 'STUDENT';

  return {
    user: authUser,
    profile,
    role,
    isAdmin: role === 'ADMIN',
    isTeacher: role === 'TEACHER',
    isStudent: role === 'STUDENT',
  };
}

/**
 * Verifies if an authenticated user has authorization for the specified class.
 * - ADMIN: full access to all classes.
 * - TEACHER: access ONLY if assigned via class_teachers or classes.teacher_id.
 * - STUDENT: access only if student is enrolled in that class.
 */
export async function verifyClassAccess(
  authCtx: AuthContext,
  classId: string
): Promise<boolean> {
  if (!authCtx.user || !authCtx.profile) return false;
  if (authCtx.isAdmin) return true;

  const adminClient = isSupabaseAdminConfigured()
    ? createAdminClient()
    : createServerSupabaseClient();

  if (authCtx.isTeacher) {
    // Check class_teachers
    const { data: ct } = await adminClient
      .from('class_teachers')
      .select('id')
      .eq('teacher_id', authCtx.user.id)
      .eq('class_id', classId)
      .maybeSingle();

    if (ct) return true;

    // Check direct legacy teacher_id on classes
    const { data: cls } = await adminClient
      .from('classes')
      .select('id')
      .eq('id', classId)
      .eq('teacher_id', authCtx.user.id)
      .maybeSingle();

    return Boolean(cls);
  }

  if (authCtx.isStudent) {
    const { data: std } = await adminClient
      .from('students')
      .select('class_id')
      .eq('profile_id', authCtx.user.id)
      .maybeSingle();

    return std?.class_id === classId;
  }

  return false;
}

/**
 * Verifies if an authenticated user has authorization for a specific student record.
 * - ADMIN: full access.
 * - TEACHER: access only if student belongs to a class assigned to teacher.
 * - STUDENT: access only to their own linked record.
 */
export async function verifyStudentAccess(
  authCtx: AuthContext,
  studentId: string
): Promise<boolean> {
  if (!authCtx.user || !authCtx.profile) return false;
  if (authCtx.isAdmin) return true;

  const adminClient = isSupabaseAdminConfigured()
    ? createAdminClient()
    : createServerSupabaseClient();

  const { data: student } = await adminClient
    .from('students')
    .select('class_id, profile_id')
    .eq('id', studentId)
    .maybeSingle();

  if (!student) return false;

  if (authCtx.isStudent) {
    return student.profile_id === authCtx.user.id;
  }

  if (authCtx.isTeacher) {
    return verifyClassAccess(authCtx, student.class_id);
  }

  return false;
}

/**
 * Creates an immutable audit log record.
 */
export async function recordAuditLog(params: {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: Record<string, any>;
}): Promise<void> {
  try {
    const adminClient = isSupabaseAdminConfigured()
      ? createAdminClient()
      : createServerSupabaseClient();

    await adminClient.from('audit_logs').insert({
      actor_id: params.actorId,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId || null,
      details: params.details || {},
    });
  } catch (err) {
    console.error('[AuditLog] Failed to record audit log:', err);
  }
}

/**
 * Generates a cryptographically secure random invitation token.
 */
export function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
