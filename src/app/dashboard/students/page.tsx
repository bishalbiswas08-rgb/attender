'use client';

import React, { useState } from 'react';
import { useAttendance } from '@/lib/context/AttendanceContext';
import { StudentCard } from '@/components/students/StudentCard';
import { StudentModal } from '@/components/students/StudentModal';
import { StudentProfileModal } from '@/components/students/StudentProfileModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Student } from '@/lib/types';
import { Users, UserPlus, Search, Filter } from 'lucide-react';

export default function StudentsPage() {
  const {
    students,
    classes,
    activeClassId,
    setActiveClassId,
    addStudent,
    updateStudent,
    deleteStudent,
  } = useAttendance();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [profileStudent, setProfileStudent] = useState<Student | null>(null);

  // Filter students
  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.roll_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesClass = filterClass === 'all' || s.class_id === filterClass;
    const matchesStatus =
      statusFilter === 'all' ? true : statusFilter === 'active' ? s.active : !s.active;

    return matchesSearch && matchesClass && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Title & Add Student CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Student Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage student records, frontal face profile photographs, and attendance profiles.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setEditingStudent(null);
            setIsModalOpen(true);
          }}
          leftIcon={<UserPlus className="w-4 h-4" />}
          className="font-bold shrink-0 shadow-md shadow-indigo-600/20"
        >
          ADD STUDENT
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, roll number, or email..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          {/* Class Filter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer font-medium"
            >
              <option value="all">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.section}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                statusFilter === 'active'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              All
            </button>
          </div>
        </div>
      </div>

      {/* Student Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredStudents.map((student) => (
          <StudentCard
            key={student.id}
            student={student}
            onEdit={(std) => {
              setEditingStudent(std);
              setIsModalOpen(true);
            }}
            onDelete={(id) => setStudentToDelete(id)}
            onViewProfile={(std) => setProfileStudent(std)}
          />
        ))}
      </div>

      {filteredStudents.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {students.length === 0 ? 'No students yet.' : 'No students found.'}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {classes.length === 0
                ? 'Create a class first before registering students.'
                : students.length === 0
                ? 'Register your students with frontal face profile photos to start taking attendance.'
                : 'Try adjusting your search query or class filter.'}
            </p>
          </div>
          <div className="pt-2">
            {classes.length === 0 ? (
              <Button
                variant="primary"
                onClick={() => (window.location.href = '/dashboard/classes')}
                leftIcon={<UserPlus className="w-4 h-4" />}
              >
                CREATE CLASS FIRST
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => {
                  setEditingStudent(null);
                  setIsModalOpen(true);
                }}
                leftIcon={<UserPlus className="w-4 h-4" />}
                className="font-bold shadow-md shadow-indigo-600/20"
              >
                ADD STUDENT
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Student Modal */}
      <StudentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingStudent(null);
        }}
        studentToEdit={editingStudent}
        classes={classes}
        defaultClassId={activeClassId}
        onSave={async (std) => {
          if ('id' in std) {
            await updateStudent(std as Student);
          } else {
            await addStudent(std);
          }
        }}
      />

      {/* Student Profile Modal */}
      <StudentProfileModal
        isOpen={Boolean(profileStudent)}
        onClose={() => setProfileStudent(null)}
        student={profileStudent}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(studentToDelete)}
        onClose={() => setStudentToDelete(null)}
        onConfirm={async () => {
          if (studentToDelete) {
            await deleteStudent(studentToDelete);
            setStudentToDelete(null);
          }
        }}
        title="Delete Student?"
        message="This will permanently delete this student record from the class roster."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
