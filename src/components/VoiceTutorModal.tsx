import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Mic,
  Volume2,
  VolumeX,
  PhoneOff,
  Loader2,
  RotateCcw,
  BookOpen,
  FileText,
  Sparkles,
  AlertCircle,
  GraduationCap,
  History,
} from 'lucide-react';
import type { StudyDocument, VoiceTurn, TutorCitation } from '../types/study';
import { aiStudyClient } from '../services/aiClient';
import { studyStorage } from '../services/storageService';
import { MathText } from './MathText';

interface VoiceTutorModalProps {
  doc?: StudyDocument | null;
  activeDocument?: StudyDocument | null;
  weakTopics?: string[];
  isOpen: boolean;
  onClose: () => void;
  onJumpToPage?: (pageNumber: number) => void;
  onNavigateToCitation?: (pageNumber: number, quote?: string) => void;
}

export type VoiceSessionLifecycleState =
  | 'IDLE'
  | 'INITIALIZING'
  | 'LISTENING'
  | 'PROCESSING'
  | 'SPEAKING'
  | 'MUTED'
  | 'DISCONNECTED'
  | 'ERROR';

export type TeacherLanguageAccent =
  | 'hinglish_in'
  | 'english_in'
  | 'hindi_in'
  | 'english_intl';

export interface SpokenTeacherAdaptation {
  languageAccent: TeacherLanguageAccent;
  recognitionLang: string;
  preferredVoiceLangs: string[];
  speechRate: number;
  detectedLanguageLabel: string;
  styleInstruction: string;
}

export interface ArchivedVoiceSession {
  id: string;
  title: string;
  createdAt: string;
  turns: VoiceTurn[];
}

const ARCHIVED_VOICE_SESSIONS_KEY_PREFIX = 'learnmate_voice_sessions_archive_v1_';

function loadArchivedVoiceSessions(docId: string): ArchivedVoiceSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${ARCHIVED_VOICE_SESSIONS_KEY_PREFIX}${docId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveArchivedVoiceSessions(docId: string, sessions: ArchivedVoiceSession[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      `${ARCHIVED_VOICE_SESSIONS_KEY_PREFIX}${docId}`,
      JSON.stringify(sessions.slice(0, 15))
    );
  } catch {
    // ignore storage quota errors
  }
}

/**
 * Automatically detects the student's spoken language (Hindi, Hinglish, or English),
 * desired speaking speed, and pedagogical instructions directly from their spoken words.
 */
export function detectSpokenTeacherAdaptation(
  spokenText: string,
  previous?: SpokenTeacherAdaptation
): SpokenTeacherAdaptation {
  const text = (spokenText || '').trim();
  const lower = text.toLowerCase();

  let languageAccent: TeacherLanguageAccent = previous?.languageAccent || 'english_in';

  // 1. Check explicit language switch instructions or script/vocabulary
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  const requestsHindi =
    /\b(in hindi|hindi mein|hindi me|speak hindi|explain in hindi|हिन्दी में|हिंदी में)\b/i.test(text);
  const requestsHinglish =
    /\b(in hinglish|hinglish mein|hinglish me|speak hinglish)\b/i.test(text);
  const requestsEnglish =
    /\b(in english|english mein|speak in english|explain in english|only english)\b/i.test(text);

  const hinglishMarkers =
    /\b(samjhao|samjha|batao|bataiye|kya|kaise|kyun|kyu|hai|hain|mein|aur|iska|iski|iske|dekho|bhaiya|sir\s+ji|beta|sawal|padhao|karo|hota|hoti|nahi|wala|wali|chahiye)\b/i;

  if (requestsEnglish) {
    languageAccent = 'english_in';
  } else if (requestsHindi || hasDevanagari) {
    languageAccent = 'hindi_in';
  } else if (requestsHinglish || hinglishMarkers.test(lower)) {
    languageAccent = 'hinglish_in';
  } else if (!previous) {
    languageAccent = 'english_in';
  }

  // 2. Check spoken speed instructions
  let speechRate = previous?.speechRate ?? 1.0;
  if (/\b(slowly|slow down|speak slow|little slow|dheere|dheere bolo|aaram se|धीरे)\b/i.test(lower)) {
    speechRate = 0.9;
  } else if (/\b(faster|speak fast|quickly|tez bolo|jaldi|तेज़)\b/i.test(lower)) {
    speechRate = 1.15;
  } else if (/\b(normal speed|normal pace)\b/i.test(lower)) {
    speechRate = 1.0;
  }

  // 3. Language-specific voice and prompt configuration
  const langMap: Record<
    TeacherLanguageAccent,
    {
      recognitionLang: string;
      preferredVoiceLangs: string[];
      detectedLanguageLabel: string;
      langPrompt: string;
    }
  > = {
    hinglish_in: {
      recognitionLang: 'en-IN',
      preferredVoiceLangs: ['en-IN', 'hi-IN', 'en-GB', 'en-US'],
      detectedLanguageLabel: 'Hinglish (Mirrored)',
      langPrompt:
        'The student spoke in Hinglish. Reply in natural conversational Hinglish (Hindi-English classroom mix using Roman script for Hindi words and standard English for technical terms) exactly matching the student’s way of speaking.',
    },
    hindi_in: {
      recognitionLang: 'hi-IN',
      preferredVoiceLangs: ['hi-IN', 'en-IN'],
      detectedLanguageLabel: 'Hindi (हिन्दी)',
      langPrompt:
        'The student spoke in Hindi or asked for Hindi. Reply in natural, clear classroom Hindi (with technical terms clarified) matching the student’s spoken style.',
    },
    english_in: {
      recognitionLang: 'en-IN',
      preferredVoiceLangs: ['en-IN', 'en-GB', 'en-US'],
      detectedLanguageLabel: 'English (Mirrored)',
      langPrompt:
        'The student spoke in English. Reply in clear, natural, articulate English like a dedicated classroom professor addressing the student directly.',
    },
    english_intl: {
      recognitionLang: 'en-US',
      preferredVoiceLangs: ['en-US', 'en-GB', 'en-AU'],
      detectedLanguageLabel: 'English',
      langPrompt:
        'Reply in crisp, structured academic English directly answering the student’s spoken request.',
    },
  };

  const chosenLang = langMap[languageAccent];

  return {
    languageAccent,
    recognitionLang: chosenLang.recognitionLang,
    preferredVoiceLangs: chosenLang.preferredVoiceLangs,
    speechRate,
    detectedLanguageLabel: chosenLang.detectedLanguageLabel,
    styleInstruction: chosenLang.langPrompt,
  };
}

