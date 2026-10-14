'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import {
  GraduationCap,
  CheckCircle2,
  XCircle,
  Clock,
  Percent,
  Calendar,
  AlertCircle,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  Camera,
  Upload,
  BookOpen,
  User,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import { BunkCalculation, SubjectAttendanceStats } from '@/lib/types';

interface StudentData {
  linked: boolean;
  isRusticated?: boolean;
  message?: string;
  profile?: {
    id: string;
    email: string;
    fullName: string;
  };
  requests?: Array<{
    id: string;
    class_id: string;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
    requested_at: string;
    reviewed_at?: string | null;
    review_reason?: string | null;
    submitted_photo_url?: string | null;
    message?: string | null;
    class?: {
      id: string;
      name: string;
      section: string;
      academic_year: string;
    };
  }>;
  availableClasses?: Array<{
    id: string;
    name: string;
    section: string;
    academic_year: string;
  }>;
  student?: {
    id: string;
    fullName: string;
    rollNumber: string;
    photoUrl: string | null;
    active: boolean;
    status?: string;
    statusReason?: string | null;
    statusChangedAt?: string | null;
    class: {
      id: string;
      name: string;
      section: string;
      academic_year: string;
    };
  };
  teachers?: Array<{
    id: string;
    fullName: string;
    email: string;
  }>;
  assignedSubjects?: Array<{
    id: string;
    subjectId: string;
    subject?: {
      id: string;
      name: string;
      code?: string;
      description?: string;
    };
    teacher?: {
      id: string;
      fullName: string;
    };
  }>;
  stats?: {
    presentCount: number;
    absentCount: number;
    lateCount: number;
    totalSessions: number;
    percentage: number | null;
    isBelowThreshold: boolean;
    bunkCalculation?: BunkCalculation;
  };
  subjectWiseStats?: SubjectAttendanceStats[];
  monthlyBreakdown?: Array<{
    month: string;
    present: number;
    absent: number;
    total: number;
    rate: number;
  }>;
  history?: Array<{
    id: string;
    date: string;
    status: 'present' | 'absent' | 'late';
    source: string;
    subjectId?: string | null;
    subjectName?: string;
    subjectCode?: string | null;
  }>;
}

