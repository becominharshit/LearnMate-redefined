import React, { useRef, useState } from 'react';
import {
  Camera,
  Mic,
  BookMarked,
  Calendar,
  Upload,
  RotateCw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ArrowRight,
  Square,
  Play,
  Plus,
  X,
} from 'lucide-react';
import type {
  NotebookEntry,
  StudyDocument,
  StudyPlannerTask,
} from '../types/study';
import { aiStudyClient } from '../services/aiClient';
import { studyStorage } from '../services/storageService';
import { splitTextIntoPages } from '../utils/quizGrading';

interface NotebookAndScannerModalProps {
  isOpen: boolean;
  initialMode: 'scan' | 'voice' | 'notebook' | 'planner';
  onClose: () => void;
  onImportAsStudyDocument: (doc: StudyDocument) => void;
}

export const NotebookAndScannerModal: React.FC<NotebookAndScannerModalProps> = ({
  isOpen,
  initialMode,
  onClose,
  onImportAsStudyDocument,
}) => {
  const [activeTab, setActiveTab] = useState<'scan' | 'voice' | 'notebook' | 'planner'>(
    initialMode
  );

  // Sync tab when initialMode prop changes
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialMode);
    }
  }, [isOpen, initialMode]);

  // Close on Escape key
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Scan Notes state
  const [scanTitle, setScanTitle] = useState('Handwritten Lecture Notes');
  // Starts empty: the scanner only ever processes and saves the student's own photo.
  const [imageDataUrl, setImageDataUrl] = useState<string>('');
  const [imageRotation, setImageRotation] = useState(0);
  const [highContrastPreview, setHighContrastPreview] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [noteDisplayStyle, setNoteDisplayStyle] = useState<'clean' | 'handwritten'>(
    'clean'
  );
  const [scannedCleanText, setScannedCleanText] = useState<string>('');
  const [scannedHandwrittenText, setScannedHandwrittenText] = useState<string>('');
  const [scannedKeyConcepts, setScannedKeyConcepts] = useState<string[]>([]);
  const [uncertainFlags, setUncertainFlags] = useState<string[]>([]);
  const [scanSavedMsg, setScanSavedMsg] = useState<string | null>(null);
  const [scanMsgIsError, setScanMsgIsError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Voice Recorder state
  const [voiceTitle, setVoiceTitle] = useState('Recorded Lecture Summary');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedBase64, setRecordedBase64] = useState<string | null>(null);
  const [spokenOrTypedTranscript, setSpokenOrTypedTranscript] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribedNotes, setTranscribedNotes] = useState<string>('');
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  // Notebook & Planner state
  const [notebookEntries, setNotebookEntries] = useState<NotebookEntry[]>(() =>
    studyStorage.getNotebookEntries()
  );
  const [plannerTasks, setPlannerTasks] = useState<StudyPlannerTask[]>(() =>
    studyStorage.getStudyPlannerTasks()
  );
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskMins, setNewTaskMins] = useState(25);

  if (!isOpen) return null;

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanTitle(file.name.replace(/\.[^.]+$/, ''));
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRunOcrScan = async () => {
    if (!imageDataUrl) {
      setScanMsgIsError(true);
      setScanSavedMsg('Upload or take a photo of your notes first.');
      return;
    }
    setIsScanning(true);
    setScanSavedMsg(null);
    try {
      const res = await aiStudyClient.scanNotes({
        imageDataUrl,
        title: scanTitle,
      });
      setScannedCleanText(res.cleanContent);
      setScannedHandwrittenText(res.handwrittenContent || res.cleanContent);
      setUncertainFlags(res.uncertainSegments || []);
      setScannedKeyConcepts(res.keyConcepts || []);
      setScanMsgIsError(false);
      setScanSavedMsg('OCR scan complete! You can edit the notes or open them in Learn.');
    } catch (err) {
      setScanMsgIsError(true);
      setScanSavedMsg(err instanceof Error ? err.message : 'Could not scan these notes.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSaveScanToNotebook = (openInLearn: boolean) => {
    if (!scannedCleanText.trim()) {
      setScanMsgIsError(true);
      setScanSavedMsg('There are no notes to save yet. Scan a photo or type your notes first.');
      return;
    }
    const entry: NotebookEntry = {
      id: `nb-scan-${Date.now()}`,
      title: scanTitle.trim() || 'Scanned Notes',
      type: 'scanned_note',
      cleanContent: scannedCleanText,
      handwrittenContent: scannedHandwrittenText,
      uncertainSegments: uncertainFlags,
      originalImageUrl: imageDataUrl,
      summary: scannedCleanText.slice(0, 160),
      keyConcepts: scannedKeyConcepts,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    studyStorage.saveNotebookEntry(entry);
    setNotebookEntries(studyStorage.getNotebookEntries());
    setScanMsgIsError(false);
    setScanSavedMsg('Saved to My Notebook!');

    if (openInLearn) {
      const pages = splitTextIntoPages(scannedCleanText);
      const newDoc: StudyDocument = {
        id: `doc-scan-${Date.now()}`,
        title: entry.title,
        sourceType: 'scanned_notes',
        pageCount: pages.length,
        pages,
        scannedImageDataUrl: imageDataUrl,
        createdAt: new Date().toISOString(),
        lastStudiedAt: new Date().toISOString(),
        overview: entry.summary,
        topics: [
          {
            id: `top-scan-${Date.now()}`,
            name: entry.title,
            summary: entry.summary,
            keyConcepts: entry.keyConcepts,
            sourcePages: [1],
          },
        ],
      };
      onImportAsStudyDocument(newDoc);
      onClose();
    }
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setRecordedAudioUrl(URL.createObjectURL(blob));
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setRecordedBase64(reader.result);
          }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      // Microphone unavailable in headless/iframe environment; user can still use spoken/typed transcript below
      setIsRecording(false);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsRecording(false);
  };

  const handleRunAudioTranscription = async (openInLearn: boolean) => {
    if (!recordedBase64 && !spokenOrTypedTranscript.trim()) {
      setTranscribeError('Record a lecture or type a transcript first.');
      return;
    }
    setTranscribeError(null);
    setIsTranscribing(true);
    try {
      const res = await aiStudyClient.transcribeAudio({
        audioDataUrl: recordedBase64 || undefined,
        title: voiceTitle,
        manualTranscript: spokenOrTypedTranscript,
      });
      setTranscribedNotes(res.structuredNotes);
      const entry: NotebookEntry = {
        id: `nb-voice-${Date.now()}`,
        title: voiceTitle.trim() || 'Voice Note',
        type: 'voice_transcript',
        cleanContent: res.structuredNotes,
        handwrittenContent: res.transcript,
        uncertainSegments: [],
        audioDurationSeconds: recordingSeconds || undefined,
        summary: res.summary,
        keyConcepts: res.keyConcepts,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      studyStorage.saveNotebookEntry(entry);
      setNotebookEntries(studyStorage.getNotebookEntries());

      if (openInLearn) {
        const pages = splitTextIntoPages(res.structuredNotes);
        const newDoc: StudyDocument = {
          id: `doc-voice-${Date.now()}`,
          title: entry.title,
          sourceType: 'voice_note',
          pageCount: pages.length,
          pages,
          createdAt: new Date().toISOString(),
          lastStudiedAt: new Date().toISOString(),
          overview: res.summary,
          topics: [
            {
              id: `top-voice-${Date.now()}`,
              name: entry.title,
              summary: res.summary,
              keyConcepts: res.keyConcepts,
              sourcePages: [1],
            },
          ],
        };
        onImportAsStudyDocument(newDoc);
        onClose();
      }
    } catch (err) {
      setTranscribeError(
        err instanceof Error ? err.message : 'Could not transcribe this recording.'
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleAddPlannerTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const task: StudyPlannerTask = {
      id: `plan-${Date.now()}`,
      title: newTaskTitle.trim(),
      dateIso: new Date().toISOString().slice(0, 10),
      durationMinutes: Math.max(5, Math.min(180, Number(newTaskMins) || 25)),
      category: 'study',
      completed: false,
    };
    const next = [task, ...plannerTasks];
    setPlannerTasks(next);
    studyStorage.saveStudyPlannerTasks(next);
    setNewTaskTitle('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="notebook-scanner-modal"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden my-auto"
      >
        {/* Top Modal Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-canvas border-b border-slate-200">
          <div className="flex items-center gap-2">
            {[
              { id: 'scan', label: 'Scan Notes (OCR)', icon: Camera },
              { id: 'voice', label: 'Record Voice Note', icon: Mic },
              {
                id: 'notebook',
                label: `My Notebook (${notebookEntries.length})`,
                icon: BookMarked,
              },
              { id: 'planner', label: 'Study Planner', icon: Calendar },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? 'bg-brand text-white shadow-2xs'
                      : 'bg-white text-muted hover:text-ink border border-slate-200/80'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notebook modal"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 max-h-[78vh] overflow-y-auto">
          {activeTab === 'scan' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-ink">
                    Camera & Handwritten Note Scanner
                  </h3>
                  <p className="text-xs text-muted">
                    Upload or snap a photo of handwritten notebook pages or whiteboards to convert into editable digital notes.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-ink cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-brand" />
                    <span>Upload / Camera Photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRunOcrScan()}
                    disabled={isScanning}
                    data-testid="run-ocr-scan-btn"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isScanning ? 'Scanning with Gemini OCR...' : 'Extract & Digitize Notes'}</span>
                  </button>
                </div>
              </div>

              {/* Side-by-Side Original Image & Extracted Notes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Left: Original Image Preview + Rotate / Enhance Controls */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink">
                      Original Scanned Page
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setImageRotation((r) => (r + 90) % 360)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        <RotateCw className="w-3 h-3" />
                        <span>Rotate</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setHighContrastPreview((p) => !p)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                          highContrastPreview
                            ? 'bg-brand-soft border-brand text-brand'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        Enhance Contrast
                      </button>
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white flex items-center justify-center h-64">
                    {imageDataUrl ? (
                      <img
                        src={imageDataUrl}
                        alt="Scanned study notes preview"
                        className={`max-h-full max-w-full object-contain transition-transform ${
                          highContrastPreview ? 'contrast-150 brightness-105' : ''
                        }`}
                        style={{ transform: `rotate(${imageRotation}deg)` }}
                      />
                    ) : (
                      <p className="px-6 text-center text-xs text-slate-500">
                        Upload or take a photo of your handwritten notes, then press
                        &ldquo;Extract &amp; Digitize Notes&rdquo;.
                      </p>
                    )}
                  </div>
                  <input
                    type="text"
                    value={scanTitle}
                    onChange={(e) => setScanTitle(e.target.value)}
                    placeholder="Title for scanned notes..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-ink"
                  />
                </div>

                {/* Right: Clean Digital Notes | Handwritten-style Notes (Kalam) */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink">
                      Digitized Editable Notes
                    </span>
                    <div className="inline-flex rounded-xl bg-slate-100 p-1">
                      <button
                        type="button"
                        onClick={() => setNoteDisplayStyle('clean')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                          noteDisplayStyle === 'clean'
                            ? 'bg-white text-brand shadow-2xs'
                            : 'text-slate-600'
                        }`}
                      >
                        Clean Digital Notes
                      </button>
                      <button
                        type="button"
                        onClick={() => setNoteDisplayStyle('handwritten')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                          noteDisplayStyle === 'handwritten'
                            ? 'bg-white text-brand shadow-2xs'
                            : 'text-slate-600'
                        }`}
                      >
                        Handwritten (Kalam)
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={8}
                    value={
                      noteDisplayStyle === 'clean'
                        ? scannedCleanText
                        : scannedHandwrittenText
                    }
                    onChange={(e) => {
                      if (noteDisplayStyle === 'clean') {
                        setScannedCleanText(e.target.value);
                      } else {
                        setScannedHandwrittenText(e.target.value);
                      }
                    }}
                    className={`w-full flex-1 p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-brand ${
                      noteDisplayStyle === 'handwritten'
                        ? 'font-handwriting text-base bg-[#FFFDF5] text-slate-800 leading-relaxed'
                        : 'text-xs font-sans bg-slate-50/50 text-ink leading-relaxed'
                    }`}
                  />

                  {uncertainFlags.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Handwriting verification hint: </span>
                        {uncertainFlags.join(' • ')}
                      </div>
                    </div>
                  )}

                  {scanSavedMsg &&
                    (scanMsgIsError ? (
                      <div
                        role="alert"
                        className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-900 flex items-center gap-2"
                      >
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>{scanSavedMsg}</span>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                        <span>{scanSavedMsg}</span>
                      </div>
                    ))}

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSaveScanToNotebook(false)}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-ink cursor-pointer"
                    >
                      Save to My Notebook
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveScanToNotebook(true)}
                      data-testid="study-scanned-notes-btn"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-success hover:bg-success text-white text-xs font-semibold cursor-pointer"
                    >
                      <span>Study & Generate Flashcards</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'voice' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-ink">
                  Voice Note & Lecture Recorder
                </h3>
                <p className="text-xs text-muted">
                  Record spoken explanations or class lectures, transcribe with Gemini, and turn them into structured study notes and flashcards.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <input
                    type="text"
                    value={voiceTitle}
                    onChange={(e) => setVoiceTitle(e.target.value)}
                    placeholder="Lecture or voice note title..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-ink"
                  />

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          isRecording
                            ? 'bg-red-100 text-danger animate-pulse'
                            : 'bg-brand-soft text-brand'
                        }`}
                      >
                        <Mic className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-ink">
                          {isRecording ? 'Recording Microphone...' : 'Microphone Ready'}
                        </div>
                        <div className="text-[11px] text-muted tabular-nums">
                          Elapsed: {Math.floor(recordingSeconds / 60)}:
                          {String(recordingSeconds % 60).padStart(2, '0')}
                        </div>
                      </div>
                    </div>

                    {!isRecording ? (
                      <button
                        type="button"
                        onClick={() => void handleStartRecording()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-danger hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Record</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStopRecording}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                      >
                        <Square className="w-3.5 h-3.5" />
                        <span>Stop</span>
                      </button>
                    )}
                  </div>

                  {recordedAudioUrl && (
                    <audio controls src={recordedAudioUrl} className="w-full h-9" />
                  )}

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Spoken / Dictated Lecture Transcript (editable before summarizing):
                    </label>
                    <textarea
                      rows={4}
                      value={spokenOrTypedTranscript}
                      onChange={(e) => setSpokenOrTypedTranscript(e.target.value)}
                      className="w-full p-3 rounded-xl border border-slate-200 bg-white text-xs text-ink"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isTranscribing}
                      onClick={() => void handleRunAudioTranscription(false)}
                      className="px-3.5 py-2 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs font-semibold cursor-pointer"
                    >
                      {isTranscribing
                        ? 'Summarizing Lecture...'
                        : 'Transcribe & Save to Notebook'}
                    </button>
                    <button
                      type="button"
                      disabled={isTranscribing}
                      onClick={() => void handleRunAudioTranscription(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-success hover:bg-success text-white text-xs font-semibold cursor-pointer"
                    >
                      <span>Convert to Study Material</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {transcribeError && (
                    <div
                      role="alert"
                      className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-900 flex items-center gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>{transcribeError}</span>
                    </div>
                  )}
                </div>

                <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-3">
                  <span className="text-xs font-bold text-ink">
                    Structured Study Notes Output
                  </span>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-ink whitespace-pre-wrap min-h-[220px]">
                    {transcribedNotes ||
                      'Click "Transcribe & Save to Notebook" or "Convert to Study Material" to transform your voice recording into structured bullet points, formulas, and flashcards.'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notebook' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-ink">
                    My Personal Notebook
                  </h3>
                  <p className="text-xs text-muted">
                    All your digitized handwritten scans and transcribed voice lectures in one place.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('scan')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand text-white text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Scan</span>
                </button>
              </div>

              {notebookEntries.length === 0 ? (
                <div className="p-8 rounded-2xl border border-dashed border-slate-200 text-center space-y-2">
                  <p className="text-sm font-semibold text-ink">
                    Your personal notebook is empty
                  </p>
                  <p className="text-xs text-muted">
                    Scan handwritten notes or record a voice summary to save entries here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {notebookEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2.5 flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-ink">
                            {entry.title}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-brand-soft text-brand">
                            {entry.type === 'scanned_note' ? 'Scanned OCR' : 'Voice Note'}
                          </span>
                        </div>
                        <p className="text-xs text-muted line-clamp-3 whitespace-pre-wrap">
                          {entry.cleanContent}
                        </p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            studyStorage.deleteNotebookEntry(entry.id);
                            setNotebookEntries(studyStorage.getNotebookEntries());
                          }}
                          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const pages = splitTextIntoPages(entry.cleanContent);
                            onImportAsStudyDocument({
                              id: `doc-nb-${entry.id}`,
                              title: entry.title,
                              sourceType:
                                entry.type === 'scanned_note'
                                  ? 'scanned_notes'
                                  : 'voice_note',
                              pageCount: pages.length,
                              pages,
                              createdAt: entry.createdAt,
                              lastStudiedAt: new Date().toISOString(),
                              overview: entry.summary,
                              topics: [
                                {
                                  id: `top-${entry.id}`,
                                  name: entry.title,
                                  summary: entry.summary,
                                  keyConcepts: entry.keyConcepts,
                                  sourcePages: [1],
                                },
                              ],
                            });
                            onClose();
                          }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline cursor-pointer"
                        >
                          <span>Open in Learn</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'planner' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-ink">
                  Daily Study Planner & Revision Schedule
                </h3>
                <p className="text-xs text-muted">
                  Organize your daily study blocks, spaced-repetition reviews, and mock exam targets.
                </p>
              </div>

              <form onSubmit={handleAddPlannerTask} className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Add a study goal (e.g. Complete Bayes Theorem 15-question drill)..."
                  className="flex-1 min-w-[220px] px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-ink"
                />
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={newTaskMins}
                  onChange={(e) => setNewTaskMins(Number(e.target.value))}
                  className="w-24 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-ink"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand text-white text-xs font-semibold hover:bg-brand-strong cursor-pointer"
                >
                  Add Task
                </button>
              </form>

              <div className="space-y-2">
                {plannerTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                      task.completed
                        ? 'bg-emerald-50/50 border-emerald-200 text-slate-500'
                        : 'bg-white border-slate-200 text-ink'
                    }`}
                  >
                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => {
                          const next = plannerTasks.map((t) =>
                            t.id === task.id ? { ...t, completed: !t.completed } : t
                          );
                          setPlannerTasks(next);
                          studyStorage.saveStudyPlannerTasks(next);
                        }}
                        className="w-4 h-4 accent-success rounded cursor-pointer"
                      />
                      <div>
                        <div
                          className={`text-xs font-semibold ${
                            task.completed ? 'line-through text-slate-400' : ''
                          }`}
                        >
                          {task.title}
                        </div>
                        <div className="text-[11px] text-muted">
                          {task.dateIso} • {task.durationMinutes} mins • {task.category}
                        </div>
                      </div>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const next = plannerTasks.filter((t) => t.id !== task.id);
                        setPlannerTasks(next);
                        studyStorage.saveStudyPlannerTasks(next);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
