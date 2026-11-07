import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Calculator,
  Ruler,
  BookOpen,
  LineChart,
  BarChart2,
  X,
  Wrench,
  RotateCcw,
  Delete,
  ChevronDown,
} from 'lucide-react';
import {
  evaluateScientificExpression,
  convertStudyUnit,
  calculateDatasetStatistics,
} from '../utils/learnmate2Engine';
import type { StudyDocument } from '../types/study';

interface CompactStudyUtilitiesWidgetProps {
  activeDocument?: StudyDocument | null;
  externalOpen?: boolean;
  onExternalClose?: () => void;
}

type ToolTab = 'calc' | 'units' | 'stats' | 'formulas' | 'graph';

const UNIT_GROUPS: Record<string, string[]> = {
  Length: ['m', 'km', 'cm', 'mm', 'in', 'ft', 'mi'],
  Mass: ['kg', 'g', 'mg', 'lb'],
  Temperature: ['c', 'f', 'k'],
  Energy: ['j', 'kj', 'cal', 'kcal', 'ev'],
  Speed: ['m/s', 'km/h', 'mph'],
};

/** Shown when the active material has no formulas that could be extracted. */
const JEE_QUICK_FORMULAS: Array<{ subject: string; items: string[] }> = [
  { subject: 'Physics', items: ['v = u + at', 's = ut + ½at²', 'v² = u² + 2as', 'T = 2π√(l/g)'] },
  { subject: 'Chemistry', items: ['PV = nRT', 'ΔG = ΔH − TΔS', 'pH = −log[H⁺]'] },
  {
    subject: 'Mathematics',
    items: ['x = (−b ± √(b² − 4ac)) / 2a', 'sin²θ + cos²θ = 1', 'd/dx (xⁿ) = n·xⁿ⁻¹'],
  },
];

/**
 * Converts a finite decimal number to an exact reduced fraction { num, den }
 * when denominator <= 1000 and error < 1e-9.
 */
function toExactFraction(value: number): { num: number; den: number } | null {
  if (!Number.isFinite(value)) return null;
  if (Number.isInteger(value)) return null;
  const sign = value < 0 ? -1 : 1;
  const absVal = Math.abs(value);
  for (let den = 2; den <= 1000; den++) {
    const num = Math.round(absVal * den);
    if (Math.abs(num / den - absVal) < 1e-8) {
      const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
      const g = gcd(num, den);
      return { num: sign * (num / g), den: den / g };
    }
  }
  return null;
}

