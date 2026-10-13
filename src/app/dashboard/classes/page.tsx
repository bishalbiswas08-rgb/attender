'use client';

import React, { useState } from 'react';
import { useAttendance } from '@/lib/context/AttendanceContext';
import { ClassModal } from '@/components/classes/ClassModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ClassItem } from '@/lib/types';
import { GraduationCap, Plus, Edit2, Trash2, Users, Calendar, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function ClassesPage() {
  const {
    classes,
    students,
    activeClassId,
    setActiveClassId,
    addClass,
    updateClass,
    deleteClass,
    user,
  } = useAttendance();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [classToDelete, setClassToDelete] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Title & CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <GraduationCap className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Class Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Organize academic classes, sections, and assigned teacher rosters in Supabase.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setEditingClass(null);
            setIsModalOpen(true);
          }}
          leftIcon={<Plus className="w-4 h-4" />}
          className="font-bold shadow-md shadow-indigo-600/20"
        >
          CREATE CLASS
        </Button>
      </div>

      {/* Empty State when zero classes */}
      {classes.length === 0 ? (
        <div className="p-16 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <GraduationCap className="w-8 h-8" />
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-800 dark:text-slate-200">
              No classes yet.
            </h4>
            <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mt-1">
              Add your first classroom section (e.g. Class XII - Section A) to start enrolling students and recording attendance.
            </p>
          </div>
          <div className="pt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                setEditingClass(null);
                setIsModalOpen(true);
              }}
              leftIcon={<Plus className="w-5 h-5" />}
              className="font-bold shadow-md shadow-indigo-600/20"
            >
              CREATE CLASS
            </Button>
          </div>
        </div>
      ) : (
        /* Classes Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {classes.map((cls) => {
            const studentCount = students.filter((s) => s.class_id === cls.id).length;
            const isSelected = activeClassId === cls.id;

            return (
              <Card
                key={cls.id}
                hoverEffect
                padding="lg"
                className={`flex flex-col justify-between transition-all ${
                  isSelected ? 'ring-2 ring-indigo-500 border-indigo-400 dark:border-indigo-600' : ''
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-lg border border-indigo-200/60 dark:border-indigo-800/60">
                      {cls.section}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingClass(cls);
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Edit class"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setClassToDelete(cls.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Delete class"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black text-slate-900 dark:text-white">
                        {cls.name} - {cls.section}
                      </h3>
                      {isSelected && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Academic Year: {cls.academic_year}
                    </p>
                  </div>

                  <div className="mt-5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-slate-400" /> Enrolled Roster:
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {studentCount} Students
                    </span>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between pt-5 mt-5 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => setActiveClassId(cls.id)}
                    className={`text-xs font-bold transition-colors ${
                      isSelected
                        ? 'text-indigo-600 dark:text-indigo-400 cursor-default'
                        : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600'
                    }`}
                  >
                    {isSelected ? 'Currently Selected' : 'Set as Active Class'}
                  </button>

                  <Link
                    href="/dashboard/students"
                    onClick={() => setActiveClassId(cls.id)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <span>View Roster</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Class Modal */}
      <ClassModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingClass(null);
        }}
        classToEdit={editingClass}
        onSave={async (cls) => {
          if ('id' in cls) {
            await updateClass(cls as ClassItem);
          } else {
            await addClass(cls);
          }
        }}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(classToDelete)}
        onClose={() => setClassToDelete(null)}
        onConfirm={async () => {
          if (classToDelete) {
            await deleteClass(classToDelete);
            setClassToDelete(null);
          }
        }}
        title="Delete Class?"
        message="This will delete this class and all associated student rosters from Supabase."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
