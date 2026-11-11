import React, { useEffect, useMemo, useState } from 'react';
import {
  StickyNote,
  Layers,
  Network,
  FileSpreadsheet,
  RefreshCw,
  Copy,
  Check,
  Trash2,
  Edit3,
  Plus,
  Printer,
  Download,
  Shuffle,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  CheckCircle2,
  Clock,
  ZoomIn,
  ZoomOut,
  Maximize,
  ExternalLink,
  Loader2,
  Sparkles,
  AlertCircle,
  FileDown,
  Eye,
  X,
  FileText,
  AlertTriangle,
  Calendar,
  BookOpen,
  Search,
  Target,
  PenTool,
} from 'lucide-react';
import type {
  StudyDocument,
  StickyNoteItem,
  StickyNoteColor,
  FlashcardItem,
  FlashcardStatus,
  MindMapData,
  MindMapNode,
  OnePageRevisionSheet,
  QuickReviseBundle,
  MistakeInsight,
  RevisionTask,
} from '../types/study';
import { aiStudyClient } from '../services/aiClient';
import { studyStorage } from '../services/storageService';
import {
  computeContentVersion,
  formatSourceReferenceLabel,
  buildGroundedStickyNotesAndFlashcards,
  buildGroundedMindMapAndRevisionSheet,
} from '../utils/quizGrading';
import { computeNextSpacedRepetitionState } from '../utils/learnmate2Engine';
import { classifyJeeSubject } from '../utils/jeeSubjects';
import {
  buildRevisionPdfFilename,
  generateRevisionNotesPdfBytes,
  triggerPdfDownload,
} from '../utils/pdfGenerator';
import { noteGenerationCache, type HandwrittenWorkflowSource } from '../utils/phase6Engine';
import { awardLearningXp } from '../utils/rewardsEngine';
import { MathText } from './MathText';
import { HandwrittenNotesView } from './HandwrittenNotesView';

export type QuickReviseSubTab =
  | 'flashcards'
  | 'mindmap'
  | 'onepage'
  | 'handwritten'
  | 'mistakes'
  | 'formulas'
  | 'sticky';

interface QuickReviseViewProps {
  activeDocument: StudyDocument;
  initialSubTab?: QuickReviseSubTab;
  onNavigateToCitation: (pageNumber: number, quote?: string) => void;
  onAskTutorAboutConcept?: (prompt: string) => void;
  onOpenPractice?: () => void;
}

