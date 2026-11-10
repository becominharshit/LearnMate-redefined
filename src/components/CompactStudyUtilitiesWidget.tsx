import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calculator,
  Scale,
  BarChart2,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Wrench,
  BookMarked,
  LineChart,
  X,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
  Download,
  AlertCircle,
} from 'lucide-react';
import type { StudyDocument, FocusSessionRecord } from '../types/study';
import {
  evaluateScientificExpression,
  convertStudyUnit,
  calculateDatasetStatistics,
  sampleCartesianEquationSegments,
  compileCartesianEquation,
} from '../utils/learnmate2Engine';
import { JEE_SYLLABUS_CHAPTERS } from '../data/jeeSyllabusAndNotes';
import { studyStorage } from '../services/storageService';
import { awardLearningXp } from '../utils/rewardsEngine';

interface CompactStudyUtilitiesWidgetProps {
  activeDocument?: StudyDocument | null;
  externalOpenTab?: UtilityTab | null;
  onConsumeExternalOpen?: () => void;
}

export type UtilityTab = 'calculator' | 'converter' | 'statistics' | 'formulas' | 'graph';

interface EquationEntry {
  id: string;
  expression: string;
  color: string;
  visible: boolean;
}

const CURVE_COLORS = ['#4F46E5', '#0D9488', '#D97706', '#E11D48', '#7C3AED'];

const PHYSICAL_CONSTANTS: Array<{ symbol: string; label: string; value: string; unit: string }> = [
  { symbol: 'g', label: 'Std. Gravity', value: '9.8', unit: 'm/s²' },
  { symbol: 'c', label: 'Speed of Light', value: '299792458', unit: 'm/s' },
  { symbol: 'h', label: 'Planck Constant', value: '6.626e-34', unit: 'J·s' },
  { symbol: 'R', label: 'Gas Constant', value: '8.314', unit: 'J/(mol·K)' },
  { symbol: 'N_A', label: 'Avogadro No.', value: '6.022e23', unit: 'mol⁻¹' },
  { symbol: 'e_c', label: 'Elementary Charge', value: '1.602e-19', unit: 'C' },
];

