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

export type CompanionMode = 'idle' | 'pomodoro';

interface DynamicCompanionProps {
  activeDoc?: StudyDocument | null;
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
        {/* IDLE MODE (Compact Pomodoro Timer Pill) */}
        {mode === 'idle' && (
          <motion.div
            key="island-idle"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex items-center gap-2 px-3 py-1.5 h-9"
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
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full hover:bg-white/15 text-xs font-mono font-medium transition-colors cursor-pointer text-slate-100 hover:text-white"
              title="Open Focus Timer"
            >
              <Timer className="w-3.5 h-3.5 text-amber-400" />
              <span>{formatTimestamp(timerState.remainingSeconds)}</span>
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

        {/* POMODORO MODE (Focus Timer + Optional Lo-Fi Music off by default) */}
        {mode === 'pomodoro' && (
          <motion.div
            key="island-pomodoro"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="w-[340px] sm:w-[360px] max-w-[calc(100vw-24px)] p-4 flex flex-col gap-3 text-xs"
          >
            <div className="flex items-center justify-between border-b border-white/15 pb-2.5">
              <span
                className="text-slate-200 font-medium truncate max-w-[170px]"
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
                <button
                  type="button"
                  onClick={() => setMode('idle')}
                  className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Minimize Timer"
                >
                  <ChevronDown className="w-4 h-4" />
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

            {/* Optional Ambient Lo-Fi Music Toggle (Off by default) */}
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
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};