export const CompactStudyUtilitiesWidget: React.FC<CompactStudyUtilitiesWidgetProps> = ({
  activeDocument,
  externalOpen,
  onExternalClose,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;

  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    if (!next && onExternalClose) {
      onExternalClose();
    }
  };

  const [activeTool, setActiveTool] = useState<ToolTab>('calc');
  const [angleMode, setAngleMode] = useState<'DEG' | 'RAD'>('DEG');
  const modalRef = useRef<HTMLDivElement | null>(null);

  // Default expression from Image 5: 1/13 + (2 * 5)^2 -> 1301/13 or 1/13 + (2 * 5)^2
  const [calcExpr, setCalcExpr] = useState('1/13 + (2 * 5)^2');
  const [calcResult, setCalcResult] = useState<string>('1301/13');
  const [calcNumeric, setCalcNumeric] = useState<number | null>(1301 / 13);
  const [calcHistory, setCalcHistory] = useState<Array<{ expr: string; res: string }>>([
    { expr: '1/13 + (2 * 5)^2', res: '1301/13 (≈ 100.0769)' },
    { expr: 'sin(pi / 2) + sqrt(16)', res: '5' },
  ]);
  const [showHistory, setShowHistory] = useState(false);

  // Unit Converter state
  const [unitCategory, setUnitCategory] = useState<string>('Length');
  const [unitVal, setUnitVal] = useState<string>('1');
  const [fromUnit, setFromUnit] = useState<string>('km');
  const [toUnit, setToUnit] = useState<string>('m');

  // Statistics state
  const [statsInput, setStatsInput] = useState('12, 15, 18, 22, 25, 28');

  // Graph state
  const [graphFn, setGraphFn] = useState<'sin(x)' | 'x^2' | 'cos(x)' | '1/(1+e^-x)'>('sin(x)');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleRunCalc = (exprToEval = calcExpr) => {
    const normalized = exprToEval.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
    const out = evaluateScientificExpression(normalized);
    if (out.ok && out.value !== null) {
      setCalcNumeric(out.value);
      const frac = toExactFraction(out.value);
      const formatted = frac ? `${frac.num}/${frac.den}` : String(out.value);
      setCalcResult(formatted);
      setCalcHistory((prev) => [
        { expr: exprToEval, res: formatted },
        ...prev.filter((item) => item.expr !== exprToEval).slice(0, 5),
      ]);
    } else {
      setCalcNumeric(null);
      setCalcResult(out.error || 'Syntax Error');
    }
  };

  useEffect(() => {
    handleRunCalc(calcExpr);
  }, []);

  const convertedOutput = convertStudyUnit(Number(unitVal) || 0, fromUnit, toUnit);

  const parsedDataset = statsInput
    .split(/[\s,;]+/)
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isFinite(n));
  const statsSummary = calculateDatasetStatistics(parsedDataset);

  const docFormulas = (activeDocument?.pages || [])
    .flatMap((p) =>
      p.content
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.includes('=') && l.length >= 8 && l.length <= 110)
        .map((line) => ({ page: p.pageNumber, text: line.replace(/^[•\-*\d.)\s]+/, '') }))
    )
    .slice(0, 6);

  const exactFraction = calcNumeric !== null ? toExactFraction(calcNumeric) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!isOpen)}
        data-testid="study-tools-trigger"
        aria-expanded={isOpen}
        title="Open Study Tools (Scientific Calculator, Units, Statistics, Formulas, Graph)"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-soft text-ink border border-line text-xs font-medium transition-colors cursor-pointer"
      >
        <Calculator className="w-3.5 h-3.5 text-brand" />
        <span>Study Tools</span>
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-xs p-4 lm-no-print"
            onMouseDown={(e) => {
              if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                setOpen(false);
              }
            }}
          >
            <div
              ref={modalRef}
              data-testid="study-tools-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Study Tools"
              className="w-full max-w-[520px] rounded-2xl bg-white dark:bg-[#121A2E] text-ink border border-line shadow-2xl overflow-hidden"
            >
            {/* Editorial Modal Header matching Image 5 */}
            <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-3">
              <h2 className="font-serif-editorial text-2xl font-bold text-ink tracking-tight">
                Study Tools
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close Study Tools"
                className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-soft transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 5 Editorial Tabs with Terracotta Active Indicator */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-1 px-4 sm:px-6 border-b border-line">
              {[
                { id: 'calc', label: 'Calculator', icon: Calculator },
                { id: 'units', label: 'Units', icon: Ruler },
                { id: 'stats', label: 'Statistics', icon: BarChart2 },
                { id: 'formulas', label: 'Formulas', icon: BookOpen },
                { id: 'graph', label: 'Graph', icon: LineChart },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTool === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTool(tab.id as ToolTab)}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'border-brand text-brand font-semibold'
                        : 'border-transparent text-muted hover:text-ink'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {activeTool === 'calc' && (
                <div className="space-y-4">
                  {/* Expression & Fraction Display Box matching Image 5 */}
                  <div className="rounded-xl border border-line bg-canvas p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span className="font-mono text-[11px] truncate max-w-[260px]">
                        {calcExpr || 'Enter mathematical expression'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowHistory((p) => !p)}
                          title="Calculation History"
                          className="p-1 rounded hover:bg-line/50 text-muted cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setAngleMode((prev) => (prev === 'DEG' ? 'RAD' : 'DEG'))
                          }
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold text-muted hover:bg-line/50 cursor-pointer"
                        >
                          <span>{angleMode}</span>
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={calcExpr}
                      onChange={(e) => setCalcExpr(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRunCalc(calcExpr);
                      }}
                      aria-label="Scientific calculator expression"
                      placeholder="e.g. 1/13 + (2 * 5)^2"
                      className="w-full bg-transparent font-serif-editorial text-xl text-ink focus:outline-none"
                    />

                    <div
                      data-testid="calc-result-display"
                      className="flex items-center justify-end gap-2 pt-1 font-serif-editorial text-2xl font-semibold text-ink tabular-nums"
                    >
                      <span>=</span>
                      {exactFraction ? (
                        <span className="lm-fraction text-xl" title={`≈ ${calcNumeric?.toFixed(6)}`}>
                          <span className="num">{exactFraction.num}</span>
                          <span className="den">{exactFraction.den}</span>
                        </span>
                      ) : (
                        <span>{calcResult}</span>
                      )}
                    </div>
                  </div>

                  {showHistory && calcHistory.length > 0 && (
                    <div className="rounded-lg border border-line bg-canvas p-2.5 text-xs space-y-1 max-h-28 overflow-y-auto">
                      {calcHistory.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setCalcExpr(item.expr);
                            handleRunCalc(item.expr);
                            setShowHistory(false);
                          }}
                          className="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-soft text-left cursor-pointer"
                        >
                          <span className="font-mono text-muted">{item.expr}</span>
                          <span className="font-semibold text-ink">= {item.res}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Row 1: Scientific Functions matching Image 5 */}
                  <div className="grid grid-cols-10 gap-1.5">
                    {[
                      { label: 'sin', token: 'sin(' },
                      { label: 'cos', token: 'cos(' },
                      { label: 'tan', token: 'tan(' },
                      { label: 'log', token: 'log(' },
                      { label: 'ln', token: 'ln(' },
                      { label: '√', token: 'sqrt(' },
                      { label: '( )', token: '(' },
                      { label: 'π', token: 'pi' },
                      { label: 'e', token: 'e' },
                      { label: '⌫', token: 'BACKSPACE' },
                    ].map((fn) => (
                      <button
                        key={fn.label}
                        type="button"
                        onClick={() => {
                          if (fn.token === 'BACKSPACE') {
                            setCalcExpr((prev) => prev.slice(0, -1));
                          } else {
                            setCalcExpr((prev) => `${prev}${fn.token}`);
                          }
                        }}
                        className="py-2 rounded-lg border border-line bg-canvas hover:bg-soft text-xs font-serif-editorial font-medium text-ink flex items-center justify-center cursor-pointer"
                      >
                        {fn.token === 'BACKSPACE' ? <Delete className="w-3.5 h-3.5" /> : fn.label}
                      </button>
                    ))}
                  </div>

                  {/* Main Numeric & Operator Grid matching Image 5 */}
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { label: '7', token: '7', variant: 'num' },
                      { label: '8', token: '8', variant: 'num' },
                      { label: '9', token: '9', variant: 'num' },
                      { label: '÷', token: '/', variant: 'op' },
                      { label: 'C', token: 'CLEAR', variant: 'clear' },
                      { label: '4', token: '4', variant: 'num' },
                      { label: '5', token: '5', variant: 'num' },
                      { label: '6', token: '6', variant: 'num' },
                      { label: '×', token: '*', variant: 'op' },
                      { label: '(', token: '(', variant: 'op' },
                      { label: '1', token: '1', variant: 'num' },
                      { label: '2', token: '2', variant: 'num' },
                      { label: '3', token: '3', variant: 'num' },
                      { label: '−', token: '-', variant: 'op' },
                      { label: ')', token: ')', variant: 'op' },
                    ].map((btn) => (
                      <button
                        key={btn.label}
                        type="button"
                        onClick={() => {
                          if (btn.token === 'CLEAR') {
                            setCalcExpr('');
                            setCalcResult('0');
                            setCalcNumeric(0);
                          } else {
                            setCalcExpr((prev) => `${prev}${btn.token}`);
                          }
                        }}
                        className={`py-2.5 rounded-lg text-base font-serif-editorial font-medium transition-colors cursor-pointer border ${
                          btn.variant === 'clear'
                            ? 'bg-brand-soft border-brand/30 text-brand font-semibold hover:bg-brand-soft/80'
                            : btn.variant === 'op'
                            ? 'bg-soft border-line text-ink hover:bg-line/40 dark:hover:bg-[#1A2440]'
                            : 'bg-canvas border-line text-ink hover:bg-soft'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}

                    {/* Bottom Row: 0 (2 cols), ., +, = (Terracotta) */}
                    <button
                      type="button"
                      onClick={() => setCalcExpr((prev) => `${prev}0`)}
                      className="col-span-2 py-2.5 rounded-lg border border-line bg-canvas hover:bg-soft text-base font-serif-editorial font-medium text-ink cursor-pointer"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalcExpr((prev) => `${prev}.`)}
                      className="py-2.5 rounded-lg border border-line bg-canvas hover:bg-soft text-base font-serif-editorial font-medium text-ink cursor-pointer"
                    >
                      .
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalcExpr((prev) => `${prev}+`)}
                      className="py-2.5 rounded-lg border border-line bg-soft hover:bg-line/40 dark:hover:bg-[#1A2440] text-base font-serif-editorial font-medium text-ink cursor-pointer"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRunCalc(calcExpr)}
                      data-testid="calc-equals-btn"
                      className="py-2.5 rounded-lg bg-brand hover:bg-brand-strong text-white text-base font-serif-editorial font-semibold transition-colors cursor-pointer"
                    >
                      =
                    </button>
                  </div>
                </div>
              )}

              {activeTool === 'units' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(UNIT_GROUPS).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setUnitCategory(cat);
                          setFromUnit(UNIT_GROUPS[cat][0]);
                          setToUnit(UNIT_GROUPS[cat][1]);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
                          unitCategory === cat
                            ? 'bg-brand-soft border-brand/30 text-brand'
                            : 'bg-canvas border-line text-muted hover:text-ink'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block text-xs font-semibold text-muted mb-1">
                        Value
                      </label>
                      <input
                        type="number"
                        value={unitVal}
                        onChange={(e) => setUnitVal(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-line bg-canvas font-semibold text-sm text-ink"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted mb-1">
                        From
                      </label>
                      <select
                        value={fromUnit}
                        onChange={(e) => setFromUnit(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-line bg-canvas font-semibold text-sm text-ink"
                      >
                        {(UNIT_GROUPS[unitCategory] || []).map((u) => (
                          <option key={u} value={u}>
                            {u.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted mb-1">
                        To
                      </label>
                      <select
                        value={toUnit}
                        onChange={(e) => setToUnit(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-line bg-canvas font-semibold text-sm text-ink"
                      >
                        {(UNIT_GROUPS[unitCategory] || []).map((u) => (
                          <option key={u} value={u}>
                            {u.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-brand-soft/60 border border-brand/25 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted">Converted Value:</span>
                    <span className="font-serif-editorial font-bold text-lg text-brand tabular-nums">
                      {convertedOutput.ok
                        ? `${convertedOutput.value} ${toUnit.toUpperCase()}`
                        : convertedOutput.error}
                    </span>
                  </div>
                </div>
              )}

              {activeTool === 'stats' && (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-muted">
                    Dataset Values (comma-separated):
                  </label>
                  <input
                    type="text"
                    value={statsInput}
                    onChange={(e) => setStatsInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-canvas font-mono text-xs text-ink"
                  />
                  {statsSummary ? (
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <div className="p-3 rounded-xl bg-canvas border border-line">
                        <div className="text-[11px] text-muted">Mean (μ / X̄)</div>
                        <div className="font-serif-editorial font-bold text-base text-ink tabular-nums">
                          {statsSummary.mean}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-canvas border border-line">
                        <div className="text-[11px] text-muted">Median</div>
                        <div className="font-serif-editorial font-bold text-base text-ink tabular-nums">
                          {statsSummary.median}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-canvas border border-line">
                        <div className="text-[11px] text-muted">Sample Std Dev (s)</div>
                        <div className="font-serif-editorial font-bold text-base text-brand tabular-nums">
                          {statsSummary.sampleStdDev}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-canvas border border-line">
                        <div className="text-[11px] text-muted">Population Std Dev (σ)</div>
                        <div className="font-serif-editorial font-bold text-base text-success tabular-nums">
                          {statsSummary.populationStdDev}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted">Enter at least one number.</p>
                  )}
                </div>
              )}

              {activeTool === 'formulas' && (
                <div className="space-y-2.5 max-h-72 overflow-y-auto">
                  <div className="text-xs font-semibold text-muted">
                    {docFormulas.length > 0 && activeDocument
                      ? `Extracted from ${activeDocument.title}`
                      : activeDocument
                      ? `No formulas found in ${activeDocument.title}. JEE quick reference:`
                      : 'JEE quick reference'}
                  </div>
                  {docFormulas.length > 0 ? (
                    docFormulas.map((f, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-canvas border border-line space-y-1"
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-brand">
                          Page {f.page}
                        </span>
                        <div className="font-serif-editorial text-sm text-ink">{f.text}</div>
                      </div>
                    ))
                  ) : (
                    <div className="space-y-2 text-sm text-ink">
                      {JEE_QUICK_FORMULAS.map((group) => (
                        <div
                          key={group.subject}
                          className="p-3 rounded-xl bg-canvas border border-line space-y-1"
                        >
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand">
                            {group.subject}
                          </span>
                          {group.items.map((item) => (
                            <div key={item} className="font-serif-editorial">
                              {item}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTool === 'graph' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['sin(x)', 'x^2', 'cos(x)', '1/(1+e^-x)'] as const).map((fn) => (
                      <button
                        key={fn}
                        type="button"
                        onClick={() => setGraphFn(fn)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold cursor-pointer border ${
                          graphFn === fn
                            ? 'bg-brand border-brand text-white'
                            : 'bg-canvas border-line text-ink hover:bg-soft'
                        }`}
                      >
                        f(x) = {fn}
                      </button>
                    ))}
                  </div>
                  <svg
                    viewBox="0 0 320 160"
                    className="w-full h-40 rounded-xl bg-canvas border border-line"
                  >
                    <line x1="0" y1="80" x2="320" y2="80" stroke="currentColor" className="text-line" strokeWidth="1" />
                    <line x1="160" y1="0" x2="160" y2="160" stroke="currentColor" className="text-line" strokeWidth="1" />
                    <polyline
                      fill="none"
                      stroke="currentColor"
                      className="text-brand"
                      strokeWidth="2.5"
                      points={Array.from({ length: 81 })
                        .map((_, i) => {
                          const xNorm = (i - 40) / 10;
                          let yNorm = 0;
                          if (graphFn === 'sin(x)') yNorm = Math.sin(xNorm);
                          else if (graphFn === 'cos(x)') yNorm = Math.cos(xNorm);
                          else if (graphFn === 'x^2') yNorm = (xNorm * xNorm) / 8 - 0.8;
                          else yNorm = (1 / (1 + Math.exp(-xNorm))) * 2 - 1;
                          const px = (i / 80) * 320;
                          const py = 80 - yNorm * 56;
                          return `${px.toFixed(1)},${Math.max(8, Math.min(152, py)).toFixed(1)}`;
                        })
                        .join(' ')}
                    />
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
