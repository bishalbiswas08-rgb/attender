'use client';

import React, { useState } from 'react';
import { Student } from '@/lib/types';
import { ThresholdBadge } from '../ui/Badge';
import { Edit2, Trash2, Calendar, Mail, ShieldAlert, ShieldCheck, Hash, Camera } from 'lucide-react';
import { useAttendance } from '@/lib/context/AttendanceContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';

interface StudentCardProps {
  student: Student;
  onEdit: (student: Student) => void;
  onDelete: (studentId: string) => void;
  onViewProfile: (student: Student) => void;
}

export const StudentCard: React.FC<StudentCardProps> = ({
  student,
  onEdit,
  onDelete,
  onViewProfile,
}) => {
  const {
    getStudentStats,
    threshold,
    classes,
    isAdmin,
    isTeacher,
    updateStudentRollNumber,
    rusticateStudent,
    reinstateStudent,
  } = useAttendance();
  const { error: toastError, success: toastSuccess } = useToast();

  const [isRollModalOpen, setIsRollModalOpen] = useState(false);
  const [newRollNumber, setNewRollNumber] = useState(student.roll_number || '');
  const [isUpdatingRoll, setIsUpdatingRoll] = useState(false);

  const [isRusticateModalOpen, setIsRusticateModalOpen] = useState(false);
  const [rusticateReason, setRusticateReason] = useState('');
  const [isRusticating, setIsRusticating] = useState(false);

  const stats = getStudentStats(student.id);
  const percentage = stats ? stats.percentage : null;
  const studentClass = classes.find((c) => c.id === student.class_id);
  const isRusticated = student.status === 'RUSTICATED';

  const handleRollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRollNumber.trim()) {
      toastError('Error', 'Roll number cannot be empty.');
      return;
    }
    setIsUpdatingRoll(true);
    try {
      await updateStudentRollNumber(student.id, newRollNumber.trim());
      setIsRollModalOpen(false);
    } catch (err: any) {
      toastError('Update Failed', err.message);
    } finally {
      setIsUpdatingRoll(false);
    }
  };

  const handleRusticateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rusticateReason.trim()) {
      toastError('Reason Required', 'Please specify the official reason for rustication.');
      return;
    }
    setIsRusticating(true);
    try {
      await rusticateStudent(student.id, rusticateReason.trim());
      setIsRusticateModalOpen(false);
      setRusticateReason('');
    } catch (err: any) {
      toastError('Rustication Failed', err.message);
    } finally {
      setIsRusticating(false);
    }
  };

  const handleReinstate = async () => {
    if (!confirm(`Are you sure you want to reinstate ${student.full_name}?`)) return;
    try {
      await reinstateStudent(student.id);
    } catch (err: any) {
      toastError('Reinstatement Failed', err.message);
    }
  };

  return (
    <>
      <div
        className={`group rounded-2xl bg-white dark:bg-slate-900 border p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between w-full min-w-0 overflow-hidden ${
          isRusticated
            ? 'border-rose-300 dark:border-rose-900 bg-rose-50/20 dark:bg-rose-950/10'
            : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        <div className="min-w-0">
          {/* Top Info */}
          <div className="flex items-start gap-3.5 sm:gap-4 min-w-0">
            <div
              onClick={() => onViewProfile(student)}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shrink-0 cursor-pointer shadow-sm group-hover:scale-105 transition-transform relative"
            >
              {student.photo_url ? (
                <img
                  src={student.photo_url}
                  alt={student.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-slate-400 text-lg sm:text-xl">
                  {student.full_name.charAt(0)}
                </div>
              )}
              {isRusticated && (
                <div className="absolute inset-0 bg-rose-950/60 flex items-center justify-center">
                  <ShieldAlert className="w-6 h-6 text-rose-400" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4
                  onClick={() => onViewProfile(student)}
                  className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  {student.full_name}
                </h4>
                {isRusticated && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300">
                    Rusticated
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                <span className="truncate">
                  Roll: <strong className="text-slate-700 dark:text-slate-200">{student.roll_number || 'None'}</strong>
                </span>
                {(isAdmin || isTeacher) && (
                  <button
                    onClick={() => {
                      setNewRollNumber(student.roll_number || '');
                      setIsRollModalOpen(true);
                    }}
                    title="Change roll number"
                    className="p-0.5 rounded text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950"
                  >
                    <Hash className="w-3 h-3" />
                  </button>
                )}
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {studentClass ? `${studentClass.name}-${studentClass.section}` : 'Class'}
              </p>

              <div className="flex items-center gap-1.5 sm:gap-2 mt-2 flex-wrap">
                <span className="text-[11px] text-slate-500 shrink-0">Attendance:</span>
                <ThresholdBadge percentage={percentage} threshold={threshold} />
              </div>
            </div>
          </div>

          {student.email && (
            <div className="flex items-center gap-1.5 mt-3 text-[11px] text-slate-400 min-w-0 overflow-hidden">
              <Mail className="w-3 h-3 shrink-0" />
              <span className="truncate break-all">{student.email}</span>
            </div>
          )}

          {isRusticated && student.status_reason && (
            <div className="mt-2.5 p-2 rounded-xl bg-rose-100/60 dark:bg-rose-950/40 text-[11px] text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
              <strong>Rustication Reason:</strong> {student.status_reason}
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 sm:pt-4 mt-3 sm:mt-4 border-t border-slate-100 dark:border-slate-800/80">
          <button
            onClick={() => onViewProfile(student)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors py-1"
          >
            <Calendar className="w-3.5 h-3.5" /> View Profile
          </button>

          <div className="flex items-center gap-1">
            {isAdmin && (
              <>
                {isRusticated ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReinstate}
                    className="text-[11px] px-2 py-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                    title="Reinstate student"
                  >
                    <ShieldCheck className="w-3 h-3 mr-1" /> Reinstate
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setIsRusticateModalOpen(true)}
                    className="text-[11px] px-2 py-1"
                    title="Rusticate student"
                  >
                    <ShieldAlert className="w-3 h-3 mr-1" /> Rusticate
                  </Button>
                )}

                <button
                  onClick={() => onEdit(student)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                  title="Edit student"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDelete(student.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                  title="Delete student"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Roll Number Edit Modal */}
      {isRollModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsRollModalOpen(false)}
          title={`Assign Roll Number: ${student.full_name}`}
          maxWidth="sm"
        >
          <form onSubmit={handleRollSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Official Roll Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newRollNumber}
                onChange={(e) => setNewRollNumber(e.target.value)}
                placeholder="e.g. 101 or CS-01"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Must be unique among active students in this class.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsRollModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isUpdatingRoll}>
                Save Roll Number
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Rusticate Confirmation Modal */}
      {isRusticateModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsRusticateModalOpen(false)}
          title={`Rusticate Student: ${student.full_name}`}
          maxWidth="md"
        >
          <form onSubmit={handleRusticateSubmit} className="space-y-4">
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200">
              <strong>Admin Warning:</strong> Rusticaton revokes active enrollment, disables future attendance marking, and excludes the student from AI face scans. Historical attendance records are preserved for audit purposes.
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Official Reason for Rustication <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={rusticateReason}
                onChange={(e) => setRusticateReason(e.target.value)}
                placeholder="e.g. Disciplinary breach of code of conduct per academic committee hearing."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsRusticateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" isLoading={isRusticating}>
                Confirm Rustication
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};