/**
 * Converts LaTeX math and Markdown into natural spoken teacher phrasing
 * so the TTS engine reads equations aloud like a real human teacher instead of skipping them.
 */
export function convertMathAndMarkdownToTeacherSpeech(raw: string): string {
  if (!raw) return '';

  const verbalizeMathFragment = (mathStr: string): string => {
    let s = mathStr.trim();
    for (let i = 0; i < 3; i++) {
      s = s.replace(/\\dfrac\{([^{}]+)\}\{([^{}]+)\}/g, ' $1 divided by $2 ');
      s = s.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, ' $1 divided by $2 ');
      s = s.replace(/\\sqrt\[([^{}\]]+)\]\{([^{}]+)\}/g, ' $1th root of $2 ');
      s = s.replace(/\\sqrt\{([^{}]+)\}/g, ' square root of $2 ');
      s = s.replace(/\\vec\{([^{}]+)\}/g, ' vector $1 ');
      s = s.replace(/\\hat\{([^{}]+)\}/g, ' $1 hat ');
      s = s.replace(/\\overline\{([^{}]+)\}/g, ' mean $1 ');
      s = s.replace(/\\text\{([^{}]+)\}/g, ' $1 ');
      s = s.replace(/\\mathrm\{([^{}]+)\}/g, ' $1 ');
      s = s.replace(/\\mathbf\{([^{}]+)\}/g, ' $1 ');
    }

    s = s
      .replace(/\^\{2\}|\^2\b/g, ' squared ')
      .replace(/\^\{3\}|\^3\b/g, ' cubed ')
      .replace(/\^\{-1\}/g, ' inverse ')
      .replace(/\^\{([^{}]+)\}/g, ' to the power $1 ')
      .replace(/\^([a-zA-Z0-9]+)/g, ' to the power $1 ')
      .replace(/_\{0\}|_0\b/g, ' naught ')
      .replace(/_\{max\}|_\{(\text\{max\})\}/gi, ' max ')
      .replace(/_\{min\}|_\{(\text\{min\})\}/gi, ' min ')
      .replace(/_\{eff\}/gi, ' effective ')
      .replace(/_\{rms\}/gi, ' r m s ')
      .replace(/_\{([^{}]+)\}/g, ' sub $1 ')
      .replace(/_([a-zA-Z0-9])/g, ' sub $1 ');

    const symbolMap: Array<[RegExp, string]> = [
      [/\\Delta\b/g, ' delta '],
      [/\\delta\b/g, ' delta '],
      [/\\theta\b/g, ' theta '],
      [/\\Theta\b/g, ' theta '],
      [/\\omega\b/g, ' omega '],
      [/\\Omega\b/g, ' ohm '],
      [/\\alpha\b/g, ' alpha '],
      [/\\beta\b/g, ' beta '],
      [/\\gamma\b/g, ' gamma '],
      [/\\lambda\b/g, ' lambda '],
      [/\\mu\b/g, ' mu '],
      [/\\pi\b/g, ' pi '],
      [/\\sigma\b/g, ' sigma '],
      [/\\tau\b/g, ' tau '],
      [/\\phi\b/g, ' phi '],
      [/\\Phi\b/g, ' phi '],
      [/\\psi\b/g, ' psi '],
      [/\\rho\b/g, ' rho '],
      [/\\epsilon\b|\\varepsilon\b/g, ' epsilon '],
      [/\\eta\b/g, ' eta '],
      [/\\nu\b/g, ' nu '],
      [/\\infty\b/g, ' infinity '],
      [/\\int\b/g, ' integral of '],
      [/\\oint\b/g, ' closed integral of '],
      [/\\sum\b/g, ' summation of '],
      [/\\prod\b/g, ' product of '],
      [/\\partial\b/g, ' partial '],
      [/\\nabla\b/g, ' del '],
      [/\\times\b/g, ' times '],
      [/\\cdot\b/g, ' times '],
      [/\\div\b/g, ' divided by '],
      [/\\pm\b/g, ' plus or minus '],
      [/\\mp\b/g, ' minus or plus '],
      [/\\approx\b/g, ' is approximately equal to '],
      [/\\neq\b|\\ne\b/g, ' is not equal to '],
      [/\\leq\b|\\le\b/g, ' is less than or equal to '],
      [/\\geq\b|\\ge\b/g, ' is greater than or equal to '],
      [/\\propto\b/g, ' is proportional to '],
      [/\\equiv\b/g, ' is equivalent to '],
      [/\\rightarrow\b|\\to\b|\\longrightarrow\b/g, ' gives '],
      [/\\Rightarrow\b/g, ' implies '],
      [/\\leftrightarrow\b|\\rightleftharpoons\b/g, ' is in equilibrium with '],
      [/\\sin\b/g, ' sine '],
      [/\\cos\b/g, ' cosine '],
      [/\\tan\b/g, ' tangent '],
      [/\\log\b/g, ' log '],
      [/\\ln\b/g, ' natural log of '],
      [/\\lim\b/g, ' limit '],
      [/\\left|\\right/g, ' '],
      [/=/g, ' equals '],
      [/\+/g, ' plus '],
      [/\{|\}/g, ' '],
      [/\\/g, ' '],
    ];

    for (const [pattern, replacement] of symbolMap) {
      s = s.replace(pattern, replacement);
    }

    return s.replace(/\s+/g, ' ').trim();
  };

  return raw
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => ` ${verbalizeMathFragment(math)}. `)
    .replace(/\$([^$\n]+)\$/g, (_, math) => ` ${verbalizeMathFragment(math)} `)
    .replace(/\[Page\s+(\d+)\]/gi, 'on page $1')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_~#>]/g, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitIntoSpokenSentences(text: string): string[] {
  const cleaned = convertMathAndMarkdownToTeacherSpeech(text);
  if (!cleaned) return [];
  const rawSentences = cleaned
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const sentence of rawSentences) {
    if (sentence.length <= 220) {
      chunks.push(sentence);
    } else {
      const parts = sentence.split(/(?<=[,;:])\s+/);
      let current = '';
      for (const p of parts) {
        if ((current + ' ' + p).trim().length > 200 && current) {
          chunks.push(current.trim());
          current = p;
        } else {
          current = (current + ' ' + p).trim();
        }
      }
      if (current.trim()) chunks.push(current.trim());
    }
  }
  return chunks.length > 0 ? chunks : [cleaned];
}

