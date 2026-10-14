import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  ClassroomScanResult,
  DetectedStudent,
  NormalizedStudentResult,
  Student,
  UndetectedStudent,
} from '../types';

export interface RecognitionInput {
  imageBase64: string;
  mimeType: string;
  students: Student[];
  className?: string;
  subjectName?: string;
}

export interface RecognitionProvider {
  recognize(input: RecognitionInput): Promise<ClassroomScanResult>;
}

// Primary model is gemini-2.5-flash per current multimodal standards (configurable via GEMINI_MODEL).
const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const FALLBACK_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.5-pro',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
];

const MODEL_CASCADE = [PRIMARY_MODEL, ...FALLBACK_MODELS];

function sanitizeErrorMessage(msg: string): string {
  return msg
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_KEY]')
    .replace(/key=[^&\s]+/gi, 'key=[REDACTED]');
}

function extractHttpStatus(err: any): number | null {
  if (err?.status && typeof err.status === 'number') return err.status;
  if (err?.response?.status && typeof err.response.status === 'number') return err.response.status;
  const match = (err?.message || '').match(/\b(400|401|403|404|429|500|502|503|504)\b/);
  return match ? parseInt(match[1], 10) : null;
}

function isTransientError(err: any): boolean {
  const status = extractHttpStatus(err);
  if (status === 503 || status === 429 || status === 502 || status === 504) return true;
  if (status === 400 || status === 401 || status === 403 || status === 404) return false;
  const msg = (err?.message || '').toLowerCase();
  return (
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('service unavailable') ||
    msg.includes('high demand') ||
    msg.includes('spikes in demand') ||
    msg.includes('overloaded') ||
    msg.includes('resource_exhausted') ||
    msg.includes('temporarily')
  );
}

/**
 * Gemini Recognition Implementation
 * Isolates Google Generative AI behind a clean server-side provider interface.
 */
