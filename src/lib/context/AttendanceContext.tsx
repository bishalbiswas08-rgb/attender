'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import {
  ClassItem,
  Student,
  AttendanceSession,
  AttendanceRecord,
  Profile,
  RecentActivity,
  StudentAttendanceStats,
  DashboardMetrics,
  AttendanceStatus,
  AttendanceSource,
  UserRole,
  Subject,
  ClassSubject,
} from '../types';
import { calculateStudentStats, calculateClassStats, DEFAULT_THRESHOLD } from '../attendance/calculations';
import { createClient, isSupabaseConfigured } from '../supabase/client';
import { useToast } from '@/components/ui/Toast';

export interface SaveSessionPayload {
  classId: string;
  subjectId?: string;
  date: string;
  source: AttendanceSource;
  records: { studentId: string; status: AttendanceStatus }[];
  imageUrl?: string;
}

interface AttendanceContextType {
  session: Session | null;
  authLoading: boolean;
  signOut: () => Promise<void>;
  user: Profile | null;
  isAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  classes: ClassItem[];
  students: Student[];
  subjects: Subject[];
  classSubjects: ClassSubject[];
  activeSubjectId: string;
  setActiveSubjectId: (id: string) => void;
  activeSubject: Subject | undefined;
  classAvailableSubjects: Subject[];
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
  recentActivities: RecentActivity[];
  threshold: number;
  setThreshold: (val: number) => void;
  activeClassId: string;
  setActiveClassId: (id: string) => void;
  activeClass: ClassItem | undefined;
  classStudents: Student[];
  addClass: (cls: Omit<ClassItem, 'id' | 'created_at'>) => Promise<void>;
  updateClass: (cls: ClassItem) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  addStudent: (std: Omit<Student, 'id' | 'created_at'>) => Promise<void>;
  updateStudent: (std: Student) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
  updateStudentRollNumber: (studentId: string, rollNumber: string) => Promise<void>;
  rusticateStudent: (studentId: string, reason: string) => Promise<void>;
  reinstateStudent: (studentId: string) => Promise<void>;
  saveAttendanceSession: (payload: SaveSessionPayload) => Promise<void>;
  getStudentStats: (studentId: string) => StudentAttendanceStats | undefined;
  dashboardMetrics: DashboardMetrics;
  isSupabaseLive: boolean;
  isGeminiLive: boolean;
  isLoading: boolean;
  refreshData: () => Promise<void>;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

// Helper to ensure public.profiles row exists for the authenticated user
async function syncProfileForUser(supabase: any, authUser: User): Promise<Profile> {
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (profileData) {
    return profileData as Profile;
  }

  // Safe fallback if profile trigger is delayed: default strictly to STUDENT
  const safeProfile: Profile = {
    id: authUser.id,
    full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
    email: authUser.email || '',
    role: 'STUDENT',
    created_at: new Date().toISOString(),
  };

  return safeProfile;
}

export function AttendanceProvider({ children }: { children: React.ReactNode }) {
  const { success, error: toastError, info } = useToast();

  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [user, setUser] = useState<Profile | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState<string>('');
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);