export const VoiceTutorModal: React.FC<VoiceTutorModalProps> = ({
  doc: docProp,
  activeDocument,
  weakTopics = [],
  isOpen,
  onClose,
  onJumpToPage,
  onNavigateToCitation,
}) => {
  const doc = docProp ?? activeDocument ?? null;
  const docId = doc?.id || 'general-workspace';
  const docTitle = doc?.title ? doc.title.replace(/\.pdf$/i, '') : 'General JEE Study Session';

  const [lifecycleState, setLifecycleState] = useState<VoiceSessionLifecycleState>('IDLE');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [streamingResponse, setStreamingResponse] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState<VoiceTurn[]>([]);
  const [archivedSessions, setArchivedSessions] = useState<ArchivedVoiceSession[]>([]);
  const [activeSpokenSentence, setActiveSpokenSentence] = useState<string>('');
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  // Automatic spoken adaptation state (mirrors student's spoken language, pace & instructions)
  const [adaptation, setAdaptation] = useState<SpokenTeacherAdaptation>(() =>
    detectSpokenTeacherAdaptation('')
  );

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(
    typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
  );
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef<boolean>(false);
  const sessionActiveRef = useRef<boolean>(false);
  const isMutedRef = useRef<boolean>(isMuted);
  const adaptationRef = useRef<SpokenTeacherAdaptation>(adaptation);
  const transcriptAccumRef = useRef<string>('');
  const silenceTimerRef = useRef<number | null>(null);
  const speechQueueAbortRef = useRef<boolean>(false);
  const historyEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    adaptationRef.current = adaptation;
  }, [adaptation]);

  const pickBestTeacherVoice = useCallback(
    (voices: SpeechSynthesisVoice[], preferredLangs: string[]): SpeechSynthesisVoice | null => {
      if (!voices || voices.length === 0) return null;

      for (const targetLang of preferredLangs) {
        const exactMatch = voices.find(
          (v) =>
            v.lang.toLowerCase() === targetLang.toLowerCase() &&
            (v.name.includes('Natural') ||
              v.name.includes('Google') ||
              v.name.includes('Microsoft') ||
              v.name.includes('India') ||
              v.name.includes('Rishi') ||
              v.name.includes('Neerja') ||
              v.name.includes('Prabhat') ||
              v.name.includes('Swara') ||
              v.name.includes('Madhur') ||
              v.name.includes('Lekha'))
        );
        if (exactMatch) return exactMatch;

        const langMatch = voices.find((v) =>
          v.lang.toLowerCase().startsWith(targetLang.toLowerCase())
        );
        if (langMatch) return langMatch;
      }

      return (
        voices.find((v) => v.lang.startsWith('en') && v.name.includes('Natural')) ||
        voices.find((v) => v.lang.startsWith('en')) ||
        voices[0] ||
        null
      );
    },
    []
  );

  useEffect(() => {
    if (isOpen) {
      const saved = studyStorage.getVoiceTutorMessages(docId);
      setMessages(saved);
      setArchivedSessions(loadArchivedVoiceSessions(docId));
    }
  }, [isOpen, docId]);

  useEffect(() => {
    if (isOpen && messages.length > 0) {
      studyStorage.saveVoiceTutorMessages(docId, messages);
    }
  }, [messages, isOpen, docId]);

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveTranscript, streamingResponse]);

  const teardownAllVoiceResources = useCallback(() => {
    sessionActiveRef.current = false;
    speechQueueAbortRef.current = true;

    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch {
        // Ignore abort errors
      }
      abortControllerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort?.();
        recognitionRef.current.stop?.();
      } catch {
        // Ignore errors stopping recognition
      }
      recognitionRef.current = null;
    }

    if (synthRef.current) {
      try {
        synthRef.current.cancel();
      } catch {
        // Ignore errors cancelling speech synthesis
      }
    }

    setActiveSpokenSentence('');
    setSpeakingMessageId(null);
  }, []);

  const speakTeacherExplanation = useCallback(
    (
      rawMarkdownText: string,
      currentAdapt: SpokenTeacherAdaptation,
      messageId?: string,
      onFinished?: () => void
    ) => {
      if (!synthRef.current || isMutedRef.current) {
        setActiveSpokenSentence('');
        setSpeakingMessageId(null);
        onFinished?.();
        return;
      }

      const synth = synthRef.current;
      speechQueueAbortRef.current = true;
      synth.cancel();

      const sentences = splitIntoSpokenSentences(rawMarkdownText);
      if (sentences.length === 0) {
        onFinished?.();
        return;
      }

      speechQueueAbortRef.current = false;
      if (messageId) setSpeakingMessageId(messageId);

      const voices = synth.getVoices();
      const chosenVoice = pickBestTeacherVoice(voices, currentAdapt.preferredVoiceLangs);

      let index = 0;

      const speakNextSentence = () => {
        if (
          speechQueueAbortRef.current ||
          !isMountedRef.current ||
          isMutedRef.current ||
          index >= sentences.length
        ) {
          setActiveSpokenSentence('');
          setSpeakingMessageId(null);
          onFinished?.();
          return;
        }

        const currentSentence = sentences[index];
        index += 1;
        setActiveSpokenSentence(currentSentence);
        setLifecycleState('SPEAKING');

        const utterance = new SpeechSynthesisUtterance(currentSentence);
        if (chosenVoice) {
          utterance.voice = chosenVoice;
          utterance.lang = chosenVoice.lang;
        } else {
          utterance.lang = currentAdapt.recognitionLang;
        }
        utterance.rate = currentAdapt.speechRate;
        utterance.pitch = 1.0;

        utterance.onend = () => {
          if (speechQueueAbortRef.current || !isMountedRef.current) {
            setActiveSpokenSentence('');
            setSpeakingMessageId(null);
            return;
          }
          speakNextSentence();
        };

        utterance.onerror = () => {
          if (speechQueueAbortRef.current || !isMountedRef.current) {
            setActiveSpokenSentence('');
            setSpeakingMessageId(null);
            return;
          }
          speakNextSentence();
        };

        synth.speak(utterance);
      };

      speakNextSentence();
    },
    [pickBestTeacherVoice]
  );

  const startListening = useCallback(() => {
    if (!sessionActiveRef.current) {
      sessionActiveRef.current = true;
    }
    if (!recognitionRef.current) {
      setErrorMsg(
        'Microphone recognition requires Chrome, Edge, or Safari with microphone permission enabled.'
      );
      return;
    }

    speechQueueAbortRef.current = true;
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setActiveSpokenSentence('');
    setSpeakingMessageId(null);

    try {
      setErrorMsg(null);
      transcriptAccumRef.current = '';
      setLiveTranscript('');
      recognitionRef.current.lang = adaptationRef.current.recognitionLang;
      recognitionRef.current.start();
    } catch {
      try {
        recognitionRef.current.stop();
        setTimeout(() => {
          if (sessionActiveRef.current && isMountedRef.current && recognitionRef.current) {
            transcriptAccumRef.current = '';
            setLiveTranscript('');
            recognitionRef.current.start();
          }
        }, 150);
      } catch {
        setLifecycleState('IDLE');
      }
    }
  }, []);

  const handleUserQuery = useCallback(
    async (queryText: string) => {
      const cleanQuery = queryText.trim();
      if (!cleanQuery || !isMountedRef.current) return;

      if (!sessionActiveRef.current) {
        sessionActiveRef.current = true;
      }

      if (silenceTimerRef.current !== null) {
        window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      speechQueueAbortRef.current = true;
      if (synthRef.current) {
        synthRef.current.cancel();
      }

      // Automatically detect & mirror the student's spoken language, accent, pace, and instructions
      const nextAdaptation = detectSpokenTeacherAdaptation(cleanQuery, adaptationRef.current);
      setAdaptation(nextAdaptation);
      adaptationRef.current = nextAdaptation;

      const userMsg: VoiceTurn = {
        id: `v-user-${Date.now()}`,
        role: 'user',
        text: cleanQuery,
        isFinal: true,
        timestamp: new Date().toISOString(),
      };

      let nextHistory: VoiceTurn[] = [];
      setMessages((prev) => {
        nextHistory = [...prev, userMsg];
        return nextHistory;
      });
      setLiveTranscript('');
      setStreamingResponse('');
      setLifecycleState('PROCESSING');
      setErrorMsg(null);

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const historyPayload = nextHistory.slice(-10).map((m) => ({
          role: m.role,
          content: m.text,
        }));

        const teacherPrompt = `[AI VOICE CLASSROOM TEACHER — AUTOMATIC MIRRORING DIRECTIVE:
1. Language & Tone Mirroring: ${nextAdaptation.styleInstruction} Always reply in the exact same language, tone, and style that the student used in their spoken message.
2. Follow Student Instructions Directly: Do whatever the student has asked for (whether explaining a concept, solving a numerical step-by-step, deriving a formula, quizzing them orally, or summarizing).
3. Paragraph & Symbol Formatting:
   - Write in clear, natural paragraphs so your explanation streams word-by-word in a cohesive paragraph and sounds like a real human teacher speaking aloud.
   - Format all mathematical symbols, expressions, and physics/chemistry formulas in valid KaTeX ($...$ for inline, $$...$$ for display equations) so the student understands every symbol visually.
   - Highlight important takeaways, laws, and conditions using **bold** and *italic*.]

Student Spoken Words: ${cleanQuery}`;

        let accumulated = '';
        const responseObj = await aiStudyClient.askTutorStream(
          {
            title: doc?.title || 'General JEE Classroom Session',
            pages: doc?.pages?.length
              ? doc.pages
              : [
                  {
                    pageNumber: 1,
                    title: 'General JEE Study Session',
                    content: 'Physics, Chemistry, and Mathematics Classroom Session',
                  },
                ],
            question: teacherPrompt,
            history: historyPayload,
            studentContext: {
              weakTopics,
              preferredLanguage: nextAdaptation.detectedLanguageLabel,
              currentActivity: 'Voice Classroom Session',
            },
            sourceControlMode: 'extended_knowledge',
            isVoiceTutor: true,
            signal: abortController.signal,
          },
          (deltaText) => {
            if (!isMountedRef.current || !sessionActiveRef.current) return;
            accumulated += deltaText;
            setStreamingResponse(accumulated);
          }
        );

        if (!isMountedRef.current || !sessionActiveRef.current) return;

        const finalAnswer = (responseObj?.answer || accumulated).trim();
        const extractedCitations: TutorCitation[] =
          responseObj?.citations && responseObj.citations.length > 0
            ? [...responseObj.citations]
            : [];

        const pageRegex = /\[Page\s+(\d+)\]/gi;
        let match: RegExpExecArray | null;
        while ((match = pageRegex.exec(finalAnswer)) !== null) {
          const pageNum = parseInt(match[1], 10);
          if (
            !Number.isNaN(pageNum) &&
            !extractedCitations.some((c) => c.pageNumber === pageNum)
          ) {
            extractedCitations.push({
              pageNumber: pageNum,
              section: `Page ${pageNum}`,
              quote: '',
            });
          }
        }

        const aiMsgId = `v-ai-${Date.now()}`;
        const aiMsg: VoiceTurn = {
          id: aiMsgId,
          role: 'assistant',
          text: finalAnswer,
          isFinal: true,
          timestamp: new Date().toISOString(),
          citations: extractedCitations.length > 0 ? extractedCitations : undefined,
          modelUsed: responseObj?.modelUsed,
        };

        setMessages((prev) => [...prev, aiMsg]);
        setStreamingResponse('');

        if (!isMutedRef.current && synthRef.current) {
          speakTeacherExplanation(finalAnswer, nextAdaptation, aiMsgId, () => {
            if (!isMountedRef.current || !sessionActiveRef.current) return;
            setLifecycleState('IDLE');
            startListening();
          });
        } else {
          setLifecycleState(isMutedRef.current ? 'MUTED' : 'IDLE');
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || !isMountedRef.current || !sessionActiveRef.current) {
          return;
        }
        setErrorMsg(err?.message || 'Failed to generate teacher explanation. Tap the mic to retry.');
        setStreamingResponse('');
        setLifecycleState('ERROR');
      }
    },
    [doc, weakTopics, speakTeacherExplanation, startListening]
  );

  useEffect(() => {
    isMountedRef.current = true;

    if (!isOpen) {
      teardownAllVoiceResources();
      setLifecycleState('DISCONNECTED');
      setLiveTranscript('');
      setStreamingResponse('');
      return;
    }

    sessionActiveRef.current = true;
    setLifecycleState('INITIALIZING');
    setErrorMsg(null);

    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = adaptationRef.current.recognitionLang;

        recognition.onstart = () => {
          if (!isMountedRef.current || !sessionActiveRef.current) return;
          setLifecycleState('LISTENING');
          setErrorMsg(null);
        };

        recognition.onresult = (event: any) => {
          if (!isMountedRef.current || !sessionActiveRef.current) return;

          let fullParagraph = '';
          for (let i = 0; i < event.results.length; ++i) {
            const piece = event.results[i][0].transcript;
            fullParagraph +=
              (fullParagraph && !fullParagraph.endsWith(' ') ? ' ' : '') + piece.trim();
          }

          const cleaned = fullParagraph.replace(/\s+/g, ' ').trim();
          transcriptAccumRef.current = cleaned;
          setLiveTranscript(cleaned);

          if (silenceTimerRef.current !== null) {
            window.clearTimeout(silenceTimerRef.current);
          }

          const latestResult = event.results[event.results.length - 1];
          const waitMs = latestResult?.isFinal ? 1100 : 2100;

          silenceTimerRef.current = window.setTimeout(() => {
            const finalSpoken = transcriptAccumRef.current.trim();
            if (finalSpoken && sessionActiveRef.current && isMountedRef.current) {
              try {
                recognition.stop();
              } catch {
                // ignore
              }
              transcriptAccumRef.current = '';
              void handleUserQuery(finalSpoken);
            }
          }, waitMs);
        };

        recognition.onerror = (event: any) => {
          if (!isMountedRef.current || !sessionActiveRef.current) return;
          if (event.error === 'aborted' || event.error === 'no-speech') {
            if (event.error === 'no-speech') {
              setLifecycleState('IDLE');
            }
            return;
          }
          setErrorMsg(
            `Microphone notice (${event.error}). Tap the microphone button to speak again.`
          );
          setLifecycleState('ERROR');
        };

        recognition.onend = () => {
          if (!isMountedRef.current || !sessionActiveRef.current) return;
          setLifecycleState((prev) => (prev === 'LISTENING' ? 'IDLE' : prev));
        };

        recognitionRef.current = recognition;
        setLifecycleState('IDLE');
      } else {
        setErrorMsg('Live voice recognition requires Chrome, Edge, or Safari.');
        setLifecycleState('IDLE');
      }
    }

    return () => {
      isMountedRef.current = false;
      teardownAllVoiceResources();
    };
  }, [isOpen, teardownAllVoiceResources, handleUserQuery]);

  const stopListeningAndSubmit = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    const finalSpoken = transcriptAccumRef.current.trim() || liveTranscript.trim();
    if (finalSpoken) {
      transcriptAccumRef.current = '';
      void handleUserQuery(finalSpoken);
    } else {
      setLifecycleState('IDLE');
    }
  }, [liveTranscript, handleUserQuery]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const nextMuted = !prev;
      isMutedRef.current = nextMuted;
      if (nextMuted && synthRef.current) {
        speechQueueAbortRef.current = true;
        synthRef.current.cancel();
        setActiveSpokenSentence('');
        setSpeakingMessageId(null);
        setLifecycleState((curr) => (curr === 'SPEAKING' ? 'MUTED' : curr));
      } else if (!nextMuted) {
        setLifecycleState((curr) => (curr === 'MUTED' ? 'IDLE' : curr));
      }
      return nextMuted;
    });
  }, []);

  const stopTeacherSpeechOnly = useCallback(() => {
    speechQueueAbortRef.current = true;
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setActiveSpokenSentence('');
    setSpeakingMessageId(null);
    setLifecycleState('IDLE');
  }, []);

  // New Session Button: archives current turns to Recorded History and resets active conversation
  const handleNewSession = useCallback(() => {
    stopTeacherSpeechOnly();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (messages.length > 0) {
      const firstUserTurn = messages.find((m) => m.role === 'user');
      const sessionTitle = firstUserTurn
        ? firstUserTurn.text.slice(0, 68)
        : `${docTitle} Voice Session`;
      const newArchived: ArchivedVoiceSession = {
        id: `vsess-${Date.now()}`,
        title: sessionTitle,
        createdAt: new Date().toISOString(),
        turns: messages,
      };
      const updatedArchive = [newArchived, ...archivedSessions].slice(0, 15);
      setArchivedSessions(updatedArchive);
      saveArchivedVoiceSessions(docId, updatedArchive);
    }
    studyStorage.saveVoiceTutorMessages(docId, []);
    setMessages([]);
    setLiveTranscript('');
    setStreamingResponse('');
    setLifecycleState('IDLE');
  }, [messages, archivedSessions, docId, docTitle, stopTeacherSpeechOnly]);

  const handleEndSession = useCallback(() => {
    teardownAllVoiceResources();
    setLifecycleState('DISCONNECTED');
    setLiveTranscript('');
    setStreamingResponse('');
    onClose();
  }, [teardownAllVoiceResources, onClose]);

  const lifecycleMeta: Record<
    VoiceSessionLifecycleState,
    { label: string; badgeClass: string; dotClass: string; subtitle: string }
  > = useMemo(
    () => ({
      IDLE: {
        label: 'Ready to Listen',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        dotClass: 'bg-slate-400',
        subtitle:
          'Tap the microphone and speak naturally in English, Hinglish, or Hindi. The AI Teacher replies in the same way you speak.',
      },
      INITIALIZING: {
        label: 'Initializing Voice',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        dotClass: 'bg-amber-500 animate-pulse',
        subtitle: 'Preparing voice recognition and teacher audio...',
      },
      LISTENING: {
        label: 'Listening Live',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        dotClass: 'bg-emerald-600 animate-ping',
        subtitle:
          'Speak your question or instruction — your words appear live word-by-word in a paragraph below.',
      },
      PROCESSING: {
        label: 'Teacher Thinking',
        badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
        dotClass: 'bg-blue-600 animate-pulse',
        subtitle: 'Formulating a step-by-step spoken explanation in your language and style...',
      },
      SPEAKING: {
        label: 'Teacher Explaining',
        badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
        dotClass: 'bg-indigo-600 animate-pulse',
        subtitle: 'Your teacher is explaining aloud. Tap the mic anytime to interrupt or ask a follow-up.',
      },
      MUTED: {
        label: 'Speaker Muted',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        dotClass: 'bg-amber-500',
        subtitle: 'Speaker audio is muted. Word-by-word paragraph explanations continue visually.',
      },
      DISCONNECTED: {
        label: 'Session Closed',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
        dotClass: 'bg-slate-400',
        subtitle: 'Voice session ended.',
      },
      ERROR: {
        label: 'Mic Attention',
        badgeClass: 'bg-red-50 text-red-700 border-red-200',
        dotClass: 'bg-red-500',
        subtitle: 'Tap the microphone button to retry voice capture.',
      },
    }),
    []
  );

  if (!isOpen) return null;

  const currentStatus = lifecycleMeta[lifecycleState];

  const renderMessageContent = (msg: VoiceTurn) => {
    return (
      <div className="space-y-3">
        <div className="text-[15px] leading-[1.8] text-slate-800">
          <MathText text={msg.text} />
        </div>
        {msg.citations && msg.citations.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/80">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
              Material Reference:
            </span>
            {msg.citations.map((citation, cIdx) => (
              <button
                key={`${citation.pageNumber}-${cIdx}`}
                type="button"
                onClick={() => {
                  if (onNavigateToCitation) {
                    onNavigateToCitation(citation.pageNumber, citation.quote);
                  } else if (onJumpToPage) {
                    onJumpToPage(citation.pageNumber);
                  }
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition-colors cursor-pointer"
                title={`Jump to Page ${citation.pageNumber} in study material`}
              >
                <BookOpen className="w-3 h-3" />
                Page {citation.pageNumber}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-xs p-3 sm:p-6"
      data-testid="voice-tutor-modal"
      data-voice-lifecycle={lifecycleState}
    >
      <div className="keep-white bg-white text-slate-900 w-full max-w-[1680px] h-[90vh] max-h-[940px] rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
        {/* Clean White Desktop Header with ONLY Mute Speaker, New Session, and Close Controls */}
        <header className="px-6 lg:px-8 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
                  AI Voice Tutor
                </h2>
                <span
                  data-testid="voice-lifecycle-badge"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border ${currentStatus.badgeClass}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${currentStatus.dotClass}`} />
                  {currentStatus.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>
                  Context: <strong className="font-semibold text-slate-700">{docTitle}</strong> ·
                  Automatically mirrors your spoken language &amp; instructions
                </span>
              </p>
            </div>
          </div>

          {/* Approved Controls: Mute Speaker, New Session, Close */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleMute}
              data-testid="voice-mute-toggle-btn"
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                isMuted
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              title={isMuted ? 'Unmute speaker' : 'Mute speaker'}
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-4 h-4 text-amber-600" />
                  <span>Unmute Speaker</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-slate-700" />
                  <span>Mute Speaker</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleNewSession}
              data-testid="voice-new-session-btn"
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Archive current transcript and start a new voice session"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>New Session</span>
            </button>

            <button
              type="button"
              onClick={handleEndSession}
              data-testid="voice-end-session-top-btn"
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Close Voice Tutor"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>Close</span>
            </button>
          </div>
        </header>

        {/* Two-Column Clean White Desktop View: Left Live Visualizer + Active Paragraphs | Right Recorded Transcript History */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 bg-white">
          {/* LEFT COLUMN (5 cols on desktop): Live Voice Visualizer, Central Mic Control & Real-Time Word-by-Word Paragraphs */}
          <aside className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50/50 flex flex-col justify-between p-6 lg:p-8 overflow-y-auto">
            <div className="space-y-6">
              {/* Live Voice Stage Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 lg:p-8 shadow-2xs text-center space-y-6">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Live Voice Classroom
                  </span>
                  <h3 className="text-lg font-bold text-slate-900">{currentStatus.label}</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    {currentStatus.subtitle}
                  </p>
                </div>

                {/* Architectural Acoustic Waveform Visualizer */}
                <div
                  className="flex items-center justify-center gap-2 h-16 py-2"
                  aria-hidden="true"
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((barIdx) => {
                    const heights = [
                      'h-3',
                      'h-5',
                      'h-8',
                      'h-11',
                      'h-14',
                      'h-16',
                      'h-14',
                      'h-11',
                      'h-8',
                      'h-5',
                      'h-3',
                    ];
                    return (
                      <span
                        key={barIdx}
                        className={`w-1.5 rounded-full transition-all duration-300 ${
                          lifecycleState === 'LISTENING'
                            ? `bg-emerald-600 ${heights[barIdx]} animate-pulse`
                            : lifecycleState === 'SPEAKING'
                            ? `bg-blue-600 ${heights[(barIdx + 3) % heights.length]} animate-pulse`
                            : lifecycleState === 'PROCESSING'
                            ? 'bg-amber-500 h-5 animate-pulse'
                            : 'bg-slate-200 h-3'
                        }`}
                      />
                    );
                  })}
                </div>

                {/* Single Primary Microphone Button */}
                <div className="flex flex-col items-center gap-3">
                  <button
                    type="button"
                    data-testid="voice-central-orb-btn"
                    onClick={() => {
                      if (lifecycleState === 'LISTENING') {
                        stopListeningAndSubmit();
                      } else if (lifecycleState === 'SPEAKING') {
                        stopTeacherSpeechOnly();
                        startListening();
                      } else if (lifecycleState !== 'PROCESSING') {
                        startListening();
                      }
                    }}
                    disabled={lifecycleState === 'PROCESSING'}
                    className={`w-full max-w-sm py-4 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition-all border cursor-pointer ${
                      lifecycleState === 'LISTENING'
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-md'
                        : lifecycleState === 'SPEAKING'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700 shadow-sm'
                        : lifecycleState === 'PROCESSING'
                        ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-wait'
                        : 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900 shadow-sm'
                    }`}
                  >
                    {lifecycleState === 'LISTENING' ? (
                      <>
                        <Mic className="w-5 h-5 animate-pulse" />
                        <span>Done Speaking (Send to Teacher)</span>
                      </>
                    ) : lifecycleState === 'PROCESSING' ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Teacher is Thinking...</span>
                      </>
                    ) : lifecycleState === 'SPEAKING' ? (
                      <>
                        <Mic className="w-5 h-5" />
                        <span>Tap Mic to Interrupt &amp; Speak</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-5 h-5" />
                        <span>Tap Mic to Speak</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Live Spoken Sentence Caption when Teacher is Speaking */}
                {activeSpokenSentence && (
                  <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-left">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-700 mb-1">
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Teacher Speaking Aloud Now</span>
                    </div>
                    <p className="text-sm text-slate-800 leading-relaxed font-medium">
                      “{activeSpokenSentence}”
                    </p>
                  </div>
                )}
              </div>

              {/* Live Word-by-Word Student Speech Paragraph Box */}
              <div
                className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2.5 shadow-2xs"
                data-testid="voice-live-student-paragraph"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        lifecycleState === 'LISTENING'
                          ? 'bg-emerald-600 animate-ping'
                          : 'bg-slate-300'
                      }`}
                    />
                    Your Spoken Words (Live Word-by-Word Paragraph)
                  </span>
                </div>
                {liveTranscript ? (
                  <p className="text-[15px] leading-relaxed font-medium text-slate-900">
                    {liveTranscript}
                    <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-emerald-600 animate-pulse" />
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 leading-relaxed">
                    As you speak, your words appear here word-by-word in a complete paragraph. Speak
                    in English, Hinglish, or Hindi and tell the teacher how you want the topic or
                    question explained.
                  </p>
                )}
              </div>

              {/* Live Word-by-Word AI Teacher Response Paragraph Box */}
              {(lifecycleState === 'PROCESSING' || streamingResponse) && (
                <div
                  className="bg-white rounded-2xl border border-blue-200 p-5 space-y-2.5 shadow-xs"
                  data-testid="voice-live-teacher-paragraph"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600 animate-spin" />
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                      AI Teacher Response (Word-by-Word Paragraph)
                    </span>
                  </div>
                  {streamingResponse ? (
                    <div className="text-[15px] leading-[1.8] text-slate-800">
                      <MathText text={streamingResponse} />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 text-sm text-slate-500 py-1">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Preparing explanation in your spoken language and style...</span>
                    </div>
                  )}
                </div>
              )}

              {errorMsg && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
              <span>All voice turns &amp; KaTeX formulas are recorded automatically</span>
              <span className="font-semibold text-slate-700">
                {messages.length} {messages.length === 1 ? 'turn' : 'turns'} recorded
              </span>
            </div>
          </aside>

          {/* RIGHT COLUMN (7 cols on desktop): Recorded Word-by-Word Paragraph Transcript & Past Session History */}
          <section className="lg:col-span-7 flex flex-col min-h-0 bg-white">
            <div className="px-6 lg:px-8 py-3.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Recorded Conversation Transcript &amp; History
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-slate-600">
                  {messages.length} {messages.length === 1 ? 'turn' : 'turns'}
                </span>
              </div>
              <span className="text-xs text-slate-500 hidden sm:inline">
                Visual KaTeX Formulas · Bold &amp; Italic Highlights
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
              {messages.length === 0 ? (
                <div className="h-full min-h-[280px] flex flex-col items-center justify-center max-w-lg mx-auto text-center py-8">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 mb-4">
                    <Mic className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Speak to Start Your Classroom Session
                  </h3>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                    Tap the microphone on the left and talk to your AI Teacher just like a real
                    classroom instructor. Whether you speak in <strong>English</strong>,{' '}
                    <strong>Hinglish</strong>, or <strong>Hindi</strong>, or ask for derivations,
                    numericals, or oral viva questions, your teacher will reply in the exact same
                    way and record the full word-by-word paragraph transcript here.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isBeingSpoken = speakingMessageId === msg.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.role === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5 px-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          {msg.role === 'user' ? 'You (Spoken Paragraph)' : 'AI Teacher (Spoken Paragraph)'}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div
                        className={`max-w-[92%] rounded-2xl px-5 py-4 border ${
                          msg.role === 'user'
                            ? 'bg-slate-900 text-white border-slate-900 rounded-br-xs'
                            : isBeingSpoken
                            ? 'bg-blue-50/40 text-slate-900 border-blue-300 shadow-xs rounded-bl-xs'
                            : 'bg-slate-50/80 text-slate-900 border-slate-200 rounded-bl-xs'
                        }`}
                      >
                        {msg.role === 'user' ? (
                          <p className="text-[15px] leading-relaxed font-normal text-white">
                            {msg.text}
                          </p>
                        ) : (
                          renderMessageContent(msg)
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Archived Past Voice Sessions */}
              {archivedSessions.length > 0 && (
                <div className="pt-6 mt-6 border-t border-slate-200 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <History className="w-3.5 h-3.5" />
                    <span>Previous Recorded Voice Sessions ({archivedSessions.length})</span>
                  </div>
                  <div className="space-y-2.5">
                    {archivedSessions.map((sess) => (
                      <details
                        key={sess.id}
                        className="rounded-xl border border-slate-200 bg-slate-50/60 overflow-hidden"
                      >
                        <summary className="px-4 py-3 text-xs font-semibold text-slate-800 cursor-pointer flex items-center justify-between gap-2 select-none">
                          <span className="truncate">{sess.title}</span>
                          <span className="text-[11px] text-slate-500 shrink-0">
                            {sess.turns.length} turns ·{' '}
                            {new Date(sess.createdAt).toLocaleDateString()}
                          </span>
                        </summary>
                        <div className="p-4 bg-white border-t border-slate-200 space-y-3">
                          {sess.turns.map((t) => (
                            <div
                              key={t.id}
                              className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1"
                            >
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                {t.role === 'user' ? 'Student' : 'AI Teacher'}
                              </div>
                              <div className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                                <MathText text={t.text} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              )}

              <div ref={historyEndRef} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