export const CompactStudyUtilitiesWidget: React.FC<CompactStudyUtilitiesWidgetProps> = ({
  activeDocument,
  externalOpenTab,
  onConsumeExternalOpen,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<UtilityTab>('graph');
  const [focusPopoverOpen, setFocusPopoverOpen] = useState(false);

  // Open drawer when requested from App Guide or Search
  useEffect(() => {
    if (externalOpenTab) {
      setActiveTab(externalOpenTab);
      setIsOpen(true);
      onConsumeExternalOpen?.();
    }
  }, [externalOpenTab, onConsumeExternalOpen]);

  // 1. Scientific Calculator State
  const [calcInput, setCalcInput] = useState('2 * sin(pi / 6) + sqrt(16)');
  const [angleMode, setAngleMode] = useState<'RAD' | 'DEG'>('RAD');
  const [memoryValue, setMemoryValue] = useState<number>(0);
  const [calcHistory, setCalcHistory] = useState<Array<{ expr: string; res: string }>>([]);

  const calcResult = useMemo(() => {
    return evaluateScientificExpression(calcInput, angleMode);
  }, [calcInput, angleMode]);

  const handleSaveToCalcHistory = () => {
    if (calcResult.ok && calcResult.value !== null) {
      setCalcHistory((prev) => [
        { expr: `${calcInput} (${angleMode})`, res: String(calcResult.value) },
        ...prev.slice(0, 9),
      ]);
    }
  };

  // 2. Unit Converter State
  const [unitVal, setUnitVal] = useState('100');
  const [fromUnit, setFromUnit] = useState('km/h');
  const [toUnit, setToUnit] = useState('m/s');
  const unitConversion = convertStudyUnit(Number(unitVal), fromUnit, toUnit);

  // 3. Statistics Calculator State
  const [statsInput, setStatsInput] = useState('12, 15, 18, 22, 25, 30');
  const parsedStatsNumbers = statsInput
    .split(/[\s,]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
  const statsSummary = calculateDatasetStatistics(parsedStatsNumbers);

  // 4. Formula Sheet Search & Subject Filter State
  const [formulaFilter, setFormulaFilter] = useState('');
  const [formulaSubject, setFormulaSubject] = useState<'All' | 'Physics' | 'Chemistry' | 'Mathematics'>('All');

  const allFormulas = useMemo(() => {
    const list: Array<{ subject: string; chapter: string; label: string; formula: string; condition: string }> = [];
    // Include formulas from active uploaded document first
    if (activeDocument) {
      for (const t of activeDocument.topics) {
        for (const kp of t.keyConcepts || []) {
          if (/[=+\-*/^√∫∑Δ]/.test(kp)) {
            list.push({
              subject: 'My Material',
              chapter: t.name,
              label: t.name,
              formula: kp,
              condition: activeDocument.title.replace(/\.pdf$/i, ''),
            });
          }
        }
      }
    }
    // Include verified JEE syllabus chapter formulas
    for (const ch of JEE_SYLLABUS_CHAPTERS) {
      if (formulaSubject !== 'All' && ch.subject !== formulaSubject) continue;
      for (const f of ch.quickNotes.essentialFormulas) {
        list.push({
          subject: ch.subject,
          chapter: ch.title,
          label: f.label,
          formula: f.formula,
          condition: f.condition,
        });
      }
    }
    if (!formulaFilter.trim()) return list;
    const q = formulaFilter.toLowerCase();
    return list.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.formula.toLowerCase().includes(q) ||
        item.chapter.toLowerCase().includes(q)
    );
  }, [activeDocument, formulaFilter, formulaSubject]);

  // 5. Multi-Expression Numerical Equation Graphing Workspace State (matching Image 6)
  const [primaryEqInput, setPrimaryEqInput] = useState('y = x^2 - 4');
  const [equations, setEquations] = useState<EquationEntry[]>([
    { id: 'eq-1', expression: 'y = x^2 - 4', color: CURVE_COLORS[0], visible: true },
  ]);
  const [xMinInput, setXMinInput] = useState('-10');
  const [xMaxInput, setXMaxInput] = useState('10');
  const [yMinInput, setYMinInput] = useState('-10');
  const [yMaxInput, setYMaxInput] = useState('10');
  const [paramA, setParamA] = useState<number>(1);
  const [traceX, setTraceX] = useState<string>('2');

  const svgRef = useRef<SVGSVGElement | null>(null);

  const numericBounds = useMemo(() => {
    const xMin = Number(xMinInput);
    const xMax = Number(xMaxInput);
    const yMin = Number(yMinInput);
    const yMax = Number(yMaxInput);
    return {
      xMin: Number.isFinite(xMin) ? xMin : -10,
      xMax: Number.isFinite(xMax) && xMax > (Number.isFinite(xMin) ? xMin : -10) ? xMax : 10,
      yMin: Number.isFinite(yMin) ? yMin : -10,
      yMax: Number.isFinite(yMax) && yMax > (Number.isFinite(yMin) ? yMin : -10) ? yMax : 10,
    };
  }, [xMinInput, xMaxInput, yMinInput, yMaxInput]);

  const handlePlotPrimaryEquation = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = primaryEqInput.trim();
    if (!trimmed) return;
    setEquations((prev) => {
      if (prev.length === 0) {
        return [{ id: `eq-${Date.now()}`, expression: trimmed, color: CURVE_COLORS[0], visible: true }];
      }
      const updated = [...prev];
      updated[0] = { ...updated[0], expression: trimmed, visible: true };
      return updated;
    });
  };

  const handleAddAnotherEquation = () => {
    const trimmed = primaryEqInput.trim() || 'y = 2*x + 1';
    setEquations((prev) => {
      if (prev.some((item) => item.expression.trim().toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      const nextColor = CURVE_COLORS[prev.length % CURVE_COLORS.length];
      return [
        ...prev,
        {
          id: `eq-${Date.now()}-${prev.length}`,
          expression: trimmed,
          color: nextColor,
          visible: true,
        },
      ];
    });
  };

  const handleResetGraph = () => {
    setPrimaryEqInput('y = x^2 - 4');
    setEquations([{ id: 'eq-1', expression: 'y = x^2 - 4', color: CURVE_COLORS[0], visible: true }]);
    setXMinInput('-10');
    setXMaxInput('10');
    setYMinInput('-10');
    setYMaxInput('10');
    setParamA(1);
  };

  const handleZoomGraph = (factor: number) => {
    const xCenter = (numericBounds.xMin + numericBounds.xMax) / 2;
    const yCenter = (numericBounds.yMin + numericBounds.yMax) / 2;
    const halfW = ((numericBounds.xMax - numericBounds.xMin) / 2) * factor;
    const halfH = ((numericBounds.yMax - numericBounds.yMin) / 2) * factor;
    setXMinInput(String(Number((xCenter - halfW).toFixed(2))));
    setXMaxInput(String(Number((xCenter + halfW).toFixed(2))));
    setYMinInput(String(Number((yCenter - halfH).toFixed(2))));
    setYMaxInput(String(Number((yCenter + halfH).toFixed(2))));
  };

  const plottedCurves = useMemo(() => {
    return equations.map((eq) => ({
      entry: eq,
      result: sampleCartesianEquationSegments({
        expression: eq.expression,
        xMin: numericBounds.xMin,
        xMax: numericBounds.xMax,
        yMin: numericBounds.yMin,
        yMax: numericBounds.yMax,
        samples: 480,
        parameterA: paramA,
      }),
    }));
  }, [equations, numericBounds, paramA]);

  const traceEvaluations = useMemo(() => {
    const xVal = Number(traceX);
    if (!Number.isFinite(xVal)) return [];
    return equations
      .filter((eq) => eq.visible)
      .map((eq) => {
        const compiled = compileCartesianEquation(eq.expression);
        const yVal = compiled.valid && compiled.evaluateAt ? compiled.evaluateAt(xVal, paramA) : NaN;
        return {
          id: eq.id,
          expression: eq.expression,
          color: eq.color,
          x: xVal,
          y: Number.isFinite(yVal) ? Number(yVal.toFixed(4)) : null,
        };
      });
  }, [equations, traceX, paramA]);

  const handleExportGraphSvg = () => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgRef.current);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'LearnMate_Graph_Plot.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 6. Docked Non-Overlapping Pomodoro Focus Timer State (25:00)
  const [focusSeconds, setFocusSeconds] = useState(25 * 60);
  const [isFocusRunning, setIsFocusRunning] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(
    () => studyStorage.getFocusSessions().length
  );

  useEffect(() => {
    if (!isFocusRunning) return;
    const timer = window.setInterval(() => {
      setFocusSeconds((prev) => {
        if (prev <= 1) {
          setIsFocusRunning(false);
          const sessionId = `focus-${Date.now()}`;
          const newSession: FocusSessionRecord = {
            id: sessionId,
            documentId: activeDocument?.id || 'general',
            documentTitle: activeDocument?.title || 'General Study Session',
            durationMinutes: 25,
            completedAt: new Date().toISOString(),
          };
          studyStorage.saveFocusSession(newSession);
          awardLearningXp({
            eventId: `focus:${sessionId}`,
            category: 'focus_session_completed',
            title: `Completed 25m Focus Session (${newSession.documentTitle})`,
            xpAwarded: 25,
          });
          setCompletedPomodoros(studyStorage.getFocusSessions().length);
          return 25 * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isFocusRunning, activeDocument]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Coordinate mapping for SVG (width=520, height=300)
  const svgW = 520;
  const svgH = 300;
  const pad = 32;
  const plotW = svgW - pad * 2;
  const plotH = svgH - pad * 2;

  const mapX = (x: number) =>
    pad + ((x - numericBounds.xMin) / Math.max(1e-6, numericBounds.xMax - numericBounds.xMin)) * plotW;
  const mapY = (y: number) =>
    pad + plotH - ((y - numericBounds.yMin) / Math.max(1e-6, numericBounds.yMax - numericBounds.yMin)) * plotH;

  const zeroX = Math.min(svgW - pad, Math.max(pad, mapX(0)));
  const zeroY = Math.min(svgH - pad, Math.max(pad, mapY(0)));

  return (
    <div className="flex items-center gap-1.5">
      {/* Study Tools Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        data-testid="study-utilities-toggle-btn"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-white dark:bg-[#121A2E] hover:bg-soft text-ink text-xs font-semibold transition-colors cursor-pointer"
        title="Open Study Tools (Calculator, Units, Statistics, Formulas, Graph)"
      >
        <Wrench className="w-3.5 h-3.5 text-brand" />
        <span className="hidden sm:inline">Study Tools</span>
      </button>

      {/* Docked Focus Timer Pill (non-overlapping in top navbar) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setFocusPopoverOpen((prev) => !prev)}
          data-testid="navbar-focus-timer-btn"
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
            isFocusRunning
              ? 'border-brand bg-brand-soft text-brand'
              : 'border-line bg-white dark:bg-[#121A2E] hover:bg-soft text-ink'
          }`}
          title="Pomodoro Focus Timer (25:00)"
        >
          <Timer className="w-3.5 h-3.5 text-brand" />
          <span>{formatTimer(focusSeconds)}</span>
        </button>

        {focusPopoverOpen && (
          <div
            data-testid="focus-timer-popover"
            className="absolute right-0 mt-2 w-72 rounded-2xl border border-line bg-white dark:bg-[#121A2E] shadow-xl p-4 z-50 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink">Focus Timer</span>
              <span className="text-[11px] font-semibold text-brand">
                {completedPomodoros} session{completedPomodoros === 1 ? '' : 's'} logged
              </span>
            </div>
            <div className="text-center py-2 rounded-xl bg-soft border border-line">
              <div className="text-2xl font-extrabold font-mono text-ink tabular-nums">
                {formatTimer(focusSeconds)}
              </div>
              <p className="text-[11px] text-muted mt-0.5 truncate px-2">
                {activeDocument ? activeDocument.title.replace(/\.pdf$/i, '') : 'JEE Deep Study Block'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFocusRunning((prev) => !prev)}
                data-testid="focus-timer-start-pause-btn"
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl lm-btn-accent text-xs font-semibold cursor-pointer"
              >
                {isFocusRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isFocusRunning ? 'Pause' : 'Start 25m'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsFocusRunning(false);
                  setFocusSeconds(25 * 60);
                }}
                className="px-3 py-2 rounded-xl border border-line bg-white dark:bg-[#0B1020] hover:bg-soft text-xs font-semibold text-muted hover:text-ink cursor-pointer"
                title="Reset timer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over / Modal Study Tools Drawer (matching Image 6) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex justify-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <aside
            data-testid="study-utilities-popover"
            aria-label="Study Tools"
            className="w-full max-w-[600px] h-full bg-white dark:bg-[#111827] border-l border-line shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-brand" />
                <h2 className="font-display text-base font-bold text-ink">Study Tools</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close Study Tools"
                data-testid="study-tools-close-btn"
                className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-soft transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 5 Tool Tabs: Calculator | Units | Statistics | Formulas | Graph */}
            <div className="px-5 pt-3 border-b border-line flex items-center gap-1 overflow-x-auto">
              {(
                [
                  { id: 'calculator', label: 'Calculator', icon: Calculator },
                  { id: 'converter', label: 'Units', icon: Scale },
                  { id: 'statistics', label: 'Statistics', icon: BarChart2 },
                  { id: 'formulas', label: 'Formulas', icon: BookMarked },
                  { id: 'graph', label: 'Graph', icon: LineChart },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    data-testid={`utility-tab-${tab.id}`}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 border-b-2 text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      active
                        ? 'border-brand text-brand bg-brand-soft/40 rounded-t-lg'
                        : 'border-transparent text-muted hover:text-ink'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* TAB 1: GRAPHING WORKSPACE (matching Image 6) */}
              {activeTab === 'graph' && (
                <div className="space-y-4" data-testid="study-tools-graph-panel">
                  <form onSubmit={handlePlotPrimaryEquation} className="space-y-2.5">
                    <label className="block text-xs font-bold text-ink">
                      Equation (type any explicit function of x, e.g. <code className="font-mono text-brand">y = x^2 - 4</code>, <code className="font-mono text-brand">tan(x)</code>, <code className="font-mono text-brand">1/(x-2)</code>)
                    </label>
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                      <input
                        type="text"
                        value={primaryEqInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPrimaryEqInput(val);
                          setEquations((prev) => {
                            if (prev.length === 0) {
                              return [{ id: 'eq-1', expression: val, color: CURVE_COLORS[0], visible: true }];
                            }
                            const copy = [...prev];
                            copy[0] = { ...copy[0], expression: val };
                            return copy;
                          });
                        }}
                        placeholder="y = x^2 - 4"
                        data-testid="graph-equation-input"
                        className="flex-1 px-3.5 py-2 rounded-xl border border-line bg-canvas text-sm font-mono text-ink focus:outline-none focus:border-brand"
                      />
                      <button
                        type="button"
                        onClick={handleAddAnotherEquation}
                        data-testid="graph-add-equation-btn"
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-line bg-white dark:bg-[#1E293B] hover:bg-soft text-xs font-semibold text-ink cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5 text-brand" />
                        <span>Add Equation</span>
                      </button>
                    </div>
                  </form>

                  {/* Active Equation List when multiple equations are plotted */}
                  {equations.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      {equations.map((eq, idx) => (
                        <div
                          key={eq.id}
                          className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border border-line bg-soft text-xs font-mono text-ink"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: eq.color }}
                          />
                          <span>{eq.expression}</span>
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setEquations((prev) => prev.filter((item) => item.id !== eq.id))
                              }
                              aria-label={`Remove ${eq.expression}`}
                              className="text-muted hover:text-danger cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Axis Range & Plot / Reset Row (matching Image 6) */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-muted">x range:</span>
                    <input
                      type="number"
                      value={xMinInput}
                      onChange={(e) => setXMinInput(e.target.value)}
                      data-testid="graph-xmin-input"
                      aria-label="x minimum"
                      className="w-16 px-2 py-1.5 rounded-lg border border-line bg-canvas text-center font-mono text-ink"
                    />
                    <span className="text-muted">to</span>
                    <input
                      type="number"
                      value={xMaxInput}
                      onChange={(e) => setXMaxInput(e.target.value)}
                      data-testid="graph-xmax-input"
                      aria-label="x maximum"
                      className="w-16 px-2 py-1.5 rounded-lg border border-line bg-canvas text-center font-mono text-ink"
                    />

                    <span className="font-semibold text-muted ml-1">y range:</span>
                    <input
                      type="number"
                      value={yMinInput}
                      onChange={(e) => setYMinInput(e.target.value)}
                      data-testid="graph-ymin-input"
                      aria-label="y minimum"
                      className="w-16 px-2 py-1.5 rounded-lg border border-line bg-canvas text-center font-mono text-ink"
                    />
                    <span className="text-muted">to</span>
                    <input
                      type="number"
                      value={yMaxInput}
                      onChange={(e) => setYMaxInput(e.target.value)}
                      data-testid="graph-ymax-input"
                      aria-label="y maximum"
                      className="w-16 px-2 py-1.5 rounded-lg border border-line bg-canvas text-center font-mono text-ink"
                    />

                    <button
                      type="button"
                      onClick={() => handlePlotPrimaryEquation()}
                      data-testid="graph-plot-btn"
                      className="px-3.5 py-1.5 rounded-lg lm-btn-accent text-xs font-semibold cursor-pointer"
                    >
                      Plot
                    </button>
                    <button
                      type="button"
                      onClick={handleResetGraph}
                      data-testid="graph-reset-btn"
                      className="px-3 py-1.5 rounded-lg border border-line bg-white dark:bg-[#1E293B] hover:bg-soft text-xs font-semibold text-ink cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>

                  {/* Optional Quick Presets & Parameter a */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-muted font-semibold">Presets:</span>
                      {[
                        { label: 'x² − 4', expr: 'y = x^2 - 4' },
                        { label: 'sin(x)', expr: 'y = sin(x)' },
                        { label: 'tan(x) (asymptotes)', expr: 'y = tan(x)' },
                        { label: '1/(x − 2)', expr: 'y = 1 / (x - 2)' },
                        { label: 'e^(−x/3)·cos(2x)', expr: 'y = exp(-x/3) * cos(2*x)' },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setPrimaryEqInput(preset.expr);
                            setEquations([
                              {
                                id: 'eq-1',
                                expression: preset.expr,
                                color: CURVE_COLORS[0],
                                visible: true,
                              },
                            ]);
                          }}
                          className="px-2 py-1 rounded-md border border-line bg-soft hover:border-brand text-ink font-mono cursor-pointer"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <label htmlFor="graph-param-a" className="text-muted font-semibold">
                        Param a = {paramA}:
                      </label>
                      <input
                        id="graph-param-a"
                        type="range"
                        min={-5}
                        max={5}
                        step={0.5}
                        value={paramA}
                        onChange={(e) => setParamA(Number(e.target.value))}
                        className="w-20 accent-indigo-600"
                      />
                    </div>
                  </div>

                  {/* Validation / Unsupported Expression Error Banner */}
                  {plottedCurves.some((c) => !c.result.valid) && (
                    <div
                      data-testid="graph-error-banner"
                      className="rounded-xl border border-danger/40 bg-danger-soft px-3.5 py-2.5 flex items-center gap-2 text-xs text-danger font-semibold"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>
                        {plottedCurves.find((c) => !c.result.valid)?.result.error ||
                          'Unsupported mathematical expression'}
                      </span>
                    </div>
                  )}

                  {/* Computed SVG Coordinate Graph */}
                  <div className="rounded-2xl border border-line bg-white dark:bg-[#0B1020] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[11px] text-muted">
                        <span className="font-mono font-bold text-ink">
                          [{numericBounds.xMin}, {numericBounds.xMax}] × [{numericBounds.yMin}, {numericBounds.yMax}]
                        </span>
                        {plottedCurves[0]?.result.discontinuityCount > 0 && (
                          <span
                            data-testid="graph-discontinuity-badge"
                            className="px-2 py-0.5 rounded-full bg-warning-soft text-amber-800 dark:text-amber-300 font-semibold"
                          >
                            {plottedCurves[0].result.discontinuityCount} discontinuity / asymptote split(s) handled
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleZoomGraph(0.75)}
                          title="Zoom in"
                          className="p-1.5 rounded-lg border border-line hover:bg-soft text-muted hover:text-ink cursor-pointer"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleZoomGraph(1.35)}
                          title="Zoom out"
                          className="p-1.5 rounded-lg border border-line hover:bg-soft text-muted hover:text-ink cursor-pointer"
                        >
                          <ZoomOut className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleExportGraphSvg}
                          title="Export SVG"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-line hover:bg-soft text-[11px] font-semibold text-ink cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>SVG</span>
                        </button>
                      </div>
                    </div>

                    <svg
                      ref={svgRef}
                      viewBox={`0 0 ${svgW} ${svgH}`}
                      data-testid="computed-cartesian-graph-svg"
                      className="w-full h-64 rounded-xl bg-slate-50/70 dark:bg-[#0F172A] border border-line/60"
                    >
                      <defs>
                        <clipPath id="graph-plot-clip">
                          <rect x={pad} y={pad} width={plotW} height={plotH} />
                        </clipPath>
                      </defs>

                      {/* Grid lines */}
                      {[0.2, 0.4, 0.6, 0.8].map((frac) => {
                        const gx = pad + frac * plotW;
                        const gy = pad + frac * plotH;
                        const xVal = (
                          numericBounds.xMin +
                          frac * (numericBounds.xMax - numericBounds.xMin)
                        ).toFixed(1);
                        const yVal = (
                          numericBounds.yMax -
                          frac * (numericBounds.yMax - numericBounds.yMin)
                        ).toFixed(1);
                        return (
                          <g key={frac}>
                            <line
                              x1={gx}
                              y1={pad}
                              x2={gx}
                              y2={svgH - pad}
                              stroke="currentColor"
                              className="text-slate-200 dark:text-slate-800"
                              strokeWidth="1"
                            />
                            <line
                              x1={pad}
                              y1={gy}
                              x2={svgW - pad}
                              y2={gy}
                              stroke="currentColor"
                              className="text-slate-200 dark:text-slate-800"
                              strokeWidth="1"
                            />
                            <text
                              x={gx}
                              y={zeroY + 13}
                              textAnchor="middle"
                              className="fill-slate-400 text-[9px] font-mono"
                            >
                              {xVal}
                            </text>
                            <text
                              x={zeroX - 6}
                              y={gy + 3}
                              textAnchor="end"
                              className="fill-slate-400 text-[9px] font-mono"
                            >
                              {yVal}
                            </text>
                          </g>
                        );
                      })}

                      {/* X and Y Coordinate Axes */}
                      <line
                        x1={pad}
                        y1={zeroY}
                        x2={svgW - pad}
                        y2={zeroY}
                        stroke="currentColor"
                        className="text-slate-400 dark:text-slate-500"
                        strokeWidth="1.5"
                      />
                      <line
                        x1={zeroX}
                        y1={pad}
                        x2={zeroX}
                        y2={svgH - pad}
                        stroke="currentColor"
                        className="text-slate-400 dark:text-slate-500"
                        strokeWidth="1.5"
                      />
                      <text
                        x={svgW - pad + 8}
                        y={zeroY + 4}
                        className="fill-slate-500 text-[10px] font-bold font-mono"
                      >
                        x
                      </text>
                      <text
                        x={zeroX + 5}
                        y={pad - 8}
                        className="fill-slate-500 text-[10px] font-bold font-mono"
                      >
                        y
                      </text>

                      {/* Plotted Continuous Segments (never connecting across asymptotes) */}
                      <g clipPath="url(#graph-plot-clip)">
                        {plottedCurves.map(({ entry, result }) => {
                          if (!entry.visible || !result.valid) return null;
                          return result.segments.map((seg, segIdx) => {
                            if (seg.length < 2) return null;
                            const d = seg
                              .map(
                                (pt, idx) =>
                                  `${idx === 0 ? 'M' : 'L'} ${mapX(pt.x).toFixed(2)} ${mapY(pt.y).toFixed(2)}`
                              )
                              .join(' ');
                            return (
                              <path
                                key={`${entry.id}-seg-${segIdx}`}
                                d={d}
                                fill="none"
                                stroke={entry.color}
                                strokeWidth="2.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            );
                          });
                        })}

                        {/* Trace point marker */}
                        {traceEvaluations.map(
                          (tr) =>
                            tr.y !== null &&
                            tr.x >= numericBounds.xMin &&
                            tr.x <= numericBounds.xMax &&
                            tr.y >= numericBounds.yMin &&
                            tr.y <= numericBounds.yMax && (
                              <circle
                                key={`trace-${tr.id}`}
                                cx={mapX(tr.x)}
                                cy={mapY(tr.y)}
                                r={4.5}
                                fill={tr.color}
                                stroke="#ffffff"
                                strokeWidth="1.5"
                              />
                            )
                        )}
                      </g>
                    </svg>

                    {/* Point Trace / Inspection Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-muted">Trace at x =</span>
                        <input
                          type="number"
                          step="0.5"
                          value={traceX}
                          onChange={(e) => setTraceX(e.target.value)}
                          data-testid="graph-trace-x-input"
                          className="w-20 px-2 py-1 rounded-lg border border-line bg-canvas font-mono text-ink"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                        {traceEvaluations.map((tr) => (
                          <span key={tr.id} className="inline-flex items-center gap-1.5 text-ink">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: tr.color }}
                            />
                            <span>
                              y({tr.x}) ={' '}
                              <strong>{tr.y !== null ? tr.y : 'undefined'}</strong>
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SCIENTIFIC CALCULATOR */}
              {activeTab === 'calculator' && (
                <div className="space-y-4" data-testid="study-tools-calculator-panel">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink">
                      Deterministic Scientific Expression Evaluator
                    </span>
                    <div className="inline-flex rounded-lg border border-line p-0.5 bg-soft">
                      {(['RAD', 'DEG'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setAngleMode(mode)}
                          data-testid={`calc-angle-${mode}`}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                            angleMode === mode ? 'bg-brand text-white' : 'text-muted hover:text-ink'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="text"
                      value={calcInput}
                      onChange={(e) => setCalcInput(e.target.value)}
                      data-testid="scientific-calc-input"
                      placeholder="e.g., 2 * sin(pi / 6) + sqrt(16)"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-canvas text-sm font-mono text-ink focus:outline-none focus:border-brand"
                    />
                    <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-soft border border-line">
                      <span className="text-xs font-semibold text-muted">Result ({angleMode})</span>
                      <span
                        data-testid="scientific-calc-result"
                        className={`text-base font-extrabold font-mono ${
                          calcResult.ok ? 'text-brand' : 'text-danger'
                        }`}
                      >
                        {calcResult.ok ? calcResult.value : calcResult.error}
                      </span>
                    </div>
                  </div>

                  {/* Memory & Action Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleSaveToCalcHistory}
                      className="px-3 py-1.5 rounded-lg lm-btn-accent text-xs font-semibold cursor-pointer"
                    >
                      = Record
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (calcResult.ok && calcResult.value !== null) {
                          setMemoryValue((m) => m + (calcResult.value ?? 0));
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-line bg-soft text-xs font-mono font-bold text-ink cursor-pointer"
                    >
                      M+
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalcInput((prev) => `${prev}${memoryValue}`)}
                      className="px-2.5 py-1.5 rounded-lg border border-line bg-soft text-xs font-mono font-bold text-ink cursor-pointer"
                    >
                      MR ({Number(memoryValue.toPrecision(6))})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMemoryValue(0)}
                      className="px-2.5 py-1.5 rounded-lg border border-line bg-soft text-xs font-mono font-bold text-muted hover:text-ink cursor-pointer"
                    >
                      MC
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalcInput('')}
                      className="px-2.5 py-1.5 rounded-lg border border-line bg-soft text-xs font-bold text-danger cursor-pointer ml-auto"
                    >
                      Clear
                    </button>
                  </div>

                  {/* Scientific Functions Keypad */}
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      'sin(',
                      'cos(',
                      'tan(',
                      'asin(',
                      'acos(',
                      'atan(',
                      'sqrt(',
                      'cbrt(',
                      'ln(',
                      'log(',
                      'exp(',
                      'abs(',
                      'pi',
                      'e',
                      '^2',
                    ].map((token) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() => setCalcInput((prev) => `${prev}${token}`)}
                        className="py-2 rounded-lg border border-line bg-canvas hover:bg-soft text-xs font-mono font-semibold text-ink cursor-pointer"
                      >
                        {token}
                      </button>
                    ))}
                  </div>

                  {/* JEE Physical Constants */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
                      JEE Physical Constants (click to insert)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {PHYSICAL_CONSTANTS.map((c) => (
                        <button
                          key={c.symbol}
                          type="button"
                          onClick={() => setCalcInput((prev) => `${prev}${c.value}`)}
                          className="p-2 rounded-lg border border-line bg-canvas hover:border-brand text-left cursor-pointer"
                        >
                          <div className="text-xs font-bold text-ink font-mono">
                            {c.symbol} = {c.value}
                          </div>
                          <div className="text-[10px] text-muted">
                            {c.label} ({c.unit})
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {calcHistory.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-line">
                      <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
                        Calculation History
                      </span>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {calcHistory.map((item, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-soft text-xs font-mono"
                          >
                            <span className="text-muted truncate">{item.expr}</span>
                            <span className="font-bold text-ink">= {item.res}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: UNIT CONVERTER */}
              {activeTab === 'converter' && (
                <div className="space-y-4" data-testid="study-tools-units-panel">
                  <label className="block text-xs font-bold text-ink">
                    Physics &amp; Chemistry Unit Converter
                  </label>
                  <input
                    type="number"
                    value={unitVal}
                    onChange={(e) => setUnitVal(e.target.value)}
                    data-testid="unit-converter-value-input"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-canvas text-sm font-mono text-ink"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[11px] font-semibold text-muted block mb-1">From</span>
                      <select
                        value={fromUnit}
                        onChange={(e) => setFromUnit(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-line bg-canvas text-xs font-semibold text-ink"
                      >
                        <optgroup label="Speed">
                          <option value="km/h">km/h</option>
                          <option value="m/s">m/s</option>
                          <option value="mph">mph</option>
                        </optgroup>
                        <optgroup label="Length">
                          <option value="m">m</option>
                          <option value="km">km</option>
                          <option value="cm">cm</option>
                          <option value="mm">mm</option>
                        </optgroup>
                        <optgroup label="Energy">
                          <option value="J">Joules (J)</option>
                          <option value="kJ">kJ</option>
                          <option value="cal">cal</option>
                          <option value="kcal">kcal</option>
                          <option value="eV">Electron-Volt (eV)</option>
                        </optgroup>
                        <optgroup label="Temperature">
                          <option value="C">°C</option>
                          <option value="K">Kelvin (K)</option>
                          <option value="F">°F</option>
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-muted block mb-1">To</span>
                      <select
                        value={toUnit}
                        onChange={(e) => setToUnit(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-line bg-canvas text-xs font-semibold text-ink"
                      >
                        <optgroup label="Speed">
                          <option value="m/s">m/s</option>
                          <option value="km/h">km/h</option>
                          <option value="mph">mph</option>
                        </optgroup>
                        <optgroup label="Length">
                          <option value="m">m</option>
                          <option value="km">km</option>
                          <option value="cm">cm</option>
                          <option value="mm">mm</option>
                        </optgroup>
                        <optgroup label="Energy">
                          <option value="J">Joules (J)</option>
                          <option value="kJ">kJ</option>
                          <option value="cal">cal</option>
                          <option value="kcal">kcal</option>
                          <option value="eV">Electron-Volt (eV)</option>
                        </optgroup>
                        <optgroup label="Temperature">
                          <option value="K">Kelvin (K)</option>
                          <option value="C">°C</option>
                          <option value="F">°F</option>
                        </optgroup>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-soft border border-line">
                    <span className="text-xs font-semibold text-muted">Converted Value</span>
                    <span
                      data-testid="unit-converter-result"
                      className="text-base font-extrabold font-mono text-brand"
                    >
                      {unitConversion.ok ? `${unitConversion.value} ${toUnit}` : unitConversion.error}
                    </span>
                  </div>
                </div>
              )}

              {/* TAB 4: DATASET STATISTICS */}
              {activeTab === 'statistics' && (
                <div className="space-y-4" data-testid="study-tools-stats-panel">
                  <label className="block text-xs font-bold text-ink">
                    Dataset Values (comma or space separated)
                  </label>
                  <input
                    type="text"
                    value={statsInput}
                    onChange={(e) => setStatsInput(e.target.value)}
                    data-testid="stats-calc-input"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-canvas text-sm font-mono text-ink"
                  />
                  {statsSummary ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="p-3 rounded-xl bg-soft border border-line">
                        <span className="text-muted block">Count (N)</span>
                        <span className="font-mono font-bold text-sm text-ink">{statsSummary.count}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-soft border border-line">
                        <span className="text-muted block">Mean (x̄)</span>
                        <span data-testid="stats-mean-value" className="font-mono font-bold text-sm text-brand">
                          {statsSummary.mean}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-soft border border-line">
                        <span className="text-muted block">Median</span>
                        <span className="font-mono font-bold text-sm text-ink">{statsSummary.median}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-soft border border-line">
                        <span className="text-muted block">Pop. Variance (σ²)</span>
                        <span className="font-mono font-bold text-sm text-ink">
                          {statsSummary.populationVariance}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-soft border border-line">
                        <span className="text-muted block">Pop. Std Dev (σ)</span>
                        <span className="font-mono font-bold text-sm text-ink">
                          {statsSummary.populationStdDev}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-soft border border-line">
                        <span className="text-muted block">Min / Max</span>
                        <span className="font-mono font-bold text-sm text-ink">
                          {statsSummary.min} / {statsSummary.max}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-danger">Enter at least one valid number.</p>
                  )}
                </div>
              )}

              {/* TAB 5: CHAPTER-CONNECTED FORMULAS */}
              {activeTab === 'formulas' && (
                <div className="space-y-3" data-testid="study-tools-formulas-panel">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['All', 'Physics', 'Chemistry', 'Mathematics'] as const).map((subj) => (
                      <button
                        key={subj}
                        type="button"
                        onClick={() => setFormulaSubject(subj)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                          formulaSubject === subj
                            ? 'bg-brand text-white'
                            : 'bg-soft text-muted hover:text-ink'
                        }`}
                      >
                        {subj}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={formulaFilter}
                    onChange={(e) => setFormulaFilter(e.target.value)}
                    placeholder="Filter formulas by chapter or keyword…"
                    className="w-full px-3.5 py-2 rounded-xl border border-line bg-canvas text-xs text-ink"
                  />
                  <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                    {allFormulas.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-line bg-canvas space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-brand">
                          <span>
                            {item.subject} · {item.chapter}
                          </span>
                          <span className="text-muted">{item.condition}</span>
                        </div>
                        <div className="text-xs font-bold text-ink">{item.label}</div>
                        <div className="text-xs font-mono text-ink bg-soft px-2.5 py-1.5 rounded-lg">
                          {item.formula}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
