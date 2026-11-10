import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  HelpCircle,
  BookOpen,
  Target,
  ListChecks,
  BarChart3,
  Wrench,
  Sparkles,
  FileText,
  ArrowRight,
  X,
  Compass,
  Mic,
  PenTool,
  Award,
  LineChart,
} from 'lucide-react';
import type { StudyDocument } from '../types/study';
import type { ActiveTab } from './Navbar';
import type { QuickReviseSubTab } from './QuickReviseView';
import type { UtilityTab } from './CompactStudyUtilitiesWidget';
import {
  JEE_SYLLABUS_CHAPTERS,
  type SyllabusChapterRecord,
} from '../data/jeeSyllabusAndNotes';
import {
  OFFICIAL_PYQ_PAPERS,
  OFFICIAL_PYQ_QUESTIONS,
} from '../utils/pyqCorpusEngine';
import { studyStorage } from '../services/storageService';

export interface AppGuideEntry {
  id: string;
  name: string;
  taskGroup: 'Home & Daily Plan' | 'Study & Notes' | 'Practice & PYQs' | 'Revise & Memory' | 'Progress & Rewards' | 'Study Tools';
  destinationLabel: string;
  briefExplanation: string;
  walkthroughTip: string;
  targetTab: ActiveTab;
  reviseSubTab?: QuickReviseSubTab;
  utilityTab?: UtilityTab;
  studySection?: 'syllabus' | 'notes' | 'materials' | 'tutor' | 'create' | 'resources';
}

