import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Send,
  Square,
  RotateCcw,
  Trash2,
  BookOpen,
} from 'lucide-react';
import type {
  StudyDocument,
  VoiceTurn,
  StudentTutorContext,
  SourceControlMode,
} from '../types/study';
import { aiStudyClient } from '../services/aiClient';
import { studyStorage } from '../services/storageService';
import { LearnMateBuddyAvatar, type BuddyAvatarState } from './LearnMateBuddyAvatar';
import { MathText } from './MathText';
import {
  globalAudioRegistry,
  retrieveRelevantPagesForQuery,
  stopAllGlobalAudioAndSpeech,
  type VoiceSessionLifecycleState,
} from '../utils/phase6Engine';

interface VoiceTutorModalProps {
  isOpen: boolean;
  onClose: () => void;
  document?: StudyDocument;
  activeDocument?: StudyDocument;
  weakTopics?: string[];
  onJumpToPage?: (pageNumber: number) => void;
  onNavigateToCitation?: (pageNumber: number, quote?: string) => void;
  studentContext?: StudentTutorContext;
  sourceControlMode?: SourceControlMode;
}

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

function stripForSpeech(raw: string): string {
  return raw
    .replace(/\$\$[\s\S]*?\$\$/g, ' formula ')
    .replace(/\$[^$\n]+\$/g, ' expression ')
    .replace(/[`*_#>-]/g, ' ')
    .replace(/\[Page\s+\d+\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const VoiceTutorModal: React.FC<VoiceTutorModalProps> = ({
  isOpen,
  onClose,
  document: docProp,
  activeDocument,
  weakTopics,
  onJumpToPage: onJumpToPageProp,
  onNavigateToCitation,
  studentContext: studentContextProp,
  sourceControlMode = 'material_only',
}) => {
  const studyDoc = (docProp || activeDocument) as StudyDocument;
  const onJumpToPage =
    onJumpToPageProp ||
    (onNavigateToCitation ? (pageNum: number) => onNavigateToCitation(pageNum) : undefined);
  const studentContext: StudentTutorContext | undefined =
    studentContextProp ||
    (weakTopics && weakTopics.length > 0 ? { weakTopics } : undefined);
  const docId = studyDoc?.id || 'default-doc';

  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [lifecycleState, setLifecycleState] = useState<VoiceSessionLifecycleState>('IDLE');
  const [turns, setTurns] = useState<VoiceTurn[]>(() =>
    studyStorage.getVoiceTutorMessages(docId)
  );
  const [liveTranscript, setLiveTranscript] = useState('');
  const [textFallbackInput, setTextFallbackInput] = useState('');
  const [muted, setMuted] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [autoLoop, setAutoLoop] = useState(true);

  const recognitionRef = useRef<any>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const turnsEndRef = useRef<HTMLDivElement | null>(null);
  const autoLoopRef = useRef(autoLoop);
  const mutedRef = useRef(muted);
  const isOpenRef = useRef(isOpen);
  const sessionEpochRef = useRef(0);
  const lifecycleStateRef = useRef<VoiceSessionLifecycleState>('IDLE');

  const updateLifecycle = useCallback((next: VoiceSessionLifecycleState) => {
    lifecycleStateRef.current = next;
    globalAudioRegistry.transitionState(next);
    setLifecycleState(next);
  }, []);

  useEffect(() => {
    autoLoopRef.current = autoLoop;
  }, [autoLoop]);

  useEffect(() => {
    mutedRef.current = muted;
    if (muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        if (activeUtteranceRef.current) {
          activeUtteranceRef.current.onstart = null;
          activeUtteranceRef.current.onend = null;
          activeUtteranceRef.current.onerror = null;
          activeUtteranceRef.current = null;
        }
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
      setVoiceState((s) => (s === 'speaking' ? 'idle' : s));
      if (lifecycleStateRef.current === 'SPEAKING') {
        updateLifecycle('IDLE');
      }
    }
  }, [muted, updateLifecycle]);

  // Restore per-document voice conversation history when switching documents
  useEffect(() => {
    const saved = studyStorage.getVoiceTutorMessages(docId);
    setTurns(saved);
  }, [docId]);

  // Persist finalized turns per document
  useEffect(() => {
    const persistable = turns.filter((t) => !t.isStreaming && t.text.trim().length > 0);
    studyStorage.saveVoiceTutorMessages(docId, persistable);
  }, [turns, docId]);

  useEffect(() => {
    turnsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, liveTranscript]);

  /**
   * Deterministic teardown that transitions through ENDING -> ENDED,
   * detaches all utterance/recognition handlers, cancels window.speechSynthesis,
   * aborts active streams, and invalidates all in-flight session epochs.
   */
  const teardownVoiceSession = useCallback(
    (reason = 'end_voice_session', finalState: 'IDLE' | 'ENDED' = 'ENDED') => {
      lifecycleStateRef.current = 'ENDING';
      sessionEpochRef.current += 1;

      if (activeUtteranceRef.current) {
        try {
          activeUtteranceRef.current.onstart = null;
          activeUtteranceRef.current.onend = null;
          activeUtteranceRef.current.onerror = null;
        } catch {
          // ignore
        }
        activeUtteranceRef.current = null;
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.onstart = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          if (typeof recognitionRef.current.abort === 'function') {
            recognitionRef.current.abort();
          } else if (typeof recognitionRef.current.stop === 'function') {
            recognitionRef.current.stop();
          }
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }

      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort();
        } catch {
          // ignore
        }
        abortControllerRef.current = null;
      }

      stopAllGlobalAudioAndSpeech(reason);
      sessionEpochRef.current = globalAudioRegistry.getEpoch();
      lifecycleStateRef.current = finalState;
      setLifecycleState(finalState);
      setVoiceState('idle');
      setLiveTranscript('');
    },
    []
  );

  useEffect(() => {
    isOpenRef.current = isOpen;
    if (!isOpen) {
      teardownVoiceSession('modal_closed', 'ENDED');
    } else {
      const nextEpoch = globalAudioRegistry.beginSession('IDLE');
      sessionEpochRef.current = nextEpoch;
      lifecycleStateRef.current = 'IDLE';
      setLifecycleState('IDLE');
    }
  }, [isOpen, teardownVoiceSession]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(Boolean(SpeechRec));
    return () => {
      teardownVoiceSession('component_unmount', 'ENDED');
    };
  }, [teardownVoiceSession]);

  const stopSpeakingAndRecognition = useCallback(
    (reason = 'interrupt_turn') => {
      teardownVoiceSession(reason, 'IDLE');
    },
    [teardownVoiceSession]
  );

  const startListening = useCallback(() => {
    if (!isOpenRef.current) return;
    if (
      lifecycleStateRef.current === 'ENDING' ||
      lifecycleStateRef.current === 'ENDED'
    ) {
      // Starting a fresh turn explicitly re-opens the session
      lifecycleStateRef.current = 'CONNECTING';
    }
    setMicError(null);

    if (typeof window === 'undefined') return;
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setMicError('Browser voice recognition unavailable. Use the text bar below.');
      return;
    }

    // Cancel any ongoing speech or stream first so speaker playback never feeds into the mic
    stopSpeakingAndRecognition('start_listening_interrupt');
    const currentEpoch = globalAudioRegistry.beginSession('CONNECTING');
    sessionEpochRef.current = currentEpoch;
    lifecycleStateRef.current = 'CONNECTING';
    setLifecycleState('CONNECTING');

    try {
      const recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';
      globalAudioRegistry.registerRecognition(recognition);

      let collectedFinal = '';

      recognition.onstart = () => {
        if (
          !isOpenRef.current ||
          sessionEpochRef.current !== currentEpoch ||
          !globalAudioRegistry.isCallbackValid(currentEpoch)
        ) {
          try {
            recognition.abort();
          } catch {
            // ignore
          }
          return;
        }
        lifecycleStateRef.current = 'LISTENING';
        globalAudioRegistry.transitionState('LISTENING');
        setLifecycleState('LISTENING');
        setVoiceState('listening');
        setLiveTranscript('');
      };

      recognition.onresult = (event: any) => {
        if (
          !isOpenRef.current ||
          sessionEpochRef.current !== currentEpoch ||
          !globalAudioRegistry.isCallbackValid(currentEpoch)
        ) {
          return;
        }
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const piece = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            collectedFinal += piece + ' ';
          } else {
            interim += piece;
          }
        }
        setLiveTranscript((collectedFinal + interim).trim());
      };

      recognition.onerror = (event: any) => {
        if (sessionEpochRef.current !== currentEpoch) return;
        if (event.error && event.error !== 'no-speech' && event.error !== 'aborted') {
          setMicError(`Microphone notice (${event.error}). You can also type below.`);
        }
        setVoiceState('idle');
        updateLifecycle('IDLE');
      };

      recognition.onend = () => {
        if (
          !isOpenRef.current ||
          sessionEpochRef.current !== currentEpoch ||
          !globalAudioRegistry.isCallbackValid(currentEpoch)
        ) {
          return;
        }
        const finalSpoken = collectedFinal.trim();
        setLiveTranscript('');
        if (finalSpoken) {
          void handleProcessSpokenQuestion(finalSpoken, currentEpoch);
        } else {
          setVoiceState('idle');
          updateLifecycle('IDLE');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setMicError('Could not start microphone. Please use the text input below.');
      setVoiceState('idle');
      updateLifecycle('IDLE');
    }
  }, [stopSpeakingAndRecognition, updateLifecycle]);

  const speakResponse = useCallback(
    (text: string, epoch: number) => {
      if (
        !isOpenRef.current ||
        mutedRef.current ||
        sessionEpochRef.current !== epoch ||
        lifecycleStateRef.current === 'ENDING' ||
        lifecycleStateRef.current === 'ENDED' ||
        !globalAudioRegistry.isCallbackValid(epoch) ||
        typeof window === 'undefined' ||
        !('speechSynthesis' in window)
      ) {
        setVoiceState('idle');
        if (lifecycleStateRef.current !== 'ENDED') {
          updateLifecycle('IDLE');
        }
        return;
      }

      try {
        window.speechSynthesis.cancel();
        const cleanSpeech = stripForSpeech(text);
        if (!cleanSpeech) {
          setVoiceState('idle');
          updateLifecycle('IDLE');
          return;
        }

        const utterance = new SpeechSynthesisUtterance(cleanSpeech);
        utterance.lang = 'en-IN';
        utterance.rate = 1.04;
        utterance.pitch = 1.02;

        const voices = window.speechSynthesis.getVoices();
        const preferredVoice =
          voices.find((v) => v.lang.includes('en-IN') || v.name.includes('India')) ||
          voices.find((v) => v.lang.startsWith('en'));
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        utterance.onstart = () => {
          if (
            !isOpenRef.current ||
            sessionEpochRef.current !== epoch ||
            lifecycleStateRef.current === 'ENDING' ||
            lifecycleStateRef.current === 'ENDED' ||
            !globalAudioRegistry.isCallbackValid(epoch)
          ) {
            try {
              window.speechSynthesis.cancel();
            } catch {
              // ignore
            }
            return;
          }
          lifecycleStateRef.current = 'SPEAKING';
          globalAudioRegistry.transitionState('SPEAKING');
          setLifecycleState('SPEAKING');
          setVoiceState('speaking');
        };

        utterance.onend = () => {
          globalAudioRegistry.unregisterUtterance(utterance);
          if (activeUtteranceRef.current === utterance) {
            activeUtteranceRef.current = null;
          }
          if (
            !isOpenRef.current ||
            sessionEpochRef.current !== epoch ||
            lifecycleStateRef.current === 'ENDING' ||
            lifecycleStateRef.current === 'ENDED' ||
            !globalAudioRegistry.isCallbackValid(epoch)
          ) {
            return;
          }
          setVoiceState('idle');
          updateLifecycle('IDLE');
          if (autoLoopRef.current && isOpenRef.current) {
            const loopTimer = setTimeout(() => {
              if (
                isOpenRef.current &&
                autoLoopRef.current &&
                sessionEpochRef.current === epoch &&
                lifecycleStateRef.current !== 'ENDING' &&
                lifecycleStateRef.current !== 'ENDED'
              ) {
                startListening();
              }
            }, 350);
            globalAudioRegistry.registerTimer(loopTimer);
          }
        };

        utterance.onerror = () => {
          globalAudioRegistry.unregisterUtterance(utterance);
          if (activeUtteranceRef.current === utterance) {
            activeUtteranceRef.current = null;
          }
          if (sessionEpochRef.current !== epoch) return;
          setVoiceState('idle');
          if (lifecycleStateRef.current !== 'ENDED') {
            updateLifecycle('IDLE');
          }
        };

        activeUtteranceRef.current = utterance;
        globalAudioRegistry.registerUtterance(utterance);
        window.speechSynthesis.speak(utterance);
      } catch {
        setVoiceState('idle');
        if ((lifecycleStateRef.current as VoiceSessionLifecycleState) !== 'ENDED') {
          updateLifecycle('IDLE');
        }
      }
    },
    [startListening, updateLifecycle]
  );

  const handleProcessSpokenQuestion = async (questionText: string, epochOverride?: number) => {
    const trimmed = questionText.trim();
    if (!trimmed || !isOpenRef.current) return;

    const activeEpoch =
      epochOverride ??
      (sessionEpochRef.current || globalAudioRegistry.beginSession('CONNECTING'));
    sessionEpochRef.current = activeEpoch;
    lifecycleStateRef.current = 'CONNECTING';
    globalAudioRegistry.transitionState('CONNECTING');
    setLifecycleState('CONNECTING');

    const userTurnId = `v-user-${Date.now()}`;
    const assistantTurnId = `v-ai-${Date.now() + 1}`;
    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const userTurn: VoiceTurn = {
      id: userTurnId,
      role: 'user',
      text: trimmed,
      isFinal: true,
      timestamp: nowTime,
    };

    const streamingAssistantTurn: VoiceTurn = {
      id: assistantTurnId,
      role: 'assistant',
      text: '',
      isStreaming: true,
      isFinal: false,
      timestamp: nowTime,
    };

    setTurns((prev) => [...prev, userTurn, streamingAssistantTurn]);
    setVoiceState('thinking');

    const controller = new AbortController();
    abortControllerRef.current = controller;
    globalAudioRegistry.registerAbortController(controller);

    // Retrieve relevant pages for 60-page PDFs so Voice Tutor stays fast and page-accurate
    const retrieval = retrieveRelevantPagesForQuery(
      studyDoc.pages,
      trimmed,
      studentContext?.currentPage || 1,
      10
    );

    try {
      const historyPayload = turns
        .filter((t) => !t.isStreaming && t.text.trim())
        .slice(-6)
        .map((t) => ({ role: t.role, content: t.text }));

      let accumulatedText = '';
      const response = await aiStudyClient.askTutorStream(
        {
          title: studyDoc.title,
          pages: retrieval.selectedPages,
          question: trimmed,
          history: historyPayload,
          studentContext,
          sourceControlMode,
          isVoiceTutor: true,
          signal: controller.signal,
        },
        (delta) => {
          const curState = lifecycleStateRef.current as VoiceSessionLifecycleState;
          if (
            !isOpenRef.current ||
            sessionEpochRef.current !== activeEpoch ||
            curState === 'ENDING' ||
            curState === 'ENDED'
          ) {
            return;
          }
          accumulatedText += delta;
          const snapshot = accumulatedText;
          setTurns((prev) =>
            prev.map((t) => (t.id === assistantTurnId ? { ...t, text: snapshot } : t))
          );
        }
      );

      // Reject late completion if session was ended or interrupted
      const curStateAfter = lifecycleStateRef.current as VoiceSessionLifecycleState;
      if (
        !isOpenRef.current ||
        sessionEpochRef.current !== activeEpoch ||
        curStateAfter === 'ENDING' ||
        curStateAfter === 'ENDED' ||
        !globalAudioRegistry.isCallbackValid(activeEpoch)
      ) {
        return;
      }

      const finalAnswer = (response.answer || accumulatedText).trim();
      setTurns((prev) =>
        prev.map((t) =>
          t.id === assistantTurnId
            ? {
                ...t,
                text: finalAnswer,
                isStreaming: false,
                isFinal: true,
                citations: response.citations,
                modelUsed: response.modelUsed,
              }
            : t
        )
      );

      speakResponse(finalAnswer, activeEpoch);
    } catch (err: any) {
      const errState = lifecycleStateRef.current as VoiceSessionLifecycleState;
      if (
        sessionEpochRef.current !== activeEpoch ||
        errState === 'ENDING' ||
        errState === 'ENDED'
      ) {
        setTurns((prev) =>
          prev.map((t) =>
            t.id === assistantTurnId
              ? {
                  ...t,
                  text: t.text.trim() || 'Interrupted.',
                  isStreaming: false,
                  isFinal: true,
                  interrupted: true,
                }
              : t
          )
        );
        return;
      }

      const fallbackReply = `From ${studyDoc.title}: ${
        studyDoc.overview ||
        studyDoc.pages[0]?.content.slice(0, 200) ||
        'Please ask about a specific concept from your uploaded material.'
      }`;
      setTurns((prev) =>
        prev.map((t) =>
          t.id === assistantTurnId
            ? {
                ...t,
                text: fallbackReply,
                isStreaming: false,
                isFinal: true,
              }
            : t
        )
      );
      speakResponse(fallbackReply, activeEpoch);
    }
  };

  /**
   * Clicking the central voice orb always interrupts the current reply or stream
   * and immediately opens a fresh listening turn.
   */
  const handleCentralOrbClick = () => {
    if (voiceState === 'listening') {
      stopSpeakingAndRecognition('orb_stop_listening');
      return;
    }
    setTurns((prev) =>
      prev.map((t) =>
        t.isStreaming
          ? {
              ...t,
              text: t.text.trim() || 'Interrupted by student.',
              isStreaming: false,
              isFinal: true,
              interrupted: true,
            }
          : t
      )
    );
    startListening();
  };

  /**
   * End Session immediately stops all audio, detaches utterance handlers,
   * closes the microphone, cancels in-flight streams, transitions to ENDED,
   * and closes the modal idempotently.
   */
  const handleEndSession = () => {
    teardownVoiceSession('user_clicked_end_session', 'ENDED');
    onClose();
  };

  const handleClearHistory = () => {
    stopSpeakingAndRecognition('clear_voice_history');
    setTurns([]);
    studyStorage.saveVoiceTutorMessages(studyDoc.id, []);
  };

  const handleTextFallbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textFallbackInput.trim()) return;
    stopSpeakingAndRecognition('text_fallback_submit');
    const q = textFallbackInput.trim();
    setTextFallbackInput('');
    const nextEpoch = globalAudioRegistry.beginSession('CONNECTING');
    sessionEpochRef.current = nextEpoch;
    void handleProcessSpokenQuestion(q, nextEpoch);
  };

  if (!isOpen) return null;

  const buddyAvatarState: BuddyAvatarState =
    voiceState === 'listening'
      ? 'listening'
      : voiceState === 'thinking'
        ? 'thinking'
        : voiceState === 'speaking'
          ? 'speaking'
          : 'idle';

  const statusHeadline =
    voiceState === 'listening'
      ? 'Listening to you... Tap circle to stop'
      : voiceState === 'thinking'
        ? 'Buddy is thinking... Tap circle to interrupt'
        : voiceState === 'speaking'
          ? 'Buddy is speaking... Tap circle to interrupt & speak'
          : 'Tap the voice circle to start speaking';

  return (
    <div
      data-testid="voice-tutor-modal"
      data-voice-lifecycle={lifecycleState}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="w-full max-w-2xl bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
                <LearnMateBuddyAvatar state={buddyAvatarState} outputEnergy={voiceState === 'speaking' ? 0.45 : 0} />
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                  voiceState === 'listening'
                    ? 'bg-red-500 animate-ping'
                    : voiceState === 'speaking'
                      ? 'bg-emerald-400 animate-pulse'
                      : voiceState === 'thinking'
                        ? 'bg-amber-400 animate-bounce'
                        : 'bg-indigo-400'
                }`}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white truncate">Buddy Live Voice Tutor</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  Real-Time
                </span>
                <span
                  data-testid="voice-lifecycle-badge"
                  className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700"
                >
                  {lifecycleState}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">Studying: {studyDoc.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {turns.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-rose-300 hover:bg-slate-700 transition-colors cursor-pointer"
                title="Clear voice history for this document"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              data-testid="voice-mute-toggle-btn"
              className={`p-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                muted
                  ? 'bg-red-500/15 border-red-500/30 text-red-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
              title={muted ? 'Unmute voice output' : 'Mute voice output'}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={handleEndSession}
              data-testid="voice-end-session-top-btn"
              className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-200 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
              title="End Session"
            >
              <X className="w-3.5 h-3.5" />
              <span>End Session</span>
            </button>
          </div>
        </div>

        {/* Standalone Circular Voice Control Stage */}
        <div className="px-6 py-5 bg-gradient-to-b from-slate-900 via-indigo-950/30 to-slate-900 flex flex-col items-center justify-center text-center border-b border-slate-800/80">
          <button
            type="button"
            onClick={handleCentralOrbClick}
            data-testid="voice-central-orb-btn"
            aria-label={statusHeadline}
            className="relative group focus:outline-none cursor-pointer"
          >
            <div
              className={`absolute -inset-4 rounded-full transition-all duration-500 blur-md ${
                voiceState === 'listening'
                  ? 'bg-rose-500/35 scale-110 animate-pulse'
                  : voiceState === 'speaking'
                    ? 'bg-emerald-500/35 scale-110 animate-pulse'
                    : voiceState === 'thinking'
                      ? 'bg-amber-500/30 scale-105 animate-pulse'
                      : 'bg-indigo-500/20 group-hover:bg-indigo-500/35 group-hover:scale-105'
              }`}
            />
            <div
              className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center border-2 transition-all shadow-inner ${
                voiceState === 'listening'
                  ? 'bg-rose-950/80 border-rose-400 shadow-rose-500/30'
                  : voiceState === 'speaking'
                    ? 'bg-emerald-950/80 border-emerald-400 shadow-emerald-500/30'
                    : voiceState === 'thinking'
                      ? 'bg-amber-950/80 border-amber-400 shadow-amber-500/30'
                      : 'bg-slate-800/90 border-indigo-400/60 group-hover:border-indigo-300'
              }`}
            >
              <LearnMateBuddyAvatar state={buddyAvatarState} outputEnergy={voiceState === 'speaking' ? 0.45 : 0} />
              <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-200">
                {voiceState === 'listening' ? (
                  <>
                    <Square className="w-2.5 h-2.5 fill-rose-400 text-rose-400" />
                    <span>Listening</span>
                  </>
                ) : voiceState === 'speaking' ? (
                  <>
                    <Mic className="w-3 h-3 text-emerald-300" />
                    <span>Interrupt</span>
                  </>
                ) : voiceState === 'thinking' ? (
                  <span>Thinking...</span>
                ) : (
                  <>
                    <Mic className="w-3 h-3 text-indigo-300" />
                    <span>Speak</span>
                  </>
                )}
              </span>
            </div>
          </button>

          <p className="mt-3.5 text-xs sm:text-sm font-semibold text-slate-200">{statusHeadline}</p>

          {liveTranscript && (
            <div className="mt-2.5 px-4 py-2 rounded-2xl bg-indigo-500/15 border border-indigo-400/30 text-xs text-indigo-100 max-w-md">
              &ldquo;{liveTranscript}&rdquo;
            </div>
          )}

          {micError && (
            <p className="mt-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
              {micError}
            </p>
          )}
        </div>

        {/* Stable Streaming Conversation Paragraphs */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-slate-950/50 min-h-[200px] max-h-[320px]">
          {turns.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-8 text-slate-400 space-y-3">
              <p className="text-xs max-w-sm">
                Tap the circle above and ask a JEE doubt in English or Hinglish, or pick a prompt:
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  'Explain the core formula on Page 1 step by step',
                  'Ask me a quick viva question from this chapter',
                  'Summarize the most common JEE exam trap here',
                ].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => {
                      stopSpeakingAndRecognition('quick_prompt_select');
                      const nextEpoch = globalAudioRegistry.beginSession('CONNECTING');
                      sessionEpochRef.current = nextEpoch;
                      void handleProcessSpokenQuestion(prompt, nextEpoch);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-indigo-600/30 border border-slate-700 hover:border-indigo-400/40 text-xs text-slate-200 transition-colors cursor-pointer"
                  >
                    &ldquo;{prompt}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          ) : (
            turns.map((turn) => (
              <div
                key={turn.id}
                className={`flex flex-col ${turn.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                    turn.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-xs'
                      : 'bg-slate-800/95 text-slate-100 border border-slate-700/80 rounded-bl-xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                      {turn.role === 'user' ? 'You' : 'Buddy Tutor'}
                    </span>
                    <span className="text-[10px] opacity-60">{turn.timestamp}</span>
                  </div>

                  {turn.role === 'assistant' ? (
                    <div className="prose prose-invert prose-xs max-w-none">
                      {turn.text ? (
                        <MathText text={turn.text} />
                      ) : (
                        <span className="text-slate-400 italic">Listening to notes...</span>
                      )}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{turn.text}</p>
                  )}

                  {turn.interrupted && (
                    <span className="mt-1.5 inline-block text-[10px] font-medium text-amber-300/90">
                      (Interrupted)
                    </span>
                  )}

                  {turn.citations && turn.citations.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-700/70 flex flex-wrap gap-1.5">
                      {turn.citations.map((cit, idx) => (
                        <button
                          key={`${turn.id}-cit-${idx}`}
                          type="button"
                          onClick={() => {
                            if (onJumpToPage) {
                              onJumpToPage(cit.pageNumber);
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 text-[10px] font-semibold cursor-pointer"
                        >
                          <BookOpen className="w-2.5 h-2.5" />
                          <span>Page {cit.pageNumber}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={turnsEndRef} />
        </div>

        {/* Bottom Controls + Text Input Fallback */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {speechSupported ? (
                <button
                  type="button"
                  onClick={handleCentralOrbClick}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    voiceState === 'listening'
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {voiceState === 'listening' ? (
                    <>
                      <MicOff className="w-3.5 h-3.5" />
                      <span>Stop Mic</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5" />
                      <span>{voiceState === 'speaking' ? 'Interrupt & Speak' : 'Speak Now'}</span>
                    </>
                  )}
                </button>
              ) : (
                <span className="text-xs text-amber-300">
                  Voice mic unsupported in this browser — use text input below
                </span>
              )}

              <button
                type="button"
                onClick={handleEndSession}
                data-testid="voice-end-session-bottom-btn"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/40 text-slate-200 hover:text-rose-200 text-xs font-semibold cursor-pointer transition-colors"
              >
                <Square className="w-3 h-3" />
                <span>End Session</span>
              </button>
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoLoop}
                onChange={(e) => setAutoLoop(e.target.checked)}
                className="rounded border-slate-600 text-indigo-500 focus:ring-indigo-500"
              />
              <RotateCcw className="w-3 h-3 text-indigo-400" />
              <span>Auto-listen after reply</span>
            </label>
          </div>

          <form onSubmit={handleTextFallbackSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={textFallbackInput}
              onChange={(e) => setTextFallbackInput(e.target.value)}
              placeholder="Or type to talk with Buddy..."
              className="flex-1 px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={!textFallbackInput.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
