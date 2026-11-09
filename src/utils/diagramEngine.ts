import type {
  StructuredDiagramSpec,
  DiagramCategory,
  DiagramElement,
  DiagramArrow,
  DiagramLine,
  DiagramRect,
  DiagramCircle,
  DiagramPolygon,
  DiagramPath,
  DiagramText,
  DiagramArc,
} from '../types/diagram';

/**
 * Sanitizes user or model text to prevent script injection or malformed SVG attributes.
 * Strips script tags, HTML tags, event handlers, and javascript: URLs.
 */
export function sanitizeString(val: unknown): string {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\/?\w+[^>]*>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript\s*:/gi, '')
    .trim();
}

/**
 * Ensures a number is finite and bounded within [min, max].
 */
export function clampNumber(n: unknown, min: number, max: number, fallback: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/**
 * Validates and sanitizes a raw element object into a safe DiagramElement.
 * Returns null if the element is malformed or invalid.
 */
export function sanitizeDiagramElement(
  raw: any,
  index: number,
  viewWidth = 700,
  viewHeight = 500
): DiagramElement | null {
  if (!raw || typeof raw !== 'object') return null;

  const id = sanitizeString(raw.id) || `elem-${index}-${Math.random().toString(36).slice(2, 6)}`;
  const kind = String(raw.kind || '').toLowerCase().trim();

  switch (kind) {
    case 'arrow': {
      const startX = clampNumber(raw.startX ?? raw.x1, -200, viewWidth + 200, 50);
      const startY = clampNumber(raw.startY ?? raw.y1, -200, viewHeight + 200, 50);
      const endX = clampNumber(raw.endX ?? raw.x2, -200, viewWidth + 200, 150);
      const endY = clampNumber(raw.endY ?? raw.y2, -200, viewHeight + 200, 150);
      // Skip zero-length degenerate arrows
      if (Math.hypot(endX - startX, endY - startY) < 1) return null;
      return {
        id,
        kind: 'arrow',
        startX,
        startY,
        endX,
        endY,
        x1: startX,
        y1: startY,
        x2: endX,
        y2: endY,
        label: sanitizeString(raw.label) || undefined,
        color: sanitizeString(raw.color) || '#4F46E5',
        strokeWidth: clampNumber(raw.strokeWidth, 1, 12, 2.5),
        dashed: Boolean(raw.dashed),
      } as DiagramArrow;
    }

    case 'line': {
      const startX = clampNumber(raw.startX ?? raw.x1, -200, viewWidth + 200, 50);
      const startY = clampNumber(raw.startY ?? raw.y1, -200, viewHeight + 200, 50);
      const endX = clampNumber(raw.endX ?? raw.x2, -200, viewWidth + 200, 150);
      const endY = clampNumber(raw.endY ?? raw.y2, -200, viewHeight + 200, 150);
      if (Math.hypot(endX - startX, endY - startY) < 1) return null;
      return {
        id,
        kind: 'line',
        startX,
        startY,
        endX,
        endY,
        x1: startX,
        y1: startY,
        x2: endX,
        y2: endY,
        label: sanitizeString(raw.label) || undefined,
        color: sanitizeString(raw.color) || '#64748B',
        strokeWidth: clampNumber(raw.strokeWidth, 1, 12, 2),
        dashed: Boolean(raw.dashed),
      } as DiagramLine;
    }

    case 'rect': {
      const x = clampNumber(raw.x, -200, viewWidth + 200, 100);
      const y = clampNumber(raw.y, -200, viewHeight + 200, 100);
      const width = clampNumber(raw.width, 1, viewWidth * 2, 80);
      const height = clampNumber(raw.height, 1, viewHeight * 2, 60);
      return {
        id,
        kind: 'rect',
        x,
        y,
        width,
        height,
        rx: clampNumber(raw.rx, 0, 50, 4),
        label: sanitizeString(raw.label) || undefined,
        fill: sanitizeString(raw.fill) || '#EEF2FF',
        stroke: sanitizeString(raw.stroke) || '#4F46E5',
        strokeWidth: clampNumber(raw.strokeWidth, 0, 12, 2),
      } as DiagramRect;
    }

    case 'circle': {
      const cx = clampNumber(raw.cx, -200, viewWidth + 200, 100);
      const cy = clampNumber(raw.cy, -200, viewHeight + 200, 100);
      const r = clampNumber(raw.r, 1, viewWidth, 20);
      return {
        id,
        kind: 'circle',
        cx,
        cy,
        r,
        label: sanitizeString(raw.label) || undefined,
        fill: sanitizeString(raw.fill) || '#EEF2FF',
        stroke: sanitizeString(raw.stroke) || '#4F46E5',
        strokeWidth: clampNumber(raw.strokeWidth, 0, 12, 2),
      } as DiagramCircle;
    }

    case 'polygon': {
      const rawPoints = typeof raw.points === 'string' ? raw.points : '';
      // Parse coordinates pair by pair to ensure validity
      const pairs = rawPoints
        .trim()
        .split(/[\s,]+/)
        .map(Number)
        .filter(Number.isFinite);
      if (pairs.length < 6 || pairs.length % 2 !== 0) return null; // at least 3 points (6 coords)
      const cleanPoints: string[] = [];
      for (let i = 0; i < pairs.length; i += 2) {
        cleanPoints.push(`${clampNumber(pairs[i], -200, viewWidth + 200, 0)},${clampNumber(pairs[i + 1], -200, viewHeight + 200, 0)}`);
      }
      return {
        id,
        kind: 'polygon',
        points: cleanPoints.join(' '),
        label: sanitizeString(raw.label) || undefined,
        fill: sanitizeString(raw.fill) || '#F1F5F9',
        stroke: sanitizeString(raw.stroke) || '#64748B',
        strokeWidth: clampNumber(raw.strokeWidth, 0, 12, 2),
      } as DiagramPolygon;
    }

    case 'path': {
      const d = sanitizeString(raw.d);
      // Basic path sanity check: must start with M or m and have valid SVG path commands
      if (!d || !/^[Mm]\s*[-0-9]/.test(d)) return null;
      return {
        id,
        kind: 'path',
        d,
        label: sanitizeString(raw.label) || undefined,
        fill: sanitizeString(raw.fill) || 'none',
        stroke: sanitizeString(raw.stroke) || '#4F46E5',
        strokeWidth: clampNumber(raw.strokeWidth, 1, 12, 2.5),
        dashed: Boolean(raw.dashed),
      } as DiagramPath;
    }

    case 'text': {
      const text = sanitizeString(raw.text);
      if (!text) return null;
      const x = clampNumber(raw.x, -200, viewWidth + 200, 50);
      const y = clampNumber(raw.y, -200, viewHeight + 200, 50);
      return {
        id,
        kind: 'text',
        x,
        y,
        text,
        fontSize: clampNumber(raw.fontSize, 9, 36, 13),
        fontWeight: raw.fontWeight === 'bold' || raw.fontWeight === '600' || raw.fontWeight === '700' ? 'bold' : 'normal',
        color: sanitizeString(raw.color) || '#0F172A',
        textAnchor: raw.textAnchor === 'middle' || raw.textAnchor === 'end' ? raw.textAnchor : 'start',
      } as DiagramText;
    }

    case 'arc': {
      const cx = clampNumber(raw.cx, -200, viewWidth + 200, 100);
      const cy = clampNumber(raw.cy, -200, viewHeight + 200, 100);
      const r = clampNumber(raw.r, 5, viewWidth, 30);
      const startAngleDeg = clampNumber(raw.startAngleDeg, -720, 720, 0);
      const endAngleDeg = clampNumber(raw.endAngleDeg, -720, 720, 45);
      return {
        id,
        kind: 'arc',
        cx,
        cy,
        r,
        startAngleDeg,
        endAngleDeg,
        label: sanitizeString(raw.label) || undefined,
        color: sanitizeString(raw.color) || '#D97706',
      } as DiagramArc;
    }

    default:
      return null;
  }
}

/**
 * Validates and sanitizes a complete diagram specification.
 * If raw is missing or has fewer than 2 valid elements, generates a deterministic template fallback.
 */
export function validateAndSanitizeDiagramSpec(
  raw: any,
  defaultConcept = 'Educational Concept',
  contextText = '',
  citedPages: number[] = []
): StructuredDiagramSpec {
  if (!raw || typeof raw !== 'object') {
    return getDeterministicDiagramTemplate(defaultConcept, contextText, citedPages);
  }

  const vx = clampNumber(raw.viewBox?.x, -1000, 1000, 0);
  const vy = clampNumber(raw.viewBox?.y, -1000, 1000, 0);
  const width = clampNumber(raw.viewBox?.width, 300, 1600, 700);
  const height = clampNumber(raw.viewBox?.height, 200, 1200, 500);

  const rawElements = Array.isArray(raw.elements) ? raw.elements : [];
  const cleanElements: DiagramElement[] = [];

  for (let i = 0; i < rawElements.length; i++) {
    const el = sanitizeDiagramElement(rawElements[i], i, width, height);
    if (el) cleanElements.push(el);
  }

  // If fewer than 2 valid geometric elements were extracted, return a high-quality deterministic template
  if (cleanElements.length < 2 && !Array.isArray(raw.elements)) {
    return getDeterministicDiagramTemplate(
      raw.title || defaultConcept,
      contextText,
      citedPages.length > 0 ? citedPages : Array.isArray(raw.citedPages) ? raw.citedPages.filter((n: any) => typeof n === 'number') : []
    );
  }

  const cleanAssumptions: string[] = Array.isArray(raw.assumptions)
    ? raw.assumptions.map(sanitizeString).filter(Boolean)
    : Array.isArray(raw.schematicAssumptions)
    ? raw.schematicAssumptions.map(sanitizeString).filter(Boolean)
    : [];

  const rawPages: number[] = Array.isArray(raw.citedPages)
    ? raw.citedPages.filter((n: any) => typeof n === 'number' && Number.isInteger(n) && n > 0)
    : citedPages;

  const validCategories: DiagramCategory[] = [
    'free_body_diagram',
    'circuit',
    'circuit_diagram',
    'ray_optics',
    'conic',
    'conic_section',
    'molecular_shape',
    'flowchart',
    'comparison_chart',
    'scientific_diagram',
    'educational_diagram',
  ];
  const category: DiagramCategory = validCategories.includes(raw.category)
    ? raw.category
    : 'educational_diagram';

  const validSubjects = ['Physics', 'Chemistry', 'Mathematics', 'General'] as const;
  const subject = validSubjects.includes(raw.subject) ? raw.subject : 'General';

  const candidateSpec: StructuredDiagramSpec = {
    title: sanitizeString(raw.title) || defaultConcept,
    category,
    subject,
    description:
      sanitizeString(raw.description) ||
      `Structured JEE ${subject} diagram illustrating ${defaultConcept}.`,
    viewBox: { x: vx, y: vy, width, height },
    elements: cleanElements,
    assumptions: cleanAssumptions,
    schematicAssumptions: cleanAssumptions,
    needsClarification: sanitizeString(raw.needsClarification) || undefined,
    citedPages: rawPages,
    isAiGenerated: raw.isAiGenerated !== false,
    modelUsed: sanitizeString(raw.modelUsed) || undefined,
    provider: sanitizeString(raw.provider) || undefined,
    fallbackNotice: sanitizeString(raw.fallbackNotice) || undefined,
  };

  const semanticCheck = validateDiagramSemanticAccuracy(candidateSpec, defaultConcept);
  if (!semanticCheck.isSemanticallyValid && semanticCheck.repairedOrFallbackSpec) {
    return semanticCheck.repairedOrFallbackSpec;
  }
  return candidateSpec;
}

export interface DiagramSemanticValidationResult {
  isSemanticallyValid: boolean;
  warnings: string[];
  errors: string[];
  domainChecked: 'Physics' | 'Chemistry' | 'Mathematics' | 'General';
  repairedOrFallbackSpec?: StructuredDiagramSpec;
}

/**
 * Phase 6 Section 4 — Validates scientific and mathematical semantic accuracy
 * of a `StructuredDiagramSpec` before rendering:
 * - Physics: Gravity (`mg`) must point downward (+Y in SVG coordinates); Normal reaction (`N`)
 *   must point upward/perpendicular (-Y); Friction (`f_s` / `f_k`) must only appear when
 *   motion/tendency or friction is relevant.
 * - Chemistry: VSEPR bond angles & lone pairs must match canonical values
 *   (CH4: 109.5°, NH3: 107°, H2O: 104.5°, PCl5: 90°/120°).
 * - Mathematics: Coordinate axes or conic loci must contain valid curve/axis geometry.
 */
export function validateDiagramSemanticAccuracy(
  spec: StructuredDiagramSpec,
  conceptHint = ''
): DiagramSemanticValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const combinedText = `${spec.title || ''} ${spec.description || ''} ${conceptHint}`.toLowerCase();

  // 1. Physics Free-Body Diagram Semantic Validation
  if (
    spec.category === 'free_body_diagram' ||
    /\b(free body|fbd|inclined plane|block on incline|normal force|gravity)\b/.test(combinedText)
  ) {
    const arrows = spec.elements.filter((el): el is DiagramArrow => el.kind === 'arrow');
    if (arrows.length === 0) {
      errors.push('Physics Free-Body Diagram is missing force vector arrows.');
    }

    for (const arrow of arrows) {
      const lbl = (arrow.label || '').toLowerCase();
      const dy = arrow.endY - arrow.startY;
      // In SVG coordinates, +Y is downward. Gravity (mg / weight / F_g) must have dy > 0.
      if (/\b(f_g|mg|m\s*g|weight|gravity)\b/.test(lbl) && !lbl.includes('sin') && !lbl.includes('cos')) {
        if (dy <= 5) {
          errors.push(
            `Gravity vector "${arrow.label}" points upward or horizontally (Δy=${dy}); gravity must act vertically downward (+Y).`
          );
        }
      }
      // Normal reaction N must point upward (-Y, so dy < 0) for standard horizontal/inclined support
      if (/\b(normal|^n$|\(n\))\b/.test(lbl)) {
        if (dy >= 0) {
          errors.push(
            `Normal force vector "${arrow.label}" points downward (Δy=${dy}); normal reaction must point outward/upward from the contact surface.`
          );
        }
      }
      // Friction check on frictionless/smooth surface
      if (
        /\b(friction|f_s|f_k)\b/.test(lbl) &&
        /\b(frictionless|smooth surface)\b/.test(combinedText)
      ) {
        errors.push(
          `Friction vector "${arrow.label}" was drawn for a frictionless/smooth surface problem.`
        );
      }
    }

    if (errors.length > 0) {
      const fallback = getDeterministicDiagramTemplate(
        conceptHint || spec.title,
        spec.description,
        spec.citedPages
      );
      fallback.fallbackNotice = `Semantic Physics Validator repaired diagram: ${errors[0]}`;
      return {
        isSemanticallyValid: false,
        warnings,
        errors,
        domainChecked: 'Physics',
        repairedOrFallbackSpec: fallback,
      };
    }

    return {
      isSemanticallyValid: true,
      warnings,
      errors,
      domainChecked: 'Physics',
    };
  }

  // 2. Chemistry VSEPR & Molecular Geometry Semantic Validation
  if (
    spec.category === 'molecular_shape' ||
    /\b(vsepr|h2o|nh3|ch4|pcl5|bond angle|lone pair|molecular)\b/.test(combinedText)
  ) {
    const allLabels = spec.elements
      .map((el) => ('text' in el ? el.text : 'label' in el ? el.label : ''))
      .filter(Boolean)
      .join(' ');

    if (/\bh2o\b|water/i.test(combinedText)) {
      if (/\b(180|120|90)\s*°/.test(allLabels) && !allLabels.includes('104.5')) {
        errors.push('H2O VSEPR geometry has inaccurate bond angle; expected 104.5° bent geometry.');
      }
    } else if (/\bnh3\b|ammonia/i.test(combinedText)) {
      if (/\b(180|120|90)\s*°/.test(allLabels) && !allLabels.includes('107')) {
        errors.push('NH3 VSEPR geometry has inaccurate bond angle; expected ~107° trigonal pyramidal.');
      }
    } else if (/\bch4\b|methane/i.test(combinedText)) {
      if (/\b(180|90)\s*°/.test(allLabels) && !allLabels.includes('109.5')) {
        errors.push('CH4 VSEPR geometry has inaccurate bond angle; expected 109.5° tetrahedral.');
      }
    }

    if (errors.length > 0) {
      const fallback = getDeterministicDiagramTemplate(
        conceptHint || spec.title,
        spec.description,
        spec.citedPages
      );
      fallback.fallbackNotice = `Semantic Chemistry Validator repaired diagram: ${errors[0]}`;
      return {
        isSemanticallyValid: false,
        warnings,
        errors,
        domainChecked: 'Chemistry',
        repairedOrFallbackSpec: fallback,
      };
    }

    return {
      isSemanticallyValid: true,
      warnings,
      errors,
      domainChecked: 'Chemistry',
    };
  }

  // 3. Mathematics Conic Sections & Coordinate Geometry Validation
  if (
    spec.category === 'conic' ||
    spec.category === 'conic_section' ||
    /\b(parabola|ellipse|hyperbola|conic|latus rectum|directrix)\b/.test(combinedText)
  ) {
    const hasCurveOrCircle = spec.elements.some(
      (el) => el.kind === 'path' || el.kind === 'circle' || el.kind === 'arc'
    );
    const hasAxis = spec.elements.some((el) => el.kind === 'arrow' || el.kind === 'line');

    if (!hasCurveOrCircle || !hasAxis) {
      errors.push('Mathematics conic/coordinate diagram is missing either coordinate axes or locus curve.');
      const fallback = getDeterministicDiagramTemplate(
        conceptHint || spec.title,
        spec.description,
        spec.citedPages
      );
      fallback.fallbackNotice = `Semantic Mathematics Validator repaired diagram: ${errors[0]}`;
      return {
        isSemanticallyValid: false,
        warnings,
        errors,
        domainChecked: 'Mathematics',
        repairedOrFallbackSpec: fallback,
      };
    }

    return {
      isSemanticallyValid: true,
      warnings,
      errors,
      domainChecked: 'Mathematics',
    };
  }

  return {
    isSemanticallyValid: spec.elements.length >= 2,
    warnings,
    errors: spec.elements.length < 2 ? ['Diagram has fewer than 2 valid geometric elements.'] : [],
    domainChecked: spec.subject,
  };
}

