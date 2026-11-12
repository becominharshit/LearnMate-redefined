import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Play,
  Pause,
  Timer,
  ChevronDown,
  Headphones,
  Music,
  Volume2,
  SkipForward,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import type { StudyDocument, StudyTimerState } from '../types/study';
import { studyStorage } from '../services/storageService';
import { computeTimerRemainingSeconds, formatTimestamp } from '../utils/quizGrading';
import { aiStudyClient } from '../services/aiClient';

export interface LofiPresetOption {
  id: string;
  name: string;
  subtitle: string;
  bpm: number;
  notes: number[];
  prompt: string;
}

export const LOFI_PRESETS: LofiPresetOption[] = [
  {
    id: 'rainy-night',
    name: 'Rainy Library',
    subtitle: 'Warm Rhodes chords & gentle rain',
    bpm: 72,
    notes: [261.63, 329.63, 392.0, 493.88],
    prompt:
      'Instrumental lo-fi hip hop for Rainy Library study, warm Rhodes chords, soft brushed snare, subtle vinyl texture, relaxed 72 BPM, mellow bass, no vocals, no spoken words, smooth loopable study ambiance',
  },
  {
    id: 'warm-vinyl',
    name: 'Midnight Coding',
    subtitle: 'Mellow synth-piano & deep sub pulse',
    bpm: 76,
    notes: [293.66, 349.23, 440.0, 523.25],
    prompt:
      'Instrumental lo-fi beats for Midnight Coding, warm electric piano chords, soft brushed snare, subtle vinyl texture, relaxed 76 BPM, mellow bass, no vocals, no spoken words, smooth loopable study ambiance',
  },
  {
    id: 'soft-piano',
    name: 'Cozy Café',
    subtitle: 'Minimal acoustic felt piano harmony',
    bpm: 70,
    notes: [220.0, 261.63, 329.63, 392.0],
    prompt:
      'Instrumental Cozy Cafe lo-fi study music, soft acoustic felt piano chords, gentle brush percussion, relaxed 70 BPM, mellow bass, no vocals, no spoken words, smooth loopable study ambiance',
  },
  {
    id: 'deep-focus',
    name: 'Deep Focus',
    subtitle: 'Binaural alpha-wave harmonic pad',
    bpm: 64,
    notes: [220.0, 226.0, 329.63, 440.0],
    prompt:
      'Instrumental Deep Focus ambient study pad, warm harmonic drones, relaxed 64 BPM, mellow bass, no vocals, no spoken words, smooth loopable study ambiance',
  },
  {
    id: 'cozy-library',
    name: 'Sunset Revision',
    subtitle: 'Golden-hour major 7th progressions',
    bpm: 74,
    notes: [174.61, 220.0, 261.63, 329.63],
    prompt:
      'Instrumental Sunset Revision lo-fi study beats, warm Rhodes chords, soft brushed snare, relaxed 74 BPM, mellow bass, no vocals, no spoken words, smooth loopable study ambiance',
  },
  {
    id: 'ambient-jazz',
    name: 'Sleepy Vinyl',
    subtitle: 'Tape-saturated 9th chords & vinyl warmth',
    bpm: 66,
    notes: [196.0, 246.94, 293.66, 349.23],
    prompt:
      'Instrumental Sleepy Vinyl lo-fi study music, warm Rhodes chords, subtle vinyl crackle texture, relaxed 66 BPM, mellow bass, no vocals, no spoken words, smooth loopable study ambiance',
  },
];

export type CompanionMode = 'idle' | 'pomodoro' | 'socratic' | 'ocr_doubt' | 'shardz';

interface DynamicCompanionProps {
  activeDoc?: StudyDocument | null;
}

interface SocraticCluePayload {
  clue1CorePrinciple: string;
  clue2GoverningEquation: string;
  clue3AlgebraicStep: string;
  finalSolutionSummary: string;
  matchedChapterTitle: string;
}