export default function StudentDashboardPage() {
  const { success, error: toastError } = useToast();

  const [data, setData] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Enrollment Form State (for unenrolled students)
  const [selectedClassId, setSelectedClassId] = useState('');
  const [enrollmentPhotoBase64, setEnrollmentPhotoBase64] = useState<string | null>(null);
  const [enrollmentMessage, setEnrollmentMessage] = useState('');
  const [isSubmittingEnrollment, setIsSubmittingEnrollment] = useState(false);

  // Photo Update Modal State (for enrolled students)
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [newPhotoBase64, setNewPhotoBase64] = useState<string | null>(null);
  const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false);

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const enrollmentPhotoInputRef = useRef<HTMLInputElement | null>(null);

  const fetchStudentData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/student/me');
      if (!res.ok) throw new Error('Unable to retrieve student profile.');
      const json = await res.json();
      setData(json);
      if (json.availableClasses && json.availableClasses.length > 0) {
        setSelectedClassId((prev) => prev || json.availableClasses[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading student portal data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, []);

  const handleEnrollmentPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toastError('File Too Large', 'Please upload a photo under 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setEnrollmentPhotoBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId) {
      toastError('Class Required', 'Please select a class to request enrollment in.');
      return;
    }

    setIsSubmittingEnrollment(true);
    try {
      const res = await fetch('/api/student/enrollment/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: selectedClassId,
          photoBase64: enrollmentPhotoBase64,
          message: enrollmentMessage.trim() || undefined,
        }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to submit enrollment request.');

      success('Request Submitted', resData.message || 'Enrollment request submitted to class teacher.');
      setEnrollmentPhotoBase64(null);
      setEnrollmentMessage('');
      await fetchStudentData();
    } catch (err: any) {
      toastError('Submission Failed', err.message);
    } finally {
      setIsSubmittingEnrollment(false);
    }
  };

  const handleWithdrawRequest = async (requestId: string) => {
    if (!confirm('Are you sure you want to withdraw this enrollment application?')) return;
    try {
      const res = await fetch('/api/student/enrollment/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Unable to withdraw request.');
      success('Request Withdrawn', resData.message || 'Enrollment application withdrawn.');
      await fetchStudentData();
    } catch (err: any) {
      toastError('Error', err.message);
    }
  };

  const handleUpdatePhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhotoBase64) {
      toastError('Photo Required', 'Please choose a photo to upload.');
      return;
    }

    setIsUpdatingPhoto(true);
    try {
      const res = await fetch('/api/student/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoBase64: newPhotoBase64 }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to update photo.');

      success('Photo Updated', resData.message || 'Reference photo updated successfully.');
      setIsPhotoModalOpen(false);
      setNewPhotoBase64(null);
      await fetchStudentData();
    } catch (err: any) {
      toastError('Update Failed', err.message);
    } finally {
      setIsUpdatingPhoto(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 font-medium">Loading your student portal records...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-3xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-center max-w-md mx-auto my-12 space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-600 dark:text-rose-400 mx-auto" />
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Connection Error</h3>
        <p className="text-xs text-slate-600 dark:text-slate-400">{error}</p>
        <Button size="sm" variant="outline" onClick={fetchStudentData}>
          Try Again
        </Button>
      </div>
    );
  }

  // CASE 1: UNENROLLED STUDENT (NO ACTIVE STUDENT RECORD LINKED)
  if (!data?.linked) {
    const pendingRequest = data?.requests?.find((r) => r.status === 'PENDING');
    const pastRequests = data?.requests?.filter((r) => r.status !== 'PENDING') || [];

    return (
      <div className="max-w-3xl mx-auto py-8 px-4 space-y-6 min-w-0">
        {/* Banner */}
        <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black">Student Enrollment Portal</h1>
              <p className="text-xs text-indigo-100 mt-0.5">
                Welcome, {data?.profile?.fullName || 'Student'}. Request admission into your classroom roster below.
              </p>
            </div>
          </div>
        </div>

        {/* Pending Request Banner if one exists */}
        {pendingRequest ? (
          <Card padding="lg" className="border-2 border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 space-y-4">
            <div className="flex items-start gap-3">
              <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-pulse" />
              <div className="flex-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                  Application Under Review
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                  Enrolling in {pendingRequest.class?.name} ({pendingRequest.class?.section})
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  Your admission request was submitted on{' '}
                  <strong>{new Date(pendingRequest.requested_at).toLocaleDateString()}</strong>. Your class teacher is reviewing your details and biometric reference photo.
                </p>
                {pendingRequest.message && (
                  <p className="text-xs text-slate-500 italic mt-2">
                    Note: &ldquo;{pendingRequest.message}&rdquo;
                  </p>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-amber-200 dark:border-amber-900/60 flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] text-slate-500">
                Need to change classes or update photo?
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleWithdrawRequest(pendingRequest.id)}
                className="text-xs border-amber-400 text-amber-800 dark:text-amber-300 hover:bg-amber-100"
              >
                Withdraw Request
              </Button>
            </div>
          </Card>
        ) : (
          /* Enrollment Application Form */
          <Card padding="lg" className="space-y-6 border border-slate-200 dark:border-slate-800 shadow-md">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                Submit New Enrollment Request
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Choose your class and provide a frontal portrait photo so ATTENDER AI can identify you in classroom scans.
              </p>
            </div>

            <form onSubmit={handleSubmitEnrollment} className="space-y-5">
              {/* Class Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Class & Section <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                >
                  <option value="" disabled>Choose a class...</option>
                  {data?.availableClasses?.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} - Section {cls.section} ({cls.academic_year})
                    </option>
                  ))}
                </select>
              </div>

              {/* Biometric Photo Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Biometric Face Photo (Required for AI Recognition) <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0 border border-slate-300 dark:border-slate-700 flex items-center justify-center">
                    {enrollmentPhotoBase64 ? (
                      <img src={enrollmentPhotoBase64} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 text-center sm:text-left space-y-2">
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Upload a clean, well-lit frontal portrait with your face centered. Avoid hats, masks, or extreme angles.
                    </p>
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => enrollmentPhotoInputRef.current?.click()}
                        leftIcon={<Upload className="w-3.5 h-3.5" />}
                        className="text-xs"
                      >
                        {enrollmentPhotoBase64 ? 'Change Photo' : 'Select Photo'}
                      </Button>
                      <input
                        ref={enrollmentPhotoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleEnrollmentPhotoChange}
                        className="hidden"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Message to Teacher */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Message or Existing Roll Number (Optional)
                </label>
                <textarea
                  rows={2}
                  value={enrollmentMessage}
                  onChange={(e) => setEnrollmentMessage(e.target.value)}
                  placeholder="e.g. Previous roll number was 24, or transferred from Section A."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isSubmittingEnrollment}
                disabled={!selectedClassId || !enrollmentPhotoBase64}
                className="w-full text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-indigo-500/20"
              >
                Submit Enrollment Application
              </Button>
            </form>
          </Card>
        )}

        {/* Previous Request History */}
        {pastRequests.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Past Applications</h3>
            <div className="space-y-2">
              {pastRequests.map((r) => (
                <div
                  key={r.id}
                  className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {r.class?.name} ({r.class?.section})
                    </span>
                    <span className="text-slate-400 ml-2">
                      {new Date(r.requested_at).toLocaleDateString()}
                    </span>
                    {r.review_reason && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                        Note: {r.review_reason}
                      </p>
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      r.status === 'ACCEPTED'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : r.status === 'REJECTED'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // CASE 2: ENROLLED STUDENT
  const { student, stats, teachers, assignedSubjects, subjectWiseStats, monthlyBreakdown, history, isRusticated } = data;
  const percentage = stats?.percentage !== null && stats?.percentage !== undefined ? stats.percentage : null;
  const bunkCalc = stats?.bunkCalculation;

  return (
    <div className="space-y-6 max-w-7xl mx-auto min-w-0">
      {/* Rustication Restriction Notice if Rusticated */}
      {isRusticated && (
        <div className="p-4 sm:p-5 rounded-3xl bg-rose-950 border-2 border-rose-500 text-white shadow-2xl flex items-start gap-4 animate-bounce-short">
          <ShieldAlert className="w-8 h-8 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="px-2.5 py-0.5 rounded-full bg-rose-500/30 text-rose-200 text-[10px] font-bold uppercase tracking-wider border border-rose-400/40">
              Official Notice
            </span>
            <h2 className="text-lg sm:text-xl font-black text-rose-100">
              Academic Enrollment Rusticated
            </h2>
            <p className="text-xs sm:text-sm text-rose-200/90 leading-relaxed max-w-3xl">
              Your student enrollment has been officially rusticated by administrative action. You retain access to inspect your historical attendance records and subject performance below, but you cannot be marked in new attendance sessions or submit enrollment requests.
            </p>
            {student?.statusReason && (
              <div className="mt-2 p-2.5 rounded-xl bg-black/40 border border-rose-800 text-xs text-rose-300">
                <strong>Reason on Record:</strong> {student.statusReason}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Student Profile Banner */}
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white relative overflow-hidden shadow-xl border border-indigo-800/40">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 min-w-0">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            {/* Student Photo with update button */}
            <div className="relative group shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-slate-800 border-2 border-white/20 shadow-lg shadow-indigo-500/25 flex items-center justify-center">
                {student?.photoUrl ? (
                  <img src={student.photoUrl} alt={student.fullName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-black">{student?.fullName.charAt(0)}</span>
                )}
              </div>
              {!isRusticated && (
                <button
                  onClick={() => setIsPhotoModalOpen(true)}
                  aria-label="Update photo"
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-2xl transition-opacity text-white text-[10px] font-bold"
                >
                  <Camera className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-black tracking-tight truncate">{student?.fullName}</h1>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                    isRusticated
                      ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {isRusticated ? 'RUSTICATED' : 'ACTIVE ENROLLED'}
                </span>
              </div>
              <p className="text-xs text-indigo-200 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span>Roll No: <strong className="text-white">{student?.rollNumber || 'Not assigned'}</strong></span>
                <span className="hidden sm:inline">•</span>
                <span>Class: <strong className="text-white">{student?.class?.name} - {student?.class?.section}</strong></span>
                <span className="hidden sm:inline">•</span>
                <span>Year: <strong className="text-white">{student?.class?.academic_year}</strong></span>
              </p>
              {teachers && teachers.length > 0 && (
                <p className="text-[11px] text-indigo-300/80 truncate">
                  Class Teachers: {teachers.map((t) => t.fullName).join(', ')}
                </p>
              )}
            </div>
          </div>

          {/* Aggregate Attendance Standing */}
          <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-300 block">
                Overall Attendance
              </span>
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {percentage !== null ? `${percentage}%` : 'N/A'}
              </span>
            </div>
            <div
              className={`w-2.5 sm:w-3 h-10 sm:h-12 rounded-full ${
                percentage !== null && percentage >= 75 ? 'bg-emerald-400' : 'bg-amber-400'
              } shadow-lg shadow-black/30`}
            />
          </div>
        </div>

        <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* DYNAMIC BUNK CALCULATOR HERO CARD */}
      {bunkCalc && (
        <Card
          padding="lg"
          className={`border-2 shadow-lg transition-all ${
            bunkCalc.isSafe
              ? 'border-emerald-300 dark:border-emerald-800 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/5'
              : 'border-rose-300 dark:border-rose-800 bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-indigo-500/5'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                    bunkCalc.isSafe
                      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300'
                  }`}
                >
                  {bunkCalc.isSafe ? 'SAFE STANDING' : 'ATTENDANCE DEFICIT'}
                </span>
                <span className="text-xs text-slate-500 font-semibold">Dynamic Academic Guidance</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                {bunkCalc.message}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Formula: Safe bunks B = &lfloor;Present / 0.75 - Total&rfloor; &bull; Needed recovery A = &lceil;(0.75 &times; Total - Present) / 0.25&rceil;
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
              <div className="px-4 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Rate</span>
                <span
                  className={`text-lg font-black ${
                    bunkCalc.isSafe ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {bunkCalc.currentPercentage !== null ? `${bunkCalc.currentPercentage}%` : 'N/A'}
                </span>
              </div>
              <div className="px-4 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Target</span>
                <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                  {bunkCalc.requiredPercentage}%
                </span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card padding="md" className="space-y-1 min-w-0">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Overall Rate</span>
            <Percent className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {percentage !== null ? `${percentage}%` : 'N/A'}
          </div>
          <p className="text-[11px] text-slate-400 truncate">
            {percentage !== null && percentage >= 75 ? 'Healthy standing' : 'Below 75% target'}
          </p>
        </Card>

        <Card padding="md" className="space-y-1 min-w-0">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Present Classes</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {stats?.presentCount || 0}
          </div>
          <p className="text-[11px] text-slate-400 truncate">Total attended classes</p>
        </Card>

        <Card padding="md" className="space-y-1 min-w-0">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Absent Classes</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
            {stats?.absentCount || 0}
          </div>
          <p className="text-[11px] text-slate-400 truncate">Total missed classes</p>
        </Card>

        <Card padding="md" className="space-y-1 min-w-0">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Evaluated</span>
            <Calendar className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {stats?.totalSessions || 0}
          </div>
          <p className="text-[11px] text-slate-400 truncate">Recorded attendance sessions</p>
        </Card>
      </div>

      {/* SUBJECT-WISE ATTENDANCE BREAKDOWN */}
      <Card padding="none" className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Subject-Wise Attendance Breakdown
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Attendance tracked individually per curriculum subject with dynamic bunk calculations
            </p>
          </div>
          <span className="text-xs font-bold text-slate-400">
            {subjectWiseStats?.length || 0} Subjects Assigned
          </span>
        </div>

        {(!subjectWiseStats || subjectWiseStats.length === 0) ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No subjects assigned yet to your class curriculum.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Educator</th>
                  <th className="py-3 px-4">Attended / Total</th>
                  <th className="py-3 px-4">Rate (%)</th>
                  <th className="py-3 px-4">Standing</th>
                  <th className="py-3 px-4">Bunk Advice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {subjectWiseStats.map((sub) => {
                  const subPct = sub.percentage;
                  const bCalc = sub.bunkCalculation;

                  return (
                    <tr key={sub.subjectId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span>{sub.subjectName}</span>
                          {sub.subjectCode && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-500">
                              {sub.subjectCode}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {sub.teacherName || 'Class Teacher'}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-200 font-semibold">
                        {sub.presentCount} / {sub.totalClasses} classes
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-black text-sm ${
                            subPct !== null && subPct >= 75
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {subPct !== null ? `${subPct}%` : 'N/A'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            subPct !== null && subPct >= 75
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200'
                              : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200'
                          }`}
                        >
                          {subPct !== null && subPct >= 75 ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> Safe
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3 h-3" /> At Risk
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-600 dark:text-slate-300">
                        {bCalc ? (
                          bCalc.isSafe ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              +{bCalc.allowedBunks} safe {bCalc.allowedBunks === 1 ? 'bunk' : 'bunks'}
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400 font-semibold">
                              Attend next {bCalc.recoveryNeeded}
                            </span>
                          )
                        ) : (
                          'N/A'
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

      {/* Middle Grid: Monthly Trends & Security Note */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Breakdown */}
        <div className="lg:col-span-2 space-y-4">
          <Card padding="lg" className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Monthly Attendance Trends
            </h3>

            {(!monthlyBreakdown || monthlyBreakdown.length === 0) ? (
              <p className="text-xs text-slate-400 py-6 text-center">No monthly attendance records yet.</p>
            ) : (
              <div className="space-y-3 pt-2">
                {monthlyBreakdown.map((m) => (
                  <div key={m.month} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-800 dark:text-slate-200">{m.month}</span>
                      <span className={m.rate >= 75 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                        {m.rate}% ({m.present} of {m.total} sessions)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          m.rate >= 75
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                            : 'bg-gradient-to-r from-amber-500 to-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, m.rate))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Security & Standing Card */}
        <div className="space-y-4">
          <Card padding="md" className="space-y-3">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" /> Academic Policy & Privacy
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              ATTENDER enforces strict database-level student privacy. You can only view your own records and calculations.
            </p>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Passing Threshold:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">75% minimum</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Current Status:</span>
                <span className={`font-bold ${percentage !== null && percentage >= 75 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {percentage !== null ? (percentage >= 75 ? 'Good Standing' : 'Deficit Risk') : 'Pending Data'}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Personal Attendance History Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Your Attendance History</h3>
            <p className="text-xs text-slate-400 mt-0.5">Chronological record of your recorded class attendance</p>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {history?.length || 0} entries
          </span>
        </div>

        {(!history || history.length === 0) ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No attendance sessions recorded yet for your account.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                      {record.date}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                      {record.subjectName || 'General Session'}
                      {record.subjectCode && (
                        <span className="ml-1.5 px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-500">
                          {record.subjectCode}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 capitalize text-slate-500">
                      {record.source === 'classroom_scan' ? 'AI Classroom Scan' : 'Individual Check'}
                    </td>
                    <td className="py-3 px-4">
                      {record.status === 'present' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> Present
                        </span>
                      ) : record.status === 'late' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          <Clock className="w-3 h-3" /> Late
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          <XCircle className="w-3 h-3" /> Absent
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Update Reference Photo Modal */}
      {isPhotoModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsPhotoModalOpen(false)}
          title="Update Biometric Reference Photo"
          maxWidth="sm"
        >
          <form onSubmit={handleUpdatePhoto} className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Upload a clear frontal portrait with direct lighting. ATTENDER AI uses this photo to recognize you during classroom scans.
            </p>

            <div className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <div className="w-28 h-28 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-800 mb-3 border border-slate-300 dark:border-slate-700 flex items-center justify-center">
                {newPhotoBase64 ? (
                  <img src={newPhotoBase64} alt="New Preview" className="w-full h-full object-cover" />
                ) : student?.photoUrl ? (
                  <img src={student.photoUrl} alt="Current" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-12 h-12 text-slate-400" />
                )}
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => photoInputRef.current?.click()}
                leftIcon={<Upload className="w-3.5 h-3.5" />}
                className="text-xs"
              >
                Choose Photo
              </Button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setNewPhotoBase64(reader.result as string);
                  reader.readAsDataURL(file);
                }}
                className="hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsPhotoModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isUpdatingPhoto} disabled={!newPhotoBase64}>
                Save Photo
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