export const QuickReviseView: React.FC<QuickReviseViewProps> = ({
  activeDocument,
  initialSubTab = 'flashcards',
  onNavigateToCitation,
  onAskTutorAboutConcept,
  onOpenPractice,
}) => {
  const [subTab, setSubTab] = useState<QuickReviseSubTab>(initialSubTab);
  const [handwrittenInitialWorkflow, setHandwrittenInitialWorkflow] = useState<
    HandwrittenWorkflowSource | undefined
  >(undefined);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  // Shared QuickReviseBundle State
  const [stickyNotes, setStickyNotes] = useState<StickyNoteItem[]>([]);
  const [flashcards, setFlashcards] = useState<FlashcardItem[]>([]);
  const [mindMap, setMindMap] = useState<MindMapData | null>(null);
  const [onePageRevision, setOnePageRevision] = useState<OnePageRevisionSheet | null>(null);

  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isLoadingMindMap, setIsLoadingMindMap] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  // Sticky Notes Interactive State (distinct destination in Revise)
  const [selectedPageFilter, setSelectedPageFilter] = useState<number | 'all'>('all');
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editFormula, setEditFormula] = useState('');

  // Flashcards Interactive State
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [flashcardFilter, setFlashcardFilter] = useState<'all' | 'review_again'>('all');

  // Mind Map Interactive State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<MindMapNode | null>(null);
  const [mindMapSearch, setMindMapSearch] = useState('');
  const [collapsedBranchIds, setCollapsedBranchIds] = useState<Record<string, boolean>>({});
  const [guidedReviewActive, setGuidedReviewActive] = useState(false);
  const [guidedNodeOrderIdx, setGuidedNodeOrderIdx] = useState(0);

  // Mistakes & Revision Plan State (moved from Study sub-modes into Revise)
  const [mistakeInsights, setMistakeInsights] = useState<MistakeInsight[]>(() =>
    studyStorage.getMistakeInsights(activeDocument.id)
  );
  const [revisionPlan, setRevisionPlan] = useState<RevisionTask[]>(() =>
    studyStorage.getRevisionPlan(activeDocument.id)
  );
  const [isAnalyzingMistakes, setIsAnalyzingMistakes] = useState(false);

  // Formula Book State
  const [formulaSearch, setFormulaSearch] = useState('');
  const [addedFormulaTerm, setAddedFormulaTerm] = useState<string | null>(null);

  // Real PDF Download & Preview State
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfStatusMessage, setPdfStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const contentVersion =
    activeDocument.contentVersion || computeContentVersion(activeDocument);

  const persistBundle = (updates: Partial<QuickReviseBundle>) => {
    const existing = studyStorage.getQuickReviseBundle(activeDocument.id, contentVersion);
    const merged: QuickReviseBundle = {
      documentId: activeDocument.id,
      contentVersion,
      stickyNotes: updates.stickyNotes ?? existing?.stickyNotes ?? stickyNotes,
      flashcards: updates.flashcards ?? existing?.flashcards ?? flashcards,
      mindMap: updates.mindMap !== undefined ? updates.mindMap : existing?.mindMap ?? mindMap,
      onePageRevision:
        updates.onePageRevision !== undefined
          ? updates.onePageRevision
          : existing?.onePageRevision ?? onePageRevision,
      updatedAt: new Date().toISOString(),
    };
    studyStorage.saveQuickReviseBundle(merged);
  };

  // Load cached QuickReviseBundle, mistakes, and revision plan when document changes
  useEffect(() => {
    const cached = studyStorage.getQuickReviseBundle(activeDocument.id, contentVersion);
    if (cached) {
      setStickyNotes(cached.stickyNotes || []);
      setFlashcards(cached.flashcards || []);
      setMindMap(cached.mindMap || null);
      setOnePageRevision(cached.onePageRevision || null);
      setSelectedNode(cached.mindMap?.nodes[0] || null);
    } else {
      setStickyNotes([]);
      setFlashcards([]);
      setMindMap(null);
      setOnePageRevision(null);
      setSelectedNode(null);
    }
    setMistakeInsights(studyStorage.getMistakeInsights(activeDocument.id));
    setRevisionPlan(studyStorage.getRevisionPlan(activeDocument.id));
    setCurrentCardIdx(0);
    setIsCardFlipped(false);
    setFlashcardFilter('all');
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [activeDocument.id, contentVersion]);

  // On-demand generation trigger when switching tabs if not yet cached
  useEffect(() => {
    const cached = studyStorage.getQuickReviseBundle(activeDocument.id, contentVersion);
    if (
      (subTab === 'sticky' || subTab === 'flashcards') &&
      (!cached || cached.stickyNotes.length === 0) &&
      stickyNotes.length === 0 &&
      !isLoadingNotes
    ) {
      void handleGenerateStickyAndFlashcards(false);
    } else if (
      (subTab === 'mindmap' || subTab === 'onepage' || subTab === 'formulas') &&
      (!cached || !cached.mindMap || !cached.onePageRevision) &&
      !mindMap &&
      !isLoadingMindMap
    ) {
      void handleGenerateMindMapAndRevision(false);
    }
  }, [subTab, activeDocument.id]);

  const handleGenerateStickyAndFlashcards = async (forceRefresh = false) => {
    if (isLoadingNotes) return;
    setAiNotice(null);

    if (!forceRefresh) {
      const cached = studyStorage.getQuickReviseBundle(activeDocument.id, contentVersion);
      if (cached && cached.stickyNotes.length > 0 && cached.flashcards.length > 0) {
        setStickyNotes(cached.stickyNotes);
        setFlashcards(cached.flashcards);
        return;
      }
    }

    setIsLoadingNotes(true);
    try {
      const representativePages = noteGenerationCache.buildRepresentativePagesForFastNotes(
        activeDocument.pages,
        16
      );
      const res = await aiStudyClient.generateStickyNotesAndFlashcards({
        title: activeDocument.title,
        overview: activeDocument.overview,
        sourceType: activeDocument.sourceType,
        pages: representativePages,
        topics: activeDocument.topics,
        forceRefresh,
      });

      if (res.aiNotice) {
        setAiNotice(res.aiNotice);
      }

      if (forceRefresh && res.aiNotice && stickyNotes.length > 0) {
        setAiNotice(`${res.aiNotice} Generation failed. Your existing notes are safe.`);
        return;
      }

      setStickyNotes(res.stickyNotes);
      setFlashcards(res.flashcards);
      persistBundle({
        stickyNotes: res.stickyNotes,
        flashcards: res.flashcards,
      });
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Generation failed. Your existing notes are safe.';
      setAiNotice(msg);

      if (stickyNotes.length === 0) {
        const grounded = buildGroundedStickyNotesAndFlashcards({
          sourceType: activeDocument.sourceType,
          pages: activeDocument.pages,
          topics: activeDocument.topics,
        });
        setStickyNotes(grounded.stickyNotes);
        setFlashcards(grounded.flashcards);
        persistBundle({
          stickyNotes: grounded.stickyNotes,
          flashcards: grounded.flashcards,
        });
      }
    } finally {
      setIsLoadingNotes(false);
    }
  };

  const handleGenerateMindMapAndRevision = async (forceRefresh = false) => {
    if (isLoadingMindMap) return;
    setAiNotice(null);

    if (!forceRefresh) {
      const cached = studyStorage.getQuickReviseBundle(activeDocument.id, contentVersion);
      if (cached && cached.mindMap && cached.onePageRevision) {
        setMindMap(cached.mindMap);
        setOnePageRevision(cached.onePageRevision);
        setSelectedNode(cached.mindMap.nodes[0] || null);
        return;
      }
    }

    setIsLoadingMindMap(true);
    try {
      const representativePages = noteGenerationCache.buildRepresentativePagesForFastNotes(
        activeDocument.pages,
        16
      );
      const res = await aiStudyClient.generateMindMapAndRevisionSheet({
        title: activeDocument.title,
        overview: activeDocument.overview,
        sourceType: activeDocument.sourceType,
        pages: representativePages,
        topics: activeDocument.topics,
        forceRefresh,
      });
      if (res.aiNotice) {
        setAiNotice(res.aiNotice);
      }
      setMindMap(res.mindMap);
      setOnePageRevision(res.onePageRevision);
      setSelectedNode(res.mindMap.nodes[0] || null);
      persistBundle({
        mindMap: res.mindMap,
        onePageRevision: res.onePageRevision,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '';
      if (
        errMsg.includes('temporarily busy') ||
        errMsg.includes('quota has been reached')
      ) {
        setAiNotice(
          mindMap
            ? `${errMsg} Generation failed. Your existing notes are safe.`
            : errMsg
        );
      }
      if (!mindMap || !onePageRevision) {
        const grounded = buildGroundedMindMapAndRevisionSheet({
          title: activeDocument.title,
          overview: activeDocument.overview,
          sourceType: activeDocument.sourceType,
          pages: activeDocument.pages,
          topics: activeDocument.topics,
        });
        setMindMap(grounded.mindMap);
        setOnePageRevision(grounded.onePageRevision);
        setSelectedNode(grounded.mindMap.nodes[0] || null);
        persistBundle({
          mindMap: grounded.mindMap,
          onePageRevision: grounded.onePageRevision,
        });
      }
    } finally {
      setIsLoadingMindMap(false);
    }
  };

  /* ---------------- Mistakes & Revision Plan Analysis ---------------- */
  const handleAnalyzeLatestQuizMistakes = async () => {
    const attempts = studyStorage.getQuizAttempts(activeDocument.id);
    const latest = attempts[0];
    if (!latest) return;

    setIsAnalyzingMistakes(true);
    setAiNotice(null);
    try {
      const res = await aiStudyClient.analyzeMistakesAndPlan({
        documentId: activeDocument.id,
        title: activeDocument.title,
        pages: activeDocument.pages,
        attempt: latest,
      });
      studyStorage.saveMistakeInsights(activeDocument.id, res.mistakes);
      studyStorage.saveRevisionPlan(activeDocument.id, res.revisionPlan);
      setMistakeInsights(res.mistakes);
      setRevisionPlan(res.revisionPlan);
    } catch (err) {
      setAiNotice(
        err instanceof Error
          ? err.message
          : 'Could not diagnose mistakes right now. Please try again.'
      );
    } finally {
      setIsAnalyzingMistakes(false);
    }
  };

  const handleToggleRevisionTask = (taskId: string) => {
    const updated = revisionPlan.map((t) =>
      t.id === taskId
        ? { ...t, completed: !t.completed, updatedAt: new Date().toISOString() }
        : t
    );
    setRevisionPlan(updated);
    studyStorage.saveRevisionPlan(activeDocument.id, updated);
  };

  /* ---------------- Sticky Notes Actions ---------------- */
  const handleCopyNote = async (note: StickyNoteItem) => {
    const text = `${note.title}\n${note.content}${note.formula ? `\nFormula: ${note.formula}` : ''} (${note.sourceLabel})`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedNoteId(note.id);
      setTimeout(() => setCopiedNoteId(null), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleStartEditNote = (note: StickyNoteItem) => {
    setEditingNoteId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditFormula(note.formula || '');
  };

  const handleSaveEditNote = (noteId: string) => {
    const updated = stickyNotes.map((n) =>
      n.id === noteId
        ? {
            ...n,
            title: editTitle.trim() || n.title,
            content: editContent.trim() || n.content,
            formula: editFormula.trim() || undefined,
          }
        : n
    );
    setStickyNotes(updated);
    persistBundle({ stickyNotes: updated });
    setEditingNoteId(null);
  };

  const handleDeleteNote = (noteId: string) => {
    const updated = stickyNotes.filter((n) => n.id !== noteId);
    setStickyNotes(updated);
    persistBundle({ stickyNotes: updated });
  };

  const handleAddBlankNote = () => {
    const colors: StickyNoteColor[] = ['yellow', 'pink', 'blue', 'green'];
    const newNote: StickyNoteItem = {
      id: `sn-custom-${Date.now()}`,
      title: 'New Quick Note',
      content: 'Click Edit to customize your own key takeaway or formula.',
      sourcePage: 1,
      sourceLabel: formatSourceReferenceLabel(activeDocument, 1),
      color: colors[stickyNotes.length % colors.length],
    };
    const updated = [newNote, ...stickyNotes];
    setStickyNotes(updated);
    persistBundle({ stickyNotes: updated });
    handleStartEditNote(newNote);
  };

  const handlePromoteStickyToFlashcard = (note: StickyNoteItem) => {
    const newCard: FlashcardItem = {
      id: `fc-note-${Date.now()}`,
      frontQuestion: `What is the key takeaway or formula for "${note.title}"?`,
      backAnswer: note.formula ? `${note.content} (${note.formula})` : note.content,
      topic: note.title,
      sourcePage: note.sourcePage,
      sourceLabel: note.sourceLabel,
      status: 'unreviewed',
    };
    const updated = [newCard, ...flashcards];
    setFlashcards(updated);
    persistBundle({ flashcards: updated });
    setCurrentCardIdx(0);
    setIsCardFlipped(false);
  };

  /* ---------------- Flashcards Actions ---------------- */
  const visibleFlashcards =
    flashcardFilter === 'review_again'
      ? flashcards.filter((c) => c.status === 'review_again')
      : flashcards;

  const activeFlashcard =
    visibleFlashcards[Math.min(currentCardIdx, Math.max(0, visibleFlashcards.length - 1))] ||
    null;

  const handleMarkFlashcard = (status: FlashcardStatus) => {
    if (!activeFlashcard) return;
    const sr = computeNextSpacedRepetitionState(activeFlashcard, status);
    const updated = flashcards.map((c) =>
      c.id === activeFlashcard.id
        ? {
            ...c,
            status,
            intervalDays: sr.intervalDays,
            easeFactor: sr.easeFactor,
            repetitions: sr.repetitions,
            nextReviewAt: sr.nextReviewAt,
          }
        : c
    );
    setFlashcards(updated);
    persistBundle({ flashcards: updated });

    // Award idempotent XP per unique flashcard review
    awardLearningXp({
      eventId: `flashcard-review-${activeDocument.id}-${activeFlashcard.id}`,
      actionType: 'flashcard_deck_reviewed',
      xp: 5,
      label: `Reviewed flashcard: ${activeFlashcard.topic}`,
    });

    setIsCardFlipped(false);
    if (currentCardIdx < visibleFlashcards.length - 1) {
      setCurrentCardIdx((i) => i + 1);
    }
  };

  const handleShuffleFlashcards = () => {
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5);
    setFlashcards(shuffled);
    persistBundle({ flashcards: shuffled });
    setCurrentCardIdx(0);
    setIsCardFlipped(false);
  };

  /* ---------------- Mind Map Export & Layout ---------------- */
  const handleDownloadMindMapSvg = () => {
    const svgEl = document.getElementById('learnmate-mindmap-svg');
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgEl);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeSlug = activeDocument.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    link.download = `LearnMate_MindMap_${safeSlug}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /* ---------------- One-Page Revision & Real PDF Download ---------------- */
  const ensureRevisionDataReady = (): {
    sheet: OnePageRevisionSheet;
    notes: StickyNoteItem[];
    cards: FlashcardItem[];
  } => {
    let currentNotes = stickyNotes;
    let currentCards = flashcards;
    if (currentNotes.length === 0) {
      const grounded = buildGroundedStickyNotesAndFlashcards({
        sourceType: activeDocument.sourceType,
        pages: activeDocument.pages,
        topics: activeDocument.topics,
      });
      currentNotes = grounded.stickyNotes;
      currentCards = grounded.flashcards;
      setStickyNotes(currentNotes);
      setFlashcards(currentCards);
    }

    let currentSheet = onePageRevision;
    if (!currentSheet) {
      const grounded = buildGroundedMindMapAndRevisionSheet({
        title: activeDocument.title,
        overview: activeDocument.overview,
        sourceType: activeDocument.sourceType,
        pages: activeDocument.pages,
        topics: activeDocument.topics,
      });
      currentSheet = grounded.onePageRevision;
      setOnePageRevision(currentSheet);
      if (!mindMap) setMindMap(grounded.mindMap);
      persistBundle({
        stickyNotes: currentNotes,
        flashcards: currentCards,
        mindMap: mindMap || grounded.mindMap,
        onePageRevision: currentSheet,
      });
    }

    return {
      sheet: currentSheet,
      notes: currentNotes,
      cards: currentCards,
    };
  };

  const handleDownloadRevisionPdf = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    setPdfStatusMessage(null);
    try {
      const { sheet, notes, cards } = ensureRevisionDataReady();
      const pdfBytes = await generateRevisionNotesPdfBytes({
        document: activeDocument,
        onePageRevision: sheet,
        stickyNotes: notes,
        flashcards: cards,
        mindMap,
      });
      const filename = buildRevisionPdfFilename(activeDocument.title, 'Revision_Notes');
      triggerPdfDownload(pdfBytes, filename);
      setPdfStatusMessage({
        type: 'success',
        text: `Downloaded ${filename} (${Math.max(1, Math.round(pdfBytes.byteLength / 1024))} KB PDF)`,
      });
      setTimeout(() => setPdfStatusMessage(null), 5000);
    } catch (err) {
      setPdfStatusMessage({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Could not generate PDF. Please try again.',
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleOpenPreviewModal = () => {
    ensureRevisionDataReady();
    setPreviewModalOpen(true);
  };

  const handleDownloadOnePageRevisionTxt = () => {
    const { sheet } = ensureRevisionDataReady();
    const lines: string[] = [
      '============================================================',
      `ONE-PAGE REVISION SHEET: ${sheet.chapterTitle.toUpperCase()}`,
      '============================================================',
      sheet.overview,
      '',
      '1. ESSENTIAL CONCEPTS',
      '------------------------------------------------------------',
      ...sheet.essentialConcepts.map(
        (c, idx) => `${idx + 1}. ${c.title} [${c.sourceLabel}]: ${c.summary}`
      ),
      '',
      '2. KEY FORMULAS & DEFINITIONS',
      '------------------------------------------------------------',
      ...sheet.formulasAndDefinitions.map(
        (f) => `• ${f.term} (${f.sourceLabel}): ${f.formulaOrDef}`
      ),
      '',
      '3. CONCEPT RELATIONSHIPS',
      '------------------------------------------------------------',
      ...sheet.keyRelationships.map((r) => `• ${r}`),
      '',
      '4. COMMON MISTAKES TO AVOID',
      '------------------------------------------------------------',
      ...sheet.commonMistakesToAvoid.map((m) => `⚠ ${m}`),
      '',
      '5. QUICK RECALL SELF-CHECK',
      '------------------------------------------------------------',
      ...sheet.quickRecallQuestions.map(
        (q, i) => `Q${i + 1}: ${q.question}\n   Ans: ${q.shortAnswer}`
      ),
      '============================================================',
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeSlug = activeDocument.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    link.download = `LearnMate_OnePage_Revision_${safeSlug}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const knowItCount = flashcards.filter((c) => c.status === 'know_it').length;
  const reviewAgainCount = flashcards.filter((c) => c.status === 'review_again').length;

  const currentPageNum = typeof selectedPageFilter === 'number' ? selectedPageFilter : 1;
  const totalPagesCount = Math.max(1, activeDocument.pages.length || 1);

  const canonicalTopicsList =
    activeDocument.topics.length > 0
      ? activeDocument.topics.map((t, idx) => ({
          id: t.id,
          code: `${idx + 1}`,
          name: t.name.replace(/^\d+\.\d+\s*/, ''),
          page: t.sourcePages[0] || idx + 1,
        }))
      : activeDocument.pages.slice(0, 8).map((p, idx) => ({
          id: `page-${p.pageNumber}`,
          code: `${idx + 1}`,
          name: p.title || `Page ${p.pageNumber}`,
          page: p.pageNumber,
        }));

  const subjectLabel =
    classifyJeeSubject(
      `${activeDocument.title} ${activeDocument.topics.map((t) => t.name).join(' ')}`
    ) || 'Revise';

  // Formula Book entries extracted from onePageRevision + stickyNotes with formulas
  const formulaBookItems = useMemo(() => {
    const items: Array<{
      term: string;
      formulaOrDef: string;
      sourcePage: number;
      sourceLabel: string;
    }> = [];
    const seen = new Set<string>();

    if (onePageRevision?.formulasAndDefinitions) {
      for (const f of onePageRevision.formulasAndDefinitions) {
        const key = `${f.term.toLowerCase()}::${f.formulaOrDef.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({
            term: f.term,
            formulaOrDef: f.formulaOrDef,
            sourcePage: 1,
            sourceLabel: f.sourceLabel || 'Page 1',
          });
        }
      }
    }

    for (const note of stickyNotes) {
      if (note.formula) {
        const key = `${note.title.toLowerCase()}::${note.formula.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({
            term: note.title,
            formulaOrDef: note.formula,
            sourcePage: note.sourcePage,
            sourceLabel: note.sourceLabel,
          });
        }
      }
    }

    const q = formulaSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.term.toLowerCase().includes(q) ||
        i.formulaOrDef.toLowerCase().includes(q)
    );
  }, [onePageRevision, stickyNotes, formulaSearch]);

  const handleAddFormulaToFlashcard = (item: {
    term: string;
    formulaOrDef: string;
    sourcePage: number;
    sourceLabel: string;
  }) => {
    const newCard: FlashcardItem = {
      id: `fc-formula-${Date.now()}`,
      frontQuestion: `State the formula or definition for: ${item.term}`,
      backAnswer: item.formulaOrDef,
      topic: item.term,
      sourcePage: item.sourcePage,
      sourceLabel: item.sourceLabel,
      status: 'unreviewed',
    };
    const updated = [newCard, ...flashcards];
    setFlashcards(updated);
    persistBundle({ flashcards: updated });
    setAddedFormulaTerm(item.term);
    setTimeout(() => setAddedFormulaTerm(null), 2000);
  };

  const attempts = studyStorage.getQuizAttempts(activeDocument.id);
  const latestAttempt = attempts[0] || null;
  const latestWrongCount = latestAttempt
    ? latestAttempt.answers.filter((g) => !g.isCorrect).length
    : 0;

  return (
    <div className="space-y-6 flex-1 flex flex-col">
      {/* Editorial Header */}
      <div className="space-y-4 border-b border-line pb-0 no-print">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
          <div className="space-y-1">
            <div className="lm-kicker text-xs font-bold uppercase tracking-wider text-brand">
              REVISE
            </div>
            <h1 className="lm-editorial-title text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">
              Revise
            </h1>
            <p className="lm-editorial-subtitle text-xs sm:text-sm text-body">
              Review concepts, mind maps, formula sheets, and spaced repetition cards.
            </p>
          </div>

          {/* Primary PDF Export & Preview Actions (matching wanted/d & f Block Revision Mind Map-4.png) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="preview-revision-pdf-btn"
              onClick={handleOpenPreviewModal}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-line bg-white dark:bg-[#121A2E] hover:bg-soft text-xs font-semibold text-ink transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-brand" />
              <span>Preview Notes</span>
            </button>

            <button
              type="button"
              data-testid="download-revision-pdf-btn"
              disabled={isGeneratingPdf}
              onClick={() => void handleDownloadRevisionPdf()}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl lm-btn-accent text-xs font-semibold transition-all cursor-pointer disabled:opacity-60"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </>
              )}
            </button>

            <button
              type="button"
              data-testid="download-revision-txt-btn"
              onClick={handleDownloadOnePageRevisionTxt}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-line bg-white dark:bg-[#121A2E] hover:bg-soft text-xs font-semibold text-muted hover:text-ink transition-colors cursor-pointer"
              title="Download plain text (.txt) version"
            >
              <FileText className="w-3.5 h-3.5 text-muted" />
              <span>TXT</span>
            </button>
          </div>
        </div>

        {pdfStatusMessage && (
          <div
            role="status"
            data-testid="revision-pdf-status"
            className={`flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border ${
              pdfStatusMessage.type === 'success'
                ? 'bg-success-soft border-success/30 text-success'
                : 'bg-brand-soft border-brand/30 text-brand'
            }`}
          >
            <span className="flex items-center gap-2">
              {pdfStatusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{pdfStatusMessage.text}</span>
            </span>
            <button
              type="button"
              onClick={() => setPdfStatusMessage(null)}
              className="text-xs underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 7 Distinct Revise Tabs: Flashcards · Sticky Notes · Mind map · Summary sheet · Handwritten Notes · Mistakes · Formula Book */}
        <div
          role="tablist"
          aria-label="Revise Tools"
          className="flex items-center gap-5 sm:gap-6 overflow-x-auto"
        >
          {(
            [
              { id: 'flashcards', label: 'Flashcards', icon: Layers },
              { id: 'sticky', label: 'Sticky Notes', icon: StickyNote },
              { id: 'mindmap', label: 'Mind map', icon: Network },
              { id: 'onepage', label: 'Summary sheet', icon: FileSpreadsheet },
              { id: 'handwritten', label: 'Handwritten Notes', icon: PenTool },
              { id: 'mistakes', label: 'Mistakes', icon: AlertTriangle },
              { id: 'formulas', label: 'Formula Book', icon: BookOpen },
            ] as const
          ).map((tabItem) => {
            const Icon = tabItem.icon;
            const active = subTab === tabItem.id;
            return (
              <button
                key={tabItem.id}
                type="button"
                role="tab"
                data-testid={`revise-tab-${tabItem.id}`}
                aria-selected={active}
                onClick={() => setSubTab(tabItem.id)}
                className={`relative pb-3 pt-1 flex items-center gap-2 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  active ? 'text-brand font-semibold' : 'text-muted hover:text-ink'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-brand' : 'text-[#9CA3AF]'}`} />
                <span>{tabItem.label}</span>
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-t-full bg-brand" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {aiNotice && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-canvas border border-line text-xs font-medium text-muted no-print"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-brand shrink-0" />
            <span>{aiNotice}</span>
          </div>
          <button
            type="button"
            disabled={isLoadingNotes || isLoadingMindMap}
            onClick={() => {
              if (subTab === 'sticky' || subTab === 'flashcards') {
                void handleGenerateStickyAndFlashcards(true);
              } else {
                void handleGenerateMindMapAndRevision(true);
              }
            }}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-white border border-line hover:bg-canvas text-ink font-semibold shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* =================================================================
          1A. FLASHCARDS (Distinct Destination)
         ================================================================= */}
      {subTab === 'flashcards' && (
        <div className="space-y-8 flex-1">
          {/* Interactive Flip-Card Deck */}
          <div className="space-y-5 max-w-2xl mx-auto w-full">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Know it: {knowItCount}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  Review again: {reviewAgainCount}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFlashcardFilter((prev) =>
                      prev === 'all' ? 'review_again' : 'all'
                    );
                    setCurrentCardIdx(0);
                    setIsCardFlipped(false);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                    flashcardFilter === 'review_again'
                      ? 'bg-amber-100 border-amber-300 text-amber-900'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {flashcardFilter === 'review_again'
                    ? `Showing Review Again (${reviewAgainCount})`
                    : 'Filter: Review Again'}
                </button>

                <button
                  type="button"
                  onClick={handleShuffleFlashcards}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>Shuffle</span>
                </button>
              </div>
            </div>

            {isLoadingNotes ? (
              <div className="py-12 text-center space-y-3">
                <Loader2 className="w-7 h-7 animate-spin text-brand mx-auto" />
                <p className="text-sm font-medium text-slate-700">
                  Preparing active-recall flashcards and sticky notes...
                </p>
              </div>
            ) : !activeFlashcard ? (
              <div className="p-8 rounded-2xl bg-canvas border border-slate-200 text-center space-y-3">
                <CheckCircle2 className="w-8 h-8 text-success mx-auto" />
                <h3 className="text-base font-bold text-ink">
                  No cards in &ldquo;Review again&rdquo;
                </h3>
                <p className="text-xs text-muted">
                  All flashcards are marked as known or unreviewed.
                </p>
                <button
                  type="button"
                  onClick={() => setFlashcardFilter('all')}
                  className="px-4 py-2 rounded-full bg-brand text-white text-xs font-semibold cursor-pointer"
                >
                  Show All Flashcards ({flashcards.length})
                </button>
              </div>
            ) : (
              <>
                <div
                  role="button"
                  tabIndex={0}
                  data-testid="flashcard-interactive"
                  aria-label={
                    isCardFlipped
                      ? `Flashcard Answer: ${activeFlashcard.backAnswer}. Click or press Space to flip.`
                      : `Flashcard Question: ${activeFlashcard.frontQuestion}. Click or press Space to flip.`
                  }
                  onClick={() => setIsCardFlipped((f) => !f)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setIsCardFlipped((f) => !f);
                    }
                  }}
                  className={`relative rounded-3xl border-2 p-7 sm:p-9 min-h-[240px] flex flex-col justify-between transition-all cursor-pointer select-none shadow-sm ${
                    isCardFlipped
                      ? 'bg-success-soft border-success/50'
                      : 'bg-brand-soft border-brand/40 hover:border-brand'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[11px] ${
                        isCardFlipped
                          ? 'bg-success text-white'
                          : 'bg-brand text-white'
                      }`}
                    >
                      {isCardFlipped ? 'Back · Explanation' : 'Front · Question'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-medium">
                        {activeFlashcard.topic}
                      </span>
                      {activeFlashcard.intervalDays !== undefined && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold text-[11px]">
                          SM-2: {activeFlashcard.intervalDays}d interval
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToCitation(
                            activeFlashcard.sourcePage,
                            activeFlashcard.backAnswer
                          );
                        }}
                        className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-brand font-semibold hover:underline cursor-pointer"
                      >
                        {activeFlashcard.sourceLabel}
                      </button>
                    </div>
                  </div>

                  <div className="my-6 text-center px-2">
                    <MathText
                      text={
                        isCardFlipped
                          ? activeFlashcard.backAnswer
                          : activeFlashcard.frontQuestion
                      }
                      className="text-lg sm:text-xl font-semibold text-ink leading-relaxed"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted">
                    <span className="tabular-nums font-semibold">
                      Card {currentCardIdx + 1} of {visibleFlashcards.length}
                    </span>
                    <span className="inline-flex items-center gap-1 font-medium text-brand">
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Click or press Space to flip</span>
                    </span>
                  </div>
                </div>

                {/* Self-Check & Navigation Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    disabled={currentCardIdx === 0}
                    onClick={() => {
                      setCurrentCardIdx((i) => Math.max(0, i - 1));
                      setIsCardFlipped(false);
                    }}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleMarkFlashcard('review_again')}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                        activeFlashcard.status === 'review_again'
                          ? 'bg-warning text-slate-950'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Review again</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMarkFlashcard('know_it')}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                        activeFlashcard.status === 'know_it'
                          ? 'bg-success text-white'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Know it</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={currentCardIdx >= visibleFlashcards.length - 1}
                    onClick={() => {
                      setCurrentCardIdx((i) =>
                        Math.min(visibleFlashcards.length - 1, i + 1)
                      );
                      setIsCardFlipped(false);
                    }}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* =================================================================
          1B. STICKY NOTES (Distinct Destination)
         ================================================================= */}
      {subTab === 'sticky' && (
        <div className="space-y-6 flex-1">
          <div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Chapter & Page Navigation Sidebar */}
              <aside className="lg:col-span-3 lm-card-editorial p-4 space-y-4 no-print">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-soft">
                  <div className="flex items-center gap-2 min-w-0">
                    <StickyNote className="w-4 h-4 text-brand shrink-0" />
                    <span className="text-xs font-semibold text-ink truncate">
                      Sticky Notes · {activeDocument.title}
                    </span>
                  </div>
                </div>

                {/* Page Switcher */}
                <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-canvas border border-line text-xs font-medium text-ink">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedPageFilter(Math.max(1, currentPageNum - 1))
                    }
                    className="p-1 rounded hover:bg-brand-soft text-muted hover:text-ink cursor-pointer"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPageFilter('all')}
                    className="tabular-nums font-medium cursor-pointer"
                    title="Click to show all pages"
                  >
                    {selectedPageFilter === 'all'
                      ? `1–${totalPagesCount} / ${totalPagesCount}`
                      : `${currentPageNum} / ${totalPagesCount}`}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedPageFilter(Math.min(totalPagesCount, currentPageNum + 1))
                    }
                    className="p-1 rounded hover:bg-brand-soft text-muted hover:text-ink cursor-pointer"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Chapter / Section List */}
                <div className="space-y-1">
                  {canonicalTopicsList.map((topic, idx) => {
                    const isSelected =
                      selectedPageFilter === 'all'
                        ? idx === 0
                        : selectedPageFilter === topic.page;
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() =>
                          setSelectedPageFilter(
                            selectedPageFilter === topic.page ? 'all' : topic.page
                          )
                        }
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors flex items-start gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-brand-soft text-brand font-semibold border-l-2 border-brand'
                            : 'text-muted hover:bg-canvas hover:text-ink'
                        }`}
                      >
                        <span className="tabular-nums opacity-80">{topic.code}</span>
                        <span className="leading-snug">{topic.name}</span>
                      </button>
                    );
                  })}
                </div>
              </aside>

              {/* Right 9 Columns: Sticky Notes Grid */}
              <div className="lg:col-span-9 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 no-print">
                  <span className="text-xs font-medium text-muted">
                    <strong className="text-ink">{stickyNotes.length} sticky notes</strong>{' '}
                    from {activeDocument.title.replace(/\.pdf$/i, '')}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAddBlankNote}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-white hover:bg-canvas text-xs font-medium text-ink cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-muted" />
                      <span>Add Note</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-white hover:bg-canvas text-xs font-medium text-ink cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-muted" />
                      <span>Print</span>
                    </button>
                    <button
                      type="button"
                      disabled={isLoadingNotes}
                      onClick={() => void handleGenerateStickyAndFlashcards(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg lm-btn-accent text-xs font-semibold cursor-pointer disabled:opacity-60"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingNotes ? 'animate-spin' : ''}`} />
                      <span>Regenerate</span>
                    </button>
                  </div>
                </div>

                {!isLoadingNotes && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 print-sheet">
                    {stickyNotes.map((note) => {
                      const colorClass =
                        note.color === 'pink'
                          ? 'lm-sticky-pink'
                          : note.color === 'blue'
                          ? 'lm-sticky-blue'
                          : note.color === 'green'
                          ? 'lm-sticky-green'
                          : 'lm-sticky-yellow';
                      const isEditing = editingNoteId === note.id;

                      return (
                        <div
                          key={note.id}
                          data-testid="sticky-note-card"
                          className={`rounded-xl border p-5 transition-transform hover:-translate-y-0.5 flex flex-col justify-between min-h-[215px] ${colorClass}`}
                        >
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                placeholder="Short title"
                                className="w-full px-2.5 py-1 rounded-lg bg-white/80 border border-black/15 text-sm font-bold text-ink"
                              />
                              <textarea
                                rows={3}
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                placeholder="10-30 words concise note"
                                className="w-full px-2.5 py-1.5 rounded-lg bg-white/80 border border-black/15 text-sm text-ink"
                              />
                              <input
                                type="text"
                                value={editFormula}
                                onChange={(e) => setEditFormula(e.target.value)}
                                placeholder="Optional formula"
                                className="w-full px-2.5 py-1 rounded-lg bg-white/80 border border-black/15 text-xs text-ink"
                              />
                              <div className="flex justify-end gap-1.5 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingNoteId(null)}
                                  className="px-2.5 py-1 rounded-md bg-white/70 text-xs font-semibold text-muted cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditNote(note.id)}
                                  className="px-2.5 py-1 rounded-md lm-btn-accent text-xs font-semibold cursor-pointer"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="space-y-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <h3 className="lm-sticky-font text-xl font-bold leading-snug text-ink">
                                    {note.title}
                                  </h3>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onNavigateToCitation(note.sourcePage, note.content)
                                    }
                                    className="px-2 py-0.5 rounded bg-black/5 hover:bg-black/10 text-[11px] font-medium text-muted shrink-0 cursor-pointer"
                                    title="Jump to source in material"
                                  >
                                    {note.sourceLabel}
                                  </button>
                                </div>

                                <p className="lm-sticky-font text-[16px] leading-relaxed text-inherit">
                                  {note.content}
                                </p>

                                {note.formula && (
                                  <div className="px-3 py-1.5 rounded-lg bg-white/60 dark:bg-black/30 border border-black/10 dark:border-white/15 text-sm font-serif-editorial italic text-ink">
                                    <MathText text={note.formula} />
                                  </div>
                                )}
                              </div>

                              <div className="pt-3 mt-2 border-t border-black/5 flex items-center justify-between gap-1 no-print">
                                <button
                                  type="button"
                                  onClick={() => handlePromoteStickyToFlashcard(note)}
                                  className="text-[11px] font-semibold text-brand hover:underline cursor-pointer"
                                  title="Add this sticky note to your flashcard deck"
                                >
                                  + Add to cards
                                </button>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditNote(note)}
                                    aria-label={`Edit sticky note ${note.title}`}
                                    title="Edit Sticky Note"
                                    className="p-1.5 rounded-lg hover:bg-black/10 text-muted hover:text-ink transition-colors cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleCopyNote(note)}
                                    aria-label={`Copy sticky note ${note.title}`}
                                    title="Copy Note"
                                    className="p-1.5 rounded-lg hover:bg-black/10 text-muted hover:text-ink transition-colors cursor-pointer"
                                  >
                                    {copiedNoteId === note.id ? (
                                      <Check className="w-3.5 h-3.5 text-success" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteNote(note.id)}
                                    aria-label={`Delete sticky note ${note.title}`}
                                    title="Delete Note"
                                    className="p-1.5 rounded-lg hover:bg-black/10 text-muted hover:text-ink transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================
          2. INTERACTIVE MIND MAP VIEW (Matches Image 9 & Section 14)
          Rich Concept Cards + Relationship Labels + Guided 2-Min Review
         ================================================================= */}
      {subTab === 'mindmap' && (
        <div className="space-y-4 flex-1 flex flex-col">
          {/* Mind Map Top Control Bar matching Image 9 */}
          <div className="flex flex-wrap items-center justify-between gap-3 no-print bg-white p-3.5 rounded-2xl border border-line shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-52 sm:w-64">
                <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={mindMapSearch}
                  onChange={(e) => setMindMapSearch(e.target.value)}
                  placeholder="Search concept node..."
                  aria-label="Search mind map concept"
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-canvas border border-line text-xs text-ink focus:outline-none focus:border-brand"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!mindMap) return;
                  const nextState = !guidedReviewActive;
                  setGuidedReviewActive(nextState);
                  setGuidedNodeOrderIdx(0);
                  if (nextState && mindMap.nodes.length > 0) {
                    setSelectedNode(mindMap.nodes[0]);
                  }
                }}
                data-testid="mindmap-review-2min-btn"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  guidedReviewActive
                    ? 'bg-brand text-white border-brand'
                    : 'bg-brand-soft/60 text-brand border-brand/30 hover:bg-brand-soft'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{guidedReviewActive ? 'Exit 2-Min Review' : 'Review 2 min'}</span>
              </button>

              {Object.keys(collapsedBranchIds).some((k) => collapsedBranchIds[k]) && (
                <button
                  type="button"
                  onClick={() => setCollapsedBranchIds({})}
                  className="px-2.5 py-1.5 rounded-xl border border-line bg-canvas text-xs font-semibold text-ink cursor-pointer"
                >
                  Expand All Branches
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                aria-label="Fit mind map to screen"
                className="px-2.5 py-1.5 rounded-lg border border-line bg-white hover:bg-canvas text-xs font-semibold text-ink cursor-pointer inline-flex items-center gap-1"
              >
                <Maximize className="w-3.5 h-3.5" />
                <span>Fit</span>
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.65, Number((z - 0.15).toFixed(2))))}
                aria-label="Zoom out mind map"
                className="p-1.5 rounded-lg border border-line bg-white hover:bg-canvas text-ink cursor-pointer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold tabular-nums px-1.5">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(1.6, Number((z + 0.15).toFixed(2))))}
                aria-label="Zoom in mind map"
                className="p-1.5 rounded-lg border border-line bg-white hover:bg-canvas text-ink cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleDownloadMindMapSvg}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-line bg-white hover:bg-canvas text-xs font-semibold text-ink cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export SVG</span>
              </button>
              <button
                type="button"
                disabled={isLoadingMindMap}
                onClick={() => void handleGenerateMindMapAndRevision(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-brand text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMindMap ? 'animate-spin' : ''}`} />
                <span>Regenerate</span>
              </button>
            </div>
          </div>

          {/* Guided 2-Minute Step-by-Step Banner */}
          {guidedReviewActive && mindMap && mindMap.nodes.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-brand-soft/70 border border-brand/30 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs">
                <span className="px-2.5 py-0.5 rounded-full bg-brand text-white font-bold">
                  Guided Concept Walkthrough ({guidedNodeOrderIdx + 1} / {mindMap.nodes.length})
                </span>
                <span className="font-bold text-ink">
                  {mindMap.nodes[guidedNodeOrderIdx]?.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={guidedNodeOrderIdx === 0}
                  onClick={() => {
                    const prevIdx = Math.max(0, guidedNodeOrderIdx - 1);
                    setGuidedNodeOrderIdx(prevIdx);
                    setSelectedNode(mindMap.nodes[prevIdx]);
                  }}
                  className="px-3 py-1 rounded-lg bg-white border border-line text-xs font-semibold text-ink disabled:opacity-40 cursor-pointer"
                >
                  ← Previous Node
                </button>
                <button
                  type="button"
                  disabled={guidedNodeOrderIdx >= mindMap.nodes.length - 1}
                  onClick={() => {
                    const nextIdx = Math.min(mindMap.nodes.length - 1, guidedNodeOrderIdx + 1);
                    setGuidedNodeOrderIdx(nextIdx);
                    setSelectedNode(mindMap.nodes[nextIdx]);
                  }}
                  className="px-3 py-1 rounded-lg bg-brand text-white text-xs font-semibold disabled:opacity-40 cursor-pointer"
                >
                  Next Concept →
                </button>
              </div>
            </div>
          )}

          {isLoadingMindMap || !mindMap ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-7 h-7 animate-spin text-success mx-auto" />
              <p className="text-sm font-medium text-slate-700">
                Mapping grounded concept relationships from {activeDocument.title}...
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
              <div className="xl:col-span-8 rounded-2xl bg-canvas border border-line overflow-hidden relative min-h-[480px] flex items-center justify-center">
                {(() => {
                  const width = 1040;
                  const height = 620;
                  const cx = width / 2;
                  const cy = height / 2;

                  const centralNode =
                    mindMap.nodes.find((n) => n.level === 'central') || mindMap.nodes[0];
                  const branches = mindMap.nodes.filter((n) => n.level === 'branch');
                  const subtopics = mindMap.nodes.filter(
                    (n) =>
                      n.level === 'subtopic' &&
                      (!n.parentId || !collapsedBranchIds[n.parentId])
                  );

                  const posMap = new Map<string, { x: number; y: number }>();
                  if (centralNode) {
                    posMap.set(centralNode.id, { x: cx, y: cy });
                  }

                  branches.forEach((b, idx) => {
                    const angle =
                      (idx / Math.max(1, branches.length)) * Math.PI * 2 - Math.PI / 2;
                    const rx = 230;
                    const ry = 145;
                    const bx = cx + Math.cos(angle) * rx;
                    const by = cy + Math.sin(angle) * ry;
                    posMap.set(b.id, { x: bx, y: by });

                    const children = subtopics.filter((s) => s.parentId === b.id);
                    children.forEach((child, cIdx) => {
                      const cosA = Math.cos(angle);
                      const sinA = Math.sin(angle);
                      let sx = bx;
                      let sy = by;
                      if (Math.abs(cosA) > 0.5) {
                        sx = bx + Math.sign(cosA) * 205;
                        sy = by + (cIdx - (children.length - 1) / 2) * 68;
                      } else {
                        sx = bx + (cIdx - (children.length - 1) / 2) * 195;
                        sy = by + Math.sign(sinA) * 110;
                      }
                      posMap.set(child.id, {
                        x: Math.max(105, Math.min(width - 105, sx)),
                        y: Math.max(52, Math.min(height - 52, sy)),
                      });
                    });
                  });

                  const isDark =
                    typeof document !== 'undefined' &&
                    document.documentElement.classList.contains('dark');
                  const colorPalette = isDark
                    ? {
                        blue: { stroke: '#60A5FA', fill: '#172554', text: '#EFF6FF', sub: '#93C5FD' },
                        red: { stroke: '#F87171', fill: '#450A0A', text: '#FEF2F2', sub: '#FCA5A5' },
                        yellow: { stroke: '#FBBF24', fill: '#451A03', text: '#FFFBEB', sub: '#FDE68A' },
                        green: { stroke: '#34D399', fill: '#064E3B', text: '#ECFDF5', sub: '#6EE7B7' },
                      }
                    : {
                        blue: { stroke: '#4F46E5', fill: '#EEF2FF', text: '#172033', sub: '#4338CA' },
                        red: { stroke: '#DC2626', fill: '#FEF2F2', text: '#172033', sub: '#B91C1C' },
                        yellow: { stroke: '#D97706', fill: '#FFFBEB', text: '#172033', sub: '#B45309' },
                        green: { stroke: '#059669', fill: '#ECFDF5', text: '#172033', sub: '#047857' },
                      };

                  const relationshipLabels = [
                    'depends on',
                    'causes',
                    'leads to',
                    'contrasts with',
                  ];

                  const searchLower = mindMapSearch.trim().toLowerCase();
                  const visibleNodes = mindMap.nodes.filter(
                    (n) =>
                      n.level !== 'subtopic' ||
                      !n.parentId ||
                      !collapsedBranchIds[n.parentId]
                  );

                  return (
                    <svg
                      id="learnmate-mindmap-svg"
                      viewBox={`0 0 ${width} ${height}`}
                      className="w-full h-[500px] select-none"
                    >
                      <g
                        transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
                        style={{ transformOrigin: 'center' }}
                      >
                        {mindMap.edges.map((edge, eIdx) => {
                          const p1 = posMap.get(edge.from);
                          const p2 = posMap.get(edge.to);
                          if (!p1 || !p2) return null;
                          const targetNode = mindMap.nodes.find((n) => n.id === edge.to);
                          if (
                            targetNode?.level === 'subtopic' &&
                            targetNode.parentId &&
                            collapsedBranchIds[targetNode.parentId]
                          ) {
                            return null;
                          }
                          const strokeColor =
                            colorPalette[targetNode?.color || 'blue'].stroke;
                          const midX = (p1.x + p2.x) / 2;
                          const midY = (p1.y + p2.y) / 2;
                          const relLabel =
                            relationshipLabels[eIdx % relationshipLabels.length];

                          return (
                            <g key={eIdx}>
                              <path
                                d={`M ${p1.x} ${p1.y} C ${midX} ${p1.y}, ${midX} ${p2.y}, ${p2.x} ${p2.y}`}
                                fill="none"
                                stroke={strokeColor}
                                strokeWidth={targetNode?.level === 'branch' ? 2.5 : 1.75}
                                strokeOpacity={0.75}
                              />
                              {targetNode?.level === 'branch' && (
                                <g transform={`translate(${midX}, ${midY})`}>
                                  <rect
                                    x={-34}
                                    y={-9}
                                    width={68}
                                    height={18}
                                    rx={9}
                                    fill={isDark ? '#0F172A' : '#FFFFFF'}
                                    stroke={strokeColor}
                                    strokeWidth={1}
                                  />
                                  <text
                                    x={0}
                                    y={3}
                                    textAnchor="middle"
                                    fontSize={8.5}
                                    fontWeight={700}
                                    fill={strokeColor}
                                  >
                                    {relLabel}
                                  </text>
                                </g>
                              )}
                            </g>
                          );
                        })}

                        {visibleNodes.map((node) => {
                          const pos = posMap.get(node.id);
                          if (!pos) return null;
                          const theme = colorPalette[node.color || 'blue'];
                          const isSelected = selectedNode?.id === node.id;
                          const matchesSearch =
                            searchLower.length > 0 &&
                            (node.label.toLowerCase().includes(searchLower) ||
                              node.explanation.toLowerCase().includes(searchLower));
                          const boxWidth =
                            node.level === 'central'
                              ? 200
                              : node.level === 'branch'
                              ? 186
                              : 168;
                          const boxHeight = node.level === 'central' ? 58 : 54;

                          // Concise concept summary / formula snippet inside each node so no node is just a bare heading
                          const snippetRaw = (node.explanation || '')
                            .replace(/\s+/g, ' ')
                            .trim();
                          const snippet =
                            snippetRaw.length > 28
                              ? `${snippetRaw.slice(0, 26)}…`
                              : snippetRaw || `Page ${node.sourcePage}`;

                          return (
                            <g
                              key={node.id}
                              transform={`translate(${pos.x - boxWidth / 2}, ${
                                pos.y - boxHeight / 2
                              })`}
                              onClick={() => setSelectedNode(node)}
                              className="cursor-pointer"
                            >
                              <rect
                                width={boxWidth}
                                height={boxHeight}
                                rx={12}
                                fill={node.level === 'central' ? '#4F46E5' : theme.fill}
                                stroke={
                                  matchesSearch
                                    ? '#F59E0B'
                                    : isSelected
                                    ? isDark
                                      ? '#F8FAFC'
                                      : '#172033'
                                    : theme.stroke
                                }
                                strokeWidth={matchesSearch || isSelected ? 3 : 1.8}
                              />
                              <text
                                x={boxWidth / 2}
                                y={22}
                                textAnchor="middle"
                                fill={node.level === 'central' ? '#FFFFFF' : theme.text}
                                fontSize={node.level === 'central' ? 12 : 11}
                                fontWeight={700}
                              >
                                {node.label.length > 23
                                  ? `${node.label.slice(0, 21)}…`
                                  : node.label}
                              </text>
                              <text
                                x={boxWidth / 2}
                                y={40}
                                textAnchor="middle"
                                fill={node.level === 'central' ? '#E0E7FF' : theme.sub}
                                fontSize={9.5}
                                fontWeight={500}
                              >
                                {snippet}
                              </text>
                            </g>
                          );
                        })}
                      </g>
                    </svg>
                  );
                })()}
              </div>

              {/* Right-Side Concept Node Inspector Panel matching Image 9 */}
              <div className="xl:col-span-4 rounded-2xl bg-white border border-line p-5 space-y-4 shadow-2xs">
                {selectedNode ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-brand bg-brand-soft px-2.5 py-0.5 rounded-full">
                        {selectedNode.level === 'central'
                          ? 'Central Chapter Node'
                          : selectedNode.level === 'branch'
                          ? 'Core Concept Branch'
                          : 'Formula / Subtopic Node'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onNavigateToCitation(
                            selectedNode.sourcePage,
                            selectedNode.label
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-canvas border border-line text-xs font-semibold text-brand hover:bg-brand-soft cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>{selectedNode.sourceLabel}</span>
                      </button>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-lg font-bold text-ink">
                        {selectedNode.label}
                      </h3>
                      <p className="text-[11px] text-muted">
                        Grounded in {activeDocument.title} · {selectedNode.sourceLabel}
                      </p>
                    </div>

                    {/* Explanation & Definition */}
                    <div className="p-3.5 rounded-xl bg-canvas border border-line space-y-1.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-brand">
                        Concept Definition &amp; Key Takeaway
                      </div>
                      <div className="text-xs sm:text-sm text-ink leading-relaxed">
                        <MathText text={selectedNode.explanation} />
                      </div>
                    </div>

                    {/* Common JEE Trap */}
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-1 text-xs">
                      <div className="font-bold text-amber-900">
                        Exam Checkpoint &amp; Common Trap
                      </div>
                      <p className="text-amber-950 leading-relaxed">
                        Verify units, boundary conditions, and sign conventions before applying{' '}
                        <strong>{selectedNode.label}</strong> in JEE numericals.
                      </p>
                    </div>

                    {selectedNode.level === 'branch' && (
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedBranchIds((prev) => ({
                            ...prev,
                            [selectedNode.id]: !prev[selectedNode.id],
                          }))
                        }
                        className="w-full py-2 px-3 rounded-xl border border-line bg-canvas hover:bg-white text-xs font-semibold text-ink cursor-pointer"
                      >
                        {collapsedBranchIds[selectedNode.id]
                          ? 'Expand Child Subtopics'
                          : 'Collapse Child Subtopics'}
                      </button>
                    )}

                    {/* Action Buttons: + Add to Cards | Ask Tutor */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          handleAddFormulaToFlashcard({
                            term: selectedNode.label,
                            formulaOrDef: selectedNode.explanation,
                            sourcePage: selectedNode.sourcePage,
                            sourceLabel: selectedNode.sourceLabel,
                          });
                        }}
                        className="py-2 px-3 rounded-xl border border-line bg-white hover:bg-canvas text-xs font-bold text-ink flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-brand" />
                        <span>
                          {addedFormulaTerm === selectedNode.label
                            ? 'Added!'
                            : '+ Add to Cards'}
                        </span>
                      </button>

                      {onAskTutorAboutConcept && (
                        <button
                          type="button"
                          onClick={() =>
                            onAskTutorAboutConcept(
                              `Explain "${selectedNode.label}" (${selectedNode.sourceLabel}) with a JEE worked example and common traps.`
                            )
                          }
                          className="py-2 px-3 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Ask Tutor</span>
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted">
                    Select any node in the mind map to inspect its grounded definition, formula, exam trap, and source page.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================
          3. SUMMARY SHEET (One-Page Revision Sheet)
         ================================================================= */}
      {subTab === 'onepage' && (
        <div className="space-y-4 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2 no-print">
            <span className="text-xs font-medium text-muted">
              Multi-page formatted PDF revision sheet &amp; A4 print-ready study summary.
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="convert-revision-to-handwritten-btn"
                onClick={() => {
                  ensureRevisionDataReady();
                  setHandwrittenInitialWorkflow('revision_sheet');
                  setSubTab('handwritten');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-xs font-bold text-amber-950 cursor-pointer"
              >
                <PenTool className="w-3.5 h-3.5 text-amber-700" />
                <span>Convert to Handwritten Notes</span>
              </button>
              <button
                type="button"
                onClick={handleOpenPreviewModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-brand" />
                <span>Preview Formatted Notes</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-line bg-white dark:bg-[#121A2E] hover:bg-soft text-xs font-semibold text-ink cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Notes</span>
              </button>
            </div>
          </div>

          {isLoadingMindMap || !onePageRevision ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-7 h-7 animate-spin text-danger mx-auto" />
              <p className="text-sm font-medium text-slate-700">
                Compiling summary sheet for {activeDocument.title}...
              </p>
            </div>
          ) : (
            <div
              data-testid="one-page-revision-sheet"
              className="print-sheet bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 space-y-6 shadow-xs"
            >
              <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand">
                    LearnMate Summary Sheet
                  </span>
                  <h3 className="text-xl font-bold text-ink mt-0.5">
                    {onePageRevision.chapterTitle}
                  </h3>
                  <div className="text-xs text-muted mt-1 max-w-3xl">
                    <MathText text={onePageRevision.overview} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink border-l-4 border-brand pl-2.5">
                    Essential Concepts
                  </h4>
                  <div className="space-y-2.5">
                    {onePageRevision.essentialConcepts.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-canvas border border-slate-200/80 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-ink">
                            {item.title}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onNavigateToCitation(item.sourcePage, item.title)
                            }
                            className="text-[11px] font-semibold text-brand hover:underline cursor-pointer"
                          >
                            {item.sourceLabel}
                          </button>
                        </div>
                        <div className="text-xs text-slate-600 leading-relaxed">
                          <MathText text={item.summary} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink border-l-4 border-success pl-2.5">
                    Important Formulas &amp; Definitions
                  </h4>
                  <div className="space-y-2.5">
                    {onePageRevision.formulasAndDefinitions.map((f, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-success-soft border border-emerald-100 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-ink">
                            {f.term}
                          </span>
                          <span className="text-[11px] font-semibold text-emerald-800">
                            {f.sourceLabel}
                          </span>
                        </div>
                        <div className="text-xs text-slate-700 leading-relaxed">
                          <MathText text={f.formulaOrDef} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink border-l-4 border-warning pl-2.5">
                    Key Concept Relationships
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-4">
                    {onePageRevision.keyRelationships.map((rel, idx) => (
                      <li key={idx} className="leading-relaxed">
                        <MathText text={rel} variant="inline" />
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink border-l-4 border-danger pl-2.5">
                    Common Mistakes to Avoid
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-4">
                    {onePageRevision.commonMistakesToAvoid.map((mistake, idx) => (
                      <li key={idx} className="leading-relaxed">
                        <MathText text={mistake} variant="inline" />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
                  Quick Recall Questions
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {onePageRevision.quickRecallQuestions.map((q, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-canvas border border-slate-200/80 space-y-1 text-xs"
                    >
                      <div className="font-bold text-ink">
                        Q{idx + 1}: <MathText text={q.question} variant="inline" />
                      </div>
                      <div className="text-slate-600 leading-relaxed">
                        <strong className="text-emerald-700">Answer:</strong>{' '}
                        <MathText text={q.shortAnswer} variant="inline" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================
          3B. HANDWRITTEN NOTES STUDIO (Phase 6 Section 8: Workflows A, B, C)
         ================================================================= */}
      {subTab === 'handwritten' && (
        <HandwrittenNotesView
          activeDocument={activeDocument}
          onePageRevision={onePageRevision}
          initialWorkflow={handwrittenInitialWorkflow}
          onNavigateToCitation={onNavigateToCitation}
        />
      )}

      {/* =================================================================
          4. MISTAKES & REVISION PLAN (Moved from Study into Revise per Phase 3 item 6 & 7)
         ================================================================= */}
      {subTab === 'mistakes' && (
        <div className="space-y-6 flex-1">
          <div className="rounded-2xl bg-white border border-line p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-danger">
                  Mistake DNA &amp; Recovery Plan
                </span>
                <h2 className="text-lg font-bold text-ink mt-0.5">
                  Root-cause analysis of wrong answers
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Identifies why a question went wrong (formula confusion, sign error, concept gap) and builds a targeted JEE revision plan.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {latestWrongCount > 0 && (
                  <button
                    type="button"
                    disabled={isAnalyzingMistakes}
                    onClick={() => void handleAnalyzeLatestQuizMistakes()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                  >
                    {isAnalyzingMistakes ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Diagnosing mistakes...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Diagnose Latest Attempt ({latestWrongCount} wrong)</span>
                      </>
                    )}
                  </button>
                )}
                {onOpenPractice && (
                  <button
                    type="button"
                    onClick={onOpenPractice}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-line bg-canvas hover:bg-slate-100 text-xs font-semibold text-ink cursor-pointer"
                  >
                    <Target className="w-3.5 h-3.5 text-brand" />
                    <span>Open Practice Quiz</span>
                  </button>
                )}
              </div>
            </div>

            {mistakeInsights.length === 0 ? (
              <div className="p-8 rounded-2xl bg-canvas border border-line text-center space-y-2.5">
                <CheckCircle2 className="w-8 h-8 text-success mx-auto" />
                <h3 className="text-sm font-bold text-ink">
                  No mistake diagnostics recorded for this material yet
                </h3>
                <p className="text-xs text-muted max-w-md mx-auto">
                  Take a Practice quiz on {activeDocument.title}. Any wrong answers can be diagnosed here into root causes and a prioritized revision plan.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mistakeInsights.map((item, idx) => (
                  <div
                    key={item.questionId || idx}
                    className="p-4 rounded-2xl bg-canvas border border-line space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-danger border border-red-200 text-[11px] font-bold">
                        {item.topic}
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigateToCitation(item.sourcePage, item.sourceQuote || item.topic)}
                        className="text-xs font-semibold text-brand hover:underline cursor-pointer"
                      >
                        Page {item.sourcePage}
                      </button>
                    </div>
                    <MathText text={item.question} className="text-xs font-semibold text-ink" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-red-50/70 border border-red-200 text-red-900">
                        <span className="font-semibold block">Your Answer:</span>
                        <MathText text={item.selectedOption} variant="inline" />
                      </div>
                      <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200 text-emerald-900">
                        <span className="font-semibold block">Correct Answer:</span>
                        <MathText text={item.correctOption} variant="inline" />
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-950">
                      <strong>Why it happened:</strong>{' '}
                      <MathText text={item.likelyMisconception} variant="inline" />
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-xs text-emerald-950">
                      <strong>Concept to review:</strong>{' '}
                      <MathText text={item.coreConceptFix} variant="inline" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Personalized Revision Plan Section */}
          {revisionPlan.length > 0 && (
            <div className="rounded-2xl bg-white border border-line p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand" />
                <h3 className="text-base font-bold text-ink">
                  Prioritized Revision Plan ({revisionPlan.filter((t) => !t.completed).length} remaining)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {revisionPlan.map((task) => (
                  <div
                    key={task.id}
                    className={`p-4 rounded-xl border space-y-2 transition-all ${
                      task.completed
                        ? 'bg-slate-50 border-slate-200 opacity-75'
                        : 'bg-canvas border-line'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => handleToggleRevisionTask(task.id)}
                          className="mt-0.5 w-4 h-4 rounded text-success focus:ring-success"
                        />
                        <span
                          className={`text-xs font-bold ${
                            task.completed ? 'line-through text-muted' : 'text-ink'
                          }`}
                        >
                          {task.topic}
                        </span>
                      </label>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                          task.priority === 'high'
                            ? 'bg-red-100 text-red-800'
                            : task.priority === 'medium'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed pl-6">
                      {task.recommendedAction}
                    </p>
                    <div className="flex flex-wrap gap-1.5 pl-6">
                      <button
                        type="button"
                        onClick={() => onNavigateToCitation(task.sourcePage, task.conceptSummary)}
                        className="px-2 py-0.5 rounded bg-white border border-line text-[11px] font-semibold text-brand hover:bg-brand-soft cursor-pointer"
                      >
                        Review Page {task.sourcePage}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================
          5. FORMULA BOOK (Phase 3 entry point + chapter formulas, Phase 4 full syllabus browser)
         ================================================================= */}
      {subTab === 'formulas' && (
        <div className="space-y-5 flex-1">
          <div className="rounded-2xl bg-white border border-line p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-brand">
                  JEE Formula Book · {subjectLabel}
                </span>
                <h2 className="text-lg font-bold text-ink mt-0.5">
                  Formulas &amp; Identities in {activeDocument.title.replace(/\.pdf$/i, '')}
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Every formula extracted from your current study material. Add any formula directly to your spaced-repetition flashcards.
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={formulaSearch}
                  onChange={(e) => setFormulaSearch(e.target.value)}
                  placeholder="Search formula or term..."
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-canvas border border-line text-xs text-ink focus:outline-none focus:border-brand"
                />
              </div>
            </div>

            {isLoadingMindMap && formulaBookItems.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-brand mx-auto" />
                <p className="text-xs text-muted">
                  Extracting formulas and definitions from {activeDocument.title}...
                </p>
              </div>
            ) : formulaBookItems.length === 0 ? (
              <div className="p-8 rounded-2xl bg-canvas border border-line text-center space-y-2">
                <BookOpen className="w-7 h-7 text-muted mx-auto" />
                <p className="text-sm font-semibold text-ink">
                  No matching formulas found
                </p>
                <p className="text-xs text-muted">
                  Try clearing your search or click Regenerate on the Summary sheet to extract chapter formulas.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {formulaBookItems.map((item, idx) => (
                  <div
                    key={`${item.term}-${idx}`}
                    className="p-4 rounded-2xl bg-canvas border border-line flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-ink">
                          {item.term}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onNavigateToCitation(item.sourcePage, item.term)
                          }
                          className="text-[11px] font-semibold text-brand hover:underline cursor-pointer"
                        >
                          {item.sourceLabel}
                        </button>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-line text-sm text-ink">
                        <MathText text={item.formulaOrDef} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => handleAddFormulaToFlashcard(item)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline cursor-pointer"
                      >
                        {addedFormulaTerm === item.term ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-success" />
                            <span className="text-success">Added to Flashcards</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add to flashcards</span>
                          </>
                        )}
                      </button>

                      {onAskTutorAboutConcept && (
                        <button
                          type="button"
                          onClick={() =>
                            onAskTutorAboutConcept(
                              `Explain the formula for "${item.term}" (${item.formulaOrDef}), state the units and conditions where it holds, and show one JEE Main example.`
                            )
                          }
                          className="text-xs font-medium text-muted hover:text-ink cursor-pointer"
                        >
                          Ask Tutor →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================
          PREVIEW REVISION NOTES MODAL BEFORE PDF DOWNLOAD
         ================================================================= */}
      {previewModalOpen && onePageRevision && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Revision Notes PDF Preview"
          data-testid="revision-pdf-preview-modal"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewModalOpen(false);
          }}
        >
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 bg-canvas border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand">
                  PDF Document Preview • {buildRevisionPdfFilename(activeDocument.title)}
                </span>
                <h3 className="text-base font-bold text-ink">
                  {onePageRevision.chapterTitle}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  disabled={isGeneratingPdf}
                  onClick={() => void handleDownloadRevisionPdf()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs font-bold cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>{isGeneratingPdf ? 'Generating...' : 'Download .PDF Now'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(false)}
                  aria-label="Close PDF preview"
                  className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 bg-slate-100/70 flex-1">
              <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-sm max-w-3xl mx-auto space-y-5">
                <div className="p-4 rounded-xl bg-brand-soft/70 border border-brand/30">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-brand">
                    LEARNMATE STRUCTURED REVISION NOTES
                  </div>
                  <div className="text-lg font-bold text-ink mt-0.5">
                    {onePageRevision.chapterTitle}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    {onePageRevision.overview}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand">
                    1. Essential Concepts ({onePageRevision.essentialConcepts.length})
                  </h4>
                  <div className="space-y-2">
                    {onePageRevision.essentialConcepts.map((c, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                        <div className="font-bold text-ink">
                          {idx + 1}. {c.title} <span className="text-brand">[{c.sourceLabel}]</span>
                        </div>
                        <p className="text-slate-600 mt-0.5">{c.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-success">
                    2. Key Formulas &amp; Definitions ({onePageRevision.formulasAndDefinitions.length})
                  </h4>
                  <div className="divide-y divide-emerald-100 rounded-xl border border-emerald-200/80 bg-success-soft overflow-hidden text-xs">
                    {onePageRevision.formulasAndDefinitions.map((f, idx) => (
                      <div key={idx} className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="font-bold text-emerald-900">
                          {f.term} <span className="text-[11px] font-normal">({f.sourceLabel})</span>
                        </div>
                        <div className="sm:col-span-2 font-mono text-slate-800">
                          {f.formulaOrDef}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {stickyNotes.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-warning">
                      3. Highlighted Sticky Notes ({stickyNotes.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      {stickyNotes.map((n) => (
                        <div key={n.id} className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80">
                          <div className="font-bold text-ink">{n.title}</div>
                          <p className="text-slate-700 mt-0.5">{n.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