export const LEARNMATE_FEATURE_GUIDE_REGISTRY: AppGuideEntry[] = [
  {
    id: 'guide-daily-coach',
    name: 'AI Practice Coach & My Tasks',
    taskGroup: 'Home & Daily Plan',
    destinationLabel: 'Home → My Tasks',
    briefExplanation: 'Personalized daily tasks generated from your weak topics, due flashcards, and syllabus goals.',
    walkthroughTip: 'Check off tasks on Home or click Start to jump directly to the recommended study or practice action.',
    targetTab: 'dashboard',
  },
  {
    id: 'guide-ask-doubt',
    name: 'Ask a JEE Doubt (English & Hinglish)',
    taskGroup: 'Home & Daily Plan',
    destinationLabel: 'Home → Ask a Doubt',
    briefExplanation: 'Type any Physics, Chemistry, or Maths doubt on Home to launch a source-grounded AI Tutor explanation.',
    walkthroughTip: 'Toggle English or Hinglish before submitting your doubt.',
    targetTab: 'dashboard',
  },
  {
    id: 'guide-syllabus',
    name: 'JEE Main & Advanced Syllabus Explorer',
    taskGroup: 'Study & Notes',
    destinationLabel: 'Study → Syllabus',
    briefExplanation: 'Official verified JEE Main and JEE Advanced chapter & topic catalog with provenance and weightage.',
    walkthroughTip: 'Switch between JEE Main and JEE Advanced to compare chapter scope and open Full or Quick Notes.',
    targetTab: 'study',
    studySection: 'syllabus',
  },
  {
    id: 'guide-chapter-notes',
    name: 'Complete Chapter Notes (Full & Quick Notes)',
    taskGroup: 'Study & Notes',
    destinationLabel: 'Study → Chapter Notes',
    briefExplanation: 'Study any JEE chapter directly without uploading files: includes derivations, formulas, worked examples, and traps.',
    walkthroughTip: 'Toggle between Full Notes (deep theory + derivations) and Quick Notes (essential formulas + checkpoints).',
    targetTab: 'study',
    studySection: 'notes',
  },
  {
    id: 'guide-study-workbench',
    name: 'Split-Pane Study Workbench & AI Tutor',
    taskGroup: 'Study & Notes',
    destinationLabel: 'Study → My Materials / AI Tutor',
    briefExplanation: 'Read 60+ page PDFs or YouTube lectures side-by-side with an AI Tutor supporting Notes + JEE and Only My Notes modes.',
    walkthroughTip: 'Use Explain Simpler, Explain Deeper, Teach It Back, or the Create dropdown on any tutor response.',
    targetTab: 'study',
    studySection: 'materials',
  },
  {
    id: 'guide-voice-tutor',
    name: 'Interactive Voice Tutor',
    taskGroup: 'Study & Notes',
    destinationLabel: 'Study → AI Tutor → Voice',
    briefExplanation: 'Speak doubts aloud and listen to clear mathematical explanations with immediate End Session cleanup.',
    walkthroughTip: 'Click the microphone icon in the Study AI Tutor header to start a live voice session.',
    targetTab: 'study',
    studySection: 'tutor',
  },
  {
    id: 'guide-create-studio',
    name: 'Diagram Maker & Animated Concept Lessons',
    taskGroup: 'Study & Notes',
    destinationLabel: 'Study → Create',
    briefExplanation: 'Generate scientifically validated SVG diagrams (FBD, ray optics, circuits, VSEPR, conics) and narrated animated lessons.',
    walkthroughTip: 'Includes interactive Concept Checks, misconception reteaching, SVG export, and Saved Library.',
    targetTab: 'create',
    studySection: 'create',
  },
  {
    id: 'guide-resources',
    name: 'Official Portals, Exam Guide & Quick Sheets',
    taskGroup: 'Study & Notes',
    destinationLabel: 'Study → Resources',
    briefExplanation: 'Verified links to NTA, JEE Advanced, SATHEE, and NCERT textbooks plus official exam pattern, marking, and Quick Sheets.',
    walkthroughTip: 'Click "+ Add to Materials" on any Quick Sheet to save it into your personal study library.',
    targetTab: 'resources',
    studySection: 'resources',
  },
  {
    id: 'guide-pyq-library',
    name: 'Official PYQ & Past Paper Library',
    taskGroup: 'Practice & PYQs',
    destinationLabel: 'Practice → PYQs',
    briefExplanation: 'Filterable JEE Main and JEE Advanced past papers with Paper PDF, Solutions PDF, and Start Mock.',
    walkthroughTip: 'Filter by Exam (Main / Advanced), Year, Session, Shift, or Chapter, and report any key issue via Report Error.',
    targetTab: 'practice',
  },
  {
    id: 'guide-cbt-mock',
    name: 'NTA / JEE Advanced CBT Mock Simulator & Strict Mock',
    taskGroup: 'Practice & PYQs',
    destinationLabel: 'Practice → Mock Tests',
    briefExplanation: 'Full 3-hour CBT simulator with 5-state question palette, section rules, partial-credit grading, and Strict Fullscreen option.',
    walkthroughTip: 'Enable Strict Mock to monitor fullscreen/focus events separately from your academic marks.',
    targetTab: 'practice',
  },
  {
    id: 'guide-flashcards-sticky',
    name: 'SM-2 Spaced Repetition Flashcards & Sticky Notes',
    taskGroup: 'Revise & Memory',
    destinationLabel: 'Revise → Flashcards / Sticky Notes',
    briefExplanation: 'Distinct destinations for active-recall flashcards (scheduled via SM-2) and color-coded page sticky notes.',
    walkthroughTip: 'Rate each card "Got it" or "Review again" to update your Due Today queue and earn XP.',
    targetTab: 'revision',
    reviseSubTab: 'flashcards',
  },
  {
    id: 'guide-mindmap',
    name: 'Concept Mind Maps & 2-Minute Guided Review',
    taskGroup: 'Revise & Memory',
    destinationLabel: 'Revise → Mind Map',
    briefExplanation: 'Visual concept maps with definitions, formulas, relationship labels (causes, depends on), and detail inspector.',
    walkthroughTip: 'Click any concept node to view its formula, common trap, and source page, or add it to your flashcards.',
    targetTab: 'revision',
    reviseSubTab: 'mindmap',
  },
  {
    id: 'guide-handwritten',
    name: 'Handwritten Notes Converter & One-Page Summary',
    taskGroup: 'Revise & Memory',
    destinationLabel: 'Revise → Handwritten Notes',
    briefExplanation: 'Convert PDFs, processed YouTube lectures, or revision sheets into ruled/grid handwritten-style notes with readable equations.',
    walkthroughTip: 'Choose Ruled, Grid, or Cornell paper style and export a multi-page PDF.',
    targetTab: 'revision',
    reviseSubTab: 'handwritten',
  },
  {
    id: 'guide-mistake-dna',
    name: 'Mistake DNA & Formula Book',
    taskGroup: 'Revise & Memory',
    destinationLabel: 'Revise → Mistake DNA / Formula Book',
    briefExplanation: 'Diagnose concept gaps vs calculation slips and search all chapter equations in one place.',
    walkthroughTip: 'Click "Practise weak topics" inside Mistake DNA to launch a targeted recovery set.',
    targetTab: 'revision',
    reviseSubTab: 'mistakes',
  },
  {
    id: 'guide-progress-mock-analysis',
    name: 'Deep Mock Analysis, Mastery & Rewards Ledger',
    taskGroup: 'Progress & Rewards',
    destinationLabel: 'Progress → Overview / Mock Analysis / Rewards',
    briefExplanation: 'Inspect subject & chapter mastery, time-per-question mock breakdowns, streaks, XP levels, and challenges.',
    walkthroughTip: 'XP is awarded idempotently once per unique completed learning event so refreshes never duplicate points.',
    targetTab: 'analytics',
  },
  {
    id: 'guide-graph-calculator',
    name: 'Equation Grapher & Scientific Calculator',
    taskGroup: 'Study Tools',
    destinationLabel: 'Top Bar → Study Tools',
    briefExplanation: 'Type your own equations (e.g. y = x^2 - 4, tan(x), 1/(x-2)) to plot computed Cartesian curves with asymptote splitting.',
    walkthroughTip: 'Open Study Tools from the top navigation bar at any time during study or revision.',
    targetTab: 'study',
    utilityTab: 'graph',
  },
];