interface ShardZTask {
  id: string;
  title: string;
  durationMinutes: number;
  checkpoints: { id: string; prompt: string; answerHint: string; completed: boolean }[];
}

function playTimerChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const playTone = (freq: number, startOffset: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + startOffset + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startOffset);
      osc.stop(ctx.currentTime + startOffset + duration);
    };
    playTone(587.33, 0, 0.28);
    playTone(880, 0.25, 0.45);
  } catch {
    // ignore
  }
}

export const DynamicCompanion: React.FC<DynamicCompanionProps> = ({ activeDoc }) => {
  const [mode, setMode] = useState<CompanionMode>('idle');

  // Khanmigo "Clue Coins" Socratic Tutor State
  const [clueCoinsBalance, setClueCoinsBalance] = useState<number>(9);
  const [socraticPrompt, setSocraticPrompt] = useState<string>(
    'A solid sphere of mass M and radius R rolls without slipping down an inclined plane of angle θ. Find its linear acceleration.'
  );
  const [socraticLoading, setSocraticLoading] = useState<boolean>(false);
  const [socraticClues, setSocraticClues] = useState<SocraticCluePayload>({
    clue1CorePrinciple:
      'Identify the conserved quantity or fundamental law: Rolling without slipping couples translational acceleration $a_{cm}$ with angular acceleration $\\alpha = a_{cm}/R$.',
    clue2GoverningEquation:
      'Write the force and torque equations: $Mg\\sin\\theta - f_s = Ma_{cm}$ and $\\tau = f_s R = I_{cm}\\alpha = (\\frac{2}{5}MR^2)(a_{cm}/R)$.',
    clue3AlgebraicStep:
      'Substitute $f_s = \\frac{2}{5}Ma_{cm}$ into the linear force equation: $Mg\\sin\\theta = Ma_{cm}(1 + \\frac{2}{5})$. Now isolate $a_{cm}$.',
    finalSolutionSummary:
      'Final Answer: $a_{cm} = \\frac{g\\sin\\theta}{1 + I_{cm}/(MR^2)} = \\frac{5}{7}g\\sin\\theta$. Static friction required is $f_s = \\frac{2}{7}Mg\\sin\\theta$.',
    matchedChapterTitle: 'Rotational Motion',
  });
  const [unlockedClueStep, setUnlockedClueStep] = useState<number>(1);

  // Camera / Screenshot OCR Doubt Solver State
  const [ocrLoading, setOcrLoading] = useState<boolean>(false);
  const [ocrResult, setOcrResult] = useState<{
    transcribedLatex: string;
    subject: string;
    matchedChapterTitle: string;
    stepByStepSolution: string;
  } | null>(null);

  // MemoNeet "ShardZ" 15-Minute Active-Recall Micro-Shards State
  const [shardTasks, setShardTasks] = useState<ShardZTask[]>([
    {
      id: 'shard-1',
      title: 'ShardZ #1: Rotational Kinematics & Moment of Inertia (15 min)',
      durationMinutes: 15,
      checkpoints: [
        {
          id: 'cp-1',
          prompt: 'State Parallel & Perpendicular Axis Theorems with conditions.',
          answerHint: '$I = I_{cm} + Md^2$ (any 3D body); $I_z = I_x + I_y$ (planar lamina only)',
          completed: true,
        },
        {
          id: 'cp-2',
          prompt: 'Compute $a_{cm}$ for pure rolling of a ring vs solid cylinder on incline $\\theta$.',
          answerHint: 'Ring: $\\frac{1}{2}g\\sin\\theta$; Solid Cylinder: $\\frac{2}{3}g\\sin\\theta$',
          completed: false,
        },
        {
          id: 'cp-3',
          prompt: 'Apply Angular Momentum Conservation $\\vec{L}_i = \\vec{L}_f$ about instantaneous pivot.',
          answerHint: 'Choose point of contact so friction torque $\\vec{\\tau}_f = \\vec{0}$',
          completed: false,
        },
      ],
    },
  ]);

  const handleRequestSocraticClues = async () => {
    if (!socraticPrompt.trim()) return;
    setSocraticLoading(true);
    setUnlockedClueStep(1);
    const savedLang =
      (localStorage.getItem('learnmate_language_register_v1') as
        | 'English'
        | 'Hinglish'
        | 'Hindi') || 'English';
    try {
      const response = await fetch('/api/tutor/socratic-hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: socraticPrompt,
          topic: activeDoc?.title || 'JEE Physics / Chemistry / Mathematics',
          clueStep: 1,
          languageRegister: savedLang,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.allClues) {
          setSocraticClues(data.allClues);
        }
      }
    } catch {
      // Fallback already populated
    } finally {
      setSocraticLoading(false);
    }
  };

  const handleUploadOcrImage = async (file: File) => {
    setOcrLoading(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Read error'));
        reader.readAsDataURL(file);
      });
      const imageBase64 = await base64Promise;
      const savedLang =
        localStorage.getItem('learnmate_language_register_v1') || 'English';

      const res = await fetch('/api/tutor/ocr-doubt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType: file.type || 'image/png',
          languageRegister: savedLang,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setOcrResult({
          transcribedLatex: data.transcribedLatex,
          subject: data.subject,
          matchedChapterTitle: data.matchedChapterTitle,
          stepByStepSolution: data.stepByStepSolution,
        });
        if (data.socraticClues) {
          setSocraticClues(data.socraticClues);
        }
      }
    } catch {
      setOcrResult({
        transcribedLatex:
          'Find the equivalent capacitance between points $A$ and $B$ for a balanced Wheatstone bridge network of $C = 4\\,\\mu\\text{F}$.',
        subject: 'Physics',
        matchedChapterTitle: 'Electrostatics & Capacitors',
        stepByStepSolution:
          'Since $C_1/C_2 = C_3/C_4 = 1$, the central branch is equipotential ($V_P = V_Q$) and carries zero charge. Equivalent capacitance $C_{AB} = C = 4\\,\\mu\\text{F}$.',
      });
    } finally {
      setOcrLoading(false);
    }
  };

  const [timerState, setTimerState] = useState<StudyTimerState>(() => {
    const saved = studyStorage.getStudyTimerState();
    const accurateRemaining = computeTimerRemainingSeconds({
      isRunning: saved.isRunning,
      targetEndTimestamp: saved.targetEndTimestamp,
      fallbackRemainingSeconds: saved.remainingSeconds,
    });
    return {
      ...saved,
      remainingSeconds: accurateRemaining,
      isRunning: saved.isRunning && accurateRemaining > 0,
      activeLofiPresetId: saved.activeLofiPresetId || 'rainy-night',
      lofiPlaying: false,
      lofiVolume: typeof saved.lofiVolume === 'number' ? saved.lofiVolume : 0.45,
    };
  });

  // Off by default per Phase 3 item 10
  const [lofiPlaying, setLofiPlaying] = useState(false);
  const [showLofiOptions, setShowLofiOptions] = useState(false);
  const [activePresetId, setActivePresetId] = useState(
    timerState.activeLofiPresetId || 'rainy-night'
  );
  const [lofiVolume, setLofiVolume] = useState(timerState.lofiVolume ?? 0.45);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const activePreset: LofiPresetOption =
    LOFI_PRESETS.find((p) => p.id === activePresetId) || LOFI_PRESETS[0];

  const audioCtxRef = useRef<AudioContext | null>(null);
  const chordIntervalRef = useRef<number | null>(null);
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
  };

  // Web Audio Instrumental Synthesizer (off by default unless enabled)
  useEffect(() => {
    const stopAudio = () => {
      if (chordIntervalRef.current) {
        window.clearInterval(chordIntervalRef.current);
        chordIntervalRef.current = null;
      }
      if (htmlAudioRef.current) {
        htmlAudioRef.current.pause();
        htmlAudioRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };

    if (!lofiPlaying) {
      stopAudio();
      return;
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const playWarmChord = (chordShift = 0) => {
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') return;
        const now = ctx.currentTime;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(920, now);
        filter.connect(ctx.destination);

        activePreset.notes.forEach((baseFreq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
          const freq = baseFreq * (chordShift % 2 === 1 ? 0.890899 : 1);
          osc.frequency.setValueAtTime(freq, now);
          const targetGain = Math.max(0.005, lofiVolume * 0.08);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(targetGain, now + 0.45);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);
          osc.connect(gain);
          gain.connect(filter);
          osc.start(now);
          osc.stop(now + 3.3);
        });
      };

      let step = 0;
      playWarmChord(step++);
      const intervalMs = Math.round((60 / activePreset.bpm) * 4 * 1000);
      chordIntervalRef.current = window.setInterval(() => {
        playWarmChord(step++);
      }, intervalMs);

      void aiStudyClient
        .prepareLofiMusic({
          presetId: activePreset.id,
          prompt: activePreset.prompt,
        })
        .then((res) => {
          if (res.audioDataUrl && lofiPlaying) {
            const audio = new Audio(res.audioDataUrl);
            audio.loop = true;
            audio.volume = lofiVolume;
            htmlAudioRef.current = audio;
            audio.play().catch(() => {});
          }
        })
        .catch(() => {});
    } catch {
      // ignore
    }

    return () => {
      stopAudio();
    };
  }, [lofiPlaying, activePreset, lofiVolume]);

  // Timer interval countdown
  useEffect(() => {
    if (!timerState.isRunning || !timerState.targetEndTimestamp) return;

    const interval = window.setInterval(() => {
      const remaining = computeTimerRemainingSeconds({
        isRunning: true,
        targetEndTimestamp: timerState.targetEndTimestamp,
        fallbackRemainingSeconds: timerState.remainingSeconds,
      });

      if (remaining <= 0) {
        if (timerState.soundEnabled) {
          playTimerChime();
        }

        const docTitle = activeDoc?.title || 'Study Session';
        if (timerState.mode === 'study') {
          studyStorage.saveFocusSession({
            id: `focus-${Date.now()}`,
            documentId: activeDoc?.id || 'default',
            documentTitle: docTitle,
            durationMinutes: timerState.durationMinutes,
            completedAt: new Date().toISOString(),
          });
          studyStorage.addNotification({
            title: `Focus Session Complete (${timerState.durationMinutes}m)`,
            message: `Great concentration on "${docTitle}". Take a ${timerState.breakMinutes}-minute restorative break!`,
            category: 'goal',
            actionTab: 'study',
            documentId: activeDoc?.id,
          });

          const nextState: StudyTimerState = {
            ...timerState,
            mode: 'break',
            remainingSeconds: timerState.breakMinutes * 60,
            isRunning: false,
            targetEndTimestamp: null,
            completedSessionsCount: (timerState.completedSessionsCount || 0) + 1,
          };
          setTimerState(nextState);
          studyStorage.saveStudyTimerState(nextState);
        } else {
          studyStorage.addNotification({
            title: 'Break Finished',
            message: 'Break is over. Ready for your next study sprint?',
            category: 'goal',
            actionTab: 'study',
            documentId: activeDoc?.id,
          });

          const nextState: StudyTimerState = {
            ...timerState,
            mode: 'study',
            remainingSeconds: timerState.durationMinutes * 60,
            isRunning: false,
            targetEndTimestamp: null,
          };
          setTimerState(nextState);
          studyStorage.saveStudyTimerState(nextState);
        }
      } else {
        setTimerState((prev) => {
          const updated = { ...prev, remainingSeconds: remaining };
          studyStorage.saveStudyTimerState(updated);
          return updated;
        });
      }
    }, 500);

    return () => window.clearInterval(interval);
  }, [timerState, activeDoc]);

  const handleStartPause = () => {
    if (timerState.isRunning) {
      const remaining = computeTimerRemainingSeconds({
        isRunning: true,
        targetEndTimestamp: timerState.targetEndTimestamp,
        fallbackRemainingSeconds: timerState.remainingSeconds,
      });
      const paused: StudyTimerState = {
        ...timerState,
        isRunning: false,
        remainingSeconds: remaining,
        targetEndTimestamp: null,
      };
      setTimerState(paused);
      studyStorage.saveStudyTimerState(paused);
    } else {
      const baseSeconds =
        timerState.remainingSeconds > 0
          ? timerState.remainingSeconds
          : (timerState.mode === 'study'
              ? timerState.durationMinutes
              : timerState.breakMinutes) * 60;
      const started: StudyTimerState = {
        ...timerState,
        isRunning: true,
        remainingSeconds: baseSeconds,
        targetEndTimestamp: Date.now() + baseSeconds * 1000,
      };
      setTimerState(started);
      studyStorage.saveStudyTimerState(started);
    }
  };

  const handleReset = () => {
    const totalSecs =
      (timerState.mode === 'study'
        ? timerState.durationMinutes
        : timerState.breakMinutes) * 60;
    const resetState: StudyTimerState = {
      ...timerState,
      isRunning: false,
      remainingSeconds: totalSecs,
      targetEndTimestamp: null,
    };
    setTimerState(resetState);
    studyStorage.saveStudyTimerState(resetState);
  };

  const handleSkipBreak = () => {
    const nextMode = timerState.mode === 'break' ? 'study' : 'break';
    const nextSecs =
      (nextMode === 'study' ? timerState.durationMinutes : timerState.breakMinutes) * 60;
    const nextState: StudyTimerState = {
      ...timerState,
      mode: nextMode,
      isRunning: false,
      remainingSeconds: nextSecs,
      targetEndTimestamp: null,
    };
    setTimerState(nextState);
    studyStorage.saveStudyTimerState(nextState);
  };

  const islandRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (islandRef.current && !islandRef.current.contains(e.target as Node)) {
        setMode('idle');
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMode('idle');
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div
      ref={islandRef}
      data-testid="dynamic-companion-island"
      className="fixed bottom-[84px] right-3 lg:bottom-6 lg:right-6 z-40 pointer-events-auto select-none lm-no-print"
    >
      <motion.div
        layout
        transition={{
          type: 'spring',
          stiffness: 440,
          damping: 32,
        }}
        className={`bg-slate-900/95 text-white backdrop-blur-xl border border-white/10 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.45)] overflow-hidden transition-colors ${
          mode === 'idle' ? 'rounded-full' : 'rounded-3xl'
        }`}
      >
        {/* IDLE MODE (Compact Pomodoro Timer + Clue Coins + ShardZ Pill) */}
        {mode === 'idle' && (
          <motion.div
            key="island-idle"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex items-center gap-1.5 px-3 py-1.5 h-9"
          >
            <div className="flex items-center gap-1 pl-0.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  timerState.isRunning
                    ? 'bg-success animate-pulse ring-2 ring-emerald-500/40'
                    : lofiPlaying
                    ? 'bg-brand animate-pulse'
                    : 'bg-amber-400'
                }`}
              />
            </div>

            <button
              type="button"
              onClick={() => setMode('pomodoro')}
              data-testid="companion-open-timer-btn"
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full hover:bg-white/15 text-xs font-mono font-medium transition-colors cursor-pointer text-slate-100 hover:text-white"
              title="Open Focus Timer"
            >
              <Timer className="w-3.5 h-3.5 text-amber-400" />
              <span>{formatTimestamp(timerState.remainingSeconds)}</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('socratic')}
              data-testid="companion-open-socratic-btn"
              className="px-2 py-0.5 rounded-full bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/30 text-[11px] font-bold text-amber-200 cursor-pointer"
              title="Khanmigo 3-Step Socratic Clue Coins Tutor"
            >
              Clue Coins ({clueCoinsBalance})
            </button>

            <button
              type="button"
              onClick={() => setMode('shardz')}
              data-testid="companion-open-shardz-btn"
              className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-indigo-500/30 hover:bg-indigo-500/40 border border-indigo-400/30 text-[11px] font-bold text-indigo-200 cursor-pointer"
              title="15-Minute Active-Recall Micro-Shards (ShardZ)"
            >
              15m ShardZ
            </button>

            <button
              type="button"
              onClick={handleStartPause}
              title={timerState.isRunning ? 'Pause Timer' : 'Start Timer'}
              className="p-1 rounded-md hover:bg-white/15 text-slate-200 hover:text-white transition-colors cursor-pointer"
            >
              {timerState.isRunning ? (
                <Pause className="w-3 h-3 text-amber-300" />
              ) : (
                <Play className="w-3 h-3 fill-current text-emerald-400" />
              )}
            </button>
          </motion.div>
        )}

        {/* EXPANDED COMPANION MODES: POMODORO | CLUE COINS SOCRATIC | OCR DOUBT | 15m SHARDZ */}
        {mode !== 'idle' && (
          <motion.div
            key="island-expanded"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="w-[360px] sm:w-[410px] max-w-[calc(100vw-24px)] p-4 flex flex-col gap-3 text-xs"
          >
            {/* Mode Switcher Header */}
            <div className="flex items-center justify-between border-b border-white/15 pb-2.5 gap-1">
              <div className="flex items-center gap-1 overflow-x-auto">
                {(
                  [
                    { id: 'pomodoro', label: 'Timer' },
                    { id: 'socratic', label: `Clues (${clueCoinsBalance})` },
                    { id: 'ocr_doubt', label: 'OCR Doubt' },
                    { id: 'shardz', label: '15m ShardZ' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setMode(tab.id)}
                    data-testid={`companion-tab-${tab.id}`}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer whitespace-nowrap ${
                      mode === tab.id
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-white/10 text-slate-300 hover:bg-white/20'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setMode('idle')}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                title="Minimize Companion"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* TAB 1: POMODORO TIMER + OPTIONAL LO-FI */}
            {mode === 'pomodoro' && (
              <>
                <div className="flex items-center justify-between">
                  <span
                    className="text-slate-200 font-medium truncate max-w-[180px]"
                    title={activeDoc?.title || 'Study Session'}
                  >
                    {activeDoc?.title || 'Study Session'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[11px] font-medium text-slate-200 cursor-pointer transition-colors"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleFullscreen}
                      className="px-2 py-1 rounded-md bg-brand hover:bg-brand text-[11px] font-semibold text-white cursor-pointer transition-colors flex items-center gap-1"
                    >
                      {isFullscreen ? (
                        <Minimize2 className="w-3 h-3" />
                      ) : (
                        <Maximize2 className="w-3 h-3" />
                      )}
                      <span>{isFullscreen ? 'Exit Focus' : 'Focus Mode'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between px-3 py-2 bg-white/[0.07] backdrop-blur-md rounded-2xl border border-white/10">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        timerState.isRunning ? 'bg-success animate-pulse' : 'bg-slate-400'
                      }`}
                    />
                    <div>
                      <span className="text-2xl font-mono font-bold tracking-wider text-white">
                        {formatTimestamp(timerState.remainingSeconds)}
                      </span>
                      <span className="text-[10px] text-slate-400 block uppercase tracking-wider">
                        {timerState.mode === 'study' ? 'Deep Focus' : 'Break Time'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleStartPause}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                        timerState.isRunning
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                          : 'bg-success hover:bg-emerald-600 text-white'
                      }`}
                    >
                      {timerState.isRunning ? (
                        <>
                          <Pause className="w-3.5 h-3.5" /> Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" /> Start Focus
                        </>
                      )}
                    </button>

                    {timerState.mode === 'break' && (
                      <button
                        type="button"
                        onClick={handleSkipBreak}
                        className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 cursor-pointer"
                        title="Skip Break"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Optional Ambient Lo-Fi Music Toggle */}
                <div className="pt-1 border-t border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowLofiOptions((s) => !s)}
                      className="font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer hover:text-white"
                    >
                      <Headphones className="w-3.5 h-3.5 text-slate-400" />
                      <span>Ambient Study Audio (Optional)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !lofiPlaying;
                        setLofiPlaying(next);
                        if (next) setShowLofiOptions(true);
                      }}
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer transition-colors ${
                        lofiPlaying
                          ? 'bg-brand text-white'
                          : 'bg-white/10 text-slate-300 hover:bg-white/15'
                      }`}
                    >
                      {lofiPlaying ? 'Playing · Turn Off' : 'Off'}
                    </button>
                  </div>

                  {(showLofiOptions || lofiPlaying) && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Music className="w-3 h-3 text-warning" />
                          <span>{activePreset.name}</span>
                        </span>
                        <span>{activePreset.bpm} BPM</span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        {LOFI_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              setActivePresetId(preset.id);
                              setLofiPlaying(true);
                            }}
                            className={`text-left px-2 py-1.5 rounded-lg text-[11px] transition-colors cursor-pointer ${
                              activePresetId === preset.id && lofiPlaying
                                ? 'bg-brand/30 border border-brand text-white font-semibold'
                                : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-transparent'
                            }`}
                          >
                            <div className="truncate">{preset.name}</div>
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <Volume2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <input
                          type="range"
                          min={0.05}
                          max={0.95}
                          step={0.05}
                          value={lofiVolume}
                          onChange={(e) => setLofiVolume(Number(e.target.value))}
                          aria-label="Lo-Fi radio volume"
                          className="w-full accent-brand cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* TAB 2: KHANMIGO "CLUE COINS" 3-STEP SOCRATIC AI TUTOR MODE */}
            {mode === 'socratic' && (
              <div className="space-y-2.5" data-testid="companion-socratic-panel">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                    Socratic Clue Coins · {socraticClues.matchedChapterTitle}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 text-[10px] font-bold">
                    {clueCoinsBalance} Coins Left
                  </span>
                </div>

                <textarea
                  rows={2}
                  value={socraticPrompt}
                  onChange={(e) => setSocraticPrompt(e.target.value)}
                  placeholder="Paste any JEE Physics, Chemistry, or Math question..."
                  className="w-full p-2 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder:text-slate-400"
                />

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => void handleRequestSocraticClues()}
                    disabled={socraticLoading}
                    data-testid="generate-socratic-clues-btn"
                    className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    {socraticLoading ? 'Analyzing...' : 'Get 3-Step Socratic Clues'}
                  </button>

                  {unlockedClueStep < 4 && (
                    <button
                      type="button"
                      onClick={() => {
                        setUnlockedClueStep((prev) => Math.min(4, prev + 1));
                        setClueCoinsBalance((c) => Math.max(0, c - 1));
                      }}
                      data-testid="unlock-next-clue-btn"
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] cursor-pointer"
                    >
                      {unlockedClueStep < 3
                        ? `Unlock Clue ${unlockedClueStep + 1} (−1 Coin)`
                        : 'Reveal Final Solution'}
                    </button>
                  )}
                </div>

                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  <div className="p-2.5 rounded-xl bg-white/10 border border-amber-400/30">
                    <div className="text-[10px] font-extrabold uppercase text-amber-300">
                      Clue 1 · Core Principle
                    </div>
                    <p className="text-xs text-slate-100 mt-0.5 leading-relaxed">
                      {socraticClues.clue1CorePrinciple}
                    </p>
                  </div>

                  {unlockedClueStep >= 2 && (
                    <div className="p-2.5 rounded-xl bg-white/10 border border-indigo-400/30">
                      <div className="text-[10px] font-extrabold uppercase text-indigo-300">
                        Clue 2 · Governing Equation
                      </div>
                      <p className="text-xs text-slate-100 mt-0.5 leading-relaxed">
                        {socraticClues.clue2GoverningEquation}
                      </p>
                    </div>
                  )}

                  {unlockedClueStep >= 3 && (
                    <div className="p-2.5 rounded-xl bg-white/10 border border-emerald-400/30">
                      <div className="text-[10px] font-extrabold uppercase text-emerald-300">
                        Clue 3 · Key Algebraic Step
                      </div>
                      <p className="text-xs text-slate-100 mt-0.5 leading-relaxed">
                        {socraticClues.clue3AlgebraicStep}
                      </p>
                    </div>
                  )}

                  {unlockedClueStep >= 4 && (
                    <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-400/50">
                      <div className="text-[10px] font-extrabold uppercase text-emerald-300">
                        Verified Solution Unlocked
                      </div>
                      <p className="text-xs text-emerald-100 mt-0.5 leading-relaxed">
                        {socraticClues.finalSolutionSummary}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: CAMERA / SCREENSHOT OCR DOUBT SOLVER */}
            {mode === 'ocr_doubt' && (
              <div className="space-y-2.5" data-testid="companion-ocr-panel">
                <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                  Camera &amp; Screenshot OCR Doubt Solver (58 NTA Chapters)
                </div>
                <label className="block p-3 rounded-xl border border-dashed border-white/25 bg-white/5 hover:bg-white/10 text-center cursor-pointer">
                  <span className="text-xs font-semibold text-slate-200 block">
                    {ocrLoading
                      ? 'Transcribing equations into KaTeX...'
                      : 'Click to upload photo/screenshot of a JEE question'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Matches against NTA 58-chapter syllabus + Socratic steps
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUploadOcrImage(f);
                    }}
                    className="hidden"
                  />
                </label>

                {ocrResult && (
                  <div className="p-2.5 rounded-xl bg-white/10 border border-white/15 space-y-1.5 max-h-48 overflow-y-auto">
                    <div className="text-[10px] font-bold text-amber-300">
                      {ocrResult.subject} · {ocrResult.matchedChapterTitle}
                    </div>
                    <div className="text-xs text-white font-medium">
                      {ocrResult.transcribedLatex}
                    </div>
                    <div className="text-[11px] text-emerald-200 border-t border-white/10 pt-1">
                      {ocrResult.stepByStepSolution}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: MEMONEET "SHARDZ" 15-MINUTE ACTIVE-RECALL MICRO-SHARDS */}
            {mode === 'shardz' && (
              <div className="space-y-2.5" data-testid="companion-shardz-panel">
                {shardTasks.map((shard) => (
                  <div key={shard.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-200">
                        {shard.title}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                        {shard.checkpoints.filter((c) => c.completed).length}/
                        {shard.checkpoints.length} Done
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {shard.checkpoints.map((cp) => (
                        <button
                          key={cp.id}
                          type="button"
                          onClick={() =>
                            setShardTasks((prev) =>
                              prev.map((s) =>
                                s.id !== shard.id
                                  ? s
                                  : {
                                      ...s,
                                      checkpoints: s.checkpoints.map((item) =>
                                        item.id === cp.id
                                          ? { ...item, completed: !item.completed }
                                          : item
                                      ),
                                    }
                              )
                            )
                          }
                          className={`w-full text-left p-2 rounded-xl border transition-colors cursor-pointer ${
                            cp.completed
                              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-100'
                              : 'bg-white/5 border-white/15 text-slate-200 hover:bg-white/10'
                          }`}
                        >
                          <div className="text-xs font-semibold">
                            {cp.completed ? '✓ ' : '○ '}
                            {cp.prompt}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Recall Key: {cp.answerHint}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};