  const [threshold, setThresholdState] = useState<number>(DEFAULT_THRESHOLD);
  const [activeClassId, setActiveClassId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [isSupabaseLive, setIsSupabaseLive] = useState(false);
  const [isGeminiLive, setIsGeminiLive] = useState(false);

  // Fetch all real data from Supabase
  const fetchDatabaseData = useCallback(async () => {
    setIsLoading(true);
    const configured = isSupabaseConfigured();
    setIsSupabaseLive(configured);

    if (!configured) {
      setIsLoading(false);
      return;
    }

    try {
      const supabase = createClient();

      // 1. Fetch classes
      const { data: dbClasses, error: classesErr } = await supabase
        .from('classes')
        .select('*')
        .order('name', { ascending: true });

      if (classesErr) throw classesErr;
      const classList = (dbClasses as ClassItem[]) || [];
      setClasses(classList);

      if (classList.length > 0) {
        setActiveClassId((prev) => {
          const exists = classList.some((c) => c.id === prev);
          return exists ? prev : classList[0].id;
        });
      }

      // 2. Fetch students
      const { data: dbStudents, error: studentsErr } = await supabase
        .from('students')
        .select('*')
        .order('roll_number', { ascending: true });

      if (studentsErr) throw studentsErr;
      setStudents((dbStudents as Student[]) || []);

      // 3. Fetch subjects
      const { data: dbSubjects, error: subjectsErr } = await supabase
        .from('subjects')
        .select('*')
        .order('name', { ascending: true });

      if (!subjectsErr && dbSubjects) {
        setSubjects(dbSubjects as Subject[]);
      }

      // 4. Fetch class_subjects mappings
      const { data: dbClassSubjects, error: classSubjectsErr } = await supabase
        .from('class_subjects')
        .select(`
          id,
          class_id,
          subject_id,
          teacher_id,
          created_at,
          subject:subject_id(id, name, code, description, active),
          teacher:teacher_id(id, full_name, email)
        `);

      if (!classSubjectsErr && dbClassSubjects) {
        setClassSubjects(dbClassSubjects as unknown as ClassSubject[]);
      }

      // 5. Fetch attendance sessions
      const { data: dbSessions, error: sessionsErr } = await supabase
        .from('attendance_sessions')
        .select('*')
        .order('date', { ascending: false });

      if (sessionsErr) throw sessionsErr;
      setSessions((dbSessions as AttendanceSession[]) || []);

      // 6. Fetch attendance records
      const { data: dbRecords, error: recordsErr } = await supabase
        .from('attendance')
        .select('*');

      if (recordsErr) throw recordsErr;
      setRecords((dbRecords as AttendanceRecord[]) || []);
    } catch (err: any) {
      console.error('[AttendanceContext] Supabase fetch error:', err);
      toastError('Database Connection Notice', err.message || 'Unable to retrieve data from Supabase.');
    } finally {
      setIsLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    // Check saved threshold from localStorage
    const savedThreshold = localStorage.getItem('attender_threshold');
    if (savedThreshold) setThresholdState(Number(savedThreshold));

    // Check Gemini API key existence via OPTIONS
    fetch('/api/ai/chat', { method: 'OPTIONS' })
      .then((res) => {
        const geminiHeader = res.headers.get('x-gemini-configured');
        if (geminiHeader === 'true') setIsGeminiLive(true);
      })
      .catch(() => {});

    if (!isSupabaseConfigured()) {
      setIsSupabaseLive(false);
      setAuthLoading(false);
      setIsLoading(false);
      return;
    }

    const supabase = createClient();
    let isMounted = true;

    const initAuth = async () => {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();

        if (!isMounted) return;
        setSession(initialSession);

        if (initialSession?.user) {
          const profile = await syncProfileForUser(supabase, initialSession.user);
          if (isMounted) {
            setUser(profile);
            await fetchDatabaseData();
          }
        } else {
          if (isMounted) {
            setUser(null);
            setClasses([]);
            setStudents([]);
            setSubjects([]);
            setClassSubjects([]);
            setSessions([]);
            setRecords([]);
          }
        }
      } catch (err) {
        console.error('[AttendanceContext] Session initialization error:', err);
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    };

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, currentSession: Session | null) => {
        if (!isMounted) return;

        setSession(currentSession);

        if (currentSession?.user) {
          try {
            const profile = await syncProfileForUser(supabase, currentSession.user);
            if (isMounted) {
              setUser(profile);
              await fetchDatabaseData();
            }
          } catch (err) {
            console.error('[AttendanceContext] Auth change profile sync error:', err);
          }
        } else {
          if (isMounted) {
            setUser(null);
            setClasses([]);
            setStudents([]);
            setSubjects([]);
            setClassSubjects([]);
            setSessions([]);
            setRecords([]);
          }
        }

        if (isMounted) {
          setAuthLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [fetchDatabaseData]);

  const setThreshold = (val: number) => {
    setThresholdState(val);
    localStorage.setItem('attender_threshold', String(val));
  };

  const isAdmin = user?.role === 'ADMIN';
  const isTeacher = user?.role === 'TEACHER';
  const isStudent = user?.role === 'STUDENT';

  const activeClass = useMemo(
    () => classes.find((c) => c.id === activeClassId) || (classes.length > 0 ? classes[0] : undefined),
    [classes, activeClassId]
  );

  // Exclude rusticated and inactive students from active roster
  const classStudents = useMemo(
    () => (activeClass ? students.filter((s) => s.class_id === activeClass.id && s.active && s.status !== 'RUSTICATED') : []),
    [students, activeClass]
  );

  // Available subjects for current active class
  const classAvailableSubjects = useMemo(() => {
    if (!activeClassId) return [];
    const classLinks = classSubjects.filter((cs) => cs.class_id === activeClassId);
    if (classLinks.length === 0) {
      // Fallback: all active subjects
      return subjects.filter((s) => s.active !== false);
    }
    const subjMap = new Map<string, Subject>();
    classLinks.forEach((cs) => {
      if (cs.subject) {
        subjMap.set(cs.subject.id, cs.subject);
      }
    });
    return Array.from(subjMap.values());
  }, [classSubjects, subjects, activeClassId]);

  const activeSubject = useMemo(
    () => subjects.find((s) => s.id === activeSubjectId),
    [subjects, activeSubjectId]
  );

  // Auto-default activeSubjectId to first subject of class when available
  useEffect(() => {
    if (classAvailableSubjects.length > 0) {
      setActiveSubjectId((prev) => {
        const stillValid = classAvailableSubjects.some((s) => s.id === prev);
        return stillValid && prev ? prev : classAvailableSubjects[0].id;
      });
    } else {
      setActiveSubjectId('');
    }
  }, [classAvailableSubjects]);

  // Add Class to Supabase (Admin Only)
  const addClass = async (cls: Omit<ClassItem, 'id' | 'created_at'>) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and credentials in .env.local.');
    }

    if (user?.role !== 'ADMIN') {
      throw new Error('Unauthorized: Only administrators can create classes.');
    }

    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      throw new Error('Authentication required: You must be logged in to create a class.');
    }

    const { data: profileCheck } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', authUser.id)
      .maybeSingle();

    if (!profileCheck) {
      await supabase.from('profiles').upsert({
        id: authUser.id,
        full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Educator',
        email: authUser.email || '',
        role: (authUser.user_metadata?.role as UserRole) || 'TEACHER',
      });
    }

    const { data, error } = await supabase
      .from('classes')
      .insert({
        name: cls.name,
        section: cls.section,
        academic_year: cls.academic_year,
        teacher_id: authUser.id,
      })
      .select('*')
      .single();

    if (error) throw error;

    const newClass = data as ClassItem;

    try {
      await supabase.from('class_teachers').insert({
        class_id: newClass.id,
        teacher_id: authUser.id,
      });
    } catch (ctErr) {
      console.warn('[AttendanceContext] class_teachers insert notice:', ctErr);
    }

    setClasses((prev) => [...prev, newClass]);
    setActiveClassId(newClass.id);
    success('Class Created', `${newClass.name}-${newClass.section} added successfully.`);
  };

  // Update Class in Supabase (Admin Only)
  const updateClass = async (cls: ClassItem) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and credentials in .env.local.');
    }