export class GeminiRecognitionProvider implements RecognitionProvider {
  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY;
  }

  async recognize(input: RecognitionInput): Promise<ClassroomScanResult> {
    const { imageBase64, mimeType, students, className } = input;

    if (!this.apiKey || this.apiKey === 'your-gemini-api-key') {
      throw new Error(
        'Gemini AI is not configured. Please set GEMINI_API_KEY in your server environment variables.'
      );
    }

    if (!students || students.length === 0) {
      return {
        detectedStudents: [],
        undetectedStudents: [],
        students: [],
        unknownFacesCount: 0,
        totalFacesDetected: 0,
        timestamp: new Date().toISOString(),
      };
    }

    console.log(
      `[attendance/scan] Stage 2: Preparing roster for ${students.length} student(s) in "${className || 'Classroom'}"`
    );

    // Provide registered student roster with ID, name, roll number, and reference photo info
    const rosterList = students.map((s) => ({
      studentId: s.id,
      name: s.full_name,
      rollNumber: s.roll_number,
      hasReferencePhoto: Boolean(s.photo_url),
      photoUrl: s.photo_url || null,
    }));

    const validStudentMap = new Map<string, Student>();
    students.forEach((s) => validStudentMap.set(s.id, s));

    const prompt = `
You are ATTENDER AI, an expert classroom vision and face detection system.
A teacher took a wide-angle photograph of their classroom for attendance.
The teacher instructed students: "Ask everyone to look directly at the camera."

Class: ${className || 'Classroom'}
Total Enrolled Students: ${students.length}

REGISTERED STUDENT ROSTER:
${JSON.stringify(rosterList, null, 2)}

STRICT RULES:
1. Examine the classroom image carefully for frontal human faces.
2. For each detected frontal face, attempt to match them against the REGISTERED STUDENT ROSTER above using the student name, roll number, and photo info.
3. You must ONLY return studentId values that exist in the provided roster. NEVER invent or fabricate student IDs or names.
4. For matched students, assign normalized bounding box coordinates [ymin, xmin, ymax, xmax] between 0 and 1000, and confidence between 0.70 and 0.99.
5. If a face is visible in the classroom but cannot be confidently matched to any registered student in the roster, increment unknownFacesCount. Do NOT invent a student.
6. For registered students NOT detected in the image, list them in undetectedStudents.
7. Any student not confidently detected MUST be marked as absent / undetected.

Respond strictly in valid JSON matching this schema:
{
  "detectedStudents": [
    {
      "studentId": "must be an exact studentId from the roster above",
      "confidence": 0.95,
      "boundingBox": {
        "ymin": 120,
        "xmin": 340,
        "ymax": 280,
        "xmax": 460
      }
    }
  ],
  "undetectedStudents": [
    {
      "studentId": "exact studentId from roster",
      "reason": "Face not detected or obscured"
    }
  ],
  "unknownFacesCount": 0,
  "totalFacesDetected": 24
}
`;

    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: mimeType || 'image/jpeg',
      },
    };

    const genAI = new GoogleGenerativeAI(this.apiKey);

    const BACKOFF_MS = [1000, 2000, 4000];
    let selectedModel = '';
    let responseText = '';
    let lastError: any = null;
    let allFailedTransient = true;

    // Iterate through primary and fallback models
    for (let mIdx = 0; mIdx < MODEL_CASCADE.length; mIdx++) {
      const candidate = MODEL_CASCADE[mIdx];
      const isFallback = mIdx > 0;
      // Primary model gets 3 attempts; fallbacks get up to 2 attempts
      const maxAttempts = isFallback ? 2 : 3;

      if (isFallback) {
        console.log(
          `[attendance/scan] Switching to fallback model: "${candidate}" | Fallback in use: true`
        );
      }

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(
          `[attendance/scan] Model attempted: "${candidate}" | Attempt: ${attempt}/${maxAttempts} | Fallback in use: ${isFallback}`
        );

        try {
          const model = genAI.getGenerativeModel({
            model: candidate,
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          });

          const result = await model.generateContent([prompt, imagePart]);
          responseText = result.response.text();
          selectedModel = candidate;

          console.log(
            `[attendance/scan] Model succeeded: "${candidate}" | Attempt: ${attempt}/${maxAttempts} | Fallback in use: ${isFallback}`
          );
          break;
        } catch (err: any) {
          lastError = err;
          const status = extractHttpStatus(err) || (isTransientError(err) ? 503 : 'Error');
          const isTransient = isTransientError(err);
          const sanitizedMsg = sanitizeErrorMessage(err?.message || 'Call failed');

          console.warn(
            `[attendance/scan] Model attempted: "${candidate}" | Attempt: ${attempt}/${maxAttempts} failed | Status: ${status} | Error: "${sanitizedMsg}" | Fallback in use: ${isFallback}`
          );

          // Do NOT retry permanent errors (e.g. 400, 401, 403, 404, invalid key)
          if (!isTransient) {
            allFailedTransient = false;
            console.warn(
              `[attendance/scan] Permanent error for model "${candidate}". Aborting retries for this model.`
            );
            break;
          }

          if (attempt < maxAttempts) {
            const delay = BACKOFF_MS[attempt - 1] + Math.floor(Math.random() * 200);
            console.log(
              `[attendance/scan] Retrying "${candidate}" in ~${Math.round(delay / 1000)}s (transient ${status} error)...`
            );
            await new Promise((r) => setTimeout(r, delay));
          } else {
            console.warn(
              `[attendance/scan] Retries exhausted for "${candidate}" (${maxAttempts} attempts).`
            );
          }
        }
      }

      if (responseText) {
        break;
      }
    }

    if (!responseText) {
      if (allFailedTransient) {
        throw new Error('Gemini is temporarily busy. Please try the scan again in a moment.');
      }
      const cleanErrMsg = sanitizeErrorMessage(
        lastError?.message || 'Unable to generate content with available Gemini vision models.'
      );
      throw new Error(`Gemini Vision Error: ${cleanErrMsg}`);
    }

    console.log(`[attendance/scan] Stage 5: Parsing structured JSON from model "${selectedModel}"...`);

    // Clean potential markdown blocks
    let cleanText = responseText.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleanText);
    } catch (parseErr: any) {
      console.error('[attendance/scan] Failed to parse JSON response:', cleanText);
      throw new Error('Invalid JSON structure returned by Gemini vision model.');
    }

    // Validate and sanitize detected students strictly against registered roster
    const detectedStudents: DetectedStudent[] = [];
    const detectedIdSet = new Set<string>();

    if (Array.isArray(parsed.detectedStudents)) {
      for (const item of parsed.detectedStudents) {
        if (item.studentId && validStudentMap.has(item.studentId)) {
          const registered = validStudentMap.get(item.studentId)!;
          detectedIdSet.add(item.studentId);
          detectedStudents.push({
            studentId: item.studentId,
            matchedName: registered.full_name,
            rollNumber: registered.roll_number,
            confidence:
              typeof item.confidence === 'number'
                ? Math.min(1, Math.max(0, item.confidence))
                : 0.9,
            boundingBox: item.boundingBox || undefined,
          });
        }
      }
    }

    // Build undetected list for all registered students not in detected list
    const undetectedStudents: UndetectedStudent[] = [];
    students.forEach((s) => {
      if (!detectedIdSet.has(s.id)) {
        undetectedStudents.push({
          studentId: s.id,
          studentName: s.full_name,
          rollNumber: s.roll_number,
          reason: 'Not detected in camera angle',
        });
      }
    });

    const unknownFacesCount =
      typeof parsed.unknownFacesCount === 'number' ? parsed.unknownFacesCount : 0;
    const totalFaces = detectedStudents.length + unknownFacesCount;

    // Requirement 10 & 11: Return a normalized result containing each enrolled student
    const normalizedStudents: NormalizedStudentResult[] = students.map((std) => {
      const isDetected = detectedIdSet.has(std.id);
      const detectedInfo = detectedStudents.find((d) => d.studentId === std.id);
      return {
        student_id: std.id,
        name: std.full_name,
        roll_number: std.roll_number,
        status: isDetected ? 'present' : 'absent',
        detected: isDetected,
        confidence: detectedInfo?.confidence ?? 0,
        boundingBox: detectedInfo?.boundingBox,
      };
    });

    console.log(
      `[attendance/scan] Stage 6: Scan completed successfully with model "${selectedModel}". Detected: ${detectedStudents.length}, Not Detected: ${undetectedStudents.length}, Unknown Faces: ${unknownFacesCount}`
    );

    return {
      detectedStudents,
      undetectedStudents,
      students: normalizedStudents,
      unknownFacesCount,
      totalFacesDetected: totalFaces,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Top-level abstraction required by specification:
 * recognizeClassroomAttendance()
 * Allows seamlessly swapping Gemini with another facial recognition engine if needed.
 */
export async function recognizeClassroomAttendance(
  input: RecognitionInput,
  provider: RecognitionProvider = new GeminiRecognitionProvider()
): Promise<ClassroomScanResult> {
  return provider.recognize(input);
}
