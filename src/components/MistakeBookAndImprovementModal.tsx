import React, { useState, useMemo } from 'react';
import {
  X,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Clock,
  Tag,
  BookOpen,
  Layers,
  Filter,
} from 'lucide-react';
import { MathText } from './MathText';
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
  initialEntries?: MistakeBookEntry[];
}

export const MistakeBookAndImprovementModal: React.FC<
  MistakeBookAndImprovementModalProps
> = ({ isOpen, onClose, activeDocumentId, initialEntries }) => {
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
        const res = convertMistakeEntriesToSm2Flashcards([target], activeDocumentId);
        setEntries(res.updatedEntries);
      }
    }
  };

  const handleConvertAllToSm2 = () => {
    const res = convertMistakeEntriesToSm2Flashcards(filteredEntries, activeDocumentId);
    setEntries(res.updatedEntries);
    setBannerNotice(
      `Converted ${res.convertedCount} Mistake Book items into SuperMemo SM-2 Flashcards (scheduled for NeuronZ 1-3-7 day active recall in Revise).`
    );
  };

  const sm2ConvertedCount = entries.filter((e) => e.convertedToSm2).length;

  return (
    <div
      data-testid="mistake-book-modal"
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div className="w-full max-w-5xl bg-white dark:bg-[#0B1020] rounded-2xl border border-line shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-line flex items-center justify-between gap-4 bg-canvas">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[11px] font-bold">
                ALLEN Improvement Booklet + NeuronZ SM-2 Pipeline
              </span>
              <span className="text-xs font-semibold text-muted tabular-nums">
                {entries.length} Tracked Mistakes · {sm2ConvertedCount} in SM-2 Queue
              </span>
            </div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-ink">
              Mistake Book &amp; Improvement Booklet
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleConvertAllToSm2}
              data-testid="convert-mistakes-to-sm2-btn"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs font-bold cursor-pointer shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Convert Mistakes to SM-2 Flashcards</span>
            </button>
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

        {/* Filters & Auto-sync Toggle Bar */}
        <div className="px-6 py-3 border-b border-line bg-white dark:bg-[#121A2E] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-muted" />
            {(['All', 'Physics', 'Chemistry', 'Mathematics'] as const).map((subj) => (
              <button
                key={subj}
                type="button"
                onClick={() => setSubjectFilter(subj)}
                className={`px-3 py-1 rounded-lg font-bold border cursor-pointer ${
                  subjectFilter === subj
                    ? 'bg-brand text-white border-brand'
                    : 'bg-canvas text-muted border-line hover:text-ink'
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
              className="px-2.5 py-1 rounded-lg border border-line bg-canvas font-semibold text-ink"
            >
              <option value="All">All Error Types</option>
              {MISTAKE_CLASSIFICATION_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>

          <label className="inline-flex items-center gap-2 font-semibold text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={autoSyncSm2}
              onChange={(e) => setAutoSyncSm2(e.target.checked)}
              className="rounded border-line text-brand focus:ring-brand"
            />
            <span>Auto-Sync Tagged Mistakes to SM-2 (1-3-7 Day NeuronZ)</span>
          </label>
        </div>

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

        {/* Content List */}
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
                        activeDocumentId
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
      </div>
    </div>
  );
};
