'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Student, ClassItem } from '@/lib/types';
import { Upload, User, Mail, Hash, Loader2 } from 'lucide-react';
import { useToast } from '../ui/Toast';

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentToEdit?: Student | null;
  classes: ClassItem[];
  defaultClassId: string;
  onSave: (student: Omit<Student, 'id' | 'created_at'> | Student) => Promise<void>;
}

export const StudentModal: React.FC<StudentModalProps> = ({
  isOpen,
  onClose,
  studentToEdit,
  classes,
  defaultClassId,
  onSave,
}) => {
  const { error, success } = useToast();
  const [fullName, setFullName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [classId, setClassId] = useState(defaultClassId);
  const [email, setEmail] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [referencePhotos, setReferencePhotos] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (studentToEdit) {
      setFullName(studentToEdit.full_name);
      setRollNumber(studentToEdit.roll_number);
      setClassId(studentToEdit.class_id);
      setEmail(studentToEdit.email || '');
      setPhotoUrl(studentToEdit.photo_url || null);
      setReferencePhotos(studentToEdit.reference_photos || []);
      setActive(studentToEdit.active);
    } else {
      setFullName('');
      setRollNumber('');
      setClassId(defaultClassId);
      setEmail('');
      setPhotoUrl(null);
      setReferencePhotos([]);
      setActive(true);
    }
  }, [studentToEdit, defaultClassId, isOpen]);

  // Handle Photo File Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', 'student-photos');

      const res = await fetch('/api/storage/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Failed to upload photograph to Supabase Storage.');
      }

      setPhotoUrl(data.url);
      success('Photo Uploaded', 'Student profile photo uploaded to Supabase Storage.');
    } catch (err: any) {
      error('Photo Upload Failed', err.message || 'Unable to upload photo to Supabase Storage.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddReferencePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', 'student-photos');

      const res = await fetch('/api/storage/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Failed to upload reference photo.');
      }

      setReferencePhotos((prev) => [...prev, data.url]);
      success('Reference Photo Added', 'Additional face reference added for multi-angle AI recognition.');
    } catch (err: any) {
      error('Upload Failed', err.message || 'Unable to upload reference photo.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveReferencePhoto = (idx: number) => {
    setReferencePhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !rollNumber.trim()) {
      error('Validation Error', 'Full Name and Roll Number are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (studentToEdit) {
        await onSave({
          ...studentToEdit,
          full_name: fullName.trim(),
          roll_number: rollNumber.trim(),
          class_id: classId,
          email: email.trim() || null,
          photo_url: photoUrl,
          reference_photos: referencePhotos,
          active,
        });
      } else {
        await onSave({
          full_name: fullName.trim(),
          roll_number: rollNumber.trim(),
          class_id: classId,
          email: email.trim() || null,
          photo_url: photoUrl,
          reference_photos: referencePhotos,
          active,
        });
      }
      onClose();
    } catch (err: any) {
      error('Save Failed', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={studentToEdit ? 'Edit Student Profile' : 'Add New Student'}
      subtitle="Students registered with frontal photos will be recognized during Classroom Scan."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Photo Upload Area */}
        <div className="space-y-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 min-w-0">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left min-w-0">
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0 relative flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-sm">
              {photoUrl ? (
                <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <User className="w-7 h-7 text-slate-400" />
              )}
              {isUploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 cursor-pointer transition-colors border border-indigo-200 dark:border-indigo-800">
                <Upload className="w-3.5 h-3.5 shrink-0" />
                <span>{photoUrl ? 'Change Primary Photo' : 'Upload Student Photo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Primary frontal face photo for AI recognition.
              </p>
            </div>
          </div>

          {/* Multiple Reference Photos (Additional Angles) */}
          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-750">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                Additional Reference Angles ({referencePhotos.length}/3)
              </span>
              {referencePhotos.length < 3 && (
                <label className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
                  + Add Angle
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAddReferencePhoto}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>
              )}
            </div>

            {referencePhotos.length > 0 && (
              <div className="flex items-center gap-2">
                {referencePhotos.map((url, i) => (
                  <div key={i} className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 group">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveReferencePhoto(i)}
                      className="absolute inset-0 bg-black/60 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Full Name */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Full Name *
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Roll Number & Class */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Roll Number *
            </label>
            <div className="relative">
              <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="e.g. 23"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Class *
            </label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer truncate"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.section}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Email (Optional)
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rahul.sharma@school.edu"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Status Checkbox */}
        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="active-checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
          <label htmlFor="active-checkbox" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
            Active Student (eligible for daily attendance)
          </label>
        </div>

        {/* Submit Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={isSubmitting} className="w-full sm:w-auto font-bold">
            {studentToEdit ? 'Save Changes' : 'Enroll Student'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
