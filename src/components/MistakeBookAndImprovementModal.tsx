import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  Clock,
  Tag,
  BookOpen,
  Layers,
  Filter,
  Loader2,
  Calendar,
  Stethoscope,
} from 'lucide-react';
import { MathText } from './MathText';
import type { StudyDocument, MistakeInsight, RevisionTask } from '../types/study';
import { studyStorage } from '../services/storageService';
import { aiStudyClient } from '../services/aiClient';
import {
  getStoredMistakeBookEntries,
  updateMistakeClassification,
  convertMistakeEntriesToSm2Flashcards,
  MISTAKE_CLASSIFICATION_TAGS,
  type MistakeBookEntry,
  type MistakeClassificationTag,
} from '../utils/mistakeBookEngine';

interface MistakeBookAndImprovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDocumentId?: string;
  activeDocument?: StudyDocument | null;
  initialEntries?: MistakeBookEntry[];
  initialTab?: 'booklet' | 'diagnosis';
}

export const MistakeBookAndImprovementModal: React.FC<
  MistakeBookAndImprovementModalProps
> = ({
  isOpen,
  onClose,
  activeDocumentId,
  activeDocument,
  initialEntries,
  initialTab = 'booklet',
}) => {
  const resolvedDocId = activeDocument?.id || activeDocumentId || 'default-jee-doc';
  const [activeTab, setActiveTab] = useState<'booklet' | 'diagnosis'>(initialTab);
  const [entries, setEntries] = useState<MistakeBookEntry[]>(() =>
    initialEntries && initialEntries.length > 0
      ? initialEntries
      : getStoredMistakeBookEntries()
  );
  const [subjectFilter, setSubjectFilter] = useState<
    'All' | 'Physics' | 'Chemistry' | 'Mathematics'
  >('All');
  const [categoryFilter, setCategoryFilter] = useState<'All' | MistakeClassificationTag>('All');
  const [autoSyncSm2, setAutoSyncSm2] = useState<boolean>(true);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // Unified AI Mistake Diagnosis & Remediation Plan State
  const [mistakeInsights, setMistakeInsights] = useState<MistakeInsight[]>(() =>
    studyStorage.getMistakeInsights(resolvedDocId)
  );
  const [revisionPlan, setRevisionPlan] = useState<RevisionTask[]>(() =>
    studyStorage.getRevisionPlan(resolvedDocId)
  );
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (!initialEntries || initialEntries.length === 0) {
        setEntries(getStoredMistakeBookEntries());
      }
      setMistakeInsights(studyStorage.getMistakeInsights(resolvedDocId));
      setRevisionPlan(studyStorage.getRevisionPlan(resolvedDocId));
    }
  }, [isOpen, resolvedDocId, initialEntries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (subjectFilter !== 'All' && e.subject !== subjectFilter) return false;
      if (categoryFilter !== 'All' && e.errorCategory !== categoryFilter) return false;
      return true;
    });
  }, [entries, subjectFilter, categoryFilter]);

  if (!isOpen) return null;

  const handleClassify = (id: string, tag: MistakeClassificationTag) => {
    const updated = updateMistakeClassification(id, tag);
    setEntries(updated);
    if (autoSyncSm2) {
      const target = updated.find((u) => u.id === id);
      if (target) {
        const res = convertMistakeEntriesToSm2Flashcards([target], resolvedDocId);
        setEntries(res.updatedEntries);
      }
    }
  };

  const handleConvertAllToSm2 = () => {
    const res = convertMistakeEntriesToSm2Flashcards(filteredEntries, resolvedDocId);
    setEntries(res.updatedEntries);
    setBannerNotice(
      `Converted ${res.convertedCount} Mistake Book items into SuperMemo SM-2 Flashcards (scheduled for 1-3-7 day active recall in Revise).`
    );
  };

  const handleRunAiMistakeDiagnosis = async () => {
    const attempts = studyStorage.getQuizAttempts();
    const latest = attempts[0];
    if (!latest) {
      setBannerNotice('Complete at least one quiz or mock test first to run AI Mistake Diagnosis.');
      return;
    }

    setIsDiagnosing(true);
    setBannerNotice(null);
    try {
      const pages =
        activeDocument?.pages && activeDocument.pages.length > 0
          ? activeDocument.pages
          : [{ pageNumber: 1, title: latest.documentTitle, content: latest.documentTitle }];
      const res = await aiStudyClient.analyzeMistakesAndPlan({
        documentId: resolvedDocId,
        title: activeDocument?.title || latest.documentTitle,
        pages,
        attempt: latest,
      });
      studyStorage.saveMistakeInsights(resolvedDocId, res.mistakes);
      studyStorage.saveRevisionPlan(resolvedDocId, res.revisionPlan);
      setMistakeInsights(res.mistakes);
      setRevisionPlan(res.revisionPlan);
      setBannerNotice(
        `AI Mistake Diagnosis complete: identified ${res.mistakes.length} root-cause patterns and updated your Remediation Plan.`
      );
    } catch (err) {
      setBannerNotice(
        err instanceof Error ? err.message : 'Could not run AI Mistake Diagnosis right now.'
      );
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleToggleRevisionTask = (taskId: string) => {
    const updated = revisionPlan.map((t) =>
      t.id === taskId
        ? { ...t, completed: !t.completed, updatedAt: new Date().toISOString() }
        : t
    );
    setRevisionPlan(updated);
    studyStorage.saveRevisionPlan(resolvedDocId, updated);
  };

  const sm2ConvertedCount = entries.filter((e) => e.convertedToSm2).length;

  return (
    <div
      data-testid="mistake-book-modal"
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div className="w-full max-w-6xl bg-white dark:bg-[#0B1020] rounded-2xl border border-line shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-line flex flex-wrap items-center justify-between gap-4 bg-canvas">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[11px] font-bold">
                Unified Mistake Book + AI Diagnosis &amp; SM-2 Pipeline
              </span>
              <span className="text-xs font-semibold text-muted tabular-nums">
                {entries.length} Tracked Mistakes · {sm2ConvertedCount} in SM-2 Queue ·{' '}
                {mistakeInsights.length} AI Root-Cause Insights
              </span>
            </div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-ink">
              Mistake Book &amp; AI Mistake Diagnosis
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'booklet' ? (
              <button
                type="button"
                onClick={handleConvertAllToSm2}
                data-testid="convert-mistakes-to-sm2-btn"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs font-bold cursor-pointer shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Convert Mistakes to SM-2 Flashcards</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isDiagnosing}
                onClick={() => void handleRunAiMistakeDiagnosis()}
                data-testid="run-ai-mistake-diagnosis-btn"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs font-bold cursor-pointer shadow-xs disabled:opacity-60"
              >
                {isDiagnosing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Diagnosing Latest Attempt…</span>
                  </>
                ) : (
                  <>
                    <Stethoscope className="w-3.5 h-3.5" />
                    <span>Run AI Diagnosis on Latest Attempt</span>
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Mistake Book"
              data-testid="close-mistake-book-btn"
              className="p-2 rounded-xl border border-line bg-white hover:bg-soft text-muted hover:text-ink cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Unified Workspace Mode Switcher */}
        <div className="px-6 py-2.5 border-b border-line bg-white dark:bg-[#121A2E] flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-line bg-canvas p-1 gap-1">
            <button
              type="button"
              data-testid="mistake-modal-tab-booklet"
              onClick={() => setActiveTab('booklet')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'booklet'
                  ? 'bg-brand text-white'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Mistake Booklet &amp; SM-2 Queue ({entries.length})
            </button>
            <button
              type="button"
              data-testid="mistake-modal-tab-diagnosis"
              onClick={() => setActiveTab('diagnosis')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'diagnosis'
                  ? 'bg-brand text-white'
                  : 'text-muted hover:text-ink'
              }`}
            >
              AI Root-Cause Diagnosis &amp; Remediation Plan ({mistakeInsights.length})
            </button>
          </div>

          {activeTab === 'booklet' && (
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={autoSyncSm2}
                onChange={(e) => setAutoSyncSm2(e.target.checked)}
                className="rounded border-line text-brand focus:ring-brand"
              />
              <span>Auto-Sync Tagged Mistakes to SM-2 (1-3-7 Day Recall)</span>
            </label>
          )}
        </div>

        {/* Filters Bar (Booklet Tab) */}
        {activeTab === 'booklet' && (
          <div className="px-6 py-2.5 border-b border-line bg-canvas flex flex-wrap items-center gap-2 text-xs">
            <Filter className="w-3.5 h-3.5 text-muted" />
            {(['All', 'Physics', 'Chemistry', 'Mathematics'] as const).map((subj) => (
              <button
                key={subj}
                type="button"
                onClick={() => setSubjectFilter(subj)}
                className={`px-3 py-1 rounded-lg font-bold border cursor-pointer ${
                  subjectFilter === subj
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white text-muted border-line hover:text-ink'
                }`}
              >
                {subj}
              </button>
            ))}

            <select
              aria-label="Filter by Error Classification"
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(e.target.value as 'All' | MistakeClassificationTag)
              }
              className="px-2.5 py-1 rounded-lg border border-line bg-white font-semibold text-ink"
            >
              <option value="All">All Error Types</option>
              {MISTAKE_CLASSIFICATION_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>
        )}

        {bannerNotice && (
          <div className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-200 text-xs font-semibold text-emerald-900 flex items-center justify-between">
            <span>{bannerNotice}</span>
            <button
              type="button"
              onClick={() => setBannerNotice(null)}
              className="underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* TAB 1: MISTAKE BOOKLET & SM-2 QUEUE */}
        {activeTab === 'booklet' && (
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            {filteredEntries.length === 0 ? (
              <div className="p-10 rounded-2xl border border-dashed border-line text-center space-y-2">
                <BookOpen className="w-8 h-8 text-muted mx-auto" />
                <div className="text-sm font-bold text-ink">
                  No mistakes recorded in this filter yet
                </div>
                <p className="text-xs text-muted max-w-md mx-auto">
                  Every Incorrect, Unattempted (Visited), and Overtime (&gt;180s) question from your JEE CBT Mocks is automatically captured here for root-cause tagging and SM-2 flashcard conversion.
                </p>
              </div>
            ) : (
              filteredEntries.map((item) => (
                <div
                  key={item.id}
                  data-testid={`mistake-entry-${item.questionId}`}
                  className="p-5 rounded-2xl border border-line bg-canvas space-y-3.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-brand-soft text-brand text-xs font-bold">
                        {item.subject} · {item.topic}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                          item.triggerReason === 'incorrect'
                            ? 'bg-red-100 text-red-800'
                            : item.triggerReason === 'overtime_180s'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-slate-200 text-slate-800'
                        }`}
                      >
                        {item.triggerReason === 'incorrect'
                          ? 'Incorrect Attempt (−Marks)'
                          : item.triggerReason === 'overtime_180s'
                          ? `Overtime (>180s: ${item.timeSpentSeconds}s)`
                          : 'Visited & Unattempted'}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted tabular-nums">
                        <Clock className="w-3 h-3" />
                        {item.timeSpentSeconds}s
                      </span>
                    </div>

                    {item.convertedToSm2 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                        <CheckCircle2 className="w-3 h-3" />
                        SM-2 Queued ({item.neuronzStage})
                      </span>
                    )}
                  </div>

                  <MathText
                    text={item.questionText}
                    className="text-sm font-medium text-ink leading-relaxed"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-xl bg-red-50/70 border border-red-200 text-red-950">
                      <span className="font-bold">Your Response:</span>{' '}
                      <MathText text={item.studentResponseLabel} variant="inline" />
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-950">
                      <span className="font-bold">Verified Key:</span>{' '}
                      <MathText text={item.correctAnswerLabel} variant="inline" />
                    </div>
                  </div>

                  {/* Error Classification Tag Selector */}
                  <div className="pt-1 flex flex-wrap items-center justify-between gap-3 border-t border-line">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted mr-1">
                        <Tag className="w-3 h-3" />
                        Classify Root Cause:
                      </span>
                      {MISTAKE_CLASSIFICATION_TAGS.map((tag) => {
                        const active = item.errorCategory === tag;
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleClassify(item.id, tag)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                              active
                                ? 'bg-brand text-white border-brand'
                                : 'bg-white text-muted border-line hover:text-ink'
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const res = convertMistakeEntriesToSm2Flashcards(
                          [item],
                          resolvedDocId
                        );
                        setEntries(res.updatedEntries);
                        setBannerNotice(`Added "${item.topic}" flashcard to SM-2 revision queue.`);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>{item.convertedToSm2 ? 'Update SM-2 Card' : '+ Convert to SM-2 Card'}</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: AI ROOT-CAUSE DIAGNOSIS & REMEDIATION PLAN */}
        {activeTab === 'diagnosis' && (
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {mistakeInsights.length === 0 ? (
              <div className="p-10 rounded-2xl border border-dashed border-line text-center space-y-3">
                <Stethoscope className="w-8 h-8 text-brand mx-auto" />
                <div className="text-sm font-bold text-ink">
                  No AI root-cause diagnosis generated yet
                </div>
                <p className="text-xs text-muted max-w-md mx-auto">
                  Click &ldquo;Run AI Diagnosis on Latest Attempt&rdquo; above after taking any Practice quiz or CBT mock to generate KaTeX-formatted root-cause analysis and a prioritized remediation plan.
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
                      <span className="text-xs font-semibold text-muted">
                        Page {item.sourcePage}
                      </span>
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
                      <strong>Root Misconception:</strong>{' '}
                      <MathText text={item.likelyMisconception} variant="inline" />
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-xs text-emerald-950">
                      <strong>Remediation Fix:</strong>{' '}
                      <MathText text={item.coreConceptFix} variant="inline" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {revisionPlan.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-line">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-brand" />
                  <h3 className="text-sm font-bold text-ink">
                    Prioritized Remediation Plan ({revisionPlan.filter((t) => !t.completed).length} remaining)
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {revisionPlan.map((task) => (
                    <div
                      key={task.id}
                      className={`p-3.5 rounded-xl border space-y-1.5 ${
                        task.completed
                          ? 'bg-slate-50 border-slate-200 opacity-75'
                          : 'bg-canvas border-line'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <label className="flex items-start gap-2 cursor-pointer">
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
                      <p className="text-xs text-slate-600 pl-6">{task.recommendedAction}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