    if (user?.role !== 'ADMIN') {
      throw new Error('Unauthorized: Only administrators can modify classes.');
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('classes')
      .update({
        name: cls.name,
        section: cls.section,
        academic_year: cls.academic_year,
      })
      .eq('id', cls.id);

    if (error) throw error;

    setClasses((prev) => prev.map((c) => (c.id === cls.id ? cls : c)));
    success('Class Updated', `${cls.name}-${cls.section} updated successfully.`);
  };

  // Delete Class from Supabase (Admin Only)
  const deleteClass = async (id: string) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and credentials in .env.local.');
    }

    if (user?.role !== 'ADMIN') {
      throw new Error('Unauthorized: Only administrators can delete classes.');
    }

    const supabase = createClient();
    const { error } = await supabase.from('classes').delete().eq('id', id);

    if (error) throw error;

    setClasses((prev) => {
      const remaining = prev.filter((c) => c.id !== id);
      if (activeClassId === id) {
        setActiveClassId(remaining.length > 0 ? remaining[0].id : '');
      }
      return remaining;
    });
    setStudents((prev) => prev.filter((s) => s.class_id !== id));
    success('Class Deleted', 'Class removed from Supabase.');
  };

  // Add Student to Supabase (Admin Only)
  const addStudent = async (std: Omit<Student, 'id' | 'created_at'>) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and credentials in .env.local.');
    }

    if (user?.role !== 'ADMIN') {
      throw new Error('Unauthorized: Only administrators can register students.');
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from('students')
      .insert({
        full_name: std.full_name,
        roll_number: std.roll_number,
        class_id: std.class_id,
        email: std.email || null,
        photo_url: std.photo_url || null,
        active: std.active,
        status: std.status || 'ACTIVE',
      })
      .select('*')
      .single();

    if (error) throw error;

    const newStudent = data as Student;
    setStudents((prev) => [...prev, newStudent]);

    const newAct: RecentActivity = {
      id: `act_${Date.now()}`,
      type: 'student_added',
      message: `${newStudent.full_name} enrolled in ${activeClass?.name || 'Class'}`,
      time: 'Just now',
      studentName: newStudent.full_name,
    };
    setRecentActivities((prev) => [newAct, ...prev]);
    success('Student Enrolled', `${newStudent.full_name} registered in class roster.`);
  };

  // Update Student in Supabase (Admin Only)
  const updateStudent = async (std: Student) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and credentials in .env.local.');
    }

    if (user?.role !== 'ADMIN') {
      throw new Error('Unauthorized: Only administrators can modify student master records.');
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('students')
      .update({
        full_name: std.full_name,
        roll_number: std.roll_number,
        class_id: std.class_id,
        email: std.email || null,
        photo_url: std.photo_url || null,
        active: std.active,
      })
      .eq('id', std.id);

    if (error) throw error;

    setStudents((prev) => prev.map((s) => (s.id === std.id ? std : s)));
    success('Student Updated', `${std.full_name}'s profile was updated.`);
  };

  // Delete Student from Supabase (Admin Only)
  const deleteStudent = async (id: string) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and credentials in .env.local.');
    }

    if (user?.role !== 'ADMIN') {
      throw new Error('Unauthorized: Only administrators can delete students.');
    }

    const supabase = createClient();
    const { error } = await supabase.from('students').delete().eq('id', id);

    if (error) throw error;

    setStudents((prev) => prev.filter((s) => s.id !== id));
    setRecords((prev) => prev.filter((r) => r.student_id !== id));
    success('Student Removed', 'Student was removed from class roster.');
  };

  // Update Roll Number via Teacher API (Teacher or Admin)
  const updateStudentRollNumber = async (studentId: string, rollNumber: string) => {
    const res = await fetch('/api/teacher/students/roll-number', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, rollNumber }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unable to update roll number.');

    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, roll_number: rollNumber.trim() } : s))
    );
    success('Roll Number Assigned', data.message || `Roll number set to ${rollNumber}`);
  };

  // Rusticate Student (Admin Only)
  const rusticateStudent = async (studentId: string, reason: string) => {
    const res = await fetch('/api/admin/students/rusticate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, reason }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to rusticate student.');

    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId ? { ...s, status: 'RUSTICATED', active: false, status_reason: reason } : s
      )
    );
    success('Student Rusticated', data.message || 'Student rusticated and active enrollment revoked.');
  };

  // Reinstate Student (Admin Only)
  const reinstateStudent = async (studentId: string) => {
    const res = await fetch('/api/admin/students/reinstate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to reinstate student.');

    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId ? { ...s, status: 'ACTIVE', active: true, status_reason: null } : s
      )
    );
    success('Student Reinstated', data.message || 'Student reinstated to active status.');
  };

  // Save Attendance Session to Supabase via server API route
  const saveAttendanceSession = async (payload: SaveSessionPayload) => {
    const res = await fetch('/api/attendance/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'Unable to save attendance.');
    }

    // Refresh database records from Supabase
    await fetchDatabaseData();

    const presentCount = payload.records.filter((r) => r.status === 'present').length;
    const absentCount = payload.records.filter((r) => r.status === 'absent').length;

    const activityText =
      payload.source === 'classroom_scan'
        ? `Classroom scan finalized (${presentCount} present, ${absentCount} absent)`
        : `Attendance recorded for ${payload.records.length} students`;

    const newAct: RecentActivity = {
      id: `act_${Date.now()}`,
      type: payload.source === 'classroom_scan' ? 'classroom_scan' : 'session_saved',
      message: activityText,
      time: 'Just now',
      className: activeClass?.name,
    };
    setRecentActivities((prev) => [newAct, ...prev]);

    success('Attendance Saved', `Recorded attendance for ${payload.records.length} students in Supabase.`);
  };

  // Sign out
  const signOut = useCallback(async () => {
    try {
      if (isSupabaseConfigured()) {
        const supabase = createClient();
        await supabase.auth.signOut();
      }
    } catch (err: any) {
      console.error('[AttendanceContext] signOut error:', err);
    } finally {
      setSession(null);
      setUser(null);
      setClasses([]);
      setStudents([]);
      setSubjects([]);
      setClassSubjects([]);
      setSessions([]);
      setRecords([]);
      success('Signed Out', 'You have been safely signed out.');
    }
  }, [success]);

  // Dynamic Student Stats Calculator based purely on actual Supabase records
  const getStudentStats = useCallback(
    (studentId: string): StudentAttendanceStats | undefined => {
      const student = students.find((s) => s.id === studentId);
      if (!student) return undefined;
      return calculateStudentStats(student, records, threshold);
    },
    [students, records, threshold]
  );

  // Compute Dashboard Metrics dynamically from actual Supabase records
  const dashboardMetrics: DashboardMetrics = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todaySession = activeClass
      ? sessions.find((s) => s.class_id === activeClass.id && s.date === todayStr)
      : undefined;

    let todayPresent = 0;
    let todayAbsent = 0;
    let todayUnmarked = classStudents.length;

    if (todaySession) {
      const todayRecords = records.filter((r) => r.session_id === todaySession.id);
      const markedIds = new Set<string>();

      todayRecords.forEach((r) => {
        markedIds.add(r.student_id);
        if (r.status === 'present' || r.status === 'late') todayPresent++;
        else if (r.status === 'absent') todayAbsent++;
      });

      todayUnmarked = Math.max(0, classStudents.length - markedIds.size);
    }

    const todayTotalMarked = todayPresent + todayAbsent;
    const todayPercentage =
      todayTotalMarked > 0 ? Math.round((todayPresent / todayTotalMarked) * 1000) / 10 : null;

    // Overall class stats across all actual recorded sessions
    const { overallPercentage, lowAttendanceStudents } = calculateClassStats(
      classStudents,
      records,
      threshold
    );

    return {
      todayPresent,
      todayAbsent,
      todayUnmarked,
      todayTotal: classStudents.length,
      todayPercentage,
      overallPercentage,
      studentsBelowThreshold: lowAttendanceStudents.length,
      totalStudents: students.length,
      totalClasses: classes.length,
    };
  }, [sessions, records, activeClass, classStudents, students, classes, threshold]);

  return (
    <AttendanceContext.Provider
      value={{
        session,
        authLoading,
        signOut,
        user,
        isAdmin,
        isTeacher,
        isStudent,
        classes,
        students,
        subjects,
        classSubjects,
        activeSubjectId,
        setActiveSubjectId,
        activeSubject,
        classAvailableSubjects,
        sessions,
        records,
        recentActivities,
        threshold,
        setThreshold,
        activeClassId,
        setActiveClassId,
        activeClass,
        classStudents,
        addClass,
        updateClass,
        deleteClass,
        addStudent,
        updateStudent,
        deleteStudent,
        updateStudentRollNumber,
        rusticateStudent,
        reinstateStudent,
        saveAttendanceSession,
        getStudentStats,
        dashboardMetrics,
        isSupabaseLive,
        isGeminiLive,
        isLoading,
        refreshData: fetchDatabaseData,
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
}

export function useAttendance() {
  const context = useContext(AttendanceContext);
  if (!context) {
    throw new Error('useAttendance must be used within an AttendanceProvider');
  }
  return context;
}
