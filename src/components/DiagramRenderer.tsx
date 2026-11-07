import React, { useState } from 'react';
import {
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Info,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { StructuredDiagramSpec, DiagramElement } from '../types/diagram';
import { serializeDiagramSpecToSvg } from '../utils/diagramEngine';

interface DiagramRendererProps {
  spec: StructuredDiagramSpec;
  isDarkTheme?: boolean;
  onSave?: (spec: StructuredDiagramSpec) => void;
  isSaved?: boolean;
  onNavigateToPage?: (pageNumber: number) => void;
}

export const DiagramRenderer: React.FC<DiagramRendererProps> = ({
  spec,
  isDarkTheme = false,
  onSave,
  isSaved = false,
  onNavigateToPage,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [downloadToast, setDownloadToast] = useState<boolean>(false);

  const { width, height } = spec.viewBox;

  const handleDownloadSvg = () => {
    const svgContent = serializeDiagramSpecToSvg(spec, isDarkTheme);
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeTitle = (spec.title || 'diagram')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-|-$/g, '');
    a.href = url;
    a.download = `LearnMate-${safeTitle}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloadToast(true);
    setTimeout(() => setDownloadToast(false), 2800);
  };

  const getMarkerId = (color?: string): string => {
    if (!color) return 'arrow-default';
    const c = color.toLowerCase();
    if (c.includes('red') || c === '#dc2626' || c === '#ef4444') return 'arrow-red';
    if (c.includes('blue') || c === '#2563eb' || c === '#3b82f6') return 'arrow-blue';
    if (c.includes('green') || c === '#16a34a' || c === '#10b981') return 'arrow-green';
    if (c.includes('amber') || c.includes('orange') || c === '#d97706' || c === '#f59e0b') return 'arrow-amber';
    if (c.includes('purple') || c.includes('violet') || c === '#9333ea' || c === '#8b5cf6') return 'arrow-purple';
    if (c.includes('slate') || c.includes('gray') || c === '#64748b') return 'arrow-slate';
    return 'arrow-default';
  };

  const renderElement = (el: DiagramElement) => {
    const defaultText = isDarkTheme ? '#F8FAFC' : '#0F172A';

    switch (el.kind) {
      case 'arrow': {
        const marker = getMarkerId(el.color);
        const stroke = el.color || (isDarkTheme ? '#818CF8' : '#4F46E5');
        const midX = (el.startX + el.endX) / 2;
        const midY = (el.startY + el.endY) / 2 - 8;
        return (
          <g key={el.id} className="transition-all">
            <line
              x1={el.startX}
              y1={el.startY}
              x2={el.endX}
              y2={el.endY}
              stroke={stroke}
              strokeWidth={el.strokeWidth || 2.5}
              strokeDasharray={el.dashed ? '6,4' : undefined}
              markerEnd={`url(#${marker})`}
            />
            {el.label && (
              <text
                x={midX}
                y={midY}
                fill={stroke}
                fontSize={12}
                fontWeight="bold"
                textAnchor="middle"
                className="select-none"
              >
                {el.label}
              </text>
            )}
          </g>
        );
      }

      case 'line': {
        const stroke = el.color || (isDarkTheme ? '#94A3B8' : '#64748B');
        const midX = (el.startX + el.endX) / 2;
        const midY = (el.startY + el.endY) / 2 - 8;
        return (
          <g key={el.id}>
            <line
              x1={el.startX}
              y1={el.startY}
              x2={el.endX}
              y2={el.endY}
              stroke={stroke}
              strokeWidth={el.strokeWidth || 2}
              strokeDasharray={el.dashed ? '6,4' : undefined}
            />
            {el.label && (
              <text
                x={midX}
                y={midY}
                fill={stroke}
                fontSize={12}
                textAnchor="middle"
                className="select-none"
              >
                {el.label}
              </text>
            )}
          </g>
        );
      }

      case 'rect': {
        const fill = isDarkTheme && (el.fill === '#EEF2FF' || el.fill === '#FFFFFF') ? '#1A2440' : el.fill || '#EEF2FF';
        const stroke = el.stroke || (isDarkTheme ? '#818CF8' : '#4F46E5');
        return (
          <g key={el.id}>
            <rect
              x={el.x}
              y={el.y}
              width={el.width}
              height={el.height}
              rx={el.rx || 0}
              fill={fill}
              stroke={stroke}
              strokeWidth={el.strokeWidth || 2}
            />
            {el.label && (
              <text
                x={el.x + el.width / 2}
                y={el.y + el.height / 2 + 5}
                fill={defaultText}
                fontSize={12}
                fontWeight="bold"
                textAnchor="middle"
                className="select-none"
              >
                {el.label}
              </text>
            )}
          </g>
        );
      }

      case 'circle': {
        const fill = isDarkTheme && (el.fill === '#EEF2FF' || el.fill === '#FFFFFF' || el.fill === '#EFF6FF') ? '#1A2440' : el.fill || '#EEF2FF';
        const stroke = el.stroke || (isDarkTheme ? '#818CF8' : '#4F46E5');
        return (
          <g key={el.id}>
            <circle
              cx={el.cx}
              cy={el.cy}
              r={el.r}
              fill={fill}
              stroke={stroke}
              strokeWidth={el.strokeWidth || 2}
            />
            {el.label && (
              <text
                x={el.cx}
                y={el.cy + el.r + 16}
                fill={defaultText}
                fontSize={12}
                fontWeight="bold"
                textAnchor="middle"
                className="select-none"
              >
                {el.label}
              </text>
            )}
          </g>
        );
      }

      case 'polygon': {
        const fill = isDarkTheme && (el.fill === '#F1F5F9' || el.fill === '#EEF2FF') ? '#1E293B' : el.fill || '#F1F5F9';
        const stroke = el.stroke || (isDarkTheme ? '#64748B' : '#475569');
        return (
          <polygon
            key={el.id}
            points={el.points}
            fill={fill}
            stroke={stroke}
            strokeWidth={el.strokeWidth || 2}
          />
        );
      }

      case 'path': {
        const stroke = el.stroke || (isDarkTheme ? '#818CF8' : '#4F46E5');
        const fill = el.fill || 'none';
        return (
          <path
            key={el.id}
            d={el.d}
            fill={fill}
            stroke={stroke}
            strokeWidth={el.strokeWidth || 2.5}
            strokeDasharray={el.dashed ? '6,4' : undefined}
          />
        );
      }

      case 'text': {
        const color = el.color || defaultText;
        return (
          <text
            key={el.id}
            x={el.x}
            y={el.y}
            fill={color}
            fontSize={el.fontSize || 13}
            fontWeight={el.fontWeight || 'normal'}
            textAnchor={el.textAnchor || 'start'}
            className="select-none"
          >
            {el.text}
          </text>
        );
      }

      case 'arc': {
        const color = el.color || '#D97706';
        const rad1 = (el.startAngleDeg * Math.PI) / 180;
        const rad2 = (el.endAngleDeg * Math.PI) / 180;
        const x1 = el.cx + el.r * Math.cos(rad1);
        const y1 = el.cy - el.r * Math.sin(rad1);
        const x2 = el.cx + el.r * Math.cos(rad2);
        const y2 = el.cy - el.r * Math.sin(rad2);
        const diff = Math.abs(el.endAngleDeg - el.startAngleDeg);
        const largeArc = diff > 180 ? 1 : 0;
        const d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${el.r} ${el.r} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
        const midDeg = (el.startAngleDeg + el.endAngleDeg) / 2;
        const midRad = (midDeg * Math.PI) / 180;
        const labelX = el.cx + (el.r + 18) * Math.cos(midRad);
        const labelY = el.cy - (el.r + 18) * Math.sin(midRad);

        return (
          <g key={el.id}>
            <path d={d} fill="none" stroke={color} strokeWidth={2} />
            {el.label && (
              <text
                x={labelX.toFixed(1)}
                y={labelY.toFixed(1)}
                fill={color}
                fontSize={12}
                fontWeight="bold"
                textAnchor="middle"
                className="select-none"
              >
                {el.label}
              </text>
            )}
          </g>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div
      data-testid="diagram-renderer-container"
      className={`space-y-4 rounded-3xl border transition-all ${
        isFullscreen
          ? 'fixed inset-4 z-50 overflow-y-auto bg-white dark:bg-[#0B1020] p-6 shadow-2xl border-line'
          : 'bg-white dark:bg-[#121A2E] border-slate-200/90 dark:border-[#26324F] p-4 sm:p-6 shadow-2xs'
      }`}
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-brand-soft text-brand text-[10px] font-bold uppercase tracking-wider">
              {spec.subject} · {spec.category.replace(/_/g, ' ')}
            </span>
            {spec.fallbackNotice && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                {spec.fallbackNotice}
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-ink mt-1 truncate">
            {spec.title}
          </h3>
          <p className="text-xs text-muted mt-0.5 line-clamp-2">
            {spec.description}
          </p>
        </div>

        {/* Toolbar controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))))}
            title="Zoom out"
            aria-label="Zoom out"
            className="p-1.5 rounded-xl border border-line hover:bg-soft text-muted hover:text-ink cursor-pointer transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-semibold text-muted px-1 min-w-[44px] text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(2.0, Number((z + 0.15).toFixed(2))))}
            title="Zoom in"
            aria-label="Zoom in"
            className="p-1.5 rounded-xl border border-line hover:bg-soft text-muted hover:text-ink cursor-pointer transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel(1)}
            title="Reset zoom"
            aria-label="Reset zoom"
            className="p-1.5 rounded-xl border border-line hover:bg-soft text-muted hover:text-ink cursor-pointer transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen((f) => !f)}
            title={isFullscreen ? 'Exit fullscreen' : 'Expand diagram'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Expand diagram'}
            className="p-1.5 rounded-xl border border-line hover:bg-soft text-muted hover:text-ink cursor-pointer transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main SVG Render Canvas */}
      <div
        data-testid="diagram-svg-wrapper"
        className="relative overflow-x-auto rounded-2xl border border-slate-200 dark:border-[#26324F] bg-slate-50/50 dark:bg-[#0B1020] p-2 flex items-center justify-center min-h-[300px]"
      >
        <div
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
          className="transition-transform duration-150 w-full flex justify-center"
        >
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full max-w-[800px] h-auto max-h-[560px] rounded-xl select-none"
            style={{ filter: isDarkTheme ? 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' : 'drop-shadow(0 2px 8px rgba(0,0,0,0.06))' }}
          >
            <defs>
              <marker
                id="arrow-default"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill={isDarkTheme ? '#818CF8' : '#4F46E5'} />
              </marker>
              <marker
                id="arrow-blue"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#2563EB" />
              </marker>
              <marker
                id="arrow-red"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#DC2626" />
              </marker>
              <marker
                id="arrow-green"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#16A34A" />
              </marker>
              <marker
                id="arrow-amber"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#D97706" />
              </marker>
              <marker
                id="arrow-purple"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#9333EA" />
              </marker>
              <marker
                id="arrow-slate"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748B" />
              </marker>
            </defs>

            {/* Canvas background rect */}
            <rect
              width="100%"
              height="100%"
              fill={isDarkTheme ? '#0B1020' : '#FFFFFF'}
              rx="12"
            />

            {/* Render all validated elements */}
            {spec.elements.map(renderElement)}
          </svg>
        </div>
      </div>

      {/* Supporting details: Assumptions, Clarification & Citations */}
      <div className="space-y-2.5">
        {spec.assumptions && spec.assumptions.length > 0 && (
          <div
            data-testid="diagram-assumptions-box"
            className="p-3.5 rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/30 text-xs space-y-1.5"
          >
            <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>Schematic Assumptions &amp; JEE Context</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-amber-900/90 dark:text-amber-200/90 pl-1 leading-relaxed">
              {spec.assumptions.map((asm, idx) => (
                <li key={idx}>{asm}</li>
              ))}
            </ul>
          </div>
        )}

        {spec.needsClarification && (
          <div className="p-3.5 rounded-2xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/70 dark:bg-blue-950/30 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Clarification note:</strong> {spec.needsClarification}
            </div>
          </div>
        )}

        {/* Page Citations */}
        {spec.citedPages && spec.citedPages.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-muted font-medium flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Cited from active material:</span>
            </span>
            {spec.citedPages.map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => onNavigateToPage?.(pageNum)}
                className="px-2.5 py-0.5 rounded-lg border border-line bg-canvas hover:bg-soft text-brand font-semibold text-xs cursor-pointer transition-colors"
              >
                Page {pageNum} ↗
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-line">
        <div className="text-xs text-muted">
          {spec.isAiGenerated
            ? `Generated via ${spec.modelUsed || 'AI Model'}`
            : 'Rendered via LearnMate Deterministic Vector Engine'}
        </div>

        <div className="flex items-center gap-2">
          {onSave && (
            <button
              type="button"
              onClick={() => onSave(spec)}
              disabled={isSaved}
              data-testid="diagram-save-btn"
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                isSaved
                  ? 'bg-success-soft text-success border border-success/30 cursor-default'
                  : 'bg-brand-soft text-brand hover:bg-brand hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSaved ? 'Saved to Document' : 'Save Diagram'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadSvg}
            data-testid="diagram-download-svg-btn"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download SVG</span>
          </button>
        </div>
      </div>

      {downloadToast && (
        <div className="fixed bottom-6 right-6 z-50 p-3.5 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Diagram downloaded as standalone SVG!</span>
        </div>
      )}
    </div>
  );
};
