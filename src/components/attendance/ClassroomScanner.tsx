'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ClassroomReviewModal } from './ClassroomReviewModal';
import {
  DetectedStudent,
  UndetectedStudent,
  Student,
  DetectedFace,
  FaceEngineDebugInfo,
  ClassroomScanResult,
} from '@/lib/types';
import { runTwoStageClassroomScan } from '@/lib/ai/faceEngine';
import { useAttendance } from '@/lib/context/AttendanceContext';
import { useToast } from '../ui/Toast';
import {
  Camera,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Users,
  BookOpen,
  Sliders,
} from 'lucide-react';

export const ClassroomScanner: React.FC = () => {
  const { classStudents, activeClass } = useAttendance();
  const { error, info } = useToast();

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState<string>('');
  const [showReviewModal, setShowReviewModal] = useState(false);

  const [detectedStudents, setDetectedStudents] = useState<DetectedStudent[]>([]);
  const [undetectedStudents, setUndetectedStudents] = useState<UndetectedStudent[]>([]);
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [unknownFacesCount, setUnknownFacesCount] = useState<number>(0);
  const [totalFacesDetected, setTotalFacesDetected] = useState<number>(0);
  const [debugInfo, setDebugInfo] = useState<FaceEngineDebugInfo | undefined>();
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(0.58);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isScanningRef = useRef(false);
  const scanAbortControllerRef = useRef<AbortController | null>(null);

  // Stop camera and abort ongoing scan on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (scanAbortControllerRef.current) {
        scanAbortControllerRef.current.abort();
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      setCapturedImage(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn('Camera access denied or unavailable:', err);
      info('Camera Notice', 'Webcam was unavailable. You can upload an image file or test with sample photo.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhotoFromCamera = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedImage(dataUrl);
      stopCamera();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setCapturedImage(dataUrl);
      stopCamera();
    };
    reader.readAsDataURL(file);
  };

  // Pipeline execution
  const processClassroomScan = async () => {
    // Requirements 8 & 9: Guard against rapid double-clicks and multiple simultaneous scans
    if (isScanningRef.current || isScanning) {
      console.warn('Classroom scan is already in progress. Ignoring duplicate click.');
      return;
    }

    if (!activeClass) {
      error('No Class Selected', 'Please select a class from the top navigation before scanning.');
      return;
    }

    if (classStudents.length === 0) {
      error('No Enrolled Students', 'No active students enrolled in this class to match against.');
      return;
    }

    if (!capturedImage) {
      error('No Image', 'Please capture or upload a classroom photograph first.');
      return;
    }

    isScanningRef.current = true;
    setIsScanning(true);
    setScanStep('1. Preparing classroom photograph for multi-scale face scan...');

    try {
      if (scanAbortControllerRef.current) {
        scanAbortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      scanAbortControllerRef.current = abortController;

      // Convert image URL to base64 if it is an external URL
      let base64ToSend = capturedImage;
      if (capturedImage.startsWith('http')) {
        try {
          const res = await fetch(capturedImage);
          const blob = await res.blob();
          base64ToSend = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } catch {
          // If CORS prevents fetch, pass directly
        }
      }

      setScanStep('2. Stage 1: Scanning entire image for visible faces (SSD MobileNet V1)...');
      let scanResult: ClassroomScanResult;

      try {
        scanResult = await runTwoStageClassroomScan(base64ToSend, classStudents, {
          similarityThreshold,
          minConfidence: 0.18,
        });
        console.log('[ClassroomScanner] Two-stage face engine completed:', scanResult);
      } catch (clientFaceErr: any) {
        console.warn(
          '[ClassroomScanner] Local face-api fallback to server pipeline:',
          clientFaceErr?.message
        );
        setScanStep('3. Stage 2: Processing recognition via server pipeline...');

        const response = await fetch('/api/attendance/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortController.signal,
          body: JSON.stringify({
            imageBase64: base64ToSend,
            mimeType: 'image/jpeg',
            classId: activeClass?.id,
            className: `${activeClass?.name}-${activeClass?.section}`,
            students: classStudents,
          }),
        });

        const serverData = await response.json();
        if (!response.ok) {
          throw new Error(serverData.error || 'Unable to analyze classroom attendance.');
        }
        scanResult = serverData;
      }

      setScanStep('4. Assembling review roster & facial bounding markers...');
      await new Promise((r) => setTimeout(r, 300));

      setDetectedStudents(scanResult.detectedStudents || []);
      setUndetectedStudents(scanResult.undetectedStudents || []);
      setDetectedFaces(scanResult.detectedFaces || []);
      setUnknownFacesCount(scanResult.unknownFacesCount || 0);
      setTotalFacesDetected(scanResult.totalFacesDetected || 0);
      setDebugInfo(scanResult.debugInfo);
      setShowReviewModal(true);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        console.log('Classroom scan request aborted.');
        return;
      }
      console.error('Classroom scan error:', err);
      const message = err?.message || 'Unable to analyze classroom attendance. Please try again or mark manually.';
      error('Scan Failed', message);
    } finally {
      isScanningRef.current = false;
      setIsScanning(false);
      setScanStep('');
      scanAbortControllerRef.current = null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Instructions Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-indigo-200/60 dark:border-indigo-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> AI Vision Pipeline
          </span>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
            Classroom Face Attendance
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
            Instruct your class: <strong className="text-indigo-600 dark:text-indigo-400 font-semibold">&ldquo;Everyone look directly at the camera.&rdquo;</strong> Snap a wide frontal photograph, and ATTENDER AI will detect visible students, match them against registered roster photos, and present a review screen before saving.
          </p>
        </div>
      </div>

      {/* Alert when no class is selected */}
      {!activeClass && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">No Class Selected</h4>
            <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
              Please select or create a class first. Classroom face scanning requires an active enrolled roster.
            </p>
            <div className="mt-2.5">
              <Link href="/dashboard/classes">
                <Button size="sm" variant="outline" className="text-xs border-amber-500/40 text-amber-800 dark:text-amber-200 hover:bg-amber-500/10">
                  <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Go to Classes
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Alert when class is selected but has 0 students */}
      {activeClass && classStudents.length === 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
              No Students Enrolled in &ldquo;{activeClass.name}&rdquo;
            </h4>
            <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
              ATTENDER AI matches classroom faces against enrolled students with reference photos. Add students to this class before scanning.
            </p>
            <div className="mt-2.5">
              <Link href="/dashboard/students">
                <Button size="sm" variant="outline" className="text-xs border-amber-500/40 text-amber-800 dark:text-amber-200 hover:bg-amber-500/10">
                  <Users className="w-3.5 h-3.5 mr-1.5" /> Add Students
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Camera / Capture Stage */}
      <Card padding="none" className="overflow-hidden border-2 border-dashed border-slate-200 dark:border-slate-800 w-full min-w-0">
        <div className="relative min-h-[260px] sm:min-h-[380px] bg-slate-950 flex flex-col items-center justify-center p-3 sm:p-6 text-white text-center">
          {/* Active Live Video Stream */}
          {isCameraActive && (
            <div className="relative w-full max-w-3xl rounded-xl overflow-hidden aspect-video shadow-2xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-rose-600/90 text-white text-xs font-bold flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-white" /> LIVE CAMERA
              </div>
            </div>
          )}

          {/* Captured / Uploaded Image Preview */}
          {!isCameraActive && capturedImage && (
            <div className="relative w-full max-w-3xl rounded-xl overflow-hidden aspect-video shadow-2xl">
              <img
                src={capturedImage}
                alt="Captured classroom"
                className="w-full h-full object-contain bg-black/40"
              />
              <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-emerald-600/90 text-white text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Photo Ready
              </div>
            </div>
          )}

          {/* Empty State when no camera and no image */}
          {!isCameraActive && !capturedImage && (
            <div className="max-w-md py-6 sm:py-10 space-y-3 sm:space-y-4 px-2">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
                <Camera className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <div>
                <h4 className="text-base sm:text-lg font-bold text-white">Capture or Upload Classroom Photo</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Ensure good classroom lighting and frontal view of students&apos; faces.
                </p>
              </div>
            </div>
          )}

          {/* Scanning Progress Overlay */}
          {isScanning && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 z-20">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin mb-4" />
              <h4 className="text-base sm:text-lg font-bold text-white mb-2">Analyzing Classroom Attendance</h4>
              <p className="text-xs text-indigo-300 font-mono text-center px-4 animate-pulse">{scanStep}</p>
            </div>
          )}
        </div>

        {/* Action Controls Bar */}
        <div className="p-3 sm:p-5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {!isCameraActive ? (
              <Button
                variant="outline"
                size="md"
                onClick={startCamera}
                disabled={isScanning}
                leftIcon={<Camera className="w-4 h-4 text-indigo-600" />}
                className="flex-1 sm:flex-initial"
              >
                Open Camera
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={capturePhotoFromCamera}
                disabled={isScanning}
                leftIcon={<Camera className="w-4 h-4" />}
                className="flex-1 sm:flex-initial bg-indigo-600 hover:bg-indigo-700"
              >
                Snap Photo
              </Button>
            )}

            <Button
              variant="outline"
              size="md"
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning}
              leftIcon={<Upload className="w-4 h-4 text-slate-600" />}
              className="flex-1 sm:flex-initial"
            >
              Upload Photo
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={isScanning}
                className="hidden"
              />
            </Button>

            {isCameraActive && (
              <Button variant="ghost" size="sm" onClick={stopCamera} disabled={isScanning} className="w-full sm:w-auto">
                Cancel Camera
              </Button>
            )}

            {/* Configurable Similarity Threshold */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs w-full sm:w-auto justify-between sm:justify-start">
              <div className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-[11px] text-slate-500 font-medium">Strictness:</span>
              </div>
              <select
                value={similarityThreshold}
                onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
                disabled={isScanning}
                className="bg-transparent text-[11px] font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value={0.50}>Strict (0.50)</option>
                <option value={0.58}>Balanced (0.58)</option>
                <option value={0.65}>Lenient (0.65)</option>
              </select>
            </div>
          </div>

          {/* Main SCAN CLASSROOM Button */}
          <div className="w-full sm:w-auto flex flex-col items-stretch sm:items-end">
            <Button
              variant="scan"
              size="lg"
              onClick={processClassroomScan}
              isLoading={isScanning}
              disabled={!capturedImage || isScanning || !activeClass || classStudents.length === 0}
              leftIcon={<Sparkles className="w-5 h-5 text-amber-300 animate-spin" />}
              className="w-full sm:w-auto font-black tracking-wide px-6 sm:px-8 text-base shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
            >
              SCAN CLASSROOM
            </Button>
            {(!activeClass || classStudents.length === 0) && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium text-center sm:text-right mt-1">
                {!activeClass ? 'Select a class above to scan' : 'Enroll students to enable scanning'}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Review Modal */}
      {capturedImage && (
        <ClassroomReviewModal
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          imageUrl={capturedImage}
          detectedStudents={detectedStudents}
          undetectedStudents={undetectedStudents}
          allClassStudents={classStudents}
          detectedFaces={detectedFaces}
          totalFacesDetected={totalFacesDetected}
          unknownFacesCount={unknownFacesCount}
          debugInfo={debugInfo}
          onRetake={() => {
            setShowReviewModal(false);
            setCapturedImage(null);
            startCamera();
          }}
          onSaveComplete={() => {
            setCapturedImage(null);
          }}
        />
      )}
    </div>
  );
};
