import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BookMarked,
  LineChart,
  X,
  Copy,
  Check,
  FileText,
  Share2,
  Search,
  Calculator,
} from 'lucide-react';
import type { StudyDocument } from '../types/study';
import { JEE_SYLLABUS_CHAPTERS } from '../data/jeeSyllabusAndNotes';
import { extractPlottableExpressionFromFormula } from '../utils/desmosStudyToolsEngine';
import { MathText } from './MathText';

export type UtilityTab =
  | 'formulas'
  | 'graph'
  | 'matrix'
  | 'surface3d'
  | 'geometry'
  | 'calculator'
  | 'converter'
  | 'statistics';

interface CompactStudyUtilitiesWidgetProps {
  activeDocument?: StudyDocument | null;
  externalOpenTab?: UtilityTab | null;
  onConsumeExternalOpen?: () => void;
  onPlotFormulaInStudyTools?: (expression: string, formulaLabel?: string) => void;
  onOpenStudyToolsWorkspace?: (initialTool?: 'graph2d' | 'matrix' | 'surface3d' | 'geometry' | 'scientific') => void;
}

const PHYSICAL_CONSTANTS: Array<{ symbol: string; label: string; value: string; unit: string }> = [
  { symbol: 'g', label: 'Std. Gravity', value: '9.8', unit: 'm/s²' },
  { symbol: 'c', label: 'Speed of Light', value: '2.998 × 10⁸', unit: 'm/s' },
  { symbol: 'h', label: 'Planck Constant', value: '6.626 × 10⁻³⁴', unit: 'J·s' },
  { symbol: 'R', label: 'Gas Constant', value: '8.314', unit: 'J/(mol·K)' },
  { symbol: 'N_A', label: 'Avogadro No.', value: '6.022 × 10²³', unit: 'mol⁻¹' },
  { symbol: 'e', label: 'Elementary Charge', value: '1.602 × 10⁻¹⁹', unit: 'C' },
];

