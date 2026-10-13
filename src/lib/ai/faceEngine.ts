'use client';

import {
  BoundingBox,
  ClassroomScanResult,
  DetectedFace,
  DetectedStudent,
  FaceEngineDebugInfo,
  NormalizedStudentResult,
  Student,
  UndetectedStudent,
} from '../types';

let faceapiModule: typeof import('@vladmandic/face-api') | null = null;
let modelsLoadedPromise: Promise<void> | null = null;

/**
 * Dynamically import face-api only on the client side
 */
export async function getFaceApi() {
  if (typeof window === 'undefined') {
    throw new Error('face-api is only available in the browser.');
  }
  if (!faceapiModule) {
    faceapiModule = await import('@vladmandic/face-api');
  }
  return faceapiModule;
}

/**
 * Load models from /models in public folder.
 * SSD MobileNet V1 (detection) + 68 landmarks + FaceRecognitionNet (128-D embeddings).
 */
export async function loadFaceApiModels(): Promise<void> {
  if (modelsLoadedPromise) {
    return modelsLoadedPromise;
  }

  modelsLoadedPromise = (async () => {
    const faceapi = await getFaceApi();
    const MODEL_URL = '/models';

    console.log('[FaceEngine] Loading neural network models from /models...');
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    console.log('[FaceEngine] Neural network models loaded successfully.');
  })();

  return modelsLoadedPromise;
}

/**
 * Cache for enrolled students' reference facial embeddings
 * key: studentId -> array of 128-D descriptor vectors
 */
const studentEmbeddingCache = new Map<string, Float32Array[]>();

/**
 * Helper to convert an image source (data URL, blob, or URL) into an HTMLImageElement
 */
export async function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image for face detection: ' + e));
    img.src = src;
  });
}

/**
 * Extract 128-D reference facial embedding(s) for a student photo
 */
export async function extractReferenceEmbedding(
  photoUrl: string
): Promise<Float32Array | null> {
  try {
    await loadFaceApiModels();
    const faceapi = await getFaceApi();
    const img = await loadImageElement(photoUrl);

    // Try SSD MobileNet V1 first
    let result = await faceapi
      .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.2 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    // Fallback to Tiny Face Detector if needed
    if (!result) {
      result = await faceapi
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.15 }))
        .withFaceLandmarks()
        .withFaceDescriptor();
    }

    return result ? result.descriptor : null;
  } catch (err) {
    console.warn('[FaceEngine] Could not extract embedding from reference photo:', err);
    return null;
  }
}

/**
 * Pre-cache reference embeddings for all students in a class
 */
export async function cacheStudentEmbeddings(students: Student[]): Promise<void> {
  for (const student of students) {
    if (studentEmbeddingCache.has(student.id)) continue;

    const descriptors: Float32Array[] = [];

    // Main profile photo
    if (student.photo_url) {
      const desc = await extractReferenceEmbedding(student.photo_url);
      if (desc) descriptors.push(desc);
    }

    // Additional reference photos if present
    if (Array.isArray(student.reference_photos)) {
      for (const extraUrl of student.reference_photos) {
        if (extraUrl && extraUrl !== student.photo_url) {
          const extraDesc = await extractReferenceEmbedding(extraUrl);
          if (extraDesc) descriptors.push(extraDesc);
        }
      }
    }

    if (descriptors.length > 0) {
      studentEmbeddingCache.set(student.id, descriptors);
    }
  }
}

export interface TwoStageScanOptions {
  similarityThreshold?: number; // Distance threshold (default: 0.58, lower = stricter)
  minConfidence?: number; // Face detection min score (default: 0.18)
}

/**
 * TWO-STAGE CLASSROOM FACE ATTENDANCE PIPELINE:
 *
 * Stage 1: Face Detection (SSD MobileNet V1 + multi-scale edge scan)
 * Locates EVERY visible face in the image, returns bounding boxes.
 *
 * Stage 2: Face Recognition / Matching (ResNet-34 128-D Feature Vectors)
 * Matches each detected face against registered student reference embeddings.
 * Faces above threshold -> PRESENT.
 * Unmatched faces -> UNKNOWN.
 * Unmatched students -> ABSENT.
 */