interface AppGuideAndSearchModalProps {
  isOpen: boolean;
  initialView: 'search' | 'guide';
  onClose: () => void;
  documents: StudyDocument[];
  onNavigateTab: (tab: ActiveTab) => void;
  onSelectDocument: (doc: StudyDocument) => void;
  onOpenSyllabusChapter: (chapter: SyllabusChapterRecord, mode: 'full' | 'quick') => void;
  onOpenReviseSubTab: (subTab: QuickReviseSubTab) => void;
  onOpenUtilityTab: (tab: UtilityTab) => void;
  onOpenStudySection?: (section: NonNullable<AppGuideEntry['studySection']>) => void;
}

export const AppGuideAndSearchModal: React.FC<AppGuideAndSearchModalProps> = ({
  isOpen,
  initialView,
  onClose,
  documents,
  onNavigateTab,
  onSelectDocument,
  onOpenSyllabusChapter,
  onOpenReviseSubTab,
  onOpenUtilityTab,
  onOpenStudySection,
}) => {
  const [view, setView] = useState<'search' | 'guide'>(initialView);
  const [query, setQuery] = useState('');
  const [selectedTaskGroup, setSelectedTaskGroup] = useState<string>('All');

  useEffect(() => {
    if (isOpen) {
      setView(initialView);
    }
  }, [isOpen, initialView]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const savedCreations = useMemo<Array<{ id: string; title: string; prompt: string }>>(() => {
    if (!isOpen || typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem('learnmate_saved_creations_v1');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [isOpen]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();

    const matchedChapters = JEE_SYLLABUS_CHAPTERS.filter(
      (ch) =>
        !q ||
        ch.title.toLowerCase().includes(q) ||
        ch.subject.toLowerCase().includes(q) ||
        ch.overview.toLowerCase().includes(q) ||
        ch.topics.some((t) => t.title.toLowerCase().includes(q))
    ).slice(0, 6);

    const matchedDocs = documents
      .filter(
        (d) =>
          !q ||
          d.title.toLowerCase().includes(q) ||
          d.pages.some((p) => p.content.toLowerCase().includes(q))
      )
      .slice(0, 5);

    const matchedPapers = OFFICIAL_PYQ_PAPERS.filter(
      (p) =>
        !q ||
        p.title.toLowerCase().includes(q) ||
        String(p.year).includes(q) ||
        p.session.toLowerCase().includes(q)
    ).slice(0, 4);

    const matchedPyqs = q
      ? OFFICIAL_PYQ_QUESTIONS.filter(
          (pq) =>
            pq.prompt.toLowerCase().includes(q) ||
            pq.chapterName.toLowerCase().includes(q) ||
            pq.topicName.toLowerCase().includes(q)
        ).slice(0, 4)
      : [];

    const matchedCreations = q
      ? savedCreations
          .filter(
            (c) =>
              c.title.toLowerCase().includes(q) ||
              c.prompt.toLowerCase().includes(q)
          )
          .slice(0, 4)
      : [];

    const matchedGuide = LEARNMATE_FEATURE_GUIDE_REGISTRY.filter(
      (g) =>
        !q ||
        g.name.toLowerCase().includes(q) ||
        g.briefExplanation.toLowerCase().includes(q) ||
        g.destinationLabel.toLowerCase().includes(q) ||
        g.taskGroup.toLowerCase().includes(q)
    );

    return {
      matchedChapters,
      matchedDocs,
      matchedPapers,
      matchedPyqs,
      matchedCreations,
      matchedGuide,
    };
  }, [query, documents, savedCreations]);

  if (!isOpen) return null;

  const taskGroups = [
    'All',
    'Home & Daily Plan',
    'Study & Notes',
    'Practice & PYQs',
    'Revise & Memory',
    'Progress & Rewards',
    'Study Tools',
  ];

  const handleOpenGuideEntry = (entry: AppGuideEntry) => {
    onClose();
    if (entry.utilityTab) {
      onOpenUtilityTab(entry.utilityTab);
      return;
    }
    if (entry.reviseSubTab) {
      onOpenReviseSubTab(entry.reviseSubTab);
      return;
    }
    if (entry.studySection && onOpenStudySection) {
      onOpenStudySection(entry.studySection);
      return;
    }
    onNavigateTab(entry.targetTab);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-start justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-testid="app-guide-search-modal"
        role="dialog"
        aria-modal="true"
        aria-label={view === 'guide' ? 'LearnMate JEE App Guide' : 'Global Search'}
        className="w-full max-w-3xl rounded-2xl bg-white dark:bg-[#111827] border border-line shadow-2xl overflow-hidden my-4"
      >
        {/* Top Mode Switcher & Search Input */}
        <div className="p-4 sm:p-5 border-b border-line space-y-3 bg-canvas">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex rounded-xl border border-line bg-white dark:bg-[#1E293B] p-1">
              <button
                type="button"
                onClick={() => setView('search')}
                data-testid="modal-tab-search"
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  view === 'search' ? 'bg-brand text-white' : 'text-muted hover:text-ink'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search Everything</span>
              </button>
              <button
                type="button"
                onClick={() => setView('guide')}
                data-testid="modal-tab-guide"
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  view === 'guide' ? 'bg-brand text-white' : 'text-muted hover:text-ink'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>App Guide ({LEARNMATE_FEATURE_GUIDE_REGISTRY.length} features)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              data-testid="close-guide-search-modal-btn"
              className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-soft cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search syllabus chapters, Full/Quick notes, PYQs, uploaded materials, tools, or features…"
              data-testid="global-search-input"
              autoFocus
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-line bg-white dark:bg-[#0B1020] text-sm text-ink placeholder:text-muted focus:outline-none focus:border-brand"
            />
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto p-4 sm:p-5 space-y-6">
          {view === 'guide' ? (
            <div className="space-y-4" data-testid="app-guide-view">
              <div className="flex flex-wrap items-center gap-1.5">
                {taskGroups.map((group) => (
                  <button
                    key={group}
                    type="button"
                    onClick={() => setSelectedTaskGroup(group)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      selectedTaskGroup === group
                        ? 'bg-brand text-white'
                        : 'bg-soft text-muted hover:text-ink'
                    }`}
                  >
                    {group}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {searchResults.matchedGuide
                  .filter(
                    (g) => selectedTaskGroup === 'All' || g.taskGroup === selectedTaskGroup
                  )
                  .map((entry) => (
                    <div
                      key={entry.id}
                      data-testid={`guide-entry-${entry.id}`}
                      className="rounded-xl border border-line bg-canvas p-4 flex flex-col justify-between gap-3 hover:border-brand/50 transition-colors"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-brand-soft text-brand text-[10px] font-bold">
                            {entry.destinationLabel}
                          </span>
                          <span className="text-[10px] font-semibold text-muted">
                            {entry.taskGroup}
                          </span>
                        </div>
                        <h3 className="font-display text-sm font-bold text-ink">{entry.name}</h3>
                        <p className="text-xs text-muted leading-relaxed">
                          {entry.briefExplanation}
                        </p>
                        <p className="text-[11px] text-ink/80 bg-soft px-2.5 py-1.5 rounded-lg">
                          <strong>Tip:</strong> {entry.walkthroughTip}
                        </p>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleOpenGuideEntry(entry)}
                          data-testid={`guide-open-${entry.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg lm-btn-accent text-xs font-semibold cursor-pointer"
                        >
                          <span>Open</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5" data-testid="global-search-results">
              {/* 1. Syllabus Chapters & Built-in Notes */}
              {searchResults.matchedChapters.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                    Syllabus Chapters &amp; Built-In Notes ({searchResults.matchedChapters.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {searchResults.matchedChapters.map((ch) => (
                      <div
                        key={ch.id}
                        className="p-3 rounded-xl border border-line bg-canvas flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold text-brand block">
                            {ch.subject} · {ch.classLevel}
                          </span>
                          <p className="text-xs font-bold text-ink truncate">{ch.title}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenSyllabusChapter(ch, 'full');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-brand text-white text-[11px] font-semibold cursor-pointer"
                          >
                            Full Notes
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenSyllabusChapter(ch, 'quick');
                            }}
                            className="px-2 py-1 rounded-lg border border-line bg-white dark:bg-[#1E293B] text-[11px] font-semibold text-ink cursor-pointer"
                          >
                            Quick
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Student Uploaded Materials */}
              {searchResults.matchedDocs.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                    My Study Materials ({searchResults.matchedDocs.length})
                  </h3>
                  <div className="divide-y divide-line rounded-xl border border-line bg-canvas overflow-hidden">
                    {searchResults.matchedDocs.map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => {
                          onClose();
                          onSelectDocument(doc);
                        }}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-soft flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-ink truncate">{doc.title}</p>
                          <p className="text-[11px] text-muted truncate">
                            {doc.pageCount} pages · {doc.sourceType.toUpperCase()}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-brand shrink-0">Open in Study →</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Official PYQ Papers & Questions */}
              {(searchResults.matchedPapers.length > 0 || searchResults.matchedPyqs.length > 0) && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                    Official PYQ Papers &amp; Questions
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {searchResults.matchedPapers.map((paper) => (
                      <button
                        key={paper.id}
                        type="button"
                        onClick={() => {
                          onClose();
                          onNavigateTab('practice');
                        }}
                        className="p-3 rounded-xl border border-line bg-canvas hover:border-brand text-left flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold text-brand block">
                            {paper.exam === 'jee_advanced' ? 'JEE Advanced' : 'JEE Main'} · {paper.year}
                          </span>
                          <p className="text-xs font-bold text-ink truncate">{paper.title}</p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-brand shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Matching App Guide Features */}
              {searchResults.matchedGuide.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                    App Features &amp; Tools ({searchResults.matchedGuide.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {searchResults.matchedGuide.slice(0, 6).map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => handleOpenGuideEntry(g)}
                        className="p-3 rounded-xl border border-line bg-canvas hover:border-brand text-left flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold text-brand block">
                            {g.destinationLabel}
                          </span>
                          <p className="text-xs font-bold text-ink truncate">{g.name}</p>
                          <p className="text-[11px] text-muted truncate">{g.briefExplanation}</p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-brand shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
