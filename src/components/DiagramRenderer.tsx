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
  Play,
  Pause,
} from 'lucide-react';
import type { StructuredDiagramSpec, DiagramElement, DiagramArrow } from '../types/diagram';
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
  const [isAnimating, setIsAnimating] = useState<boolean>(true);

  const { width, height } = spec.viewBox;

  const customArrowColors = Array.from(
    new Set(
      spec.elements
        .filter((e): e is DiagramArrow => e.kind === 'arrow' && Boolean(e.color))
        .map((e) => e.color!.trim())
    )
  );
  const customMarkerMap = new Map<string, string>();
  customArrowColors.forEach((c, idx) => customMarkerMap.set(c.toLowerCase(), `arrow-custom-${idx}`));

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
    const c = color.trim().toLowerCase();
    if (c.includes('red') || c === '#dc2626' || c === '#ef4444') return 'arrow-red';
    if (c.includes('blue') || c === '#2563eb' || c === '#3b82f6') return 'arrow-blue';
    if (c.includes('green') || c === '#16a34a' || c === '#10b981') return 'arrow-green';
    if (c.includes('amber') || c === 'orange' || c === '#d97706' || c === '#f59e0b') return 'arrow-amber';
    if (c.includes('purple') || c === 'violet' || c === '#9333ea' || c === '#8b5cf6') return 'arrow-purple';
    if (c.includes('slate') || c === 'gray' || c === '#64748b') return 'arrow-slate';
    return customMarkerMap.get(c) || 'arrow-default';
  };

  const adaptStrokeOrText = (
    raw: string | undefined,
    lightFallback: string,
    darkFallback: string
  ): string => {
    if (!raw) return isDarkTheme ? darkFallback : lightFallback;
    if (!isDarkTheme) return raw;
    const normalized = raw.trim().toLowerCase();
    const darkToLightMap: Record<string, string> = {
      '#000': '#F8FAFC',
      '#000000': '#F8FAFC',
      'black': '#F8FAFC',
      '#0f172a': '#F8FAFC',
      '#111827': '#F8FAFC',
      '#1e293b': '#E2E8F0',
      '#334155': '#CBD5E1',
      '#475569': '#94A3B8',
      '#1e1b4b': '#C7D2FE',
      '#312e81': '#A5B4FC',
      '#3730a3': '#A5B4FC',
      '#4338ca': '#818CF8',
      '#4f46e5': '#818CF8',
      '#1e3a8a': '#93C5FD',
      '#1d4ed8': '#60A5FA',
      '#2563eb': '#60A5FA',
      '#064e3b': '#6EE7B7',
      '#065f46': '#34D399',
      '#047857': '#34D399',
      '#059669': '#34D399',
      '#78350f': '#FDE68A',
      '#92400e': '#FBBF24',
      '#b45309': '#FBBF24',
      '#d97706': '#FBBF24',
      '#7f1d1d': '#FCA5A5',
      '#991b1b': '#F87171',
      '#b91c1c': '#F87171',
      '#dc2626': '#F87171',
    };
    return darkToLightMap[normalized] || raw;
  };

  const adaptFill = (raw: string | undefined, lightFallback: string, darkFallback: string): string => {
    if (!raw) return isDarkTheme ? darkFallback : lightFallback;
    if (!isDarkTheme) return raw;
    const normalized = raw.trim().toLowerCase();
    if (normalized === 'none' || normalized === 'transparent') return raw;
    const lightFillToDarkMap: Record<string, string> = {
      '#ffffff': '#162038',
      '#fff': '#162038',
      'white': '#162038',
      '#f8fafc': '#162038',
      '#f1f5f9': '#1E293B',
      '#e2e8f0': '#26324F',
      '#eef2ff': '#1A2440',
      '#e0e7ff': '#1E294B',
      '#eff6ff': '#172554',
      '#dbeafe': '#1E3A8A',
      '#ecfdf5': '#064E3B',
      '#d1fae5': '#065F46',
      '#fffbeb': '#451A03',
      '#fef3c7': '#78350F',
      '#fef2f2': '#450A0A',
      '#fee2e2': '#7F1D1D',
    };
    return lightFillToDarkMap[normalized] || raw;
  };

  const renderElement = (el: DiagramElement) => {
    const defaultText = isDarkTheme ? '#F8FAFC' : '#0F172A';

    switch (el.kind) {
      case 'arrow': {
        const marker = getMarkerId(el.color);
        const stroke = adaptStrokeOrText(el.color, '#4F46E5', '#818CF8');
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
        const stroke = adaptStrokeOrText(el.color, '#64748B', '#94A3B8');
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
        const fill = adaptFill(el.fill, '#EEF2FF', '#1A2440');
        const stroke = adaptStrokeOrText(el.stroke, '#4F46E5', '#818CF8');
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
        const fill = adaptFill(el.fill, '#EEF2FF', '#1A2440');
        const stroke = adaptStrokeOrText(el.stroke, '#4F46E5', '#818CF8');
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
        const fill = adaptFill(el.fill, '#F1F5F9', '#1E293B');
        const stroke = adaptStrokeOrText(el.stroke, '#475569', '#94A3B8');
        let centroid: { x: number; y: number } | null = null;
        if (el.label) {
          const coords = el.points
            .trim()
            .split(/[\s,]+/)
            .map(Number)
            .filter(Number.isFinite);
          if (coords.length >= 6) {
            let sx = 0;
            let sy = 0;
            const nPts = Math.floor(coords.length / 2);
            for (let i = 0; i < nPts; i++) {
              sx += coords[i * 2];
              sy += coords[i * 2 + 1];
            }
            centroid = { x: sx / nPts, y: sy / nPts };
          }
        }
        return (
          <g key={el.id}>
            <polygon
              points={el.points}
              fill={fill}
              stroke={stroke}
              strokeWidth={el.strokeWidth || 2}
            />
            {el.label && centroid && (
              <text
                x={centroid.x}
                y={centroid.y + 4}
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

      case 'path': {
        const stroke = adaptStrokeOrText(el.stroke, '#4F46E5', '#818CF8');
        const fill = adaptFill(el.fill, 'none', 'none');
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
        const color = adaptStrokeOrText(el.color, '#0F172A', '#F8FAFC');
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
        const color = adaptStrokeOrText(el.color, '#D97706', '#FBBF24');
        const rad1 = (el.startAngleDeg * Math.PI) / 180;
        const rad2 = (el.endAngleDeg * Math.PI) / 180;
        const x1 = el.cx + el.r * Math.cos(rad1);
        const y1 = el.cy - el.r * Math.sin(rad1);
        const x2 = el.cx + el.r * Math.cos(rad2);
        const y2 = el.cy - el.r * Math.sin(rad2);
        const delta = el.endAngleDeg - el.startAngleDeg;
        const diff = Math.abs(delta);
        const largeArc = diff > 180 ? 1 : 0;
        // In SVG Y-down screen coordinates, increasing math angle sweeps counter-clockwise (sweepFlag = 0)
        const sweepFlag = delta >= 0 ? 0 : 1;
        const d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${el.r} ${el.r} 0 ${largeArc} ${sweepFlag} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
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
                dominantBaseline="middle"
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
            {spec.verificationBadge === 'VERIFIED_TEMPLATE' && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                Verified Preset
              </span>
            )}
            {spec.verificationBadge === 'AI_UNVERIFIED_SCHEMATIC' && (
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                AI Schematic (Verify Visually)
              </span>
            )}
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
            onClick={() => setIsAnimating((a) => !a)}
            title={isAnimating ? 'Pause diagram motion' : 'Play diagram motion'}
            aria-label={isAnimating ? 'Pause diagram motion' : 'Play diagram motion'}
            data-testid="diagram-animate-toggle-btn"
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold cursor-pointer transition-colors ${
              isAnimating
                ? 'border-brand/40 bg-brand-soft text-brand'
                : 'border-line hover:bg-soft text-muted hover:text-ink'
            }`}
          >
            {isAnimating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isAnimating ? 'Animating' : 'Animate'}</span>
          </button>
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
              {customArrowColors.map((color, idx) => (
                <marker
                  key={color}
                  id={`arrow-custom-${idx}`}
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill={adaptStrokeOrText(color, color, color)} />
                </marker>
              ))}
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

            {/* Continuous Non-Destructive STEM Physics/Optics/Circuit/Conic Motion Overlay */}
            {isAnimating && (
              <g data-testid="diagram-animation-overlay" pointerEvents="none">
                {(spec.animationKind === 'optics_wavefront' || spec.category === 'ray_optics') && (
                  <>
                    <circle r="4.5" fill="#DC2626">
                      <animateMotion dur="2.6s" repeatCount="indefinite" path="M 130 140 L 350 140 L 475.7 312.9" />
                    </circle>
                    <circle r="4.5" fill="#D97706">
                      <animateMotion dur="2.6s" begin="0.8s" repeatCount="indefinite" path="M 130 140 L 475.7 312.9" />
                    </circle>
                  </>
                )}
                {(spec.animationKind === 'rc_charge_flow' ||
                  spec.category === 'circuit' ||
                  spec.category === 'circuit_diagram') && (
                  <>
                    {[0, 0.75, 1.5, 2.25].map((delay) => (
                      <circle key={delay} r="4" fill="#16A34A">
                        <animateMotion
                          dur="3s"
                          begin={`${delay}s`}
                          repeatCount="indefinite"
                          path="M 150 240 L 150 160 L 550 160 L 550 230 M 550 245 L 550 360 L 150 360 L 150 255"
                        />
                      </circle>
                    ))}
                  </>
                )}
                {(spec.animationKind === 'fbd_motion' || spec.category === 'free_body_diagram') && (
                  <circle cx="286.5" cy="281.6" r="8" fill="none" stroke="#4F46E5" strokeWidth="2">
                    <animate attributeName="r" values="6;16;6" dur="2.2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.9;0.15;0.9" dur="2.2s" repeatCount="indefinite" />
                  </circle>
                )}
                {(spec.animationKind === 'vsepr_vibration' || spec.category === 'molecular_shape') && (
                  <circle cx="350" cy="220" r="44" fill="none" stroke="#2563EB" strokeWidth="1.5" strokeDasharray="4 4">
                    <animate attributeName="r" values="40;50;40" dur="2.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.7;0.2;0.7" dur="2.4s" repeatCount="indefinite" />
                  </circle>
                )}
                {(spec.animationKind === 'conic_focus_sweep' ||
                  spec.category === 'conic_section' ||
                  spec.category === 'conic') && (
                  <circle
                    cx={spec.title.toLowerCase().includes('ellipse') ? 494 : 310}
                    cy="240"
                    r="8"
                    fill="none"
                    stroke="#DC2626"
                    strokeWidth="2"
                  >
                    <animate attributeName="r" values="6;15;6" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.9;0.2;0.9" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
              </g>
            )}
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