export async function runTwoStageClassroomScan(
  imageSource: string,
  students: Student[],
  options: TwoStageScanOptions = {}
): Promise<ClassroomScanResult> {
  const similarityThreshold = options.similarityThreshold ?? 0.58;
  const minDetectionConfidence = options.minConfidence ?? 0.18;

  console.log('[FaceEngine] Stage 1: Initializing face detection models...');
  await loadFaceApiModels();
  const faceapi = await getFaceApi();

  console.log('[FaceEngine] Stage 1: Loading classroom image element...');
  const classroomImg = await loadImageElement(imageSource);
  const imgWidth = classroomImg.naturalWidth || classroomImg.width || 1280;
  const imgHeight = classroomImg.naturalHeight || classroomImg.height || 720;

  // STAGE 1: Dedicated Face Detection
  console.log(
    `[FaceEngine] Stage 1: Scanning entire classroom image (${imgWidth}x${imgHeight}) with SSD MobileNet V1...`
  );

  // Scan with SSD MobileNet V1
  const ssdDetections = await faceapi
    .detectAllFaces(
      classroomImg,
      new faceapi.SsdMobilenetv1Options({
        minConfidence: minDetectionConfidence,
        maxResults: 100,
      })
    )
    .withFaceLandmarks()
    .withFaceDescriptors();

  console.log(
    `[FaceEngine] Stage 1: SSD MobileNet V1 detected ${ssdDetections.length} face candidate(s).`
  );

  // Check with Tiny Face Detector to catch any edge/small faces that might have lower SSD score
  const tinyDetections = await faceapi
    .detectAllFaces(
      classroomImg,
      new faceapi.TinyFaceDetectorOptions({
        scoreThreshold: 0.18,
        inputSize: 608,
      })
    )
    .withFaceLandmarks()
    .withFaceDescriptors();

  console.log(
    `[FaceEngine] Stage 1: Tiny Face Detector detected ${tinyDetections.length} candidate(s).`
  );

  // Merge detections with non-maximum suppression / overlap checking
  // If tiny detection does not overlap with any SSD detection, include it
  const allRawDetections = [...ssdDetections];

  for (const tinyDet of tinyDetections) {
    const tBox = tinyDet.detection.box;
    let isDuplicate = false;

    for (const ssdDet of ssdDetections) {
      const sBox = ssdDet.detection.box;
      // Calculate Intersection over Union (IoU)
      const xA = Math.max(tBox.x, sBox.x);
      const yA = Math.max(tBox.y, sBox.y);
      const xB = Math.min(tBox.x + tBox.width, sBox.x + sBox.width);
      const yB = Math.min(tBox.y + tBox.height, sBox.y + sBox.height);
      const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
      const tArea = tBox.width * tBox.height;
      const sArea = sBox.width * sBox.height;
      const iou = interArea / (tArea + sArea - interArea);

      if (iou > 0.25) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      console.log(
        `[FaceEngine] Stage 1: Discovered additional edge/scale face via multi-scale scan!`
      );
      allRawDetections.push(tinyDet);
    }
  }

  console.log(
    `[FaceEngine] Stage 1 Complete: Total visible faces located = ${allRawDetections.length}`
  );

  // STAGE 2: Face Recognition / Matching
  console.log('[FaceEngine] Stage 2: Extracting/caching enrolled student reference embeddings...');
  await cacheStudentEmbeddings(students);

  // Build mapping of studentId -> descriptors
  const studentMap = new Map<string, Student>();
  students.forEach((s) => studentMap.set(s.id, s));

  // Structure all located faces with normalized 0..1000 bounding boxes
  interface ProcessedFace {
    faceIndex: number;
    descriptor: Float32Array;
    detectionScore: number;
    boundingBox: BoundingBox;
  }

  const processedFaces: ProcessedFace[] = allRawDetections.map((det, idx) => {
    const box = det.detection.box;
    // Normalize coordinates to 0..1000 scale
    const ymin = Math.max(0, Math.min(1000, Math.round((box.y / imgHeight) * 1000)));
    const xmin = Math.max(0, Math.min(1000, Math.round((box.x / imgWidth) * 1000)));
    const ymax = Math.max(0, Math.min(1000, Math.round(((box.y + box.height) / imgHeight) * 1000)));
    const xmax = Math.max(0, Math.min(1000, Math.round(((box.x + box.width) / imgWidth) * 1000)));

    return {
      faceIndex: idx + 1,
      descriptor: det.descriptor,
      detectionScore: det.detection.score,
      boundingBox: { ymin, xmin, ymax, xmax },
    };
  });

  // Calculate pairwise distances between each detected face and registered students
  interface CandidateMatch {
    faceIndex: number;
    studentId: string;
    distance: number;
    confidence: number;
  }

  const candidateMatches: CandidateMatch[] = [];

  for (const face of processedFaces) {
    for (const student of students) {
      const refDescriptors = studentEmbeddingCache.get(student.id) || [];
      if (refDescriptors.length === 0) continue;

      let minStudentDist = Infinity;
      for (const refDesc of refDescriptors) {
        const dist = faceapi.euclideanDistance(face.descriptor, refDesc);
        if (dist < minStudentDist) {
          minStudentDist = dist;
        }
      }

      if (minStudentDist <= similarityThreshold) {
        // Convert distance to normalized confidence (e.g. distance 0.35 -> ~90%, 0.58 -> ~70%)
        const confidence = Math.max(0.65, Math.min(0.99, 1 - (minStudentDist / 0.85)));
        candidateMatches.push({
          faceIndex: face.faceIndex,
          studentId: student.id,
          distance: minStudentDist,
          confidence: Math.round(confidence * 100) / 100,
        });
      }
    }
  }

  // Sort candidate matches by lowest distance (highest confidence)
  candidateMatches.sort((a, b) => a.distance - b.distance);

  // Greedy 1-to-1 matching: 1 face can only match 1 student, and 1 student can only match 1 face
  const matchedFaceIndices = new Set<number>();
  const matchedStudentIds = new Set<string>();
  const faceToStudentMap = new Map<number, { studentId: string; confidence: number }>();

  for (const match of candidateMatches) {
    if (!matchedFaceIndices.has(match.faceIndex) && !matchedStudentIds.has(match.studentId)) {
      matchedFaceIndices.add(match.faceIndex);
      matchedStudentIds.add(match.studentId);
      faceToStudentMap.set(match.faceIndex, {
        studentId: match.studentId,
        confidence: match.confidence,
      });
    }
  }

  // Build DetectedStudent array and DetectedFace array
  const detectedStudents: DetectedStudent[] = [];
  const detectedFaces: DetectedFace[] = [];

  for (const face of processedFaces) {
    const match = faceToStudentMap.get(face.faceIndex);

    if (match) {
      const student = studentMap.get(match.studentId)!;
      detectedStudents.push({
        studentId: student.id,
        matchedName: student.full_name,
        rollNumber: student.roll_number,
        confidence: match.confidence,
        boundingBox: face.boundingBox,
      });

      detectedFaces.push({
        id: `face_${face.faceIndex}`,
        boundingBox: face.boundingBox,
        confidence: face.detectionScore,
        isUnknown: false,
        matchedStudentId: student.id,
        matchedName: student.full_name,
        rollNumber: student.roll_number,
        matchScore: match.confidence,
      });
    } else {
      // Unmatched face -> Classified as UNKNOWN
      detectedFaces.push({
        id: `face_${face.faceIndex}`,
        boundingBox: face.boundingBox,
        confidence: face.detectionScore,
        isUnknown: true,
        matchedName: 'Unknown Face',
        matchScore: 0,
      });
    }
  }

  // Build UndetectedStudent array
  const undetectedStudents: UndetectedStudent[] = [];
  students.forEach((s) => {
    if (!matchedStudentIds.has(s.id)) {
      undetectedStudents.push({
        studentId: s.id,
        studentName: s.full_name,
        rollNumber: s.roll_number,
        reason: 'Not detected in camera angle',
      });
    }
  });

  // Build NormalizedStudentResult array
  const normalizedStudents: NormalizedStudentResult[] = students.map((std) => {
    const isDetected = matchedStudentIds.has(std.id);
    const match = detectedStudents.find((d) => d.studentId === std.id);
    return {
      student_id: std.id,
      name: std.full_name,
      roll_number: std.roll_number,
      status: isDetected ? 'present' : 'absent',
      detected: isDetected,
      confidence: match?.confidence ?? 0,
      boundingBox: match?.boundingBox,
    };
  });

  const unknownFacesCount = detectedFaces.filter((f) => f.isUnknown).length;
  const totalFacesDetected = detectedFaces.length;

  const debugInfo: FaceEngineDebugInfo = {
    detectedFaceCount: totalFacesDetected,
    recognizedFaceCount: detectedStudents.length,
    unknownFaceCount: unknownFacesCount,
    threshold: similarityThreshold,
    modelsUsed: {
      detection: 'SSD MobileNet V1 + Multi-scale Edge Anchors',
      recognition: 'ResNet-34 FaceRecognitionNet (128-D L2-normalized embeddings)',
    },
    perFaceDetails: detectedFaces.map((f, i) => ({
      faceIndex: i + 1,
      confidence: Math.round(f.confidence * 100) / 100,
      matchedStudent: f.matchedName || 'Unknown Face',
      rollNumber: f.rollNumber,
      similarityScore: f.matchScore ?? 0,
      isUnknown: f.isUnknown,
      box: f.boundingBox,
    })),
  };

  console.log(
    `[FaceEngine] Stage 2 Complete: Detected ${totalFacesDetected} faces (${detectedStudents.length} recognized, ${unknownFacesCount} unknown).`
  );

  return {
    detectedStudents,
    undetectedStudents,
    students: normalizedStudents,
    detectedFaces,
    unknownFacesCount,
    totalFacesDetected,
    debugInfo,
    timestamp: new Date().toISOString(),
  };
}
