import { GoogleGenerativeAI } from '@google/generative-ai';
import { StudentAttendanceStats, DashboardMetrics, Student, ClassItem } from '../types';

export interface AssistantContext {
  students: Student[];
  classes: ClassItem[];
  studentStats: StudentAttendanceStats[];
  metrics: DashboardMetrics;
  threshold: number;
}

const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
].filter(Boolean) as string[];

function sanitizeErrorMessage(msg: string): string {
  return msg
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_KEY]')
    .replace(/key=[^&\s]+/gi, 'key=[REDACTED]');
}

export async function askAttenderAI(
  question: string,
  context: AssistantContext
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your-gemini-api-key') {
    throw new Error(
      'Gemini AI is not configured. Please set GEMINI_API_KEY in your server environment variables.'
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // Prepare sanitized, compact summary of context from Supabase data
  const sanitizedContext = {
    threshold: `${context.threshold}%`,
    totalStudents: context.students.length,
    totalClasses: context.classes.length,
    metrics: {
      todayPresent: context.metrics.todayPresent,
      todayAbsent: context.metrics.todayAbsent,
      todayUnmarked: context.metrics.todayUnmarked,
      overallPercentage: context.metrics.overallPercentage !== null ? `${context.metrics.overallPercentage}%` : 'N/A (No records)',
      studentsBelowThreshold: context.metrics.studentsBelowThreshold,
    },
    studentsRoster: context.studentStats.map((s) => ({
      name: s.studentName,
      roll: s.rollNumber,
      attendancePercentage: s.percentage !== null ? `${s.percentage}%` : 'N/A',
      presentSessions: s.presentCount,
      absentSessions: s.absentCount,
      lateSessions: s.lateCount,
      totalSessions: s.totalClasses,
      isBelowThreshold: s.isBelowThreshold,
    })),
    classesList: context.classes.map((c) => ({
      name: `${c.name} - ${c.section}`,
      academicYear: c.academic_year,
    })),
  };

  const systemPrompt = `
You are "ATTENDER AI", the intelligent assistant inside ATTENDER ("Smart attendance. Zero hassle.").
You help educators and school administrators analyze real attendance data from Supabase, spot attendance risks, and answer natural-language inquiries.

STRICT INSTRUCTIONS:
1. Base your answer entirely and strictly on the provided real JSON context below.
2. If there are no students or no attendance records in the database, explicitly state that no attendance records have been created yet. Do not fabricate or invent student names or statistics.
3. Be concise, professional, polite, and format your response clearly in GitHub-flavored Markdown using bullet points and bold highlights.
4. If asked about students below the threshold, list the exact students, their roll numbers, and their percentages from the roster.
5. You never talk about SQL or raw database credentials.

Real Database Context:
${JSON.stringify(sanitizedContext, null, 2)}
`;

  let responseText = '';
  let lastError: any = null;

  for (const candidate of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: candidate,
        generationConfig: {
          temperature: 0.2,
        },
      });

      const result = await model.generateContent([
        systemPrompt,
        `Educator's Question: "${question}"`,
      ]);

      responseText = result.response.text();
      if (responseText) {
        break;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[assistant] Model "${candidate}" failed (${sanitizeErrorMessage(err?.message || '')}). Trying next candidate...`);
    }
  }

  if (!responseText) {
    const cleanErrMsg = sanitizeErrorMessage(
      lastError?.message || 'Unable to generate response with available Gemini models.'
    );
    throw new Error(`Gemini AI Assistant Error: ${cleanErrMsg}`);
  }

  return responseText;
}