export const CompactStudyUtilitiesWidget: React.FC<CompactStudyUtilitiesWidgetProps> = ({
  activeDocument,
  externalOpenTab,
  onConsumeExternalOpen,
  onPlotFormulaInStudyTools,
  onOpenStudyToolsWorkspace,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedFormulaIdx, setCopiedFormulaIdx] = useState<number | null>(null);
  const [formulaFilter, setFormulaFilter] = useState('');
  const [formulaSubject, setFormulaSubject] = useState<
    'Current Material' | 'All' | 'Physics' | 'Chemistry' | 'Mathematics'
  >('All');
  const [shareLinkCopied, setShareLinkCopied] = useState<string | null>(null);

  // Route non-formula utility requests directly to the dedicated Study Tools workspace
  useEffect(() => {
    if (!externalOpenTab) return;
    if (externalOpenTab === 'formulas') {
      setIsOpen(true);
    } else if (onOpenStudyToolsWorkspace) {
      const mapped =
        externalOpenTab === 'graph'
          ? 'graph2d'
          : externalOpenTab === 'matrix'
          ? 'matrix'
          : externalOpenTab === 'surface3d'
          ? 'surface3d'
          : externalOpenTab === 'geometry'
          ? 'geometry'
          : 'scientific';
      onOpenStudyToolsWorkspace(mapped);
    } else {
      setIsOpen(true);
    }
    onConsumeExternalOpen?.();
  }, [externalOpenTab, onConsumeExternalOpen, onOpenStudyToolsWorkspace]);

  // Escape closes the Formula Book drawer; lock page scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  const allFormulas = useMemo(() => {
    const list: Array<{
      subject: string;
      chapter: string;
      label: string;
      formula: string;
      condition: string;
      isFromActiveMaterial?: boolean;
      pageNumber?: number;
    }> = [];
    const seenKeys = new Set<string>();

    const pushUnique = (entry: {
      subject: string;
      chapter: string;
      label: string;
      formula: string;
      condition: string;
      isFromActiveMaterial?: boolean;
      pageNumber?: number;
    }) => {
      const normalizedFormula = entry.formula.replace(/\s+/g, ' ').trim();
      if (!normalizedFormula || normalizedFormula.length < 3) return;
      const dedupeKey = `${entry.isFromActiveMaterial ? 'doc' : entry.subject}::${normalizedFormula.toLowerCase()}`;
      if (seenKeys.has(dedupeKey)) return;
      seenKeys.add(dedupeKey);
      list.push({ ...entry, formula: normalizedFormula });
    };

    const ensureMathWrapped = (rawExpr: string): string => {
      const trimmed = rawExpr.trim();
      if (trimmed.includes('$')) return trimmed;
      if (/\\[a-zA-Z]+|[_^]/.test(trimmed)) {
        return `$${trimmed}$`;
      }
      return trimmed;
    };

    // 1. Extract all formulas and equations from the active uploaded material / chapter
    if (activeDocument) {
      const cleanDocTitle = activeDocument.title.replace(/\.pdf$/i, '');

      for (const t of activeDocument.topics || []) {
        for (const kp of t.keyConcepts || []) {
          if (/[=+\-*/^√∫∑Δ∝≈≠≤≥\\]|->|⇌/.test(kp)) {
            pushUnique({
              subject: 'Current Material',
              chapter: cleanDocTitle,
              label: t.name,
              formula: ensureMathWrapped(kp),
              condition: t.sourcePages?.[0] ? `Page ${t.sourcePages[0]}` : cleanDocTitle,
              isFromActiveMaterial: true,
              pageNumber: t.sourcePages?.[0],
            });
          }
        }
      }

      for (const page of activeDocument.pages || []) {
        const content = page.content || '';
        const pageLabel = page.title || `Page ${page.pageNumber}`;

        const displayRegex = /\$\$([\s\S]*?)\$\$/g;
        let match: RegExpExecArray | null;
        while ((match = displayRegex.exec(content)) !== null) {
          const inner = match[1].trim();
          if (inner.length >= 3) {
            pushUnique({
              subject: 'Current Material',
              chapter: cleanDocTitle,
              label: pageLabel,
              formula: `$$${inner}$$`,
              condition: `Page ${page.pageNumber}`,
              isFromActiveMaterial: true,
              pageNumber: page.pageNumber,
            });
          }
        }

        const withoutDisplay = content.replace(/\$\$[\s\S]*?\$\$/g, ' ');
        const inlineRegex = /\$([^$\n]{3,160})\$/g;
        while ((match = inlineRegex.exec(withoutDisplay)) !== null) {
          const inner = match[1].trim();
          if (
            /[=∝≈≠≤≥]|\\frac|\\sqrt|\\int|\\sum|\\Delta|\\rightarrow|\\to|\\rightleftharpoons/.test(
              inner
            )
          ) {
            pushUnique({
              subject: 'Current Material',
              chapter: cleanDocTitle,
              label: pageLabel,
              formula: `$${inner}$`,
              condition: `Page ${page.pageNumber}`,
              isFromActiveMaterial: true,
              pageNumber: page.pageNumber,
            });
          }
        }

        const lines = withoutDisplay.split('\n');
        for (const rawLine of lines) {
          const line = rawLine.replace(/^[\s•*\-\d.)]+/, '').trim();
          if (
            line.length >= 5 &&
            line.length <= 180 &&
            line.includes('=') &&
            /[0-9a-zA-Z]\s*=\s*[^=]/.test(line) &&
            !/^https?:/i.test(line)
          ) {
            if (
              /[\^_\\√∫∑Δπθωαβγλμ]|\/|\*|\b(sin|cos|tan|log|ln|lim)\b/i.test(line) ||
              /^[A-Za-z\s()]{2,35}:\s*.+=.+/.test(line)
            ) {
              const colonIdx = line.indexOf(':');
              const extractedLabel =
                colonIdx > 1 && colonIdx < 40 ? line.slice(0, colonIdx).trim() : pageLabel;
              const extractedFormula =
                colonIdx > 1 && colonIdx < 40 ? line.slice(colonIdx + 1).trim() : line;
              pushUnique({
                subject: 'Current Material',
                chapter: cleanDocTitle,
                label: extractedLabel,
                formula: ensureMathWrapped(extractedFormula),
                condition: `Page ${page.pageNumber}`,
                isFromActiveMaterial: true,
                pageNumber: page.pageNumber,
              });
            }
          }
        }
      }

      const docTitleLower = cleanDocTitle.toLowerCase();
      for (const ch of JEE_SYLLABUS_CHAPTERS) {
        const chTitleLower = ch.title.toLowerCase();
        if (
          activeDocument.id.includes(ch.id) ||
          docTitleLower.includes(chTitleLower) ||
          chTitleLower.includes(docTitleLower)
        ) {
          for (const ef of ch.quickNotes.essentialFormulas || []) {
            pushUnique({
              subject: 'Current Material',
              chapter: ch.title,
              label: ef.label,
              formula: ensureMathWrapped(ef.formula),
              condition: ef.condition,
              isFromActiveMaterial: true,
            });
          }
          for (const hyf of ch.highYieldFormulas || []) {
            pushUnique({
              subject: 'Current Material',
              chapter: ch.title,
              label: 'High-Yield Formula',
              formula: ensureMathWrapped(hyf),
              condition: ch.unitName,
              isFromActiveMaterial: true,
            });
          }
          for (const topic of ch.topics || []) {
            for (const kf of topic.keyFormulas || []) {
              pushUnique({
                subject: 'Current Material',
                chapter: ch.title,
                label: kf.name || topic.title,
                formula: ensureMathWrapped(kf.expression),
                condition: kf.unitsOrConditions || kf.variablesExplanation,
                isFromActiveMaterial: true,
              });
            }
            for (const fStr of [...(topic.highYieldFormulas || []), ...(topic.formulas || [])]) {
              pushUnique({
                subject: 'Current Material',
                chapter: ch.title,
                label: topic.title,
                formula: ensureMathWrapped(fStr),
                condition: ch.unitName,
                isFromActiveMaterial: true,
              });
            }
          }
        }
      }
    }

    // 2. Include verified JEE / BITSAT / VITEEE syllabus chapter formulas
    if (formulaSubject !== 'Current Material') {
      for (const ch of JEE_SYLLABUS_CHAPTERS) {
        if (formulaSubject !== 'All' && ch.subject !== formulaSubject) continue;
        for (const f of ch.quickNotes.essentialFormulas || []) {
          pushUnique({
            subject: ch.subject,
            chapter: ch.title,
            label: f.label,
            formula: ensureMathWrapped(f.formula),
            condition: f.condition,
          });
        }
        for (const topic of ch.topics || []) {
          for (const kf of topic.keyFormulas || []) {
            pushUnique({
              subject: ch.subject,
              chapter: ch.title,
              label: kf.name || topic.title,
              formula: ensureMathWrapped(kf.expression),
              condition: kf.unitsOrConditions || kf.variablesExplanation,
            });
          }
          for (const fStr of [...(topic.highYieldFormulas || []), ...(topic.formulas || [])]) {
            pushUnique({
              subject: ch.subject,
              chapter: ch.title,
              label: topic.title,
              formula: ensureMathWrapped(fStr),
              condition: ch.unitName,
            });
          }
        }
      }
    }

    const filteredByTab =
      formulaSubject === 'Current Material'
        ? list.filter((item) => item.isFromActiveMaterial)
        : list;

    if (!formulaFilter.trim()) return filteredByTab;
    const q = formulaFilter.toLowerCase();
    return filteredByTab.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.formula.toLowerCase().includes(q) ||
        item.chapter.toLowerCase().includes(q) ||
        item.condition.toLowerCase().includes(q)
    );
  }, [activeDocument, formulaFilter, formulaSubject]);

  const handleShareFormulaSheet = async () => {
    try {
      const response = await fetch('/api/share/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'formula_sheet',
          title:
            formulaSubject === 'Current Material' && activeDocument
              ? `${activeDocument.title.replace(/\.pdf$/i, '')} — Formula Book`
              : `${formulaSubject} Engineering Entrance Formula Sheet`,
          subtitle: `${allFormulas.length} verified formulas`,
          payload: {
            subject: formulaSubject,
            formulas: allFormulas.slice(0, 60),
          },
        }),
      });
      const data = await response.json();
      if (data.shareUrl && typeof window !== 'undefined') {
        const fullUrl = `${window.location.origin}${data.shareUrl}`;
        await navigator.clipboard?.writeText(fullUrl).catch(() => {});
        setShareLinkCopied(fullUrl);
        setTimeout(() => setShareLinkCopied(null), 4000);
      }
    } catch {
      // Fallback local share notice
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Pure Formula Book Quick-Access Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        data-testid="navbar-formula-book-btn"
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-line bg-white dark:bg-[#121A2E] hover:bg-soft text-ink text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
        title="Open Pure Formula Book (All formulas & equations from uploaded material and chapters)"
      >
        <BookMarked className="w-4 h-4 text-brand shrink-0" />
        <span className="hidden md:inline">Formula Book</span>
      </button>

      {/* Dedicated Pure Formula Book Slide-Over Drawer */}
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-slate-950/50 backdrop-blur-[2px] flex justify-end"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setIsOpen(false);
            }}
          >
            <aside
              role="dialog"
              aria-modal="true"
              data-testid="study-utilities-popover"
              aria-label="Unified Formula Book"
              className="w-full sm:max-w-[940px] h-full bg-white dark:bg-[#111827] text-ink sm:border-l border-line shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-line flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-brand/10 text-brand grid place-items-center shrink-0">
                    <BookMarked className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-bold text-ink truncate">
                      Unified Formula Book
                    </h2>
                    <p className="text-xs text-muted truncate">
                      Pure formula &amp; equation reference from your uploaded materials and JEE / BITSAT / VITEEE chapters
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {onOpenStudyToolsWorkspace && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onOpenStudyToolsWorkspace('graph2d');
                      }}
                      data-testid="formula-book-open-study-tools-btn"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-canvas hover:bg-soft text-xs font-semibold text-ink cursor-pointer transition-colors"
                    >
                      <Calculator className="w-3.5 h-3.5 text-brand" />
                      <span>Open Study Tools Lab</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleShareFormulaSheet}
                    data-testid="share-formula-sheet-btn"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-canvas hover:bg-soft text-xs font-semibold text-ink cursor-pointer transition-colors"
                    title="Create read-only share link for this formula sheet"
                  >
                    <Share2 className="w-3.5 h-3.5 text-brand" />
                    <span>{shareLinkCopied ? 'Link Copied' : 'Share Sheet'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    data-testid="close-study-utilities-btn"
                    aria-label="Close Formula Book"
                    className="p-2 rounded-xl border border-line text-muted hover:text-ink hover:bg-soft transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="px-6 py-3.5 border-b border-line bg-canvas/60 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    ['Current Material', 'All', 'Physics', 'Chemistry', 'Mathematics'] as const
                  ).map((subj) => (
                    <button
                      key={subj}
                      type="button"
                      onClick={() => setFormulaSubject(subj)}
                      data-testid={`formula-subject-${subj.toLowerCase().replace(/\s+/g, '-')}`}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        formulaSubject === subj
                          ? 'bg-brand text-white'
                          : 'bg-white dark:bg-[#1E293B] text-muted hover:text-ink border border-line'
                      }`}
                    >
                      {subj === 'Current Material'
                        ? `Active Material${
                            activeDocument
                              ? ` (${activeDocument.title.replace(/\.pdf$/i, '').slice(0, 22)})`
                              : ''
                          }`
                        : subj}
                    </button>
                  ))}
                </div>

                <div className="relative flex-1 min-w-[220px] max-w-sm">
                  <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={formulaFilter}
                    onChange={(e) => setFormulaFilter(e.target.value)}
                    placeholder="Search formulas, laws, variables, or chapters…"
                    data-testid="formula-search-input"
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-[#1E293B] border border-line text-xs text-ink placeholder:text-muted focus:outline-none focus:border-brand"
                  />
                </div>
              </div>

              {/* Quick Physical Constants Strip */}
              <div className="px-6 py-2.5 border-b border-line bg-white dark:bg-[#111827] flex items-center gap-4 overflow-x-auto text-xs">
                <span className="font-semibold text-muted whitespace-nowrap">Constants:</span>
                {PHYSICAL_CONSTANTS.map((c) => (
                  <span
                    key={c.symbol}
                    className="inline-flex items-center gap-1.5 text-ink whitespace-nowrap font-mono tabular-nums"
                  >
                    <strong className="text-brand">{c.symbol}</strong>
                    <span className="text-muted">=</span>
                    <span>{c.value}</span>
                    <span className="text-muted">{c.unit}</span>
                  </span>
                ))}
              </div>

              {/* Formula Cards List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                <div className="flex items-center justify-between text-xs text-muted pb-1">
                  <span>
                    Showing <strong className="text-ink tabular-nums">{allFormulas.length}</strong>{' '}
                    verified equations
                  </span>
                  <span>Rendered with KaTeX · Click Plot to visualize in Desmos Study Tools</span>
                </div>

                {allFormulas.length === 0 ? (
                  <div className="p-10 rounded-2xl border border-line bg-canvas text-center space-y-2">
                    <FileText className="w-7 h-7 text-muted mx-auto" />
                    <div className="text-sm font-bold text-ink">
                      No matching formulas found in this filter
                    </div>
                    <p className="text-xs text-muted max-w-md mx-auto">
                      Switch to All, Physics, Chemistry, or Mathematics above, or upload a chapter PDF to extract its equations automatically.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {allFormulas.map((item, idx) => (
                      <div
                        key={`${item.chapter}-${item.label}-${idx}`}
                        className="p-4 rounded-xl border border-line bg-white dark:bg-[#161F33] hover:border-brand/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                            <span className="font-semibold text-ink">{item.label}</span>
                            <span aria-hidden="true">·</span>
                            <span>{item.chapter}</span>
                            <span aria-hidden="true">·</span>
                            <span>{item.subject}</span>
                            {item.condition && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{item.condition}</span>
                              </>
                            )}
                          </div>
                          <div className="text-sm text-ink overflow-x-auto py-1">
                            <MathText text={item.formula} />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {onPlotFormulaInStudyTools && (
                            <button
                              type="button"
                              onClick={() => {
                                const expr = extractPlottableExpressionFromFormula(item.formula);
                                setIsOpen(false);
                                onPlotFormulaInStudyTools(expr, `${item.label} (${item.chapter})`);
                              }}
                              data-testid={`plot-formula-btn-${idx}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand/10 hover:bg-brand/20 text-brand text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                              title="Plot this formula in the Desmos 2D Graphing Calculator"
                            >
                              <LineChart className="w-3.5 h-3.5" />
                              <span>Plot in Study Tools</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(item.formula).catch(() => {});
                              setCopiedFormulaIdx(idx);
                              setTimeout(() => setCopiedFormulaIdx(null), 1500);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line hover:bg-soft text-xs font-medium text-muted hover:text-ink transition-colors cursor-pointer whitespace-nowrap"
                            title="Copy LaTeX formula"
                          >
                            {copiedFormulaIdx === idx ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>,
          document.body
        )}
    </div>
  );
};
