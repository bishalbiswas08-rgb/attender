'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ClassItem } from '@/lib/types';
import { GraduationCap, Hash, Calendar } from 'lucide-react';
import { useToast } from '../ui/Toast';

interface ClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  classToEdit?: ClassItem | null;
  onSave: (cls: Omit<ClassItem, 'id' | 'created_at'> | ClassItem) => Promise<void>;
  teacherId?: string;
}

export const ClassModal: React.FC<ClassModalProps> = ({
  isOpen,
  onClose,
  classToEdit,
  onSave,
}) => {
  const { error } = useToast();
  const [name, setName] = useState('');
  const [section, setSection] = useState('');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (classToEdit) {
      setName(classToEdit.name);
      setSection(classToEdit.section);
      setAcademicYear(classToEdit.academic_year);
    } else {
      setName('');
      setSection('');
      setAcademicYear('2026-2027');
    }
  }, [classToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !section.trim()) {
      error('Validation Error', 'Class Name and Section are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (classToEdit) {
        await onSave({
          ...classToEdit,
          name: name.trim(),
          section: section.trim().toUpperCase(),
          academic_year: academicYear.trim(),
        });
      } else {
        await onSave({
          name: name.trim(),
          section: section.trim().toUpperCase(),
          academic_year: academicYear.trim(),
        });
      }
      onClose();
    } catch (err: any) {
      error('Error Saving Class', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={classToEdit ? 'Edit Class' : 'Create New Class'}
      subtitle="Define classroom sections and academic year for roster tracking."
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Class Name *
          </label>
          <div className="relative">
            <GraduationCap className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Class XII or Grade 10"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Section *
            </label>
            <div className="relative">
              <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="e.g. A"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Academic Year *
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="2026-2027"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={isSubmitting} className="w-full sm:w-auto font-bold">
            {classToEdit ? 'Save Changes' : 'Create Class'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
