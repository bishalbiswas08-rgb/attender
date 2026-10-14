'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  Student,
  AttendanceStatus,
  DetectedStudent,
  UndetectedStudent,
  DetectedFace,
  FaceEngineDebugInfo,
} from '@/lib/types';
import { DetectionOverlay } from './DetectionOverlay';
import {
  CheckCircle2,
  Camera,
  RotateCcw,
  HelpCircle,
  Cpu,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Sparkles,
} from 'lucide-react';
import { useAttendance } from '@/lib/context/AttendanceContext';
import confetti from 'canvas-confetti';

interface ClassroomReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  detectedStudents: DetectedStudent[];
  undetectedStudents: UndetectedStudent[];
  allClassStudents: Student[];
  detectedFaces?: DetectedFace[];
  totalFacesDetected?: number;
  unknownFacesCount?: number;
  debugInfo?: FaceEngineDebugInfo;
  onRetake: () => void;
  onSaveComplete?: () => void;
}

export const ClassroomReviewModal: React.FC<ClassroomReviewModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  detectedStudents,
  undetectedStudents,
  allClassStudents,
  detectedFaces = [],
  totalFacesDetected,
  unknownFacesCount = 0,
  debugInfo,
  onRetake,
  onSaveComplete,
}) => {
  const { saveAttendanceSession, activeClassId } = useAttendance();

  // Teacher-adjustable status map: studentId -> 'present' | 'absent' | 'late'
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>(() => {
    const initial: Record<string, AttendanceStatus> = {};
    const detectedIdSet = new Set(detectedStudents.map((d) => d.studentId));

    allClassStudents.forEach((std) => {
      if (detectedIdSet.has(std.id)) {
        initial[std.id] = 'present';
      } else {
        initial[std.id] = 'absent';
      }
    });

    return initial;
  });

  const [faces, setFaces] = useState<DetectedFace[]>(detectedFaces);
  const [selectedStudentId, setSelectedStudentId] = useState<string | undefined>();
  const [selectedFaceId, setSelectedFaceId] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'both' | 'photo' | 'roster'>('both');
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    if (detectedFaces && detectedFaces.length > 0) {
      setFaces(detectedFaces);
    }
  }, [detectedFaces]);

  // Toggle student between Present and Absent to fix AI errors
  const toggleStudent = (studentId: string) => {
    setStatusMap((prev) => {
      const current = prev[studentId] || 'absent';
      const nextStatus = current === 'present' ? 'absent' : 'present';
      return { ...prev, [studentId]: nextStatus };
    });
  };

  // Manually resolve an unknown face to a registered student
  const resolveUnknownFace = (faceId: string, studentId: string) => {
    if (!studentId) return;
    const targetStudent = allClassStudents.find((s) => s.id === studentId);
    if (!targetStudent) return;

    // 1. Mark student as present
    setStatusMap((prev) => ({ ...prev, [studentId]: 'present' }));

    // 2. Link the face to this student
    setFaces((prev) =>
      prev.map((f) => {
        if (f.id === faceId) {
          return {
            ...f,
            isUnknown: false,
            matchedStudentId: targetStudent.id,
            matchedName: targetStudent.full_name,
            rollNumber: targetStudent.roll_number,
            matchScore: 0.99,
          };
        }
        return f;
      })
    );

    setSelectedFaceId(undefined);
    setSelectedStudentId(studentId);
  };

  const presentList = allClassStudents.filter((s) => statusMap[s.id] === 'present');
  const absentList = allClassStudents.filter((s) => statusMap[s.id] === 'absent');
  const unknownFaces = faces.filter((f) => f.isUnknown);
  const currentTotalFaces = totalFacesDetected ?? (faces.length > 0 ? faces.length : detectedStudents.length);

  const handleSaveAttendance = async () => {
    setIsSaving(true);
    try {
      const records = allClassStudents.map((s) => ({
        studentId: s.id,
        status: statusMap[s.id] || 'absent',
      }));

      await saveAttendanceSession({
        classId: activeClassId,
        date: new Date().toISOString().split('T')[0],
        source: 'classroom_scan',
        records,
        imageUrl,
      });

      // Celebration effect
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {}

      onSaveComplete?.();
      onClose();
    } catch (err) {
      console.error('Error saving scan attendance:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="5xl">
      <div className="space-y-6">
        {/* Header summary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-slate-100 dark:border-slate-800 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1 shrink-0">
                <Sparkles className="w-3 h-3" /> Two-Stage Vision Pipeline
              </span>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white truncate">
                CLASSROOM SCAN RESULTS
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Click any student card to toggle Present/Absent, or assign any Unknown face to an enrolled student.
            </p>
          </div>

          {/* Counts overview */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 text-xs">
            <div className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300">
              {allClassStudents.length} Registered
            </div>
            <div className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {presentList.length} Present
            </div>
            <div className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              {absentList.length} Absent
            </div>
            {unknownFaces.length > 0 && (
              <div className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                {unknownFaces.length} Unknown {unknownFaces.length === 1 ? 'Face' : 'Faces'}
              </div>
            )}
          </div>
        </div>

        {/* View Mode Switcher for smaller screens */}
        <div className="flex items-center gap-2 sm:hidden border-b border-slate-100 dark:border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('both')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold ${
              activeTab === 'both' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
            }`}
          >
            Split View
          </button>
          <button
            onClick={() => setActiveTab('photo')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold ${
              activeTab === 'photo' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
            }`}
          >
            Class Photo
          </button>
          <button
            onClick={() => setActiveTab('roster')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold ${
              activeTab === 'roster' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
            }`}
          >
            Review Roster
          </button>
        </div>

        {/* Main Split Layout: Photo on Left / Roster on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Image with Detection Boxes */}
          {(activeTab === 'both' || activeTab === 'photo') && (
            <div className="lg:col-span-7 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
                <span>Classroom Capture with Facial Markers</span>
                {/* Accurate summary displaying actual total faces located */}
                <span className="text-slate-700 dark:text-slate-300 font-bold">
                  {currentTotalFaces} face{currentTotalFaces === 1 ? '' : 's'} located
                  {unknownFaces.length > 0
                    ? ` (${presentList.length} recognized, ${unknownFaces.length} unknown)`
                    : ` (${presentList.length} recognized)`}
                </span>
              </div>

              <DetectionOverlay
                imageUrl={imageUrl}
                detectedStudents={detectedStudents}
                detectedFaces={faces}
                totalFacesDetected={currentTotalFaces}
                selectedStudentId={selectedStudentId}
                selectedFaceId={selectedFaceId}
                onSelectStudent={(id) => {
                  setSelectedStudentId(id);
                  toggleStudent(id);
                }}
                onSelectFace={(face) => {
                  setSelectedFaceId(face.id);
                  if (face.matchedStudentId) {
                    setSelectedStudentId(face.matchedStudentId);
                  }
                }}
              />

              <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 px-1 pt-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-500/80 border border-emerald-400" />
                  Green: Matched Student
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-amber-500/80 border border-amber-400" />
                  Amber: Unknown Face
                </span>
                <button
                  type="button"
                  onClick={() => setShowDebug(!showDebug)}
                  className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                  <Cpu className="w-3 h-3" />
                  {showDebug ? 'Hide AI Debug' : 'Show AI Debug'}
                </button>
              </div>

              {/* AI Debug Info Box */}
              {showDebug && debugInfo && (
                <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 font-mono space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 text-[11px] font-bold text-slate-200">
                    <span className="flex items-center gap-1 text-indigo-400">
                      <Cpu className="w-3.5 h-3.5" /> AI Engine Diagnostics
                    </span>
                    <span>Threshold: {debugInfo.threshold} (Euclidean)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px] text-center pt-1">
                    <div className="p-1.5 rounded bg-slate-800/80">
                      <span className="text-slate-400 block text-[10px]">Detected Faces</span>
                      <strong className="text-indigo-300">{debugInfo.detectedFaceCount}</strong>
                    </div>
                    <div className="p-1.5 rounded bg-slate-800/80">
                      <span className="text-slate-400 block text-[10px]">Recognized</span>
                      <strong className="text-emerald-400">{debugInfo.recognizedFaceCount}</strong>
                    </div>
                    <div className="p-1.5 rounded bg-slate-800/80">
                      <span className="text-slate-400 block text-[10px]">Unknown</span>
                      <strong className="text-amber-400">{debugInfo.unknownFaceCount}</strong>
                    </div>
                  </div>
                  <div className="text-[10px] space-y-1 pt-1 border-t border-slate-800/60 text-slate-400">
                    <p>Detector: {debugInfo.modelsUsed.detection}</p>
                    <p>Recognizer: {debugInfo.modelsUsed.recognition}</p>
                  </div>
                  {/* Per Face Details */}
                  <div className="max-h-28 overflow-y-auto space-y-1 text-[10px] pt-1">
                    {debugInfo.perFaceDetails.map((f) => (
                      <div
                        key={f.faceIndex}
                        className="flex items-center justify-between p-1 rounded bg-slate-800/40"
                      >
                        <span>
                          Face #{f.faceIndex}:{' '}
                          <strong className={f.isUnknown ? 'text-amber-300' : 'text-emerald-300'}>
                            {f.matchedStudent}
                          </strong>
                        </span>
                        <span className="opacity-75">
                          Conf: {Math.round(f.confidence * 100)}% | Match: {Math.round(f.similarityScore * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Right Column: Present, Unknown, & Not Detected Columns */}
          {(activeTab === 'both' || activeTab === 'roster') && (
            <div className="lg:col-span-5 space-y-5 max-h-[500px] overflow-y-auto pr-1">
              {/* Unknown Faces Resolution Section */}
              {unknownFaces.length > 0 && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      Unmatched Faces ({unknownFaces.length})
                    </h4>
                    <span className="text-[10px] text-amber-700 dark:text-amber-400">
                      Assign to student
                    </span>
                  </div>

                  <div className="space-y-2">
                    {unknownFaces.map((uf, idx) => (
                      <div
                        key={uf.id}
                        className={`p-2 rounded-xl border transition-all ${
                          selectedFaceId === uf.id
                            ? 'border-amber-400 bg-amber-100/60 dark:bg-amber-950/40'
                            : 'border-amber-200 dark:border-amber-900/60 bg-white dark:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-amber-900 dark:text-amber-200 shrink-0">
                            Face #{idx + 1}
                          </span>
                          <select
                            onChange={(e) => resolveUnknownFace(uf.id, e.target.value)}
                            defaultValue=""
                            className="text-xs font-medium px-2 py-1 rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 max-w-[170px] sm:max-w-xs truncate"
                          >
                            <option value="" disabled>
                              Assign to enrolled student...
                            </option>
                            {absentList.map((std) => (
                              <option key={std.id} value={std.id}>
                                {std.full_name} (Roll {std.roll_number})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Present Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    Present ({presentList.length})
                  </h4>
                  <span className="text-[11px] text-slate-400">Click to mark absent</span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {presentList.map((student) => (
                    <div
                      key={student.id}
                      onClick={() => toggleStudent(student.id)}
                      className="group flex items-center justify-between p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-100/60 transition-all cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-emerald-100 dark:bg-emerald-900 shrink-0">
                          {student.photo_url ? (
                            <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-bold text-xs text-emerald-700">
                              {student.full_name[0]}
                            </div>
                          )}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            🟢 {student.full_name}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            Roll {student.roll_number}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded">
                          Present
                        </span>
                      </div>
                    </div>
                  ))}
                  {presentList.length === 0 && (
                    <p className="text-xs text-slate-400 italic py-2">No students marked present</p>
                  )}
                </div>
              </div>

              {/* Not Detected Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    Not Detected ({absentList.length})
                  </h4>
                  <span className="text-[11px] text-slate-400">Click to mark present</span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {absentList.map((student) => (
                    <div
                      key={student.id}
                      onClick={() => toggleStudent(student.id)}
                      className="group flex items-center justify-between p-2.5 rounded-xl border border-rose-200 dark:border-rose-800/80 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100/60 transition-all cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-rose-100 dark:bg-rose-900 shrink-0">
                          {student.photo_url ? (
                            <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-bold text-xs text-rose-700">
                              {student.full_name[0]}
                            </div>
                          )}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            🔴 {student.full_name}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            Roll {student.roll_number}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/60 px-2 py-0.5 rounded">
                          Absent
                        </span>
                      </div>
                    </div>
                  ))}
                  {absentList.length === 0 && (
                    <p className="text-xs text-slate-400 italic py-2">All registered students were detected</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button
            variant="outline"
            onClick={onRetake}
            leftIcon={<Camera className="w-4 h-4" />}
            className="w-full sm:w-auto"
          >
            RETAKE PHOTO
          </Button>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={isSaving}
              className="w-full sm:w-auto"
            >
              CANCEL
            </Button>

            <Button
              variant="success"
              onClick={handleSaveAttendance}
              isLoading={isSaving}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
              className="w-full sm:w-auto font-bold px-7 shadow-lg shadow-emerald-600/20"
            >
              SAVE ATTENDANCE
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
