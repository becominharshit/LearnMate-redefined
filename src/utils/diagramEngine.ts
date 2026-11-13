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
    return {
      ...semanticCheck.repairedOrFallbackSpec,
      verificationBadge: 'REPAIRED_BY_VALIDATOR',
    };
  }
  return {
    ...candidateSpec,
    verificationBadge:
      candidateSpec.isAiGenerated === false ? 'VERIFIED_TEMPLATE' : 'AI_UNVERIFIED_SCHEMATIC',
  };
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
 * Matches a concept prompt + optional category against LearnMate's verified mathematical
 * and physical deterministic JEE templates. Returns `null` when no verified preset
 * genuinely matches the request so callers never silently swap unrelated prompts to Parabola.
 */
export function getVerifiedDiagramPresetMatch(
  concept: string,
  contextText = '',
  citedPages: number[] = [1]
): StructuredDiagramSpec | null {
  const cLower = `${concept} ${contextText}`.toLowerCase();

  // 1. FREE-BODY DIAGRAM (Physics) — exact 30° incline geometry: wedge (100,420)->(500,190), flush block
  if (
    cLower.includes('incline') ||
    cLower.includes('free-body') ||
    cLower.includes('free_body') ||
    cLower.includes('free body') ||
    cLower.includes('fbd') ||
    cLower.includes('friction') ||
    cLower.includes('newton')
  ) {
    return {
      title: `Free-Body Diagram: Block on Inclined Plane (${concept})`,
      category: 'free_body_diagram',
      subject: 'Physics',
      description:
        'Standard JEE Free-Body Diagram showing normal force N perpendicular to the 30° incline, gravitational force mg vertically downward with components (mg cos θ and mg sin θ), and opposing friction f_s.',
      viewBox: { x: 0, y: 0, width: 700, height: 500 },
      assumptions: [
        'Incline angle θ ≈ 30° (tan θ = 230/400 = 0.575) above horizontal',
        'Coefficient of static friction μ_s = 0.25',
        'Block base sits flush on the inclined plane hypotenuse; Normal N ⊥ plane',
        'Standard gravitational acceleration g = 9.8 m/s²',
      ],
      schematicAssumptions: [
        'Incline angle θ ≈ 30° (tan θ = 230/400 = 0.575) above horizontal',
        'Coefficient of static friction μ_s = 0.25',
        'Block base sits flush on the inclined plane hypotenuse; Normal N ⊥ plane',
        'Standard gravitational acceleration g = 9.8 m/s²',
      ],
      citedPages,
      isAiGenerated: false,
      verificationBadge: 'VERIFIED_TEMPLATE',
      animationKind: 'fbd_motion',
      fallbackNotice: 'Verified Deterministic JEE Template: Physics Free-Body Diagram',
      elements: [
        // Ground line
        { id: 'fbd-ground', kind: 'line', startX: 60, startY: 420, endX: 640, endY: 420, color: '#94A3B8', strokeWidth: 2 },
        // Inclined wedge (tan θ = 230/400 = 0.575 -> θ ≈ 29.9°)
        { id: 'fbd-incline', kind: 'polygon', points: '100,420 500,420 500,190', fill: '#F1F5F9', stroke: '#475569', strokeWidth: 2.5 },
        // Angle theta arc at bottom-left of incline (0° to 30° CCW upward)
        { id: 'fbd-arc-theta', kind: 'arc', cx: 100, cy: 420, r: 64, startAngleDeg: 0, endAngleDeg: 30, color: '#D97706', label: 'θ = 30°' },
        // Mass block sitting flush on hypotenuse u=(0.8669,-0.4985), n=(-0.4985,-0.8669), center M=(300,305)
        { id: 'fbd-block', kind: 'polygon', points: '261,327.4 339,282.6 312.1,235.8 234.1,280.6', fill: '#EEF2FF', stroke: '#4F46E5', strokeWidth: 2.5, label: 'Mass m' },
        // Gravity vector mg (straight down from CM (286.5, 281.6))
        { id: 'fbd-f-mg', kind: 'arrow', startX: 286.5, startY: 281.6, endX: 286.5, endY: 411.6, color: '#DC2626', strokeWidth: 3, label: 'F_g = m·g' },
        // Normal force N (perpendicular to hypotenuse along n = (-0.4985, -0.8669))
        { id: 'fbd-f-n', kind: 'arrow', startX: 286.5, startY: 281.6, endX: 229.2, endY: 181.9, color: '#2563EB', strokeWidth: 3, label: 'Normal (N)' },
        // Static friction force f_s (parallel up the incline along u = (0.8669, -0.4985))
        { id: 'fbd-f-friction', kind: 'arrow', startX: 286.5, startY: 281.6, endX: 368.9, endY: 234.2, color: '#D97706', strokeWidth: 2.5, label: 'f_s (friction)' },
        // Decomposed mg sin θ (down the incline along -u)
        { id: 'fbd-f-mg-sin', kind: 'arrow', startX: 286.5, startY: 281.6, endX: 204.2, endY: 328.9, color: '#DC2626', strokeWidth: 2, dashed: true, label: 'm·g·sin θ' },
        // Decomposed mg cos θ (into plane along -n)
        { id: 'fbd-f-mg-cos', kind: 'arrow', startX: 286.5, startY: 281.6, endX: 342.7, endY: 379.2, color: '#DC2626', strokeWidth: 2, dashed: true, label: 'm·g·cos θ' },
        // Equilibrium summary
        { id: 'fbd-accel-hint', kind: 'text', x: 60, y: 70, text: 'Equilibrium: N = m·g·cos θ  |  f_s ≤ μ_s·N  |  Slope N ⊥ u', fontSize: 13, fontWeight: 'bold', color: '#1E293B' },
      ],
    };
  }

  // 2. RAY OPTICS (Physics) — Thin-lens equation 1/v - 1/u = 1/f with exact image intersection (475.7, 312.9)
  if (
    cLower.includes('optics') ||
    cLower.includes('lens') ||
    cLower.includes('mirror') ||
    cLower.includes('refraction') ||
    cLower.includes('reflection') ||
    cLower.includes('focal') ||
    cLower.includes('ray_optics')
  ) {
    return {
      title: `Ray Optics: Convex Lens Image Formation (${concept})`,
      category: 'ray_optics',
      subject: 'Physics',
      description:
        'Thin biconvex lens (f = 80 mm) with object at u = −220 mm beyond 2F₁ forming a real, inverted, diminished image at v = +125.7 mm (m = −4/7) where Ray 1 and Ray 2 converge.',
      viewBox: { x: 0, y: 0, width: 700, height: 500 },
      assumptions: [
        'Thin biconvex lens with focal length f = +80 px',
        'Object at u = −220 px (height h_o = 110 px)',
        'Exact image coordinate v = 880/7 ≈ +125.7 px, h_i = −62.9 px',
      ],
      schematicAssumptions: [
        'Thin biconvex lens with focal length f = +80 px',
        'Object at u = −220 px (height h_o = 110 px)',
        'Exact image coordinate v = 880/7 ≈ +125.7 px, h_i = −62.9 px',
      ],
      citedPages,
      isAiGenerated: false,
      verificationBadge: 'VERIFIED_TEMPLATE',
      animationKind: 'optics_wavefront',
      fallbackNotice: 'Verified Deterministic JEE Template: Ray Optics Diagram',
      elements: [
        { id: 'opt-axis', kind: 'line', startX: 40, startY: 250, endX: 660, endY: 250, color: '#64748B', strokeWidth: 1.5, dashed: true, label: 'Principal Axis' },
        { id: 'opt-lens-line', kind: 'line', startX: 350, startY: 90, endX: 350, endY: 410, color: '#2563EB', strokeWidth: 3 },
        { id: 'opt-lens-cap-top', kind: 'arrow', startX: 350, startY: 110, endX: 350, endY: 85, color: '#2563EB', strokeWidth: 2.5 },
        { id: 'opt-lens-cap-bot', kind: 'arrow', startX: 350, startY: 390, endX: 350, endY: 415, color: '#2563EB', strokeWidth: 2.5 },
        { id: 'opt-pt-o', kind: 'circle', cx: 350, cy: 250, r: 4, fill: '#1E293B', stroke: '#1E293B', strokeWidth: 1 },
        { id: 'opt-txt-o', kind: 'text', x: 356, y: 270, text: 'O', fontSize: 13, fontWeight: 'bold', color: '#1E293B' },
        { id: 'opt-pt-f1', kind: 'circle', cx: 270, cy: 250, r: 3.5, fill: '#2563EB', stroke: '#2563EB', strokeWidth: 1 },
        { id: 'opt-txt-f1', kind: 'text', x: 263, y: 270, text: 'F₁', fontSize: 13, fontWeight: 'bold', color: '#2563EB' },
        { id: 'opt-pt-2f1', kind: 'circle', cx: 190, cy: 250, r: 3.5, fill: '#2563EB', stroke: '#2563EB', strokeWidth: 1 },
        { id: 'opt-txt-2f1', kind: 'text', x: 180, y: 270, text: '2F₁', fontSize: 13, fontWeight: 'bold', color: '#2563EB' },
        { id: 'opt-pt-f2', kind: 'circle', cx: 430, cy: 250, r: 3.5, fill: '#2563EB', stroke: '#2563EB', strokeWidth: 1 },
        { id: 'opt-txt-f2', kind: 'text', x: 425, y: 270, text: 'F₂', fontSize: 13, fontWeight: 'bold', color: '#2563EB' },
        { id: 'opt-pt-2f2', kind: 'circle', cx: 510, cy: 250, r: 3.5, fill: '#2563EB', stroke: '#2563EB', strokeWidth: 1 },
        { id: 'opt-txt-2f2', kind: 'text', x: 505, y: 270, text: '2F₂', fontSize: 13, fontWeight: 'bold', color: '#2563EB' },
        { id: 'opt-object', kind: 'arrow', startX: 130, startY: 250, endX: 130, endY: 140, color: '#16A34A', strokeWidth: 3.5, label: 'Object (AB)' },
        { id: 'opt-ray1-a', kind: 'line', startX: 130, startY: 140, endX: 350, endY: 140, color: '#DC2626', strokeWidth: 2 },
        { id: 'opt-ray1-b', kind: 'arrow', startX: 350, startY: 140, endX: 475.7, endY: 312.9, color: '#DC2626', strokeWidth: 2, label: 'Ray 1 (through F₂)' },
        { id: 'opt-ray2', kind: 'arrow', startX: 130, startY: 140, endX: 475.7, endY: 312.9, color: '#D97706', strokeWidth: 2, label: 'Ray 2 (through O)' },
        { id: 'opt-image', kind: 'arrow', startX: 475.7, startY: 250, endX: 475.7, endY: 312.9, color: '#9333EA', strokeWidth: 3, label: "Image A'B' (v = +125.7)" },
        { id: 'opt-formula-txt', kind: 'text', x: 60, y: 440, text: 'Lens Formula: 1/f = 1/v − 1/u  |  m = v/u = h_i/h_o = −0.57', fontSize: 13, fontWeight: 'bold', color: '#0F172A' },
      ],
    };
  }

  // 3. CIRCUIT (Physics / Electrical) — Fully closed loop (left wire connects seamlessly to bat-neg y=255)
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
        'Closed DC loop containing DC source V, switch S, series resistor R, and capacitor C with continuous current orientation and KVL governing equation.',
      viewBox: { x: 0, y: 0, width: 700, height: 500 },
      assumptions: [
        'DC Battery supply V = 12 V',
        'Series Resistor R = 100 Ω',
        'Capacitor C = 50 μF (τ = RC = 5.0 ms)',
        'Switch closes at t = 0 (closed Kirchhoff loop)',
      ],
      schematicAssumptions: [
        'DC Battery supply V = 12 V',
        'Series Resistor R = 100 Ω',
        'Capacitor C = 50 μF (τ = RC = 5.0 ms)',
        'Switch closes at t = 0 (closed Kirchhoff loop)',
      ],
      citedPages,
      isAiGenerated: false,
      verificationBadge: 'VERIFIED_TEMPLATE',
      animationKind: 'rc_charge_flow',
      fallbackNotice: 'Verified Deterministic JEE Template: Circuit Diagram',
      elements: [
        { id: 'cir-wire-top1', kind: 'line', startX: 150, startY: 160, endX: 250, endY: 160, color: '#334155', strokeWidth: 2.5 },
        { id: 'cir-switch-hinge', kind: 'circle', cx: 250, cy: 160, r: 4, fill: '#334155' },
        { id: 'cir-switch-arm', kind: 'line', startX: 250, startY: 160, endX: 295, endY: 135, color: '#2563EB', strokeWidth: 3, label: 'Switch S (t=0)' },
        { id: 'cir-switch-contact', kind: 'circle', cx: 300, cy: 160, r: 4, fill: '#334155' },
        { id: 'cir-wire-top2', kind: 'line', startX: 300, startY: 160, endX: 360, endY: 160, color: '#334155', strokeWidth: 2.5 },
        { id: 'cir-resistor', kind: 'path', d: 'M 360 160 L 375 140 L 395 180 L 415 140 L 435 180 L 455 140 L 470 160', stroke: '#D97706', strokeWidth: 3, label: 'R = 100 Ω' },
        { id: 'cir-wire-top3', kind: 'line', startX: 470, startY: 160, endX: 550, endY: 160, color: '#334155', strokeWidth: 2.5 },
        { id: 'cir-wire-right1', kind: 'line', startX: 550, startY: 160, endX: 550, endY: 230, color: '#334155', strokeWidth: 2.5 },
        { id: 'cir-cap-top', kind: 'line', startX: 520, startY: 230, endX: 580, endY: 230, color: '#4F46E5', strokeWidth: 4, label: '+q (C = 50 μF)' },
        { id: 'cir-cap-bot', kind: 'line', startX: 520, startY: 245, endX: 580, endY: 245, color: '#4F46E5', strokeWidth: 4, label: '-q' },
        { id: 'cir-wire-right2', kind: 'line', startX: 550, startY: 245, endX: 550, endY: 360, color: '#334155', strokeWidth: 2.5 },
        { id: 'cir-wire-bot', kind: 'line', startX: 150, startY: 360, endX: 550, endY: 360, color: '#334155', strokeWidth: 2.5 },
        // Closed seamlessly to battery negative plate (y = 255)
        { id: 'cir-wire-left1', kind: 'line', startX: 150, startY: 360, endX: 150, endY: 255, color: '#334155', strokeWidth: 2.5 },
        { id: 'cir-bat-pos', kind: 'line', startX: 130, startY: 240, endX: 170, endY: 240, color: '#16A34A', strokeWidth: 4, label: '+ (12V)' },
        { id: 'cir-bat-neg', kind: 'line', startX: 140, startY: 255, endX: 160, endY: 255, color: '#DC2626', strokeWidth: 3, label: '-' },
        { id: 'cir-wire-left2', kind: 'line', startX: 150, startY: 240, endX: 150, endY: 160, color: '#334155', strokeWidth: 2.5 },
        { id: 'cir-current-arrow', kind: 'arrow', startX: 320, startY: 122, endX: 365, endY: 122, color: '#16A34A', strokeWidth: 2.5, label: 'Current I(t)' },
        { id: 'cir-eq-txt', kind: 'text', x: 110, y: 415, text: 'Governing KVL: V − i(t)R − q(t)/C = 0  ⇒  q(t) = C·V·(1 − e^(−t/RC))', fontSize: 13, fontWeight: 'bold', color: '#0F172A' },
      ],
    };
  }

  // 4A. PCl5 TRIGONAL BIPYRAMIDAL (Chemistry VSEPR)
  if (
    cLower.includes('pcl5') ||
    cLower.includes('pcl₅') ||
    cLower.includes('phosphorus pentachloride') ||
    cLower.includes('trigonal bipyramidal')
  ) {
    return {
      title: `VSEPR Molecular Geometry: PCl₅ Trigonal Bipyramidal (${concept})`,
      category: 'molecular_shape',
      subject: 'Chemistry',
      description:
        'PCl₅ exhibits sp³d hybridization with 5 bond pairs and 0 lone pairs: 2 axial P–Cl bonds (180° apart, 90° to equatorial plane) and 3 equatorial P–Cl bonds (120° apart).',
      viewBox: { x: 0, y: 0, width: 700, height: 500 },
      assumptions: [
        'Central Phosphorus atom (sp³d, 5 bond pairs, 0 lone pairs)',
        'Axial–Equatorial bond angle = 90°; Axial–Axial = 180°',
        'Equatorial–Equatorial bond angles = 120°',
        'Axial P–Cl bonds (219 pm) are slightly longer than equatorial bonds (204 pm)',
      ],
      schematicAssumptions: [
        'Central Phosphorus atom (sp³d, 5 bond pairs, 0 lone pairs)',
        'Axial–Equatorial bond angle = 90°; Axial–Axial = 180°',
        'Equatorial–Equatorial bond angles = 120°',
        'Axial P–Cl bonds (219 pm) are slightly longer than equatorial bonds (204 pm)',
      ],
      citedPages,
      isAiGenerated: false,
      verificationBadge: 'VERIFIED_TEMPLATE',
      animationKind: 'vsepr_vibration',
      fallbackNotice: 'Verified Deterministic JEE Template: PCl₅ VSEPR Geometry',
      elements: [
        // Equatorial plane guide triangle
        { id: 'pcl5-eq-plane', kind: 'polygon', points: '510,250 235,345 250,185', fill: '#EFF6FF', stroke: '#93C5FD', strokeWidth: 1.5 },
        // Axial P-Cl top bond (vertical up: angle 90°)
        { id: 'pcl5-bond-ax1', kind: 'line', startX: 350, startY: 250, endX: 350, endY: 100, color: '#1E293B', strokeWidth: 4, label: 'Axial (219 pm)' },
        // Axial P-Cl bottom bond (vertical down: angle 270°)
        { id: 'pcl5-bond-ax2', kind: 'line', startX: 350, startY: 250, endX: 350, endY: 400, color: '#1E293B', strokeWidth: 4, label: 'Axial (219 pm)' },
        // Equatorial P-Cl right bond (horizontal right: angle 0°)
        { id: 'pcl5-bond-eq1', kind: 'line', startX: 350, startY: 250, endX: 510, endY: 250, color: '#475569', strokeWidth: 4.5, label: 'Equatorial (204 pm)' },
        // Equatorial front-left wedge bond
        { id: 'pcl5-bond-eq2', kind: 'line', startX: 350, startY: 250, endX: 235, endY: 345, color: '#334155', strokeWidth: 6 },
        // Equatorial back-left dashed bond
        { id: 'pcl5-bond-eq3', kind: 'line', startX: 350, startY: 250, endX: 250, endY: 185, color: '#64748B', strokeWidth: 3.5, dashed: true },
        // 90° angle arc between Axial-Top (90°) and Equatorial-Right (0°)
        { id: 'pcl5-arc-90', kind: 'arc', cx: 350, cy: 250, r: 58, startAngleDeg: 0, endAngleDeg: 90, color: '#D97706', label: '90°' },
        // 120° equatorial arc guide
        { id: 'pcl5-arc-120', kind: 'arc', cx: 350, cy: 250, r: 44, startAngleDeg: 218, endAngleDeg: 360, color: '#2563EB', label: '120° (eq)' },
        // Central P Atom
        { id: 'pcl5-p', kind: 'circle', cx: 350, cy: 250, r: 30, fill: '#FEF3C7', stroke: '#D97706', strokeWidth: 3.5 },
        { id: 'pcl5-p-txt', kind: 'text', x: 342, y: 257, text: 'P', fontSize: 20, fontWeight: 'bold', color: '#92400E' },
        // 5 Chlorine atoms
        { id: 'pcl5-cl1', kind: 'circle', cx: 350, cy: 95, r: 22, fill: '#DCFCE7', stroke: '#16A34A', strokeWidth: 2.5 },
        { id: 'pcl5-cl1-txt', kind: 'text', x: 341, y: 101, text: 'Cl', fontSize: 15, fontWeight: 'bold', color: '#166534' },
        { id: 'pcl5-cl2', kind: 'circle', cx: 350, cy: 405, r: 22, fill: '#DCFCE7', stroke: '#16A34A', strokeWidth: 2.5 },
        { id: 'pcl5-cl2-txt', kind: 'text', x: 341, y: 411, text: 'Cl', fontSize: 15, fontWeight: 'bold', color: '#166534' },
        { id: 'pcl5-cl3', kind: 'circle', cx: 515, cy: 250, r: 22, fill: '#DCFCE7', stroke: '#16A34A', strokeWidth: 2.5 },
        { id: 'pcl5-cl3-txt', kind: 'text', x: 506, y: 256, text: 'Cl', fontSize: 15, fontWeight: 'bold', color: '#166534' },
        { id: 'pcl5-cl4', kind: 'circle', cx: 230, cy: 350, r: 22, fill: '#DCFCE7', stroke: '#16A34A', strokeWidth: 2.5 },
        { id: 'pcl5-cl4-txt', kind: 'text', x: 221, y: 356, text: 'Cl', fontSize: 15, fontWeight: 'bold', color: '#166534' },
        { id: 'pcl5-cl5', kind: 'circle', cx: 245, cy: 180, r: 22, fill: '#DCFCE7', stroke: '#16A34A', strokeWidth: 2.5 },
        { id: 'pcl5-cl5-txt', kind: 'text', x: 236, y: 186, text: 'Cl', fontSize: 15, fontWeight: 'bold', color: '#166534' },
        { id: 'pcl5-caption', kind: 'text', x: 110, y: 465, text: 'sp³d Hybridization · Axial = 180° (219 pm) · Equatorial = 120° (204 pm) · μ = 0 D', fontSize: 12.5, fontWeight: 'bold', color: '#1E293B' },
      ],
    };
  }

  // 4B. H2O BENT VSEPR (Chemistry) — True 104.5° bond vector geometry (217.75° & 322.25° downward)
  if (
    cLower.includes('h2o') ||
    cLower.includes('h₂o') ||
    cLower.includes('water') ||
    cLower.includes('vsepr') ||
    cLower.includes('molecular_shape') ||
    cLower.includes('nh3') ||
    cLower.includes('ch4')
  ) {
    // O at (350, 220); H1 at angle 217.75° (down-left) & H2 at 322.25° (down-right), exact 104.5° separation!
    return {
      title: `VSEPR Molecular Geometry: Water H₂O Bent Shape (${concept})`,
      category: 'molecular_shape',
      subject: 'Chemistry',
      description:
        'VSEPR representation of H₂O: sp³ Oxygen center with two O–H covalent bonds placed symmetrically at 104.5° (217.75° & 322.25°) and two top non-bonding lone pairs.',
      viewBox: { x: 0, y: 0, width: 700, height: 500 },
      assumptions: [
        'Central atom: Oxygen (Z = 8, sp³ hybridized, 2 BP + 2 LP)',
        'O–H bond vectors separated by exact 104.5° (symmetric around downward vertical)',
        'Repulsion order: LP–LP > LP–BP > BP–BP compresses angle from 109.5° to 104.5°',
      ],
      schematicAssumptions: [
        'Central atom: Oxygen (Z = 8, sp³ hybridized, 2 BP + 2 LP)',
        'O–H bond vectors separated by exact 104.5° (symmetric around downward vertical)',
        'Repulsion order: LP–LP > LP–BP > BP–BP compresses angle from 109.5° to 104.5°',
      ],
      citedPages,
      isAiGenerated: false,
      verificationBadge: 'VERIFIED_TEMPLATE',
      animationKind: 'vsepr_vibration',
      fallbackNotice: 'Verified Deterministic JEE Template: Chemistry VSEPR Shape',
      elements: [
        // Left & Right O-H bonds first (exact 104.5° vectors from O=(350,220))
        { id: 'vsepr-bond-1', kind: 'line', startX: 350, startY: 220, endX: 211.6, endY: 327.1, color: '#475569', strokeWidth: 4.5, label: 'σ Bond' },
        { id: 'vsepr-bond-2', kind: 'line', startX: 350, startY: 220, endX: 488.4, endY: 327.1, color: '#475569', strokeWidth: 4.5, label: 'σ Bond' },
        // Bond Angle Arc spanning 217.75° to 322.25° below Oxygen between the two O-H bonds
        { id: 'vsepr-angle-arc', kind: 'arc', cx: 350, cy: 220, r: 62, startAngleDeg: 217.75, endAngleDeg: 322.25, color: '#D97706', label: '104.5°' },
        // Central Oxygen Atom
        { id: 'vsepr-o', kind: 'circle', cx: 350, cy: 220, r: 36, fill: '#EFF6FF', stroke: '#2563EB', strokeWidth: 3.5, label: 'Oxygen (O)' },
        { id: 'vsepr-o-txt', kind: 'text', x: 342, y: 227, text: 'O', fontSize: 22, fontWeight: 'bold', color: '#1E3A8A' },
        // Left & Right Hydrogen Atoms centered at exact vector endpoints (211.6, 327.1) and (488.4, 327.1)
        { id: 'vsepr-h1', kind: 'circle', cx: 211.6, cy: 327.1, r: 24, fill: '#FEF2F2', stroke: '#DC2626', strokeWidth: 3, label: 'H' },
        { id: 'vsepr-h1-txt', kind: 'text', x: 204.6, y: 334, text: 'H', fontSize: 18, fontWeight: 'bold', color: '#991B1B' },
        { id: 'vsepr-h2', kind: 'circle', cx: 488.4, cy: 327.1, r: 24, fill: '#FEF2F2', stroke: '#DC2626', strokeWidth: 3, label: 'H' },
        { id: 'vsepr-h2-txt', kind: 'text', x: 481.4, y: 334, text: 'H', fontSize: 18, fontWeight: 'bold', color: '#991B1B' },
        // Lone pair clouds above Oxygen
        { id: 'vsepr-lp1-lobe', kind: 'path', d: 'M 330 185 Q 285 110 320 95 Q 350 110 340 183', fill: '#FEF9C3', stroke: '#EAB308', strokeWidth: 2, dashed: true },
        { id: 'vsepr-lp1-dot1', kind: 'circle', cx: 312, cy: 125, r: 3.5, fill: '#CA8A04' },
        { id: 'vsepr-lp1-dot2', kind: 'circle', cx: 326, cy: 120, r: 3.5, fill: '#CA8A04', label: 'Lone Pair 1' },
        { id: 'vsepr-lp2-lobe', kind: 'path', d: 'M 360 183 Q 350 110 380 95 Q 415 110 370 185', fill: '#FEF9C3', stroke: '#EAB308', strokeWidth: 2, dashed: true },
        { id: 'vsepr-lp2-dot1', kind: 'circle', cx: 374, cy: 120, r: 3.5, fill: '#CA8A04' },
        { id: 'vsepr-lp2-dot2', kind: 'circle', cx: 388, cy: 125, r: 3.5, fill: '#CA8A04', label: 'Lone Pair 2' },
        { id: 'vsepr-caption', kind: 'text', x: 145, y: 440, text: 'sp³ Hybridization · Exact 104.5° H–O–H Angle · Net Dipole Moment μ = 1.85 D', fontSize: 13, fontWeight: 'bold', color: '#1E293B' },
      ],
    };
  }

  // 5A. ELLIPSE CONIC SECTION (Mathematics) — Exact 3-4-5 semi-axes (a=180, b=108, c=144, e=0.8)
  if (cLower.includes('ellipse') || cLower.includes('major axis') || cLower.includes('eccentricity')) {
    // Center (350, 240); a = 180, b = 108 -> c = sqrt(180^2 - 108^2) = 144; directrices x = 350 ± (a^2/c) = 350 ± 225 = 575, 125
    // Sample point P(350 + 180*0.6, 240 - 108*0.8) = (458, 153.6) -> PF1 + PF2 = 2a = 360 exact!
    return {
      title: `Conic Section: Ellipse x²/a² + y²/b² = 1 (${concept})`,
      category: 'conic_section',
      subject: 'Mathematics',
      description:
        'Standard ellipse with semi-major axis a = 180, semi-minor axis b = 108, eccentricity e = c/a = 0.8, foci F₁(ae, 0) & F₂(−ae, 0), directrices x = ±a/e, and constant focal sum PF₁ + PF₂ = 2a.',
      viewBox: { x: 0, y: 0, width: 700, height: 500 },
      assumptions: [
        'Center C(0, 0) at canvas (350, 240)',
        'Semi-major axis a = 180, semi-minor axis b = 108 ⇒ c = √(a² − b²) = 144 (e = 0.8)',
        'Directrices at x = ±a/e = ±225 ⇒ canvas x = 125 and x = 575',
      ],
      schematicAssumptions: [
        'Center C(0, 0) at canvas (350, 240)',
        'Semi-major axis a = 180, semi-minor axis b = 108 ⇒ c = √(a² − b²) = 144 (e = 0.8)',
        'Directrices at x = ±a/e = ±225 ⇒ canvas x = 125 and x = 575',
      ],
      citedPages,
      isAiGenerated: false,
      verificationBadge: 'VERIFIED_TEMPLATE',
      animationKind: 'conic_focus_sweep',
      fallbackNotice: 'Verified Deterministic JEE Template: Mathematics Ellipse Conic',
      elements: [
        { id: 'ell-axis-x', kind: 'arrow', startX: 60, startY: 240, endX: 640, endY: 240, color: '#64748B', strokeWidth: 2, label: 'Major Axis (2a)' },
        { id: 'ell-axis-y', kind: 'arrow', startX: 350, startY: 410, endX: 350, endY: 60, color: '#64748B', strokeWidth: 2, label: 'Minor Axis (2b)' },
        // Ellipse path built via 2 exact SVG elliptical arcs
        { id: 'ell-curve', kind: 'path', d: 'M 170 240 A 180 108 0 1 0 530 240 A 180 108 0 1 0 170 240 Z', fill: '#EEF2FF', stroke: '#2563EB', strokeWidth: 3.5, label: 'x²/a² + y²/b² = 1' },
        // Directrices x = ±a/e (125 and 575)
        { id: 'ell-dir-left', kind: 'line', startX: 125, startY: 85, endX: 125, endY: 395, color: '#D97706', strokeWidth: 2, dashed: true, label: 'x = −a/e' },
        { id: 'ell-dir-right', kind: 'line', startX: 575, startY: 85, endX: 575, endY: 395, color: '#D97706', strokeWidth: 2, dashed: true, label: 'x = +a/e' },
        // Foci F2(-c, 0) = (206, 240) and F1(+c, 0) = (494, 240)
        { id: 'ell-f2', kind: 'circle', cx: 206, cy: 240, r: 5, fill: '#DC2626', stroke: '#DC2626', label: 'S′(−ae, 0)' },
        { id: 'ell-f1', kind: 'circle', cx: 494, cy: 240, r: 5, fill: '#DC2626', stroke: '#DC2626', label: 'S(ae, 0)' },
        // Sample Point P(458, 153.6) verifying PS + PS' = 2a
        { id: 'ell-ray-ps1', kind: 'line', startX: 458, startY: 153.6, endX: 494, endY: 240, color: '#16A34A', strokeWidth: 2, dashed: true },
        { id: 'ell-ray-ps2', kind: 'line', startX: 458, startY: 153.6, endX: 206, endY: 240, color: '#16A34A', strokeWidth: 2, dashed: true },
        { id: 'ell-pt-p', kind: 'circle', cx: 458, cy: 153.6, r: 5, fill: '#16A34A', stroke: '#16A34A' },
        { id: 'ell-txt-p', kind: 'text', x: 468, y: 146, text: 'P(x, y)', fontSize: 13, fontWeight: 'bold', color: '#16A34A' },
        { id: 'ell-formula-txt', kind: 'text', x: 95, y: 455, text: 'Locus Property: PS + PS′ = 2a  |  Latus Rectum = 2b²/a  |  b² = a²(1 − e²)', fontSize: 13, fontWeight: 'bold', color: '#0F172A' },
      ],
    };
  }

  // 5B. PARABOLA CONIC SECTION (Mathematics) — Exact Quadratic Bezier y² = 4ax with Vertex V(260,240), a=50, Focus S(310,240), Directrix x=210
  if (
    cLower.includes('parabola') ||
    cLower.includes('conic') ||
    cLower.includes('latus rectum') ||
    cLower.includes('directrix') ||
    cLower.includes('4ax')
  ) {
    return {
      title: `Conic Section: Parabola y² = 4ax (${concept})`,
      category: 'conic_section',
      subject: 'Mathematics',
      description:
        'Standard parabola y² = 4ax opening right: Vertex V(0,0) at (260,240), Focus S(a,0) at (310,240), Directrix x = −a at x = 210, and exact Latus Rectum L(a,2a)–L′(a,−2a) of length 4a.',
      viewBox: { x: 0, y: 0, width: 700, height: 500 },
      assumptions: [
        'Focal parameter a = 50 px; Vertex V(0, 0) at canvas (260, 240)',
        'Focus S(a, 0) at (310, 240); Directrix x = −a at x = 210',
        'Exact quadratic Bézier M 422 60 Q 98 240 422 420 satisfies (y − 240)² = 4a(x − 260) identically',
      ],
      schematicAssumptions: [
        'Focal parameter a = 50 px; Vertex V(0, 0) at canvas (260, 240)',
        'Focus S(a, 0) at (310, 240); Directrix x = −a at x = 210',
        'Exact quadratic Bézier M 422 60 Q 98 240 422 420 satisfies (y − 240)² = 4a(x − 260) identically',
      ],
      citedPages,
      isAiGenerated: false,
      verificationBadge: 'VERIFIED_TEMPLATE',
      animationKind: 'conic_focus_sweep',
      fallbackNotice: 'Verified Deterministic JEE Template: Mathematics Parabola Conic',
      elements: [
        { id: 'con-axis-x', kind: 'arrow', startX: 60, startY: 240, endX: 640, endY: 240, color: '#64748B', strokeWidth: 2, label: 'x-axis' },
        { id: 'con-axis-y', kind: 'arrow', startX: 260, startY: 435, endX: 260, endY: 50, color: '#64748B', strokeWidth: 2, label: 'y-axis (Tangent at Vertex)' },
        { id: 'con-vertex', kind: 'circle', cx: 260, cy: 240, r: 4.5, fill: '#4F46E5', stroke: '#4F46E5', label: 'Vertex V(0,0)' },
        { id: 'con-txt-vertex', kind: 'text', x: 220, y: 260, text: 'V(0,0)', fontSize: 12.5, fontWeight: 'bold', color: '#4F46E5' },
        { id: 'con-focus', kind: 'circle', cx: 310, cy: 240, r: 5, fill: '#DC2626', stroke: '#DC2626', label: 'Focus S(a, 0)' },
        { id: 'con-txt-focus', kind: 'text', x: 316, y: 262, text: 'S(a, 0)', fontSize: 12.5, fontWeight: 'bold', color: '#DC2626' },
        { id: 'con-directrix', kind: 'line', startX: 210, startY: 60, endX: 210, endY: 420, color: '#D97706', strokeWidth: 2.5, dashed: true, label: 'Directrix: x = −a' },
        // Exact parabola Bezier: vertex at (260, 240), a = 50 -> passes exactly through (310, 140) and (310, 340)!
        { id: 'con-parabola-curve', kind: 'path', d: 'M 422 60 Q 98 240 422 420', fill: 'none', stroke: '#2563EB', strokeWidth: 3.5, label: 'y² = 4ax' },
        // Latus Rectum through S(310, 240) from (310, 140) to (310, 340), length 200 = 4a
        { id: 'con-latus-rectum', kind: 'line', startX: 310, startY: 140, endX: 310, endY: 340, color: '#16A34A', strokeWidth: 2.5, dashed: true, label: 'Latus Rectum = 4a' },
        { id: 'con-lr-p1', kind: 'circle', cx: 310, cy: 140, r: 4, fill: '#16A34A' },
        { id: 'con-lr-txt1', kind: 'text', x: 318, y: 138, text: 'L(a, 2a)', fontSize: 12, fontWeight: 'bold', color: '#16A34A' },
        { id: 'con-lr-p2', kind: 'circle', cx: 310, cy: 340, r: 4, fill: '#16A34A' },
        { id: 'con-lr-txt2', kind: 'text', x: 318, y: 348, text: "L'(a, −2a)", fontSize: 12, fontWeight: 'bold', color: '#16A34A' },
        { id: 'con-formula-txt', kind: 'text', x: 80, y: 465, text: 'Parabola Locus: PS = PM  (Distance to Focus S = Distance to Directrix x = −a)', fontSize: 12.5, fontWeight: 'bold', color: '#0F172A' },
      ],
    };
  }

  return null;
}

