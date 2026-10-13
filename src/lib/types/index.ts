export type UserRole = 'ADMIN' | 'TEACHER';

export type AttendanceStatus = 'present' | 'absent' | 'late';
export type AttendanceSource = 'individual' | 'classroom_scan' | 'manual';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface ClassItem {
  id: string;
  name: string;
  section: string;
  academic_year: string;
  teacher_id?: string | null;
  created_at: string;
  teacher?: Profile;
  student_count?: number;
}

export interface Student {
  id: string;
  full_name: string;
  roll_number: string;
  class_id: string;
  photo_url: string | null;
  reference_photos?: string[];
  email?: string | null;
  active: boolean;
  created_at: string;
  class?: ClassItem;
  attendance_percentage?: number;
}

export interface Subject {
  id: string;
  name: string;
  class_id: string;
  teacher_id: string;
  created_at: string;
}

export interface AttendanceSession {
  id: string;
  class_id: string;
  subject_id?: string | null;
  date: string; // YYYY-MM-DD
  created_by: string;
  source: AttendanceSource;
  image_url?: string | null;
  created_at: string;
  class?: ClassItem;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  marked_at: string;
  marked_by: string;
  student?: Student;
}

export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface DetectedStudent {
  studentId: string;
  confidence: number;
  boundingBox?: BoundingBox;
  matchedName?: string;
  rollNumber?: string;
}

export interface UndetectedStudent {
  studentId: string;
  reason?: string;
  studentName?: string;
  rollNumber?: string;
}

export interface NormalizedStudentResult {
  student_id: string;
  name: string;
  roll_number: string;
  status: 'present' | 'absent';
  detected: boolean;
  confidence?: number;
  boundingBox?: BoundingBox;
}

export interface DetectedFace {
  id: string;
  boundingBox: BoundingBox;
  confidence: number;
  isUnknown: boolean;
  matchedStudentId?: string;
  matchedName?: string;
  rollNumber?: string;
  matchScore?: number;
}

export interface FaceEngineDebugInfo {
  detectedFaceCount: number;
  recognizedFaceCount: number;
  unknownFaceCount: number;
  threshold: number;
  modelsUsed: {
    detection: string;
    recognition: string;
  };
  perFaceDetails: Array<{
    faceIndex: number;
    confidence: number;
    matchedStudent: string;
    rollNumber?: string;
    similarityScore: number;
    isUnknown: boolean;
    box: BoundingBox;
  }>;
}

export interface ClassroomScanResult {
  detectedStudents: DetectedStudent[];
  undetectedStudents: UndetectedStudent[];
  students?: NormalizedStudentResult[];
  detectedFaces?: DetectedFace[];
  unknownFacesCount?: number;
  totalFacesDetected?: number;
  debugInfo?: FaceEngineDebugInfo;
  imageUrl?: string;
  timestamp?: string;
}

export interface StudentAttendanceStats {
  studentId: string;
  studentName: string;
  rollNumber: string;
  photoUrl?: string | null;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  totalClasses: number;
  percentage: number | null; // null if 0 classes, displays "N/A"
  isBelowThreshold: boolean;
  recordsByDate: Record<string, AttendanceStatus>;
}

export interface DashboardMetrics {
  todayPresent: number;
  todayAbsent: number;
  todayUnmarked: number;
  todayTotal: number;
  todayPercentage: number | null;
  overallPercentage: number | null;
  studentsBelowThreshold: number;
  totalStudents: number;
  totalClasses: number;
}

export interface RecentActivity {
  id: string;
  type: 'individual_marked' | 'classroom_scan' | 'student_added' | 'session_saved';
  message: string;
  time: string;
  className?: string;
  studentName?: string;
  status?: AttendanceStatus;
}
