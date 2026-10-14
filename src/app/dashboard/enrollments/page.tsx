'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAttendance } from '@/lib/context/AttendanceContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import {
  UserPlus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Camera,
  Search,
  Filter,
  RefreshCw,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

interface EnrollmentRequestItem {
  id: string;
  studentId?: string | null;
  userId: string;
  classId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
  requestedAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  reviewReason?: string | null;
  submittedPhotoUrl?: string | null;
  message?: string | null;
  user?: {
    id: string;
    fullName: string;
    email: string;
  };
  class?: {
    id: string;
    name: string;
    section: string;
    academicYear: string;
  };
  reviewer?: {
    id: string;
    fullName: string;
  };
}

export default function EnrollmentsPage() {
  const { user, isStudent, refreshData } = useAttendance();
  const { success, error: toastError } = useToast();

  const [requests, setRequests] = useState<EnrollmentRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'ACCEPTED' | 'REJECTED'>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [reviewingRequest, setReviewingRequest] = useState<EnrollmentRequestItem | null>(null);
  const [decision, setDecision] = useState<'accept' | 'reject' | 'request_photo'>('accept');
  const [rollNumberInput, setRollNumberInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/teacher/enrollment-requests');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch enrollment requests.');
      setRequests(data.requests || []);
    } catch (err: any) {
      toastError('Error', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    if (!isStudent) {
      fetchRequests();
    }
  }, [isStudent, fetchRequests]);

  if (isStudent) {
    return (
      <div className="p-6 text-center text-slate-600 dark:text-slate-400">
        Access forbidden. Student enrollment reviews are reserved for educators and administrators.
      </div>
    );
  }

  const openReviewModal = (req: EnrollmentRequestItem, dec: 'accept' | 'reject' | 'request_photo') => {
    setReviewingRequest(req);
    setDecision(dec);
    setRollNumberInput('');
    setReasonInput('');
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingRequest) return;

    if (decision === 'accept' && !rollNumberInput.trim()) {
      toastError('Roll Number Required', 'Please assign an official roll number to accept this enrollment.');
      return;
    }

    if ((decision === 'reject' || decision === 'request_photo') && !reasonInput.trim()) {
      toastError('Reason Required', 'Please specify a reason or instruction for the student.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/teacher/enrollment-requests/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: reviewingRequest.id,
          decision,
          rollNumber: rollNumberInput.trim() || undefined,
          reason: reasonInput.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Review submission failed.');

      success('Review Completed', data.message || 'Enrollment request updated successfully.');
      setReviewingRequest(null);
      await fetchRequests();
      await refreshData();
    } catch (err: any) {
      toastError('Review Failed', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = requests.filter((r) => {
    const matchesFilter = filterStatus === 'ALL' || r.status === filterStatus;
    const nameMatch = r.user?.fullName?.toLowerCase().includes(searchQuery.toLowerCase());
    const emailMatch = r.user?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const classMatch = r.class?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && (nameMatch || emailMatch || classMatch);
  });

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <UserPlus className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
              Student Enrollments
            </h1>
            {pendingCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-xs font-bold animate-pulse">
                {pendingCount} Pending Review
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review incoming student applications, inspect biometric reference photos, assign roll numbers, and admit students into class rosters.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchRequests}
          isLoading={isLoading}
          leftIcon={<RefreshCw className="w-4 h-4" />}
          className="self-start sm:self-auto"
        >
          Refresh
        </Button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 overflow-x-auto">
          {(['PENDING', 'ACCEPTED', 'REJECTED', 'ALL'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                filterStatus === st
                  ? 'bg-white dark:bg-slate-750 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {st === 'ALL' ? 'All Applications' : st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search applicant or class..."
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          />
        </div>
      </div>

      {/* Requests List */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-400 dark:text-slate-500">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mx-auto mb-3" />
          Loading enrollment applications...
        </div>
      ) : filtered.length === 0 ? (
        <Card className="py-12 text-center text-slate-500 dark:text-slate-400">
          <UserPlus className="w-10 h-10 mx-auto text-slate-400 mb-2 opacity-50" />
          <p className="text-sm font-semibold">No enrollment requests found in this filter.</p>
          <p className="text-xs text-slate-400 mt-1">
            When students register and submit enrollment requests, they will appear here.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((req) => (
            <Card
              key={req.id}
              className="flex flex-col justify-between border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all shadow-sm"
            >
              <div className="space-y-3">
                {/* Status & Date */}
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] ${
                      req.status === 'PENDING'
                        ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                        : req.status === 'ACCEPTED'
                        ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                        : 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300'
                    }`}
                  >
                    {req.status}
                  </span>
                  <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                    <Clock className="w-3 h-3" />
                    {new Date(req.requestedAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Student Info & Photo */}
                <div className="flex items-start gap-3">
                  <div
                    onClick={() => req.submittedPhotoUrl && setPreviewPhotoUrl(req.submittedPhotoUrl)}
                    className={`w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative ${
                      req.submittedPhotoUrl ? 'cursor-pointer group' : ''
                    }`}
                  >
                    {req.submittedPhotoUrl ? (
                      <>
                        <img
                          src={req.submittedPhotoUrl}
                          alt={req.user?.fullName || 'Student'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Camera className="w-4 h-4 text-white" />
                        </div>
                      </>
                    ) : (
                      <span className="text-xs font-bold text-slate-400">No Photo</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                      {req.user?.fullName || 'Student'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{req.user?.email}</p>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                      <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {req.class ? `${req.class.name} (${req.class.section})` : 'Class Assignment'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Message / Reason */}
                {req.message && (
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-600 dark:text-slate-300 italic border border-slate-100 dark:border-slate-800">
                    &ldquo;{req.message}&rdquo;
                  </div>
                )}

                {req.reviewReason && (
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-900">
                    <strong>Note:</strong> {req.reviewReason}
                  </div>
                )}
              </div>

              {/* Action Buttons for Pending */}
              {req.status === 'PENDING' && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => openReviewModal(req, 'accept')}
                    leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700"
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openReviewModal(req, 'request_photo')}
                    leftIcon={<Camera className="w-3.5 h-3.5" />}
                    className="text-xs"
                    title="Request better photo"
                  >
                    Photo
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => openReviewModal(req, 'reject')}
                    leftIcon={<XCircle className="w-3.5 h-3.5" />}
                    className="text-xs"
                  >
                    Reject
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {reviewingRequest && (
        <Modal
          isOpen={true}
          onClose={() => setReviewingRequest(null)}
          title={
            decision === 'accept'
              ? 'Accept Enrollment & Assign Roll Number'
              : decision === 'request_photo'
              ? 'Request New Biometric Photo'
              : 'Reject Enrollment Request'
          }
          maxWidth="md"
        >
          <form onSubmit={handleReviewSubmit} className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <div>
                <strong>Applicant:</strong> {reviewingRequest.user?.fullName} ({reviewingRequest.user?.email})
              </div>
              <div>
                <strong>Target Class:</strong> {reviewingRequest.class?.name} - {reviewingRequest.class?.section}
              </div>
            </div>

            {decision === 'accept' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Assign Roll Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={rollNumberInput}
                  onChange={(e) => setRollNumberInput(e.target.value)}
                  placeholder="e.g. 101 or CS-2026-01"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Must be unique among active students in {reviewingRequest.class?.name}.
                </p>
              </div>
            )}

            {decision === 'request_photo' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Photo Request <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="e.g. The submitted photo is too dark or blurry. Please upload a clear frontal portrait with direct lighting."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            {decision === 'reject' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Rejection <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="e.g. Section is full or prerequisites not met."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setReviewingRequest(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant={decision === 'reject' ? 'danger' : 'primary'}
                isLoading={isSubmitting}
              >
                Confirm {decision === 'accept' ? 'Admission' : decision === 'request_photo' ? 'Request' : 'Rejection'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Photo Preview Modal */}
      {previewPhotoUrl && (
        <Modal isOpen={true} onClose={() => setPreviewPhotoUrl(null)} title="Biometric Reference Photo" maxWidth="sm">
          <div className="space-y-4 text-center">
            <div className="w-full aspect-square rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-200 dark:border-slate-800">
              <img src={previewPhotoUrl} alt="Student preview" className="w-full h-full object-cover" />
            </div>
            <Button variant="outline" size="sm" onClick={() => setPreviewPhotoUrl(null)}>
              Close Preview
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