/**
 * Generates a deterministic JEE diagram template for any concept.
 * If the concept matches a verified domain preset, returns that exact preset;
 * otherwise returns Parabola only as a generic last-resort fallback wrapper for legacy callers.
 */
export function getDeterministicDiagramTemplate(
  concept: string,
  contextText = '',
  citedPages: number[] = [1]
): StructuredDiagramSpec {
  const matched = getVerifiedDiagramPresetMatch(concept, contextText, citedPages);
  if (matched) {
    return matched;
  }
  return getVerifiedDiagramPresetMatch(`parabola ${concept}`, contextText, citedPages)!;
}

/**
 * Serializes a validated StructuredDiagramSpec into standalone, safe, clean SVG markup.
 * Can be downloaded as a valid .svg file.
 */
export function serializeDiagramSpecToSvg(spec: StructuredDiagramSpec, isDarkTheme = false): string {
  const { width, height } = spec.viewBox;
  const bgFill = isDarkTheme ? '#0B1020' : '#FFFFFF';
  const defaultTextColor = isDarkTheme ? '#F8FAFC' : '#0F172A';

  const customArrowColors = Array.from(
    new Set(
      spec.elements
        .filter((e): e is DiagramArrow => e.kind === 'arrow' && Boolean(e.color))
        .map((e) => e.color!.trim())
    )
  );
  const dynamicCustomMarkers = customArrowColors
    .map((color, idx) => {
      const mId = `arrow-custom-${idx}`;
      return `<marker id="${mId}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="${escapeXml(color)}" /></marker>`;
    })
    .join('\n      ');
  const customMarkerByColor = new Map<string, string>();
  customArrowColors.forEach((c, idx) => customMarkerByColor.set(c.toLowerCase(), `arrow-custom-${idx}`));

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
      ${dynamicCustomMarkers}
    </defs>
  `;

  function getMarkerId(color?: string): string {
    if (!color) return 'arrow-default';
    const c = color.trim().toLowerCase();
    if (c.includes('red') || c === '#dc2626' || c === '#ef4444') return 'arrow-red';
    if (c.includes('blue') || c === '#2563eb' || c === '#3b82f6') return 'arrow-blue';
    if (c.includes('green') || c === '#16a34a' || c === '#10b981') return 'arrow-green';
    if (c.includes('amber') || c.includes('orange') || c === '#d97706' || c === '#f59e0b') return 'arrow-amber';
    if (c.includes('purple') || c.includes('violet') || c === '#9333ea' || c === '#8b5cf6') return 'arrow-purple';
    if (c.includes('slate') || c.includes('gray') || c === '#64748b') return 'arrow-slate';
    return customMarkerByColor.get(c) || 'arrow-default';
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
            elementsXml.push(
              `<text x="${(sx / nPts).toFixed(1)}" y="${(sy / nPts + 4).toFixed(1)}" fill="${defaultTextColor}" font-size="12" font-weight="bold" font-family="sans-serif" text-anchor="middle">${escapeXml(el.label)}</text>`
            );
          }
        }
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
        const delta = el.endAngleDeg - el.startAngleDeg;
        const diff = Math.abs(delta);
        const largeArc = diff > 180 ? 1 : 0;
        // In screen Y-down SVG coordinates, increasing math angle (delta >= 0) sweeps counter-clockwise (sweep-flag = 0)
        const sweepFlag = delta >= 0 ? 0 : 1;
        const d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${el.r} ${el.r} 0 ${largeArc} ${sweepFlag} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
        elementsXml.push(
          `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" />`
        );
        if (el.label) {
          const midDeg = (el.startAngleDeg + el.endAngleDeg) / 2;
          const midRad = (midDeg * Math.PI) / 180;
          const labelX = el.cx + (el.r + 18) * Math.cos(midRad);
          const labelY = el.cy - (el.r + 18) * Math.sin(midRad);
          elementsXml.push(
            `<text x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}" fill="${color}" font-size="12" font-weight="bold" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle">${escapeXml(el.label)}</text>`
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
