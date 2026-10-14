import React from 'react';
import { DetectedStudent, DetectedFace } from '@/lib/types';
import { Check, ShieldCheck, HelpCircle } from 'lucide-react';

interface DetectionOverlayProps {
  imageUrl: string;
  detectedStudents: DetectedStudent[];
  detectedFaces?: DetectedFace[];
  totalFacesDetected?: number;
  selectedStudentId?: string;
  selectedFaceId?: string;
  onSelectStudent?: (studentId: string) => void;
  onSelectFace?: (face: DetectedFace) => void;
}

export const DetectionOverlay: React.FC<DetectionOverlayProps> = ({
  imageUrl,
  detectedStudents,
  detectedFaces,
  totalFacesDetected,
  selectedStudentId,
  selectedFaceId,
  onSelectStudent,
  onSelectFace,
}) => {
  // If dedicated detectedFaces list is available, use it; otherwise fallback to detectedStudents
  const hasFullFaceList = Array.isArray(detectedFaces) && detectedFaces.length > 0;
  const totalLocated = totalFacesDetected ?? (hasFullFaceList ? detectedFaces!.length : detectedStudents.length);
  const recognizedCount = detectedStudents.length;
  const unknownCount = hasFullFaceList
    ? detectedFaces!.filter((f) => f.isUnknown).length
    : Math.max(0, totalLocated - recognizedCount);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 shadow-xl aspect-video max-h-[500px] flex items-center justify-center">
      {/* Classroom Photograph */}
      <img
        src={imageUrl}
        alt="Classroom Scan"
        className="w-full h-full object-contain select-none"
      />

      {/* Detection Boxes Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {hasFullFaceList ? (
          // Render ALL detected faces (Stage 1 detector boxes)
          detectedFaces!.map((face) => {
            if (!face.boundingBox) return null;
            const { ymin, xmin, ymax, xmax } = face.boundingBox;
            const top = `${(ymin / 1000) * 100}%`;
            const left = `${(xmin / 1000) * 100}%`;
            const height = `${((ymax - ymin) / 1000) * 100}%`;
            const width = `${((xmax - xmin) / 1000) * 100}%`;

            const isSelected =
              (face.matchedStudentId && selectedStudentId === face.matchedStudentId) ||
              selectedFaceId === face.id;

            if (face.isUnknown) {
              return (
                <div
                  key={face.id}
                  onClick={() => onSelectFace?.(face)}
                  style={{ top, left, width, height }}
                  className={`absolute pointer-events-auto cursor-pointer rounded-lg border-2 transition-all duration-150 ${
                    isSelected
                      ? 'border-amber-400 bg-amber-500/30 shadow-lg shadow-amber-500/40 ring-2 ring-amber-300'
                      : 'border-amber-500/80 bg-amber-500/15 hover:bg-amber-500/25'
                  }`}
                >
                  <div className="absolute -top-6 left-0 flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/90 text-amber-300 border border-amber-500/60 text-[10px] font-bold shadow whitespace-nowrap">
                    <HelpCircle className="w-2.5 h-2.5 text-amber-400" />
                    <span>Unknown Face</span>
                    <span className="opacity-70 text-[9px]">(Click to assign)</span>
                  </div>
                </div>
              );
            }

            // Recognized face
            return (
              <div
                key={face.id}
                onClick={() => {
                  if (face.matchedStudentId) onSelectStudent?.(face.matchedStudentId);
                  onSelectFace?.(face);
                }}
                style={{ top, left, width, height }}
                className={`absolute pointer-events-auto cursor-pointer rounded-lg border-2 transition-all duration-150 ${
                  isSelected
                    ? 'border-indigo-400 bg-indigo-500/25 shadow-lg shadow-indigo-500/30 ring-2 ring-indigo-400'
                    : 'border-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25'
                }`}
              >
                <div className="absolute -top-6 left-0 flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 text-[10px] font-bold shadow whitespace-nowrap">
                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                  <span>{face.matchedName || 'Student'}</span>
                  {face.matchScore ? (
                    <span className="opacity-70 text-[9px]">
                      {Math.round(face.matchScore * 100)}%
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })
        ) : (
          // Fallback to detectedStudents list
          detectedStudents.map((detected) => {
            if (!detected.boundingBox) return null;
            const { ymin, xmin, ymax, xmax } = detected.boundingBox;
            const top = `${(ymin / 1000) * 100}%`;
            const left = `${(xmin / 1000) * 100}%`;
            const height = `${((ymax - ymin) / 1000) * 100}%`;
            const width = `${((xmax - xmin) / 1000) * 100}%`;

            const isSelected = selectedStudentId === detected.studentId;

            return (
              <div
                key={detected.studentId}
                onClick={() => onSelectStudent?.(detected.studentId)}
                style={{ top, left, width, height }}
                className={`absolute pointer-events-auto cursor-pointer rounded-lg border-2 transition-all duration-150 ${
                  isSelected
                    ? 'border-indigo-400 bg-indigo-500/20 shadow-lg shadow-indigo-500/30'
                    : 'border-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                }`}
              >
                <div className="absolute -top-6 left-0 flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 text-[10px] font-bold shadow whitespace-nowrap">
                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                  <span>{detected.matchedName || 'Student'}</span>
                  {detected.confidence && (
                    <span className="opacity-70 text-[9px]">
                      {Math.round(detected.confidence * 100)}%
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating HUD Pill: Shows accurate total faces located vs recognized vs unknown */}
      <div className="absolute bottom-2 sm:bottom-3 right-2 sm:right-3 max-w-[calc(100%-1rem)] sm:max-w-none flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 text-white text-[11px] sm:text-xs backdrop-blur-md shadow-lg truncate">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="font-semibold truncate">
          {totalLocated} face{totalLocated === 1 ? '' : 's'} located
          {unknownCount > 0 ? ` (${recognizedCount} recognized, ${unknownCount} unknown)` : ''}
        </span>
      </div>
    </div>
  );
};