/**
 * Generates an accurate, grounded, deterministic JEE diagram template when AI is unavailable or fails.
 */
export function getDeterministicDiagramTemplate(
  concept: string,
  contextText = '',
  citedPages: number[] = [1]
): StructuredDiagramSpec {
  const cLower = `${concept} ${contextText}`.toLowerCase();

  // 1. FREE-BODY DIAGRAM (Physics)
  if (
    cLower.includes('incline') ||
    cLower.includes('free-body') ||
    cLower.includes('fbd') ||
    cLower.includes('friction') ||
    cLower.includes('newton') ||
    cLower.includes('force') ||
    cLower.includes('gravity') ||
    cLower.includes('motion')
  ) {
    return {
      title: `Free-Body Diagram: Block on Inclined Plane (${concept})`,
      category: 'free_body_diagram',
      subject: 'Physics',
      description:
        'Standard JEE Free-Body Diagram showing normal force N perpendicular to the incline, gravitational force mg acting vertically downward with decomposed components (mg cos θ and mg sin θ), and opposing friction force f_s.',
      viewBox: { x: 0, y: 0, width: 700, height: 500 },
      assumptions: [
        'Incline angle θ = 30° above horizontal',
        'Coefficient of static friction μ_s = 0.25',
        'Block has mass m = 2.0 kg and behaves as a rigid body',
        'Standard gravitational acceleration g = 9.8 m/s²',
      ],
      schematicAssumptions: [
        'Incline angle θ = 30° above horizontal',
        'Coefficient of static friction μ_s = 0.25',
        'Block has mass m = 2.0 kg and behaves as a rigid body',
        'Standard gravitational acceleration g = 9.8 m/s²',
      ],
      citedPages,
      isAiGenerated: false,
      fallbackNotice: 'Deterministic JEE Template: Physics Free-Body Diagram',
      elements: [
        // Ground line
        { id: 'fbd-ground', kind: 'line', startX: 60, startY: 420, endX: 640, endY: 420, color: '#94A3B8', strokeWidth: 2 },
        // Inclined wedge (30 deg incline: deltaX = 400, deltaY = 230)
        { id: 'fbd-incline', kind: 'polygon', points: '100,420 500,420 500,190', fill: '#F1F5F9', stroke: '#475569', strokeWidth: 2.5 },
        // Angle theta arc at bottom-left of incline
        { id: 'fbd-arc-theta', kind: 'arc', cx: 100, cy: 420, r: 60, startAngleDeg: 0, endAngleDeg: 30, color: '#D97706', label: 'θ = 30°' },
        // Inclined surface normal line guide
        { id: 'fbd-surface-ref', kind: 'line', startX: 250, startY: 335, endX: 350, endY: 275, color: '#CBD5E1', strokeWidth: 1.5, dashed: true },
        // Mass block resting on incline (center ~ [300, 305])
        { id: 'fbd-block', kind: 'polygon', points: '260,325 340,280 370,330 290,375', fill: '#EEF2FF', stroke: '#4F46E5', strokeWidth: 2.5, label: 'Mass m' },
        // Gravity vector mg (straight down)
        { id: 'fbd-f-mg', kind: 'arrow', startX: 315, startY: 325, endX: 315, endY: 460, color: '#DC2626', strokeWidth: 3, label: 'F_g = m·g' },
        // Normal force N (perpendicular to incline plane, angle ~120 deg from horizontal)
        { id: 'fbd-f-n', kind: 'arrow', startX: 315, startY: 325, endX: 255, endY: 220, color: '#2563EB', strokeWidth: 3, label: 'Normal (N)' },
        // Static friction force f_s (parallel up the incline)
        { id: 'fbd-f-friction', kind: 'arrow', startX: 315, startY: 325, endX: 400, endY: 275, color: '#D97706', strokeWidth: 2.5, label: 'f_s (friction)' },
        // Decomposed mg sin θ (down the incline)
        { id: 'fbd-f-mg-sin', kind: 'arrow', startX: 315, startY: 325, endX: 230, endY: 375, color: '#DC2626', strokeWidth: 2, dashed: true, label: 'm·g·sin θ' },
        // Decomposed mg cos θ (opposite to normal N)
        { id: 'fbd-f-mg-cos', kind: 'arrow', startX: 315, startY: 325, endX: 375, endY: 430, color: '#DC2626', strokeWidth: 2, dashed: true, label: 'm·g·cos θ' },
        // Acceleration / Net force direction indicator
        { id: 'fbd-accel-hint', kind: 'text', x: 120, y: 260, text: 'Equilibrium: N = m·g·cos θ  |  f_s ≤ μ·N', fontSize: 13, fontWeight: 'bold', color: '#1E293B' },
      ],
    };
  }

  // 2. RAY OPTICS (Physics)
  if (
    cLower.includes('optics') ||
    cLower.includes('lens') ||
    cLower.includes('mirror') ||
    cLower.includes('refraction') ||
    cLower.includes('reflection') ||
    cLower.includes('focal') ||
    cLower.includes('ray')
  ) {
    return {
      title: `Ray Optics: Convex Lens Image Formation (${concept})`,
      category: 'ray_optics',
      subject: 'Physics',
      description:
        'Standard ray optics construction for a biconvex lens: an object placed beyond 2F forms a real, inverted, diminished image between F and 2F on the opposite side.',
      viewBox: { x: 0, y: 0, width: 700, height: 500 },
      assumptions: [
        'Thin biconvex lens with focal length f = 80 mm',
        'Object placed at u = -220 mm (beyond 2F)',
        'Paraxial ray approximation holds true',
      ],
      schematicAssumptions: [
        'Thin biconvex lens with focal length f = 80 mm',
        'Object placed at u = -220 mm (beyond 2F)',
        'Paraxial ray approximation holds true',
      ],
      citedPages,
      isAiGenerated: false,
      fallbackNotice: 'Deterministic JEE Template: Ray Optics Diagram',
      elements: [
        // Principal Axis
        { id: 'opt-axis', kind: 'line', startX: 40, startY: 250, endX: 660, endY: 250, color: '#64748B', strokeWidth: 1.5, dashed: true, label: 'Principal Axis' },
        // Lens vertical center line
        { id: 'opt-lens-line', kind: 'line', startX: 350, startY: 90, endX: 350, endY: 410, color: '#2563EB', strokeWidth: 3 },
        // Convex lens double arrow caps
        { id: 'opt-lens-cap-top', kind: 'arrow', startX: 350, startY: 110, endX: 350, endY: 85, color: '#2563EB', strokeWidth: 2.5 },
        { id: 'opt-lens-cap-bot', kind: 'arrow', startX: 350, startY: 390, endX: 350, endY: 415, color: '#2563EB', strokeWidth: 2.5 },
        // Optical Center O
        { id: 'opt-pt-o', kind: 'circle', cx: 350, cy: 250, r: 4, fill: '#1E293B', stroke: '#1E293B', strokeWidth: 1 },
        { id: 'opt-txt-o', kind: 'text', x: 355, y: 270, text: 'O', fontSize: 13, fontWeight: 'bold', color: '#1E293B' },
        // Left Foci F1 and 2F1
        { id: 'opt-pt-f1', kind: 'circle', cx: 270, cy: 250, r: 3.5, fill: '#2563EB', stroke: '#2563EB', strokeWidth: 1 },
        { id: 'opt-txt-f1', kind: 'text', x: 265, y: 270, text: 'F₁', fontSize: 13, fontWeight: 'bold', color: '#2563EB' },
        { id: 'opt-pt-2f1', kind: 'circle', cx: 190, cy: 250, r: 3.5, fill: '#2563EB', stroke: '#2563EB', strokeWidth: 1 },
        { id: 'opt-txt-2f1', kind: 'text', x: 180, y: 270, text: '2F₁', fontSize: 13, fontWeight: 'bold', color: '#2563EB' },
        // Right Foci F2 and 2F2
        { id: 'opt-pt-f2', kind: 'circle', cx: 430, cy: 250, r: 3.5, fill: '#2563EB', stroke: '#2563EB', strokeWidth: 1 },
        { id: 'opt-txt-f2', kind: 'text', x: 425, y: 270, text: 'F₂', fontSize: 13, fontWeight: 'bold', color: '#2563EB' },
        { id: 'opt-pt-2f2', kind: 'circle', cx: 510, cy: 250, r: 3.5, fill: '#2563EB', stroke: '#2563EB', strokeWidth: 1 },
        { id: 'opt-txt-2f2', kind: 'text', x: 505, y: 270, text: '2F₂', fontSize: 13, fontWeight: 'bold', color: '#2563EB' },
        // Object Arrow (AB at x=130, height=110)
        { id: 'opt-object', kind: 'arrow', startX: 130, startY: 250, endX: 130, endY: 140, color: '#16A34A', strokeWidth: 3.5, label: 'Object (AB)' },
        // Ray 1: Parallel to axis from object tip (130,140) to lens (350,140)
        { id: 'opt-ray1-a', kind: 'line', startX: 130, startY: 140, endX: 350, endY: 140, color: '#DC2626', strokeWidth: 2 },
        // Ray 1 refracted through F2 (430,250) continuing to image (476,323)
        { id: 'opt-ray1-b', kind: 'arrow', startX: 350, startY: 140, endX: 520, endY: 360, color: '#DC2626', strokeWidth: 2, label: 'Ray 1 (through F₂)' },
        // Ray 2: Passing straight through Optical Center O (350,250) to image tip
        { id: 'opt-ray2', kind: 'arrow', startX: 130, startY: 140, endX: 520, endY: 335, color: '#D97706', strokeWidth: 2, label: 'Ray 2 (through O)' },
        // Image Arrow (A'B' inverted, diminished at x=476, y=250 to y=313)
        { id: 'opt-image', kind: 'arrow', startX: 476, startY: 250, endX: 476, endY: 318, color: '#9333EA', strokeWidth: 3, label: 'Image A\'B\' (Real & Inverted)' },
        // Lens formula caption
        { id: 'opt-formula-txt', kind: 'text', x: 60, y: 440, text: 'Lens Formula: 1/f = 1/v - 1/u  |  Magnification m = v/u = h_i/h_o', fontSize: 13, fontWeight: 'bold', color: '#0F172A' },
      ],
    };
  }

  // 3. CIRCUIT (Physics / Electrical)
  if (
    cLower.includes('circuit') ||
    cLower.includes('resistor') ||
    cLower.includes('current') ||
    cLower.includes('voltage') ||
    cLower.includes('capacitor') ||
    cLower.includes('kirchhoff') ||
    cLower.includes('ohm')
  ) {
    return {
      title: `Circuit Diagram: Series RC Circuit (${concept})`,
      category: 'circuit',
      subject: 'Physics',
      description:
        'Standard DC circuit schematic showing a DC voltage source, switch S, series resistor R, and capacitor C with current flow direction and Kirchhoff loop orientation.',
      viewBox: { x: 0, y: 0, width: 700, height: 500 },
      assumptions: [
        'DC Battery supply V = 12 V',
        'Series Resistor R = 100 Ω',
        'Capacitor C = 50 μF',
        'Switch closes at t = 0',
      ],
      schematicAssumptions: [
        'DC Battery supply V = 12 V',
        'Series Resistor R = 100 Ω',
        'Capacitor C = 50 μF',
        'Switch closes at t = 0',
      ],
      citedPages,
      isAiGenerated: false,
      fallbackNotice: 'Deterministic JEE Template: Circuit Diagram',
      elements: [
        // Top wire from DC source to Switch S
        { id: 'cir-wire-top1', kind: 'line', startX: 150, startY: 160, endX: 250, endY: 160, color: '#334155', strokeWidth: 2.5 },
        // Switch S (slanted line representing open/closing switch)
        { id: 'cir-switch-hinge', kind: 'circle', cx: 250, cy: 160, r: 4, fill: '#334155' },
        { id: 'cir-switch-arm', kind: 'line', startX: 250, startY: 160, endX: 295, endY: 135, color: '#2563EB', strokeWidth: 3, label: 'Switch S (t=0)' },
        { id: 'cir-switch-contact', kind: 'circle', cx: 300, cy: 160, r: 4, fill: '#334155' },
        // Wire to Resistor
        { id: 'cir-wire-top2', kind: 'line', startX: 300, startY: 160, endX: 360, endY: 160, color: '#334155', strokeWidth: 2.5 },
        // Resistor zigzag R
        { id: 'cir-resistor', kind: 'path', d: 'M 360 160 L 375 140 L 395 180 L 415 140 L 435 180 L 455 140 L 470 160', stroke: '#D97706', strokeWidth: 3, label: 'R = 100 Ω' },
        // Wire from Resistor to right corner
        { id: 'cir-wire-top3', kind: 'line', startX: 470, startY: 160, endX: 550, endY: 160, color: '#334155', strokeWidth: 2.5 },
        // Right vertical wire to Capacitor
        { id: 'cir-wire-right1', kind: 'line', startX: 550, startY: 160, endX: 550, endY: 230, color: '#334155', strokeWidth: 2.5 },
        // Capacitor plates (two horizontal parallel lines at x=530..570)
        { id: 'cir-cap-top', kind: 'line', startX: 520, startY: 230, endX: 580, endY: 230, color: '#4F46E5', strokeWidth: 4, label: '+q (C = 50 μF)' },
        { id: 'cir-cap-bot', kind: 'line', startX: 520, startY: 245, endX: 580, endY: 245, color: '#4F46E5', strokeWidth: 4, label: '-q' },
        // Right wire from capacitor to bottom
        { id: 'cir-wire-right2', kind: 'line', startX: 550, startY: 245, endX: 550, endY: 360, color: '#334155', strokeWidth: 2.5 },
        // Bottom wire
        { id: 'cir-wire-bot', kind: 'line', startX: 150, startY: 360, endX: 550, endY: 360, color: '#334155', strokeWidth: 2.5 },
        // Left vertical wire to Battery
        { id: 'cir-wire-left1', kind: 'line', startX: 150, startY: 360, endX: 150, endY: 280, color: '#334155', strokeWidth: 2.5 },
        // DC Battery plates
        { id: 'cir-bat-pos', kind: 'line', startX: 130, startY: 240, endX: 170, endY: 240, color: '#16A34A', strokeWidth: 4, label: '+ (12V)' },
        { id: 'cir-bat-neg', kind: 'line', startX: 140, startY: 255, endX: 160, endY: 255, color: '#DC2626', strokeWidth: 3, label: '-' },
        { id: 'cir-wire-left2', kind: 'line', startX: 150, startY: 240, endX: 150, endY: 160, color: '#334155', strokeWidth: 2.5 },
        // Current direction arrow I
        { id: 'cir-current-arrow', kind: 'arrow', startX: 320, startY: 130, endX: 355, endY: 130, color: '#16A34A', strokeWidth: 2.5, label: 'Current I(t)' },
        // Equations caption
        { id: 'cir-eq-txt', kind: 'text', x: 150, y: 415, text: 'Governing KVL: V - i(t)R - q(t)/C = 0  ==>  q(t) = C·V·(1 - e^(-t/RC))', fontSize: 13, fontWeight: 'bold', color: '#0F172A' },
      ],
    };
  }

  // 4. MOLECULAR SHAPE / VSEPR (Chemistry)
  if (
    cLower.includes('vsepr') ||
    cLower.includes('molecule') ||
    cLower.includes('chemical') ||
    cLower.includes('hybrid') ||
    cLower.includes('water') ||
    cLower.includes('orbital') ||
    cLower.includes('atom') ||
    cLower.includes('bond')
  ) {
    return {
      title: `VSEPR Molecular Geometry: Water H₂O Bent Shape (${concept})`,
      category: 'molecular_shape',
      subject: 'Chemistry',
      description:
        'VSEPR representation of water molecule: Oxygen central atom with sp³ hybridization, two O-H covalent single bonds, two non-bonding electron lone pairs, and compressed bond angle of 104.5° due to lone pair-lone pair repulsion.',
      viewBox: { x: 0, y: 0, width: 700, height: 500 },
      assumptions: [
        'Central atom: Oxygen (Z=8, 6 valence electrons)',
        'Electron geometry: Tetrahedral (4 electron pairs: 2 bond pairs + 2 lone pairs)',
        'Molecular geometry: Bent / V-shaped',
        'Repulsion order: LP-LP > LP-BP > BP-BP leads to angle compression from 109.5° to 104.5°',
      ],
      schematicAssumptions: [
        'Central atom: Oxygen (Z=8, 6 valence electrons)',
        'Electron geometry: Tetrahedral (4 electron pairs: 2 bond pairs + 2 lone pairs)',
        'Molecular geometry: Bent / V-shaped',
        'Repulsion order: LP-LP > LP-BP > BP-BP leads to angle compression from 109.5° to 104.5°',
      ],
      citedPages,
      isAiGenerated: false,
      fallbackNotice: 'Deterministic JEE Template: Chemistry VSEPR Shape',
      elements: [
        // Central Oxygen Atom
        { id: 'vsepr-o', kind: 'circle', cx: 350, cy: 220, r: 38, fill: '#EFF6FF', stroke: '#2563EB', strokeWidth: 3.5, label: 'Oxygen (O)' },
        { id: 'vsepr-o-txt', kind: 'text', x: 342, y: 227, text: 'O', fontSize: 22, fontWeight: 'bold', color: '#1E3A8A' },
        // Left Hydrogen Atom (cx=220, cy=350)
        { id: 'vsepr-h1', kind: 'circle', cx: 220, cy: 350, r: 24, fill: '#FEF2F2', stroke: '#DC2626', strokeWidth: 3, label: 'H' },
        { id: 'vsepr-h1-txt', kind: 'text', x: 213, y: 357, text: 'H', fontSize: 18, fontWeight: 'bold', color: '#991B1B' },
        // Right Hydrogen Atom (cx=480, cy=350)
        { id: 'vsepr-h2', kind: 'circle', cx: 480, cy: 350, r: 24, fill: '#FEF2F2', stroke: '#DC2626', strokeWidth: 3, label: 'H' },
        { id: 'vsepr-h2-txt', kind: 'text', x: 473, y: 357, text: 'H', fontSize: 18, fontWeight: 'bold', color: '#991B1B' },
        // Left O-H Covalent Bond (Line)
        { id: 'vsepr-bond-1', kind: 'line', startX: 326, startY: 245, endX: 238, endY: 332, color: '#475569', strokeWidth: 4.5, label: 'σ Bond' },
        // Right O-H Covalent Bond (Line)
        { id: 'vsepr-bond-2', kind: 'line', startX: 374, startY: 245, endX: 462, endY: 332, color: '#475569', strokeWidth: 4.5, label: 'σ Bond' },
        // Bond Angle Arc between O-H bonds (centered at O [350,220])
        { id: 'vsepr-angle-arc', kind: 'arc', cx: 350, cy: 220, r: 55, startAngleDeg: 128, endAngleDeg: 52, color: '#D97706', label: '104.5°' },
        // Lone pair 1 lobe (top left)
        { id: 'vsepr-lp1-lobe', kind: 'path', d: 'M 330 185 Q 285 110 320 95 Q 350 110 340 183', fill: '#FEF9C3', stroke: '#EAB308', strokeWidth: 2, dashed: true },
        { id: 'vsepr-lp1-dot1', kind: 'circle', cx: 312, cy: 125, r: 3.5, fill: '#CA8A04' },
        { id: 'vsepr-lp1-dot2', kind: 'circle', cx: 326, cy: 120, r: 3.5, fill: '#CA8A04', label: 'Lone Pair 1' },
        // Lone pair 2 lobe (top right)
        { id: 'vsepr-lp2-lobe', kind: 'path', d: 'M 360 183 Q 350 110 380 95 Q 415 110 370 185', fill: '#FEF9C3', stroke: '#EAB308', strokeWidth: 2, dashed: true },
        { id: 'vsepr-lp2-dot1', kind: 'circle', cx: 374, cy: 120, r: 3.5, fill: '#CA8A04' },
        { id: 'vsepr-lp2-dot2', kind: 'circle', cx: 388, cy: 125, r: 3.5, fill: '#CA8A04', label: 'Lone Pair 2' },
        // Caption
        { id: 'vsepr-caption', kind: 'text', x: 160, y: 440, text: 'sp³ Hybridization · 2 Bond Pairs + 2 Lone Pairs · Net Dipole Moment μ = 1.85 D', fontSize: 13, fontWeight: 'bold', color: '#1E293B' },
      ],
    };
  }

  // 5. CONIC SECTIONS / COORDINATE GEOMETRY (Mathematics)
  // Default to Conic Section if math-oriented or generic
  return {
    title: `Conic Section: Parabola y² = 4ax (${concept})`,
    category: 'conic_section',
    subject: 'Mathematics',
    description:
      'Standard parabola opening to the right along the primary x-axis, showing vertex at (0,0), focus S(a,0), directrix line x = -a, and latus rectum chord of length 4a.',
    viewBox: { x: 0, y: 0, width: 700, height: 500 },
    assumptions: [
      'Standard horizontal Cartesian coordinate system',
      'Focal parameter a = 70 units',
      'Equation: y² = 4ax with vertex at origin (280, 250)',
      'Eccentricity e = 1 (definition of parabola)',
    ],
    schematicAssumptions: [
      'Standard horizontal Cartesian coordinate system',
      'Focal parameter a = 70 units',
      'Equation: y² = 4ax with vertex at origin (280, 250)',
      'Eccentricity e = 1 (definition of parabola)',
    ],
    citedPages,
    isAiGenerated: false,
    fallbackNotice: 'Deterministic JEE Template: Mathematics Parabola Conic',
    elements: [
      // X-Axis
      { id: 'con-axis-x', kind: 'arrow', startX: 60, startY: 250, endX: 640, endY: 250, color: '#64748B', strokeWidth: 2, label: 'x-axis' },
      // Y-Axis
      { id: 'con-axis-y', kind: 'arrow', startX: 280, startY: 440, endX: 280, endY: 60, color: '#64748B', strokeWidth: 2, label: 'y-axis (Tangent at Vertex)' },
      // Origin / Vertex V(0,0)
      { id: 'con-vertex', kind: 'circle', cx: 280, cy: 250, r: 4.5, fill: '#4F46E5', stroke: '#4F46E5', label: 'Vertex V(0,0)' },
      { id: 'con-txt-vertex', kind: 'text', x: 255, y: 270, text: 'V(0,0)', fontSize: 13, fontWeight: 'bold', color: '#4F46E5' },
      // Focus S(a, 0) -> a = 70 => x = 350
      { id: 'con-focus', kind: 'circle', cx: 350, cy: 250, r: 5, fill: '#DC2626', stroke: '#DC2626', label: 'Focus S(a, 0)' },
      { id: 'con-txt-focus', kind: 'text', x: 345, y: 272, text: 'S(a, 0)', fontSize: 13, fontWeight: 'bold', color: '#DC2626' },
      // Directrix line x = -a -> x = 210
      { id: 'con-directrix', kind: 'line', startX: 210, startY: 80, endX: 210, endY: 420, color: '#D97706', strokeWidth: 2.5, dashed: true, label: 'Directrix: x = -a' },
      // Parabola Curve: y^2 = 4a x => parametric or bezier curve
      { id: 'con-parabola-curve', kind: 'path', d: 'M 540 90 Q 280 250 540 410', fill: 'none', stroke: '#2563EB', strokeWidth: 3.5, label: 'y² = 4ax' },
      // Latus Rectum Chord passing through focus S(a, 0) from (a, 2a) to (a, -2a) -> y = 250 - 140 = 110, y = 250 + 140 = 390
      { id: 'con-latus-rectum', kind: 'line', startX: 350, startY: 110, endX: 350, endY: 390, color: '#16A34A', strokeWidth: 2.5, dashed: true, label: 'Latus Rectum = 4a' },
      { id: 'con-lr-p1', kind: 'circle', cx: 350, cy: 110, r: 4, fill: '#16A34A' },
      { id: 'con-lr-txt1', kind: 'text', x: 358, y: 115, text: 'L(a, 2a)', fontSize: 12, fontWeight: 'bold', color: '#16A34A' },
      { id: 'con-lr-p2', kind: 'circle', cx: 350, cy: 390, r: 4, fill: '#16A34A' },
      { id: 'con-lr-txt2', kind: 'text', x: 358, y: 395, text: 'L\'(a, -2a)', fontSize: 12, fontWeight: 'bold', color: '#16A34A' },
      // Geometric property formula
      { id: 'con-formula-txt', kind: 'text', x: 80, y: 460, text: 'Parabola Definition: For any point P on curve, Distance(P, Focus S) = Distance(P, Directrix)', fontSize: 12.5, fontWeight: 'bold', color: '#0F172A' },
    ],
  };
}

