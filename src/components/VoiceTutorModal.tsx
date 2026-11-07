import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  X,
  Send,
  Volume2,
  VolumeX,
  Keyboard,
  PhoneOff,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import type { StudyDocument, VoiceTurn } from '../types/study';
import { MathText } from './MathText';
import { aiStudyClient } from '../services/aiClient';
import { storageService } from '../services/storageService';
import {
  assembleStudentSpeechTranscript,
  formatSpokenTextForTts,
  extractSpeechUnitsFromStream,
  shouldAcceptTurnEvent,
  shouldProcessSpeechRecognitionResult,
  computeSilenceTimeoutMs,
  canAcceptSessionCallback,
} from '../utils/stabilityEngine';

interface VoiceTutorModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDocument: StudyDocument;
  weakTopics: string[];
  onNavigateToCitation?: (pageNumber: number, quote?: string) => void;
}

export type VoiceControlState = 'idle' | 'listening' | 'thinking' | 'speaking';

export const VoiceTutorModal: React.FC<VoiceTutorModalProps> = ({
  isOpen,
  onClose,
  activeDocument: studyDoc,
  weakTopics: _weakTopics,
  onNavigateToCitation,
}) => {
  // Voice state: 'idle' | 'listening' | 'thinking' | 'speaking'
  const [voiceState, setVoiceState] = useState<VoiceControlState>('idle');
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [isTutorAudioMuted, setIsTutorAudioMuted] = useState<boolean>(false);
  const [showKeyboardInput, setShowKeyboardInput] = useState<boolean>(false);
  const [typedInput, setTypedInput] = useState<string>('');
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);

  // Audio energy visualizers
  const [micEnergy, setMicEnergy] = useState<number>(0);
  const [tutorEnergy, setTutorEnergy] = useState<number>(0);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  // Full Persistent Conversation History
  const [conversation, setConversation] = useState<VoiceTurn[]>([]);

  // ---------------------------------------------------------------------------
  // SESSION LIFECYCLE REFS
  // ---------------------------------------------------------------------------
  const isSessionActiveRef = useRef<boolean>(false);
  const sessionEpochRef = useRef<number>(0);
  const turnSequenceIdRef = useRef<number>(0);
  const isTurnActiveRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Speaker Echo Gate & Cooldown
  const isPlaybackActiveRef = useRef<boolean>(false);
  const recognitionSuspendedRef = useRef<boolean>(false);
  const playbackFinishedAtRef = useRef<number>(0);
  const cooldownTimeoutRef = useRef<number | null>(null);

  // Speech Recognition Tracking
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const isStartingRecRef = useRef<boolean>(false);
  const activeStudentTurnIdRef = useRef<string | null>(null);
  const committedSpeechRef = useRef<string>('');
  const interimSpeechRef = useRef<string>('');
  const silenceTimerRef = useRef<number | null>(null);

  // TTS Speech Queue Tracking
  const ttsQueueRef = useRef<Array<{ text: string; turnSeq: number; epoch: number }>>([]);
  const isTtsSpeakingRef = useRef<boolean>(false);
  const isFirstSpeechUnitRef = useRef<boolean>(true);
  const synthIntervalRef = useRef<number | null>(null);
  const historyContainerRef = useRef<HTMLDivElement | null>(null);

  const isMicMutedRef = useRef(isMicMuted);
  const isTutorAudioMutedRef = useRef(isTutorAudioMuted);
  const voiceStateRef = useRef(voiceState);

  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  // Reduced motion preference
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const updateVoiceState = useCallback((next: VoiceControlState) => {
    voiceStateRef.current = next;
    setVoiceState(next);
  }, []);

  // Auto-scroll transcript to bottom
  useEffect(() => {
    if (historyContainerRef.current) {
      const el = historyContainerRef.current;
      el.scrollTo({
        top: el.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [conversation]);

  // ---------------------------------------------------------------------------
  // SINGLE UNIFIED TEARDOWN PATH FOR ALL EXITS
  // (End session, Close X, Escape key, Unmount)
  // ---------------------------------------------------------------------------
  const teardownVoiceSession = useCallback(() => {
    // 1. Invalidate session epoch FIRST so all async callbacks are immediately dead
    isSessionActiveRef.current = false;
    sessionEpochRef.current += 1;
    turnSequenceIdRef.current += 1;
    isTurnActiveRef.current = false;

    // 2. Immediately stop audio playback and clear queue
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    ttsQueueRef.current = [];
    isTtsSpeakingRef.current = false;
    isPlaybackActiveRef.current = false;
    recognitionSuspendedRef.current = true;
    playbackFinishedAtRef.current = 0;

    // 3. Clear all timers and intervals
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (cooldownTimeoutRef.current) {
      clearTimeout(cooldownTimeoutRef.current);
      cooldownTimeoutRef.current = null;
    }
    if (synthIntervalRef.current) {
      clearInterval(synthIntervalRef.current);
      synthIntervalRef.current = null;
    }

    // 4. Abort streaming network request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 5. Abort microphone capture
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    isStartingRecRef.current = false;

    // 6. Reset visual state
    setMicEnergy(0);
    setTutorEnergy(0);
    updateVoiceState('idle');
  }, [updateVoiceState]);

  const teardownVoiceSessionRef = useRef(teardownVoiceSession);
  teardownVoiceSessionRef.current = teardownVoiceSession;

  // Speaker audio mute toggle
  useEffect(() => {
    isTutorAudioMutedRef.current = isTutorAudioMuted;
    if (isTutorAudioMuted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      ttsQueueRef.current = [];
      isTtsSpeakingRef.current = false;
      isPlaybackActiveRef.current = false;
      playbackFinishedAtRef.current = Date.now();
      if (synthIntervalRef.current) {
        clearInterval(synthIntervalRef.current);
        synthIntervalRef.current = null;
      }
      setTutorEnergy(0);
      if (voiceStateRef.current === 'speaking') {
        updateVoiceState('idle');
      }
    }
  }, [isTutorAudioMuted, updateVoiceState]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        teardownVoiceSessionRef.current();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load persistent conversation history on mount/document switch without replaying audio
  useEffect(() => {
    if (!isOpen) return;

    isSessionActiveRef.current = true;
    sessionEpochRef.current += 1;
    isPlaybackActiveRef.current = false;
    playbackFinishedAtRef.current = 0;

    const savedTurns = storageService.getVoiceTutorMessages(studyDoc.id);
    if (savedTurns && savedTurns.length > 0) {
      // Ensure all loaded turns are non-streaming and no audio is replayed
      setConversation(
        savedTurns.map((t: VoiceTurn) => ({
          ...t,
          isStreaming: false,
        }))
      );
    } else {
      const welcomeTurn: VoiceTurn = {
        id: `welcome-${studyDoc.id}`,
        role: 'assistant',
        text: `Hi! I'm LearnMate Buddy, your voice tutor for ${studyDoc.title.replace(
          /\.pdf$/i,
          ''
        )}. Tap the circle to ask me any doubt, formula, or concept from your notes!`,
        isStreaming: false,
        isFinal: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setConversation([welcomeTurn]);
      storageService.saveVoiceTutorMessages(studyDoc.id, [welcomeTurn]);
    }
  }, [isOpen, studyDoc.id, studyDoc.title]);

  /**
   * Suspends speech recognition safely to eliminate speaker echo at the source.
   */
  const suspendSpeechRecognition = useCallback(() => {
    recognitionSuspendedRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
    }
    setMicEnergy(0);
  }, []);

  /**
   * Starts Speech Recognition safely:
   * - Shows "Listening" ONLY when recognition is ready (onstart event).
   * - Captures student question from first words.
   * - Gated during playback and cooldown.
   */
  const startSpeechRecognition = useCallback(() => {
    if (!isSessionActiveRef.current || isMicMutedRef.current || isPlaybackActiveRef.current) {
      return;
    }
    if (isStartingRecRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecClass) {
      setMicPermissionError(
        'Speech recognition is not supported in this browser. Use the Type button below to ask questions.'
      );
      setShowKeyboardInput(true);
      updateVoiceState('idle');
      return;
    }

    try {
      isStartingRecRef.current = true;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }

      const currentEpoch = sessionEpochRef.current;
      const rec = new SpeechRecClass();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-IN';

      rec.onstart = () => {
        isStartingRecRef.current = false;
        if (!canAcceptSessionCallback({ isSessionActive: isSessionActiveRef.current, currentEpoch, expectedEpoch: sessionEpochRef.current })) {
          try { rec.abort(); } catch { /* ignore */ }
          return;
        }

        setMicPermissionError(null);
        recognitionSuspendedRef.current = false;

        // Show "Listening" ONLY when recognition is ready!
        if (!isPlaybackActiveRef.current && voiceStateRef.current !== 'thinking' && voiceStateRef.current !== 'speaking') {
          updateVoiceState('listening');
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (event: any) => {
        if (!canAcceptSessionCallback({ isSessionActive: isSessionActiveRef.current, currentEpoch, expectedEpoch: sessionEpochRef.current })) {
          return;
        }

        // Speaker-echo gating at source
        const decision = shouldProcessSpeechRecognitionResult({
          isPlaybackActive: isPlaybackActiveRef.current || recognitionSuspendedRef.current,
          playbackFinishedAt: playbackFinishedAtRef.current,
          now: Date.now(),
          cooldownMs: 600,
          turnSequenceId: turnSequenceIdRef.current,
          expectedTurnSequenceId: turnSequenceIdRef.current,
        });

        if (!decision.allowProcessing) {
          return;
        }

        if (isMicMutedRef.current) return;

        let newlyFinalizedChunk = '';
        let currentInterim = '';
        let hasFinalChunk = false;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            newlyFinalizedChunk += res[0].transcript + ' ';
            hasFinalChunk = true;
          } else {
            currentInterim += res[0].transcript;
          }
        }

        const assembled = assembleStudentSpeechTranscript({
          existingCommitted: committedSpeechRef.current,
          newFinalChunk: newlyFinalizedChunk,
          interimChunk: currentInterim,
        });

        committedSpeechRef.current = assembled.committed;
        interimSpeechRef.current = currentInterim;

        const displayParagraph = assembled.displayParagraph;
        if (!displayParagraph) return;

        setMicEnergy(0.65);

        // If no active student turn exists, create one in the conversation
        if (!activeStudentTurnIdRef.current) {
          const newStudentTurnId = `student-${Date.now()}`;
          activeStudentTurnIdRef.current = newStudentTurnId;

          setConversation((prev) => [
            ...prev,
            {
              id: newStudentTurnId,
              role: 'user',
              text: displayParagraph,
              isStreaming: true,
              isFinal: false,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        } else {
          const currentId = activeStudentTurnIdRef.current;
          setConversation((prev) =>
            prev.map((t) =>
              t.id === currentId
                ? { ...t, text: displayParagraph, isStreaming: true }
                : t
            )
          );
        }

        // Measure & reduce delay: compute optimal silence timeout
        const wordCount = displayParagraph.split(/\s+/).filter(Boolean).length;
        const silenceTimeoutMs = computeSilenceTimeoutMs({
          isFinal: hasFinalChunk,
          wordCount,
        });

        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        silenceTimerRef.current = window.setTimeout(() => {
          commitAndSubmitStudentTurnRef.current();
        }, silenceTimeoutMs);
      };

      rec.onerror = (e: { error?: string }) => {
        isStartingRecRef.current = false;
        if (!canAcceptSessionCallback({ isSessionActive: isSessionActiveRef.current, currentEpoch, expectedEpoch: sessionEpochRef.current })) {
          return;
        }

        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          setMicPermissionError(
            'Microphone access denied. Please allow microphone access or use the Type button below.'
          );
          setIsMicMuted(true);
          setShowKeyboardInput(true);
          updateVoiceState('idle');
        }
      };

      rec.onend = () => {
        isStartingRecRef.current = false;
        setMicEnergy(0);

        if (!canAcceptSessionCallback({ isSessionActive: isSessionActiveRef.current, currentEpoch, expectedEpoch: sessionEpochRef.current })) {
          return;
        }

        // If session is active and not in playback/cooldown, restart cleanly
        if (!isMicMutedRef.current && !isPlaybackActiveRef.current && !recognitionSuspendedRef.current) {
          try {
            rec.start();
          } catch {
            // ignore
          }
        }
      };

      rec.start();
      recognitionRef.current = rec;
    } catch {
      isStartingRecRef.current = false;
      setMicPermissionError('Could not start speech recognition. Please type below.');
      setShowKeyboardInput(true);
      updateVoiceState('idle');
    }
  }, [updateVoiceState]);

  const startSpeechRecognitionRef = useRef(startSpeechRecognition);
  startSpeechRecognitionRef.current = startSpeechRecognition;

  /**
   * Resumes recognition after Buddy's speech playback finishes and cooldown has passed.
   */
  const scheduleRecognitionResume = useCallback(() => {
    if (cooldownTimeoutRef.current) {
      clearTimeout(cooldownTimeoutRef.current);
    }

    const currentEpoch = sessionEpochRef.current;
    // 600ms cooldown to discard any acoustic reflections or buffered echo
    cooldownTimeoutRef.current = window.setTimeout(() => {
      if (!canAcceptSessionCallback({ isSessionActive: isSessionActiveRef.current, currentEpoch, expectedEpoch: sessionEpochRef.current })) {
        return;
      }
      if (isPlaybackActiveRef.current || isMicMutedRef.current) return;

      recognitionSuspendedRef.current = false;
      committedSpeechRef.current = '';
      interimSpeechRef.current = '';
      startSpeechRecognitionRef.current();
    }, 600);
  }, []);

  /**
   * Reliable Circle Interruption Handler:
   * Tapping the circle while Buddy is thinking or speaking immediately stops
   * playback and streaming, keeps the visible partial reply, and opens a fresh listening turn.
   */
  const handleCircleInterrupt = useCallback(() => {
    if (!isSessionActiveRef.current) return;

    // 1. Invalidate current turn sequence to reject stale SSE events
    isTurnActiveRef.current = false;
    turnSequenceIdRef.current += 1;

    // 2. Abort network fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 3. Immediately cancel browser speech synthesis & clear queue
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    ttsQueueRef.current = [];
    isTtsSpeakingRef.current = false;
    isPlaybackActiveRef.current = false;
    playbackFinishedAtRef.current = 0; // Bypassed because user explicitly tapped to interrupt

    if (synthIntervalRef.current) {
      clearInterval(synthIntervalRef.current);
      synthIntervalRef.current = null;
    }
    setTutorEnergy(0);

    // 4. Mark any ongoing assistant turn as interrupted in conversation
    setConversation((prev) => {
      const lastIdx = prev.length - 1;
      if (lastIdx >= 0 && prev[lastIdx].role === 'assistant' && prev[lastIdx].isStreaming) {
        const updated = [...prev];
        updated[lastIdx] = {
          ...updated[lastIdx],
          isStreaming: false,
          interrupted: true,
        };
        storageService.saveVoiceTutorMessages(studyDoc.id, updated);
        return updated;
      }
      return prev;
    });

    // 5. Open fresh listening turn
    recognitionSuspendedRef.current = false;
    committedSpeechRef.current = '';
    interimSpeechRef.current = '';
    activeStudentTurnIdRef.current = null;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // 6. Reset state to idle briefly while mic starts
    updateVoiceState('idle');

    if (!isMicMutedRef.current) {
      startSpeechRecognitionRef.current();
    }
  }, [studyDoc.id, updateVoiceState]);

  const handleCircleInterruptRef = useRef(handleCircleInterrupt);
  handleCircleInterruptRef.current = handleCircleInterrupt;

  /**
   * Sentence-by-Sentence Speech Synthesis Player:
   * Speaks early phrases as they arrive (~400-600ms latency) while keeping recognition suspended.
   */
  const playNextSentenceInQueue = useCallback(() => {
    const currentEpoch = sessionEpochRef.current;
    if (!canAcceptSessionCallback({ isSessionActive: isSessionActiveRef.current, currentEpoch, expectedEpoch: sessionEpochRef.current })) {
      ttsQueueRef.current = [];
      isTtsSpeakingRef.current = false;
      return;
    }

    if (isTutorAudioMutedRef.current || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      ttsQueueRef.current = [];
      isTtsSpeakingRef.current = false;
      isPlaybackActiveRef.current = false;
      playbackFinishedAtRef.current = Date.now();
      updateVoiceState('idle');
      scheduleRecognitionResume();
      return;
    }

    if (ttsQueueRef.current.length === 0) {
      isTtsSpeakingRef.current = false;
      isPlaybackActiveRef.current = false;
      playbackFinishedAtRef.current = Date.now();

      if (synthIntervalRef.current) {
        clearInterval(synthIntervalRef.current);
        synthIntervalRef.current = null;
      }
      setTutorEnergy(0);

      // Playback completed; schedule clean recognition resumption after cooldown
      updateVoiceState('idle');
      scheduleRecognitionResume();
      return;
    }

    const item = ttsQueueRef.current.shift();
    if (!item) return;

    // Check that this utterance belongs to the active turn sequence and session epoch
    if (item.turnSeq !== turnSequenceIdRef.current || item.epoch !== sessionEpochRef.current) {
      playNextSentenceInQueue();
      return;
    }

    const spokenText = item.text.trim();
    if (!spokenText) {
      playNextSentenceInQueue();
      return;
    }

    isTtsSpeakingRef.current = true;
    isPlaybackActiveRef.current = true;
    suspendSpeechRecognition();
    updateVoiceState('speaking');

    try {
      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find((v) => v.lang.startsWith('en-IN')) ||
        voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google'))) ||
        voices.find((v) => v.lang.startsWith('en')) ||
        null;
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => {
        if (!canAcceptSessionCallback({ isSessionActive: isSessionActiveRef.current, currentEpoch, expectedEpoch: sessionEpochRef.current })) {
          try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
          return;
        }

        if (synthIntervalRef.current) clearInterval(synthIntervalRef.current);
        let step = 0;
        synthIntervalRef.current = window.setInterval(() => {
          step++;
          const wave = 0.3 + 0.5 * Math.abs(Math.sin(step * 0.9));
          setTutorEnergy(isTutorAudioMutedRef.current ? 0 : wave);
        }, 75);
      };

      const finishAndNext = () => {
        if (synthIntervalRef.current) {
          clearInterval(synthIntervalRef.current);
          synthIntervalRef.current = null;
        }
        setTutorEnergy(0);

        if (canAcceptSessionCallback({ isSessionActive: isSessionActiveRef.current, currentEpoch, expectedEpoch: sessionEpochRef.current })) {
          playNextSentenceInQueue();
        }
      };

      utterance.onend = finishAndNext;
      utterance.onerror = finishAndNext;

      window.speechSynthesis.speak(utterance);
    } catch {
      playNextSentenceInQueue();
    }
  }, [scheduleRecognitionResume, suspendSpeechRecognition, updateVoiceState]);

  const playNextSentenceRef = useRef(playNextSentenceInQueue);
  playNextSentenceRef.current = playNextSentenceInQueue;

  const enqueueSentenceForTts = useCallback(
    (sentence: string, turnSeq: number) => {
      const currentEpoch = sessionEpochRef.current;
      if (!canAcceptSessionCallback({ isSessionActive: isSessionActiveRef.current, currentEpoch, expectedEpoch: sessionEpochRef.current })) {
        return;
      }

      const cleaned = formatSpokenTextForTts(sentence);
      if (!cleaned) return;

      ttsQueueRef.current.push({ text: cleaned, turnSeq, epoch: currentEpoch });
      if (!isTtsSpeakingRef.current) {
        playNextSentenceRef.current();
      }
    },
    []
  );

  /**
   * Submits student question to AI Tutor:
   * Streams answer deltas into transcript and speaks early speech units (~400ms).
   */
  const submitQuestionToTutor = useCallback(
    async (questionText: string) => {
      const cleanedQuestion = questionText.trim();
      if (!cleanedQuestion || !isSessionActiveRef.current) return;

      suspendSpeechRecognition();

      turnSequenceIdRef.current += 1;
      const currentTurnSeq = turnSequenceIdRef.current;
      const currentEpoch = sessionEpochRef.current;
      isTurnActiveRef.current = true;
      isFirstSpeechUnitRef.current = true;

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      updateVoiceState('thinking');

      const tutorTurnId = `tutor-${Date.now()}`;

      // Append assistant turn to conversation
      const newAssistantTurn: VoiceTurn = {
        id: tutorTurnId,
        role: 'assistant',
        text: '',
        isStreaming: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setConversation((prev) => {
        const next = [...prev, newAssistantTurn];
        storageService.saveVoiceTutorMessages(studyDoc.id, next);
        return next;
      });

      try {
        const historyContext = conversation
          .slice(-6)
          .map((c) => ({ role: c.role, content: c.text }));

        let accumulatedAnswer = '';
        let streamSentenceBuffer = '';

        const response = await aiStudyClient.askTutorStream(
          {
            title: studyDoc.title,
            pages: studyDoc.pages,
            question: cleanedQuestion,
            history: historyContext,
            isVoiceTutor: true,
            signal: abortController.signal,
          },
          (delta) => {
            if (!canAcceptSessionCallback({ isSessionActive: isSessionActiveRef.current, currentEpoch, expectedEpoch: sessionEpochRef.current })) {
              return;
            }
            if (!shouldAcceptTurnEvent(currentTurnSeq, turnSequenceIdRef.current, isTurnActiveRef.current)) {
              return;
            }

            accumulatedAnswer += delta;
            streamSentenceBuffer += delta;

            // Update transcript text live
            setConversation((prev) =>
              prev.map((t) =>
                t.id === tutorTurnId ? { ...t, text: accumulatedAnswer, isStreaming: true } : t
              )
            );

            // Extract early speech units (start speaking at first natural phrase/clause)
            const { units, remainder } = extractSpeechUnitsFromStream(
              streamSentenceBuffer,
              isFirstSpeechUnitRef.current,
              false
            );
            streamSentenceBuffer = remainder;

            if (units.length > 0) {
              isFirstSpeechUnitRef.current = false;
              for (const unit of units) {
                enqueueSentenceForTts(unit, currentTurnSeq);
              }
            }
          }
        );

        if (!canAcceptSessionCallback({ isSessionActive: isSessionActiveRef.current, currentEpoch, expectedEpoch: sessionEpochRef.current })) {
          return;
        }
        if (!shouldAcceptTurnEvent(currentTurnSeq, turnSequenceIdRef.current, isTurnActiveRef.current)) {
          return;
        }

        // Flush any remaining buffer text
        if (streamSentenceBuffer.trim()) {
          const { units } = extractSpeechUnitsFromStream(streamSentenceBuffer, isFirstSpeechUnitRef.current, true);
          for (const unit of units) {
            enqueueSentenceForTts(unit, currentTurnSeq);
          }
        }

        const finalAnswer = response.answer || accumulatedAnswer || 'I understand your doubt.';

        setConversation((prev) => {
          const updated = prev.map((t) =>
            t.id === tutorTurnId
              ? {
                  ...t,
                  text: finalAnswer,
                  citations: response.citations || [],
                  isStreaming: false,
                  isFinal: true,
                }
              : t
          );
          storageService.saveVoiceTutorMessages(studyDoc.id, updated);
          return updated;
        });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        if (!canAcceptSessionCallback({ isSessionActive: isSessionActiveRef.current, currentEpoch, expectedEpoch: sessionEpochRef.current })) {
          return;
        }
        if (!shouldAcceptTurnEvent(currentTurnSeq, turnSequenceIdRef.current, isTurnActiveRef.current)) {
          return;
        }

        const errMsg = err instanceof Error ? err.message : String(err);
        setConversation((prev) => {
          const updated = prev.map((t) =>
            t.id === tutorTurnId
              ? {
                  ...t,
                  text: errMsg.includes('sign in')
                    ? 'Please sign in to ask doubts to LearnMate Buddy.'
                    : `I encountered an issue answering: ${errMsg}`,
                  isStreaming: false,
                  isFinal: true,
                }
              : t
          );
          storageService.saveVoiceTutorMessages(studyDoc.id, updated);
          return updated;
        });

        isPlaybackActiveRef.current = false;
        playbackFinishedAtRef.current = Date.now();
        updateVoiceState('idle');
        scheduleRecognitionResume();
      }
    },
    [conversation, enqueueSentenceForTts, scheduleRecognitionResume, studyDoc.id, studyDoc.pages, studyDoc.title, suspendSpeechRecognition, updateVoiceState]
  );

  const submitQuestionRef = useRef(submitQuestionToTutor);
  submitQuestionRef.current = submitQuestionToTutor;

  /**
   * Finalizes student speech turn and submits to tutor. Commits exactly once.
   */
  const commitAndSubmitStudentTurn = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    const studentTurnId = activeStudentTurnIdRef.current;
    const recognizedText = [committedSpeechRef.current, interimSpeechRef.current]
      .filter(Boolean)
      .join(' ')
      .trim();

    activeStudentTurnIdRef.current = null;
    committedSpeechRef.current = '';
    interimSpeechRef.current = '';
    setMicEnergy(0);

    if (!recognizedText) {
      if (studentTurnId) {
        setConversation((prev) => prev.filter((t) => t.id !== studentTurnId));
      }
      return;
    }

    setConversation((prev) => {
      const updated = prev.map((t) =>
        t.id === studentTurnId
          ? { ...t, text: recognizedText, isStreaming: false, isFinal: true }
          : t
      );
      storageService.saveVoiceTutorMessages(studyDoc.id, updated);
      return updated;
    });

    void submitQuestionRef.current(recognizedText);
  }, [studyDoc.id]);

  const commitAndSubmitStudentTurnRef = useRef(commitAndSubmitStudentTurn);
  commitAndSubmitStudentTurnRef.current = commitAndSubmitStudentTurn;

  // Primary Voice Control Handler: Tap the circle
  const handleCircleClick = () => {
    if (voiceState === 'speaking' || voiceState === 'thinking') {
      // Tap circle to interrupt Buddy immediately
      handleCircleInterrupt();
    } else if (voiceState === 'listening') {
      // If student was talking, commit immediately without waiting for silence timer
      if (committedSpeechRef.current.trim() || interimSpeechRef.current.trim()) {
        commitAndSubmitStudentTurn();
      } else {
        // Toggle mic off
        setIsMicMuted(true);
        suspendSpeechRecognition();
        updateVoiceState('idle');
      }
    } else {
      // Idle: Tap to speak
      setIsMicMuted(false);
      startSpeechRecognition();
    }
  };

  // Submit typed question from keyboard bar
  const handleSendTyped = (textToSend?: string) => {
    const text = (textToSend ?? typedInput).trim();
    if (!text) return;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    activeStudentTurnIdRef.current = null;
    committedSpeechRef.current = '';
    interimSpeechRef.current = '';

    setTypedInput('');

    const userTurnId = `student-typed-${Date.now()}`;
    const userTurn: VoiceTurn = {
      id: userTurnId,
      role: 'user',
      text,
      isStreaming: false,
      isFinal: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setConversation((prev) => {
      const next = [...prev, userTurn];
      storageService.saveVoiceTutorMessages(studyDoc.id, next);
      return next;
    });

    void submitQuestionToTutor(text);
  };

  // Clear conversation history
  const handleClearHistory = () => {
    if (confirm('Clear voice conversation history with LearnMate Buddy?')) {
      handleCircleInterrupt();
      const resetTurn: VoiceTurn = {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        text: `Conversation cleared. I am ready for your next doubt on ${studyDoc.title.replace(
          /\.pdf$/i,
          ''
        )}!`,
        isStreaming: false,
        isFinal: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setConversation([resetTurn]);
      storageService.saveVoiceTutorMessages(studyDoc.id, [resetTurn]);
    }
  };

  // Handle Close / End session click
  const handleCloseSession = () => {
    teardownVoiceSession();
    onClose();
  };

  // Session lifecycle mount / unmount cleanup
  useEffect(() => {
    if (!isOpen) return;

    // Start recognition cleanly on open
    startSpeechRecognition();

    return () => {
      teardownVoiceSessionRef.current();
    };
  }, [isOpen, startSpeechRecognition]);

  // Compute live waveform bar heights (5 bars: outer to center to outer)
  const waveformHeights = useMemo(() => {
    if (reducedMotion) {
      if (voiceState === 'speaking') return [16, 26, 38, 26, 16];
      if (voiceState === 'listening') return [14, 22, 32, 22, 14];
      if (voiceState === 'thinking') return [12, 18, 26, 18, 12];
      return [10, 18, 28, 18, 10]; // resting
    }

    if (voiceState === 'speaking') {
      const e = Math.min(1, Math.max(0.1, tutorEnergy));
      return [
        Math.round(12 + 16 * e * 0.8),
        Math.round(18 + 24 * e * 0.9),
        Math.round(26 + 32 * e),
        Math.round(18 + 24 * e * 0.9),
        Math.round(12 + 16 * e * 0.8),
      ];
    }

    if (voiceState === 'listening') {
      const e = Math.min(1, Math.max(0.1, micEnergy));
      return [
        Math.round(12 + 12 * e),
        Math.round(18 + 18 * e),
        Math.round(28 + 24 * e),
        Math.round(18 + 18 * e),
        Math.round(12 + 12 * e),
      ];
    }

    if (voiceState === 'thinking') {
      return [14, 22, 32, 22, 14];
    }

    // Default resting heights
    return [10, 18, 28, 18, 10];
  }, [micEnergy, reducedMotion, tutorEnergy, voiceState]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 select-none">
      <div className="bg-white dark:bg-[#121A2E] rounded-3xl border border-slate-200/90 dark:border-[#26324F] shadow-2xl max-w-2xl w-full h-[88vh] max-h-[780px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* ============================================================ */}
        {/* 1. TOP HEADER (Matching attached mockup)                     */}
        {/* ============================================================ */}
        <header className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-[#26324F] bg-white dark:bg-[#121A2E] shrink-0">
          <div className="flex items-center gap-3.5">
            {/* Waveform Logo Badge */}
            <div className="w-10 h-10 rounded-2xl bg-[#EEF0FD] dark:bg-indigo-950/60 border border-indigo-100/90 dark:border-indigo-800/60 flex items-center justify-center text-indigo-700 dark:text-indigo-300 shadow-2xs shrink-0">
              <div className="flex items-center gap-[3px] h-5">
                <span className="w-[3px] h-2 bg-indigo-600 rounded-full" />
                <span className="w-[3px] h-3.5 bg-indigo-600 rounded-full" />
                <span className="w-[3px] h-5 bg-indigo-600 rounded-full" />
                <span className="w-[3px] h-3.5 bg-indigo-600 rounded-full" />
                <span className="w-[3px] h-2 bg-indigo-600 rounded-full" />
              </div>
            </div>

            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug tracking-tight">
                LearnMate Buddy
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-normal truncate max-w-[260px] sm:max-w-md">
                {studyDoc.title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleClearHistory}
              title="Reset conversation"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1A2440] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleCloseSession}
              aria-label="Close"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1A2440] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ============================================================ */}
        {/* 2. CENTERED HERO VOICE CONTROL (Matching attached mockup)    */}
        {/* ============================================================ */}
        <div className="py-5 sm:py-7 px-4 flex flex-col items-center justify-center border-b border-slate-100 dark:border-[#26324F] shrink-0 bg-white dark:bg-[#121A2E]">
          {/* Accessible Concentric Circle Button */}
          <div className="relative flex items-center justify-center">
            {/* Outer subtle ring */}
            <div
              className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full border border-indigo-100/90 dark:border-indigo-800/40 bg-[#F4F6FE] dark:bg-[#1A2440]/80 flex items-center justify-center transition-all ${
                voiceState === 'listening' ? 'ring-4 ring-indigo-100 dark:ring-indigo-900/40' : ''
              }`}
            >
              {/* Primary Interactive Circle */}
              <button
                type="button"
                onClick={handleCircleClick}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCircleClick();
                  }
                }}
                aria-label={
                  voiceState === 'speaking' || voiceState === 'thinking'
                    ? 'Tap the circle to interrupt Buddy'
                    : voiceState === 'listening'
                    ? 'Listening to student. Tap to submit or mute'
                    : 'Tap to speak'
                }
                className="w-18 h-18 sm:w-22 sm:h-22 rounded-full bg-[#E5E9FC] hover:bg-[#DCE1FB] dark:bg-indigo-900/40 dark:hover:bg-indigo-900/60 border border-indigo-200/70 dark:border-indigo-700/50 shadow-2xs flex items-center justify-center cursor-pointer transition-transform active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/40"
              >
                {/* 5 Audio Waveform Bars */}
                <div className="flex items-center gap-[3.5px] sm:gap-[4px] h-9 sm:h-10">
                  {waveformHeights.map((h, i) => (
                    <span
                      key={i}
                      className="w-[3px] sm:w-[3.5px] bg-indigo-700 dark:bg-indigo-400 rounded-full transition-all duration-150"
                      style={{
                        height: `${h}px`,
                      }}
                    />
                  ))}
                </div>
              </button>
            </div>
          </div>

          {/* Status Headline and Action Hint */}
          <div className="mt-3 text-center">
            <h3 className="text-base sm:text-lg font-bold text-indigo-900 dark:text-indigo-200 tracking-tight">
              {voiceState === 'speaking'
                ? 'Buddy is speaking'
                : voiceState === 'listening'
                ? 'Listening'
                : voiceState === 'thinking'
                ? 'Thinking...'
                : isMicMuted
                ? 'Microphone muted'
                : 'Tap to speak'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-normal">
              {voiceState === 'speaking'
                ? 'Tap the circle to interrupt'
                : voiceState === 'listening'
                ? 'Speak your question'
                : voiceState === 'thinking'
                ? 'Preparing answer...'
                : isMicMuted
                ? 'Unmute mic or type below'
                : 'Tap to speak'}
            </p>
          </div>

          {micPermissionError && (
            <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>{micPermissionError}</span>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* 3. SCROLLABLE LEFT-ALIGNED TRANSCRIPT (Matching mockup)      */}
        {/* ============================================================ */}
        <div
          ref={historyContainerRef}
          data-testid="voice-conversation-thread"
          className="flex-1 overflow-y-auto px-6 sm:px-8 py-5 space-y-6 bg-white dark:bg-[#0B1020]"
        >
          {conversation.map((turn) => {
            const isUser = turn.role === 'user';
            return (
              <div key={turn.id} className="text-left space-y-1 animate-in fade-in duration-150">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {isUser ? 'You' : 'Buddy'}
                </h4>
                {isUser ? (
                  <p className="text-sm sm:text-base text-slate-800 dark:text-slate-200 leading-relaxed font-normal">
                    {turn.text}
                    {turn.isStreaming && (
                      <span className="inline-block w-1.5 h-3.5 ml-1 bg-indigo-600 animate-pulse align-middle" />
                    )}
                  </p>
                ) : (
                  <div>
                    <div className="text-sm sm:text-base text-slate-800 dark:text-slate-200 leading-relaxed font-normal">
                      <MathText text={turn.text} />
                      {turn.isStreaming && (
                        <span className="inline-block w-1.5 h-3.5 ml-1 bg-indigo-600 animate-pulse align-middle" />
                      )}
                    </div>

                    {/* Clickable page citations formatted as Page X ↗ */}
                    {turn.citations && turn.citations.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-3">
                        {turn.citations.map((cit, cIdx) => (
                          <button
                            key={cIdx}
                            type="button"
                            onClick={() => {
                              if (onNavigateToCitation) {
                                onNavigateToCitation(cit.pageNumber, cit.quote);
                              }
                            }}
                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-semibold text-sm hover:underline cursor-pointer inline-flex items-center gap-1 transition-colors"
                          >
                            <span>Page {cit.pageNumber}</span>
                            <span className="text-xs">↗</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ============================================================ */}
        {/* 4. OPTIONAL KEYBOARD TEXT INPUT BAR                         */}
        {/* ============================================================ */}
        {showKeyboardInput && (
          <div className="px-6 py-3 bg-slate-50 dark:bg-[#1A2440] border-t border-slate-200 dark:border-[#26324F] shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendTyped();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={typedInput}
                onChange={(e) => setTypedInput(e.target.value)}
                placeholder="Type your question or doubt here..."
                className="flex-1 h-10 px-4 rounded-xl bg-white dark:bg-[#121A2E] border border-slate-300 dark:border-[#26324F] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all"
              />
              <button
                type="submit"
                disabled={!typedInput.trim()}
                className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

        {/* ============================================================ */}
        {/* 5. FOOTER: [Type] [Mute speaker] [End session] (Mockup)     */}
        {/* ============================================================ */}
        <footer className="px-6 py-4 bg-white dark:bg-[#121A2E] border-t border-slate-100 dark:border-[#26324F] grid grid-cols-3 gap-3 shrink-0">
          {/* Button 1: Type */}
          <button
            type="button"
            onClick={() => setShowKeyboardInput((k) => !k)}
            className={`py-2.5 px-3 rounded-2xl border text-sm font-medium transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs ${
              showKeyboardInput
                ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                : 'bg-white dark:bg-[#1A2440] text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-[#26324F] hover:bg-slate-50 dark:hover:bg-[#223055]'
            }`}
          >
            <Keyboard className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            <span>Type</span>
          </button>

          {/* Button 2: Mute speaker */}
          <button
            type="button"
            onClick={() => setIsTutorAudioMuted((m) => !m)}
            className={`py-2.5 px-3 rounded-2xl border text-sm font-medium transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs ${
              isTutorAudioMuted
                ? 'bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                : 'bg-white dark:bg-[#1A2440] text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-[#26324F] hover:bg-slate-50 dark:hover:bg-[#223055]'
            }`}
          >
            {isTutorAudioMuted ? (
              <VolumeX className="w-4 h-4 text-amber-700 dark:text-amber-300" />
            ) : (
              <Volume2 className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            )}
            <span>{isTutorAudioMuted ? 'Unmute' : 'Mute speaker'}</span>
          </button>

          {/* Button 3: End session */}
          <button
            type="button"
            onClick={handleCloseSession}
            className="py-2.5 px-3 rounded-2xl border border-slate-200/90 dark:border-[#26324F] bg-white dark:bg-[#1A2440] hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:border-rose-200 dark:hover:border-rose-900 hover:text-rose-700 dark:hover:text-rose-300 text-slate-700 dark:text-slate-200 text-sm font-medium transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
          >
            <PhoneOff className="w-4 h-4" />
            <span>End session</span>
          </button>
        </footer>
      </div>
    </div>
  );
};
