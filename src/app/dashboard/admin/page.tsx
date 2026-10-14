'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAttendance } from '@/lib/context/AttendanceContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, RoleBadge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import {
  Shield,
  UserPlus,
  Mail,
  CheckCircle2,
  Clock,
  Trash2,
  Copy,
  Users,
  GraduationCap,
  History,
  AlertTriangle,
  Link as LinkIcon,
  Unlink,
  BookOpen,
  Plus,
} from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

interface InvitationItem {
  id: string;
  email: string;
  role: 'ADMIN' | 'TEACHER';
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  inviter?: { full_name: string; email: string };
}

interface AuditLogItem {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, any>;
  created_at: string;
  actor?: { full_name: string; email: string; role: string };
}

export default function AdminManagementPage() {
  const router = useRouter();
  const { user, isAdmin, authLoading, classes, students, subjects, classSubjects, refreshData } = useAttendance();
  const { success, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState<'invitations' | 'students' | 'subjects' | 'audit'>('invitations');

  // Invitations State
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'TEACHER' | 'ADMIN'>('TEACHER');
  const [isInviting, setIsInviting] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  // Class Teachers State
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [teacherEmailOrId, setTeacherEmailOrId] = useState<string>('');
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [classAssignments, setClassAssignments] = useState<any[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);

  // Student Linking State
  const [linkStudentId, setLinkStudentId] = useState<string>('');
  const [linkUserEmail, setLinkUserEmail] = useState<string>('');
  const [isLinking, setIsLinking] = useState(false);

  // Subjects Management State
  const [newSubjName, setNewSubjName] = useState('');
  const [newSubjCode, setNewSubjCode] = useState('');
  const [newSubjDesc, setNewSubjDesc] = useState('');
  const [isCreatingSubj, setIsCreatingSubj] = useState(false);

  const [assignSubjClassId, setAssignSubjClassId] = useState('');
  const [assignSubjId, setAssignSubjId] = useState('');
  const [assignSubjTeacherId, setAssignSubjTeacherId] = useState('');
  const [isAssigningSubj, setIsAssigningSubj] = useState(false);
  const [educators, setEducators] = useState<Array<{ id: string; full_name: string; email: string }>>([]);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Guard against non-admin manual URL navigation
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [authLoading, isAdmin, router]);

  // Load Invitations
  const loadInvitations = () => {
    fetch('/api/admin/invitations')
      .then((res) => res.json())
      .then((data) => {
        if (data.invitations) setInvitations(data.invitations);
      })
      .catch(() => {});
  };

  // Load Audit Logs
  const loadAuditLogs = () => {
    setLoadingLogs(true);
    fetch('/api/admin/audit-logs')
      .then((res) => res.json())
      .then((data) => {
        if (data.logs) setAuditLogs(data.logs);
      })
      .catch(() => {})
      .finally(() => setLoadingLogs(false));
  };

  useEffect(() => {
    if (isAdmin) {
      loadInvitations();
      loadAuditLogs();
      if (classes.length > 0 && !selectedClassId) {
        setSelectedClassId(classes[0].id);
      }
    }
  }, [isAdmin, classes, selectedClassId]);

  useEffect(() => {
    if (isAdmin && isSupabaseConfigured()) {
      const supabase = createClient();
      supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('role', ['TEACHER', 'ADMIN'])
        .order('full_name', { ascending: true })
        .then((res: any) => {
          if (res.data) setEducators(res.data);
        });
    }
  }, [isAdmin]);

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjName.trim()) return;
    setIsCreatingSubj(true);
    try {
      const res = await fetch('/api/admin/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSubjName.trim(),
          code: newSubjCode.trim() || undefined,
          description: newSubjDesc.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create subject.');
      success('Subject Created', data.message || `Subject ${newSubjName} created.`);
      setNewSubjName('');
      setNewSubjCode('');
      setNewSubjDesc('');
      await refreshData();
    } catch (err: any) {
      toastError('Creation Failed', err.message);
    } finally {
      setIsCreatingSubj(false);
    }
  };

  const handleAssignSubjectToClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignSubjClassId || !assignSubjId) {
      toastError('Selection Required', 'Please choose both a class and a subject.');
      return;
    }
    setIsAssigningSubj(true);
    try {
      const res = await fetch(`/api/classes/${assignSubjClassId}/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: assignSubjId,
          teacherId: assignSubjTeacherId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign subject.');
      success('Subject Assigned', data.message || 'Subject mapped to class curriculum.');
      await refreshData();
    } catch (err: any) {
      toastError('Assignment Failed', err.message);
    } finally {
      setIsAssigningSubj(false);
    }
  };

  const handleRemoveSubjectFromClass = async (classId: string, subjectId: string) => {
    if (!confirm('Are you sure you want to remove this subject from this class?')) return;
    try {
      const res = await fetch(`/api/classes/${classId}/subjects?subjectId=${subjectId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove subject.');
      success('Subject Removed', data.message || 'Subject unassigned from class.');
      await refreshData();
    } catch (err: any) {
      toastError('Removal Failed', err.message);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center mb-3">
          <Shield className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Access Denied</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          This portal is restricted to institutional administrators only. Redirecting to your dashboard...
        </p>
      </div>
    );
  }

  // Handle Generate Invitation
  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setIsInviting(true);
    try {
      const res = await fetch('/api/admin/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate invitation.');

      setCreatedToken(data.invitation.token);
      setInviteEmail('');
      success('Invitation Created', `Expiring single-use invitation generated for ${data.invitation.email}.`);
      loadInvitations();
      loadAuditLogs();
    } catch (err: any) {
      toastError('Invitation Error', err.message);
    } finally {
      setIsInviting(false);
    }
  };

  // Handle Revoke Invitation
  const handleRevokeInvitation = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/invitations?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to revoke invitation.');
      success('Invitation Revoked', 'Single-use token has been cancelled.');
      loadInvitations();
      loadAuditLogs();
    } catch (err: any) {
      toastError('Error', err.message);
    }
  };

  // Handle Link Student to User Account
  const handleLinkStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkStudentId || !linkUserEmail) return;

    setIsLinking(true);
    try {
      const res = await fetch('/api/admin/students/link-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: linkStudentId,
          userEmail: linkUserEmail,
          action: 'link',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unable to link student account.');

      success('Account Linked', json.message);
      setLinkUserEmail('');
      await refreshData();
      loadAuditLogs();
    } catch (err: any) {
      toastError('Linking Error', err.message);
    } finally {
      setIsLinking(false);
    }
  };

  // Handle Unlink Student Account
  const handleUnlinkStudent = async (studentId: string) => {
    try {
      const res = await fetch('/api/admin/students/link-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, action: 'unlink' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unable to unlink student.');

      success('Account Unlinked', json.message);
      await refreshData();
      loadAuditLogs();
    } catch (err: any) {
      toastError('Error', err.message);
    }
  };

  if (user?.role !== 'ADMIN') {
    return (
      <div className="py-16 text-center max-w-md mx-auto space-y-4">
        <div className="w-14 h-14 rounded-3xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-900">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Administrator Access Required</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          This portal section is restricted strictly to authorized school administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Shield className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Admin & Security Control Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage invitations, class educator assignments, student portal account links, and immutable audit logs.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('invitations')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'invitations'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Mail className="w-4 h-4" /> User Invitations
        </button>
        <button
          onClick={() => setActiveTab('students')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'students'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <LinkIcon className="w-4 h-4" /> Student Portal Links
        </button>
        <button
          onClick={() => setActiveTab('subjects')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'subjects'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4" /> Curriculum & Subjects
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'audit'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" /> Security Audit Log
        </button>
      </div>

      {/* Tab 1: User Invitations */}
      {activeTab === 'invitations' && (
        <div className="space-y-6">
          <Card padding="lg" className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Invite Educator or Administrator
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Only authenticated administrators can issue invitations. The generated link is single-use, cryptographically signed, and expires after 7 days.
            </p>

            <form onSubmit={handleCreateInvitation} className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
              <div className="sm:col-span-6">
                <input
                  type="email"
                  required
                  placeholder="colleague@school.edu"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-3">
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="TEACHER">Teacher Role</option>
                  <option value="ADMIN">Admin Role</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                  isLoading={isInviting}
                  className="w-full font-bold shadow-sm"
                >
                  Generate Invite
                </Button>
              </div>
            </form>

            {createdToken && (
              <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Invitation Token Ready
                  </span>
                  <button
                    onClick={() => {
                      const link = `${window.location.origin}/login?invitation=${createdToken}`;
                      navigator.clipboard.writeText(link);
                      success('Copied', 'Invitation link copied to clipboard.');
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Link
                  </button>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 font-mono text-[11px] text-slate-700 dark:text-slate-300 break-all select-all border border-indigo-100 dark:border-indigo-900">
                  {typeof window !== 'undefined' ? `${window.location.origin}/login?invitation=${createdToken}` : createdToken}
                </div>
              </div>
            )}
          </Card>

          {/* Invitations Table */}
          <Card padding="none" className="overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Issued Invitations
              </h4>
              <span className="text-xs text-slate-400">{invitations.length} total</span>
            </div>

            {invitations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No invitations issued yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Recipient</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Expires</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {invitations.map((inv) => {
                      const isExpired = new Date(inv.expires_at).getTime() < Date.now();
                      const isAccepted = Boolean(inv.accepted_at);

                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                            {inv.email}
                          </td>
                          <td className="py-3 px-4">
                            <RoleBadge role={inv.role} />
                          </td>
                          <td className="py-3 px-4">
                            {isAccepted ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Accepted
                              </span>
                            ) : isExpired ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                                Expired
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                <Clock className="w-3.5 h-3.5" /> Pending
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px]">
                            {new Date(inv.expires_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {!isAccepted && (
                              <button
                                onClick={() => handleRevokeInvitation(inv.id)}
                                className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                title="Revoke invitation"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 2: Student Account Linking */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          <Card padding="lg" className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Link Student to Portal Login Account
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Only authorized administrators can link a registered user account to a student enrollment record. Students cannot link themselves or access other rosters.
            </p>

            <form onSubmit={handleLinkStudent} className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
              <div className="sm:col-span-5">
                <select
                  required
                  value={linkStudentId}
                  onChange={(e) => setLinkStudentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Enrolled Student...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} (Roll #{s.roll_number}) {s.profile_id ? '✓ Linked' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-5">
                <input
                  type="email"
                  required
                  placeholder="student.login@school.edu"
                  value={linkUserEmail}
                  onChange={(e) => setLinkUserEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-2">
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                  isLoading={isLinking}
                  className="w-full font-bold shadow-sm"
                >
                  Link
                </Button>
              </div>
            </form>
          </Card>

          {/* Student Roster Linking Status */}
          <Card padding="none" className="overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Student Roster Link Status
              </h4>
              <span className="text-xs text-slate-400">{students.length} students</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Roll Number</th>
                    <th className="py-3 px-4">Portal Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {students.map((std) => (
                    <tr key={std.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                        {std.full_name}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{std.roll_number}</td>
                      <td className="py-3 px-4">
                        {std.profile_id ? (
                           <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Linked to Account
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                            Not Linked
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {std.profile_id && (
                          <button
                            onClick={() => handleUnlinkStudent(std.id)}
                            className="text-xs font-bold text-rose-500 hover:underline inline-flex items-center gap-1"
                          >
                            <Unlink className="w-3.5 h-3.5" /> Unlink
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 3: Curriculum & Subjects Management */}
      {activeTab === 'subjects' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Create Subject Card */}
            <Card padding="lg" className="space-y-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Register Curriculum Subject
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Define an institutional subject. Subjects can then be assigned to one or more classrooms and assigned to designated educators.
              </p>

              <form onSubmit={handleCreateSubject} className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Subject Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newSubjName}
                    onChange={(e) => setNewSubjName(e.target.value)}
                    placeholder="e.g. Mathematics or Computer Networks"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Subject Code
                    </label>
                    <input
                      type="text"
                      value={newSubjCode}
                      onChange={(e) => setNewSubjCode(e.target.value)}
                      placeholder="e.g. CS-301"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={newSubjDesc}
                      onChange={(e) => setNewSubjDesc(e.target.value)}
                      placeholder="Optional notes"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isCreatingSubj}
                  className="w-full text-xs font-bold"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Subject to Catalog
                </Button>
              </form>
            </Card>

            {/* Assign Subject to Class Card */}
            <Card padding="lg" className="space-y-4">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Map Subject to Class Curriculum
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Link a registered subject to a specific class and optionally assign an educator to teach it.
              </p>

              <form onSubmit={handleAssignSubjectToClass} className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Select Class <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={assignSubjClassId}
                    onChange={(e) => setAssignSubjClassId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Choose Class...</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} ({cls.section})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Select Subject <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={assignSubjId}
                    onChange={(e) => setAssignSubjId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Choose Subject...</option>
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name} {sub.code ? `(${sub.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Designated Educator (Optional)
                  </label>
                  <select
                    value={assignSubjTeacherId}
                    onChange={(e) => setAssignSubjTeacherId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Class Primary Teacher (Default)</option>
                    {educators.map((ed) => (
                      <option key={ed.id} value={ed.id}>
                        {ed.full_name} ({ed.email})
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isAssigningSubj}
                  className="w-full text-xs font-bold"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Assign Subject to Class
                </Button>
              </form>
            </Card>
          </div>

          {/* Class Subjects Mappings Table */}
          <Card padding="none" className="overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Active Class Curriculum Mappings
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Subjects currently assigned to classrooms for subject-wise attendance tracking.
                </p>
              </div>
              <span className="text-xs text-slate-400">{classSubjects.length} mappings</span>
            </div>

            {classSubjects.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No class subjects mapped yet. Use the form above to assign subjects to classes.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Class</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Subject Code</th>
                      <th className="py-3 px-4">Designated Educator</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {classSubjects.map((cs) => {
                      const classObj = classes.find((c) => c.id === cs.class_id);
                      return (
                        <tr key={cs.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                            {classObj ? `${classObj.name} (${classObj.section})` : cs.class_id}
                          </td>
                          <td className="py-3 px-4 font-semibold text-indigo-600 dark:text-indigo-400">
                            {cs.subject?.name || 'Subject'}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                            {cs.subject?.code || '-'}
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                            {cs.teacher?.full_name || 'Class Teacher'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleRemoveSubjectFromClass(cs.class_id, cs.subject_id)}
                              className="text-xs font-bold text-rose-500 hover:underline inline-flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Global Subject Catalog */}
          <Card padding="none" className="overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Institutional Subject Catalog
              </h4>
              <span className="text-xs text-slate-400">{subjects.length} subjects registered</span>
            </div>

            {subjects.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No subjects in catalog. Register your first subject above.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Subject Name</th>
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {subjects.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          {sub.name}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          {sub.code || '-'}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {sub.description || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 4: Security Audit Log */}
      {activeTab === 'audit' && (
        <Card padding="none" className="overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Immutable System Audit Logs
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Records of administrative actions, invitations, scans, and roster adjustments.
              </p>
            </div>
            <button
              onClick={loadAuditLogs}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Refresh
            </button>
          </div>

          {loadingLogs ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading audit trail...</div>
          ) : auditLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No audit logs recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4 text-slate-400 font-sans text-xs whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                        {log.action}
                      </td>
                      <td className="py-3 px-4 font-sans text-xs text-slate-800 dark:text-slate-200">
                        {log.actor?.full_name || log.actor?.email || log.actor_id || 'System'}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {log.target_type}: {log.target_id || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