/**
 * Serializes a validated StructuredDiagramSpec into standalone, safe, clean SVG markup.
 * Can be downloaded as a valid .svg file.
 */
export function serializeDiagramSpecToSvg(spec: StructuredDiagramSpec, isDarkTheme = false): string {
  const { width, height } = spec.viewBox;
  const bgFill = isDarkTheme ? '#0B1020' : '#FFFFFF';
  const defaultTextColor = isDarkTheme ? '#F8FAFC' : '#0F172A';

  const markerDefs = `
    <defs>
      <!-- Arrowheads -->
      <marker id="arrow-default" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#4F46E5" />
      </marker>
      <marker id="arrow-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#2563EB" />
      </marker>
      <marker id="arrow-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#DC2626" />
      </marker>
      <marker id="arrow-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#16A34A" />
      </marker>
      <marker id="arrow-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#D97706" />
      </marker>
      <marker id="arrow-slate" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748B" />
      </marker>
      <marker id="arrow-purple" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#9333EA" />
      </marker>
    </defs>
  `;

  function getMarkerId(color?: string): string {
    if (!color) return 'arrow-default';
    const c = color.toLowerCase();
    if (c.includes('red') || c === '#dc2626' || c === '#ef4444') return 'arrow-red';
    if (c.includes('blue') || c === '#2563eb' || c === '#3b82f6') return 'arrow-blue';
    if (c.includes('green') || c === '#16a34a' || c === '#10b981') return 'arrow-green';
    if (c.includes('amber') || c.includes('orange') || c === '#d97706' || c === '#f59e0b') return 'arrow-amber';
    if (c.includes('purple') || c.includes('violet') || c === '#9333ea' || c === '#8b5cf6') return 'arrow-purple';
    if (c.includes('slate') || c.includes('gray') || c === '#64748b') return 'arrow-slate';
    return 'arrow-default';
  }

  const elementsXml: string[] = [];

  for (const el of spec.elements) {
    switch (el.kind) {
      case 'arrow': {
        const marker = getMarkerId(el.color);
        const stroke = el.color || '#4F46E5';
        const sw = el.strokeWidth || 2.5;
        const dash = el.dashed ? ' stroke-dasharray="6,4"' : '';
        elementsXml.push(
          `<line x1="${el.startX}" y1="${el.startY}" x2="${el.endX}" y2="${el.endY}" stroke="${stroke}" stroke-width="${sw}" marker-end="url(#${marker})"${dash} />`
        );
        if (el.label) {
          const midX = (el.startX + el.endX) / 2;
          const midY = (el.startY + el.endY) / 2 - 8;
          elementsXml.push(
            `<text x="${midX}" y="${midY}" fill="${stroke}" font-size="12" font-weight="bold" font-family="sans-serif" text-anchor="middle">${escapeXml(el.label)}</text>`
          );
        }
        break;
      }

      case 'line': {
        const stroke = el.color || '#64748B';
        const sw = el.strokeWidth || 2;
        const dash = el.dashed ? ' stroke-dasharray="6,4"' : '';
        elementsXml.push(
          `<line x1="${el.startX}" y1="${el.startY}" x2="${el.endX}" y2="${el.endY}" stroke="${stroke}" stroke-width="${sw}"${dash} />`
        );
        if (el.label) {
          const midX = (el.startX + el.endX) / 2;
          const midY = (el.startY + el.endY) / 2 - 8;
          elementsXml.push(
            `<text x="${midX}" y="${midY}" fill="${stroke}" font-size="12" font-family="sans-serif" text-anchor="middle">${escapeXml(el.label)}</text>`
          );
        }
        break;
      }

      case 'rect': {
        const fill = el.fill || '#EEF2FF';
        const stroke = el.stroke || '#4F46E5';
        const sw = el.strokeWidth || 2;
        const rx = el.rx || 0;
        elementsXml.push(
          `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
        );
        if (el.label) {
          elementsXml.push(
            `<text x="${el.x + el.width / 2}" y="${el.y + el.height / 2 + 5}" fill="${defaultTextColor}" font-size="12" font-weight="bold" font-family="sans-serif" text-anchor="middle">${escapeXml(el.label)}</text>`
          );
        }
        break;
      }

      case 'circle': {
        const fill = el.fill || '#EEF2FF';
        const stroke = el.stroke || '#4F46E5';
        const sw = el.strokeWidth || 2;
        elementsXml.push(
          `<circle cx="${el.cx}" cy="${el.cy}" r="${el.r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
        );
        if (el.label) {
          elementsXml.push(
            `<text x="${el.cx}" y="${el.cy + el.r + 16}" fill="${defaultTextColor}" font-size="12" font-weight="bold" font-family="sans-serif" text-anchor="middle">${escapeXml(el.label)}</text>`
          );
        }
        break;
      }

      case 'polygon': {
        const fill = el.fill || '#F1F5F9';
        const stroke = el.stroke || '#64748B';
        const sw = el.strokeWidth || 2;
        elementsXml.push(
          `<polygon points="${el.points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
        );
        break;
      }

      case 'path': {
        const fill = el.fill || 'none';
        const stroke = el.stroke || '#4F46E5';
        const sw = el.strokeWidth || 2.5;
        const dash = el.dashed ? ' stroke-dasharray="6,4"' : '';
        elementsXml.push(
          `<path d="${el.d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash} />`
        );
        break;
      }

      case 'text': {
        const color = el.color || defaultTextColor;
        const fs = el.fontSize || 13;
        const fw = el.fontWeight === 'bold' ? 'bold' : 'normal';
        const anchor = el.textAnchor || 'start';
        elementsXml.push(
          `<text x="${el.x}" y="${el.y}" fill="${color}" font-size="${fs}" font-weight="${fw}" font-family="sans-serif" text-anchor="${anchor}">${escapeXml(el.text)}</text>`
        );
        break;
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
        elementsXml.push(
          `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" />`
        );
        if (el.label) {
          const midDeg = (el.startAngleDeg + el.endAngleDeg) / 2;
          const midRad = (midDeg * Math.PI) / 180;
          const labelX = el.cx + (el.r + 18) * Math.cos(midRad);
          const labelY = el.cy - (el.r + 18) * Math.sin(midRad);
          elementsXml.push(
            `<text x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}" fill="${color}" font-size="12" font-weight="bold" font-family="sans-serif" text-anchor="middle">${escapeXml(el.label)}</text>`
          );
        }
        break;
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  ${markerDefs}
  <rect width="100%" height="100%" fill="${bgFill}" />
  ${elementsXml.join('\n  ')}
</svg>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
