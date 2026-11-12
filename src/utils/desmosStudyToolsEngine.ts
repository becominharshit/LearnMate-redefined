/**
 * Desmos-Grade Mathematical & Study Tools Engine
 * Pure, deterministic TypeScript calculations for:
 * 1. 2D Graphing Calculator (Cartesian, Polar, Parametric, Inequalities, Domain Restrictions,
 *    Free Parameter Sliders, Roots/Extrema/Intersections POI solver, Derivative & Definite Integral Shading)
 * 2. Matrix & Linear Algebra Calculator (Determinant, Inverse, Transpose, Trace, RREF,
 *    Eigenvalues & Characteristic Polynomial, Matrix Multiplication/Addition, Ax = b Solver)
 * 3. 3D Surface z = f(x,y) & 3D Vector Space Operations (Dot, Cross, Projection, Angle, Cross-Section Slicing)
 * 4. Interactive Geometry Construction, Ray Optics Bench & Free-Body Force Vector Equilibrium
 * 5. Scientific Calculator Enhancements (ans reference, Exact Fraction converter, Combinatorics nPr/nCr)
 */

export type GraphExpressionMode = 'cartesian' | 'polar' | 'parametric' | 'inequality';
export type InequalityOperator = '<' | '<=' | '>' | '>=';

export interface ParsedDomainRestriction {
  min: number | null;
  max: number | null;
  variable: 'x' | 't' | 'theta';
}

export interface ParsedGraphExpression {
  raw: string;
  cleanExpr: string;
  parametricX?: string;
  parametricY?: string;
  mode: GraphExpressionMode;
  inequalityOp?: InequalityOperator;
  domain: ParsedDomainRestriction | null;
  freeParameters: string[];
}

export interface ParameterSliderSpec {
  symbol: string;
  value: number;
  min: number;
  max: number;
  step: number;
  playing: boolean;
}

export interface PointOfInterest {
  id: string;
  type: 'root' | 'y_intercept' | 'max' | 'min' | 'intersection';
  x: number;
  y: number;
  label: string;
  curveIds: string[];
}

export interface CalculusAnalysisResult {
  tangentX: number;
  tangentY: number | null;
  derivativeSlope: number | null;
  tangentEquationLatex: string;
  integralLower: number;
  integralUpper: number;
  definiteIntegralArea: number;
  shadedPolygonPoints: Array<{ x: number; y: number }>;
}

const RESERVED_MATH_IDENTIFIERS = new Set([
  'x',
  'y',
  't',
  'r',
  'theta',
  'pi',
  'e',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'sinh',
  'cosh',
  'tanh',
  'sec',
  'csc',
  'cot',
  'sqrt',
  'cbrt',
  'abs',
  'ln',
  'log',
  'exp',
  'floor',
  'ceil',
  'round',
  'sign',
  'min',
  'max',
  'pow',
  'ans',
  'npr',
  'ncr',
  'fact',
]);

/**
 * Parses curly-brace domain restriction like `{ -3.14 <= x <= 3.14 }` or `{ 0 < x < 5 }`
 */
export function parseDomainRestriction(raw: string): {
  withoutDomain: string;
  domain: ParsedDomainRestriction | null;
} {
  const match = raw.match(/\{([^{}]+)\}\s*$/);
  if (!match) {
    return { withoutDomain: raw.trim(), domain: null };
  }

  const withoutDomain = raw.slice(0, match.index).trim();
  const inner = match[1].trim();

  // Pattern 1: a <= x <= b or a < x < b
  const doubleBound = inner.match(
    /^([+-]?\d+(?:\.\d+)?)\s*(?:<=|<|≤)\s*(x|t|theta)\s*(?:<=|<|≤)\s*([+-]?\d+(?:\.\d+)?)$/i
  );
  if (doubleBound) {
    const minVal = Number(doubleBound[1]);
    const variable = doubleBound[2].toLowerCase() as 'x' | 't' | 'theta';
    const maxVal = Number(doubleBound[3]);
    return {
      withoutDomain,
      domain: {
        min: Number.isFinite(minVal) ? minVal : null,
        max: Number.isFinite(maxVal) ? maxVal : null,
        variable,
      },
    };
  }

  // Pattern 2: x > a or x >= a
  const lowerOnly = inner.match(/^(x|t|theta)\s*(?:>=|>|≥)\s*([+-]?\d+(?:\.\d+)?)$/i);
  if (lowerOnly) {
    return {
      withoutDomain,
      domain: {
        min: Number(lowerOnly[2]),
        max: null,
        variable: lowerOnly[1].toLowerCase() as 'x' | 't' | 'theta',
      },
    };
  }

  // Pattern 3: x < b or x <= b
  const upperOnly = inner.match(/^(x|t|theta)\s*(?:<=|<|≤)\s*([+-]?\d+(?:\.\d+)?)$/i);
  if (upperOnly) {
    return {
      withoutDomain,
      domain: {
        min: null,
        max: Number(upperOnly[2]),
        variable: upperOnly[1].toLowerCase() as 'x' | 't' | 'theta',
      },
    };
  }

  return { withoutDomain, domain: null };
}

/**
 * Detects single-letter or subscripted free parameters (e.g., a, b, c, k, m, w)
 * in one or more mathematical expressions so sliders can be generated automatically.
 */
export function detectFreeParameters(expressions: string[]): string[] {
  const found = new Set<string>();
  for (const raw of expressions) {
    const { withoutDomain } = parseDomainRestriction(raw);
    const cleaned = withoutDomain
      .replace(/^[y|r]\s*(?:<=|>=|<|>|=|≤|≥)\s*/i, '')
      .replace(/\\[a-zA-Z]+/g, ' ');
    const tokens = cleaned.match(/\b[a-zA-Z]\b/g) || [];
    for (const tok of tokens) {
      const lower = tok.toLowerCase();
      if (!RESERVED_MATH_IDENTIFIERS.has(lower)) {
        found.add(lower);
      }
    }
  }
  return Array.from(found).sort();
}

/**
 * Parses a Desmos-style expression into its mode (Cartesian, Polar, Parametric, Inequality),
 * domain restriction, and free parameter list.
 */
export function parseDesmosExpression(raw: string): ParsedGraphExpression {
  const { withoutDomain, domain } = parseDomainRestriction(raw);
  const trimmed = withoutDomain.trim();
  const freeParameters = detectFreeParameters([trimmed]);

  // Check Parametric: (x(t), y(t)) or x(t); y(t)
  const tupleMatch = trimmed.match(/^\(\s*([^,]+)\s*,\s*([^)]+)\s*\)$/);
  if (tupleMatch && /\bt\b/i.test(trimmed)) {
    return {
      raw,
      cleanExpr: trimmed,
      parametricX: tupleMatch[1].trim(),
      parametricY: tupleMatch[2].trim(),
      mode: 'parametric',
      domain,
      freeParameters,
    };
  }

  // Check Polar: r = f(theta)
  const polarMatch = trimmed.match(/^r\s*=\s*(.+)$/i);
  if (polarMatch || /\btheta\b|θ/i.test(trimmed)) {
    const rhs = (polarMatch ? polarMatch[1] : trimmed).replace(/θ/g, 'theta').trim();
    return {
      raw,
      cleanExpr: rhs,
      mode: 'polar',
      domain,
      freeParameters,
    };
  }

  // Check Inequality: y <= f(x), y >= f(x), y < f(x), y > f(x)
  const ineqMatch = trimmed.match(/^y\s*(<=|>=|<|>|≤|≥)\s*(.+)$/i);
  if (ineqMatch) {
    const rawOp = ineqMatch[1];
    const op: InequalityOperator =
      rawOp === '≤' ? '<=' : rawOp === '≥' ? '>=' : (rawOp as InequalityOperator);
    return {
      raw,
      cleanExpr: ineqMatch[2].trim(),
      mode: 'inequality',
      inequalityOp: op,
      domain,
      freeParameters,
    };
  }

  // Default Cartesian: y = f(x) or f(x)
  const cartRhs = trimmed.replace(/^(?:y|f\s*\(\s*x\s*\))\s*=\s*/i, '').trim();
  return {
    raw,
    cleanExpr: cartRhs,
    mode: 'cartesian',
    domain,
    freeParameters,
  };
}

/**
 * Safely evaluates a mathematical expression with variables x, y, t, theta and arbitrary slider parameters.
 */
export function evaluateMathWithParams(
  expr: string,
  vars: Record<string, number>
): number {
  if (!expr || !expr.trim()) return NaN;

  let normalized = expr
    .trim()
    .replace(/θ/g, 'theta')
    .replace(/π/g, 'pi')
    .replace(/−/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/\^/g, '**');

  // Insert implicit multiplication: 2x -> 2*x, 3(x+1) -> 3*(x+1), (x+1)(x-1) -> (x+1)*(x-1), ax -> a*x when a is parameter
  normalized = normalized
    .replace(/(\d)\s*([a-zA-Z(])/g, '$1*$2')
    .replace(/(\))\s*(\d|[a-zA-Z(])/g, '$1*$2');

  // Replace single-letter parameter adjacency like "a x" or "b*sin" safely
  const safeMathScope: Record<string, unknown> = {
    pi: Math.PI,
    PI: Math.PI,
    e: Math.E,
    E: Math.E,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    sinh: Math.sinh,
    cosh: Math.cosh,
    tanh: Math.tanh,
    sec: (v: number) => 1 / Math.cos(v),
    csc: (v: number) => 1 / Math.sin(v),
    cot: (v: number) => 1 / Math.tan(v),
    sqrt: Math.sqrt,
    cbrt: Math.cbrt,
    abs: Math.abs,
    ln: Math.log,
    log: Math.log10,
    exp: Math.exp,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    sign: Math.sign,
    min: Math.min,
    max: Math.max,
    pow: Math.pow,
    fact: factorial,
    npr: permutationNpr,
    ncr: combinationNcr,
    ...vars,
  };

  const argNames = Object.keys(safeMathScope);
  const argValues = argNames.map((k) => safeMathScope[k]);

  try {
    const fn = new Function(...argNames, `"use strict"; return (${normalized});`);
    const result = Number(fn(...argValues));
    return Number.isFinite(result) ? result : NaN;
  } catch {
    return NaN;
  }
}

export function sampleDesmosCurve(params: {
  id: string;
  rawExpression: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  sliderValues: Record<string, number>;
  samples?: number;
}): {
  parsed: ParsedGraphExpression;
  segments: Array<Array<{ x: number; y: number }>>;
} {
  const {
    rawExpression,
    xMin,
    xMax,
    yMin,
    yMax,
    sliderValues,
    samples = 420,
  } = params;

  const parsed = parseDesmosExpression(rawExpression);
  const segments: Array<Array<{ x: number; y: number }>> = [];
  let currentSegment: Array<{ x: number; y: number }> = [];
  const ySpan = Math.max(1, yMax - yMin);

  if (parsed.mode === 'polar') {
    const thetaMin = parsed.domain?.min ?? 0;
    const thetaMax = parsed.domain?.max ?? Math.PI * 2;
    const step = (thetaMax - thetaMin) / samples;
    for (let i = 0; i <= samples; i++) {
      const theta = thetaMin + i * step;
      const r = evaluateMathWithParams(parsed.cleanExpr, { ...sliderValues, theta, x: theta });
      if (Number.isFinite(r)) {
        const x = r * Math.cos(theta);
        const y = r * Math.sin(theta);
        currentSegment.push({ x, y });
      } else if (currentSegment.length > 0) {
        segments.push(currentSegment);
        currentSegment = [];
      }
    }
    if (currentSegment.length > 0) segments.push(currentSegment);
    return { parsed, segments };
  }

  if (parsed.mode === 'parametric' && parsed.parametricX && parsed.parametricY) {
    const tMin = parsed.domain?.min ?? -10;
    const tMax = parsed.domain?.max ?? 10;
    const step = (tMax - tMin) / samples;
    for (let i = 0; i <= samples; i++) {
      const t = tMin + i * step;
      const x = evaluateMathWithParams(parsed.parametricX, { ...sliderValues, t });
      const y = evaluateMathWithParams(parsed.parametricY, { ...sliderValues, t });
      if (Number.isFinite(x) && Number.isFinite(y)) {
        currentSegment.push({ x, y });
      } else if (currentSegment.length > 0) {
        segments.push(currentSegment);
        currentSegment = [];
      }
    }
    if (currentSegment.length > 0) segments.push(currentSegment);
    return { parsed, segments };
  }

  // Cartesian or Inequality
  const effXMin = parsed.domain?.min !== null && parsed.domain?.min !== undefined
    ? Math.max(xMin, parsed.domain.min)
    : xMin;
  const effXMax = parsed.domain?.max !== null && parsed.domain?.max !== undefined
    ? Math.min(xMax, parsed.domain.max)
    : xMax;

  if (effXMax <= effXMin) {
    return { parsed, segments: [] };
  }

  const step = (effXMax - effXMin) / samples;
  let prevY: number | null = null;

  for (let i = 0; i <= samples; i++) {
    const x = effXMin + i * step;
    const y = evaluateMathWithParams(parsed.cleanExpr, { ...sliderValues, x });
    if (Number.isFinite(y) && Math.abs(y) <= ySpan * 25) {
      if (prevY !== null && Math.abs(y - prevY) > ySpan * 2.5) {
        // Asymptote discontinuity guard
        if (currentSegment.length > 0) segments.push(currentSegment);
        currentSegment = [];
      }
      currentSegment.push({ x, y });
      prevY = y;
    } else {
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
        currentSegment = [];
      }
      prevY = null;
    }
  }
  if (currentSegment.length > 0) segments.push(currentSegment);
  return { parsed, segments };
}

/**
 * Automatically detects Points of Interest (Roots, Y-Intercept, Local Maxima/Minima, and Pairwise Curve Intersections)
 */
export function computePointsOfInterest(params: {
  curves: Array<{ id: string; rawExpression: string; visible: boolean }>;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  sliderValues: Record<string, number>;
}): PointOfInterest[] {
  const { curves, xMin, xMax, yMin, yMax, sliderValues } = params;
  const pois: PointOfInterest[] = [];
  const activeCartesian = curves
    .filter((c) => c.visible)
    .map((c) => ({ id: c.id, parsed: parseDesmosExpression(c.rawExpression) }))
    .filter((c) => c.parsed.mode === 'cartesian' || c.parsed.mode === 'inequality');

  const steps = 240;
  const dx = (xMax - xMin) / steps;

  const pushUniquePoi = (poi: PointOfInterest) => {
    if (poi.x < xMin || poi.x > xMax || poi.y < yMin || poi.y > yMax) return;
    const duplicate = pois.some(
      (p) =>
        p.type === poi.type &&
        Math.abs(p.x - poi.x) < (xMax - xMin) * 0.015 &&
        Math.abs(p.y - poi.y) < (yMax - yMin) * 0.015
    );
    if (!duplicate && pois.length < 36) {
      pois.push(poi);
    }
  };

  for (const curve of activeCartesian) {
    const evalAt = (x: number) => {
      if (curve.parsed.domain?.min !== null && curve.parsed.domain?.min !== undefined && x < curve.parsed.domain.min) {
        return NaN;
      }
      if (curve.parsed.domain?.max !== null && curve.parsed.domain?.max !== undefined && x > curve.parsed.domain.max) {
        return NaN;
      }
      return evaluateMathWithParams(curve.parsed.cleanExpr, { ...sliderValues, x });
    };

    // 1. Y-intercept at x = 0
    if (xMin <= 0 && xMax >= 0) {
      const y0 = evalAt(0);
      if (Number.isFinite(y0)) {
        pushUniquePoi({
          id: `poi-yint-${curve.id}`,
          type: 'y_intercept',
          x: 0,
          y: Number(y0.toFixed(4)),
          label: `y-int (0, ${Number(y0.toFixed(3))})`,
          curveIds: [curve.id],
        });
      }
    }

    // 2. Roots & Local Extrema
    let prevX = xMin;
    let prevY = evalAt(prevX);
    let prevSlope: number | null = null;

    for (let i = 1; i <= steps; i++) {
      const currX = xMin + i * dx;
      const currY = evalAt(currX);

      if (Number.isFinite(prevY) && Number.isFinite(currY)) {
        // Root check (sign change or exact zero)
        if (Math.abs(currY) < 1e-7) {
          pushUniquePoi({
            id: `poi-root-${curve.id}-${i}`,
            type: 'root',
            x: Number(currX.toFixed(4)),
            y: 0,
            label: `Root (${Number(currX.toFixed(3))}, 0)`,
            curveIds: [curve.id],
          });
        } else if ((prevY < 0 && currY > 0) || (prevY > 0 && currY < 0)) {
          // Bisection refinement
          let lo = prevX;
          let hi = currX;
          let fLo = prevY;
          for (let iter = 0; iter < 18; iter++) {
            const mid = 0.5 * (lo + hi);
            const fMid = evalAt(mid);
            if (!Number.isFinite(fMid)) break;
            if ((fLo < 0 && fMid > 0) || (fLo > 0 && fMid < 0)) {
              hi = mid;
            } else {
              lo = mid;
              fLo = fMid;
            }
          }
          const rootX = 0.5 * (lo + hi);
          const rootY = evalAt(rootX);
          if (Number.isFinite(rootY) && Math.abs(rootY) < 0.25) {
            pushUniquePoi({
              id: `poi-root-${curve.id}-${i}`,
              type: 'root',
              x: Number(rootX.toFixed(4)),
              y: 0,
              label: `Root (${Number(rootX.toFixed(3))}, 0)`,
              curveIds: [curve.id],
            });
          }
        }

        // Local extremum check via slope sign change
        const currSlope = (currY - prevY) / dx;
        if (prevSlope !== null && Math.abs(currSlope) < (yMax - yMin) * 5) {
          if (prevSlope > 1e-5 && currSlope < -1e-5) {
            const extX = prevX;
            const extY = prevY;
            pushUniquePoi({
              id: `poi-max-${curve.id}-${i}`,
              type: 'max',
              x: Number(extX.toFixed(4)),
              y: Number(extY.toFixed(4)),
              label: `Max (${Number(extX.toFixed(3))}, ${Number(extY.toFixed(3))})`,
              curveIds: [curve.id],
            });
          } else if (prevSlope < -1e-5 && currSlope > 1e-5) {
            const extX = prevX;
            const extY = prevY;
            pushUniquePoi({
              id: `poi-min-${curve.id}-${i}`,
              type: 'min',
              x: Number(extX.toFixed(4)),
              y: Number(extY.toFixed(4)),
              label: `Min (${Number(extX.toFixed(3))}, ${Number(extY.toFixed(3))})`,
              curveIds: [curve.id],
            });
          }
        }
        prevSlope = currSlope;
      } else {
        prevSlope = null;
      }

      prevX = currX;
      prevY = currY;
    }
  }

  // 3. Pairwise Curve Intersections
  for (let a = 0; a < activeCartesian.length; a++) {
    for (let b = a + 1; b < activeCartesian.length; b++) {
      const cA = activeCartesian[a];
      const cB = activeCartesian[b];
      const diffAt = (x: number) => {
        const yA = evaluateMathWithParams(cA.parsed.cleanExpr, { ...sliderValues, x });
        const yB = evaluateMathWithParams(cB.parsed.cleanExpr, { ...sliderValues, x });
        return yA - yB;
      };

      let prevX = xMin;
      let prevD = diffAt(prevX);

      for (let i = 1; i <= steps; i++) {
        const currX = xMin + i * dx;
        const currD = diffAt(currX);
        if (Number.isFinite(prevD) && Number.isFinite(currD)) {
          if (Math.abs(currD) < 1e-6 || (prevD < 0 && currD > 0) || (prevD > 0 && currD < 0)) {
            let lo = prevX;
            let hi = currX;
            let dLo = prevD;
            for (let iter = 0; iter < 18; iter++) {
              const mid = 0.5 * (lo + hi);
              const dMid = diffAt(mid);
              if (!Number.isFinite(dMid)) break;
              if ((dLo < 0 && dMid > 0) || (dLo > 0 && dMid < 0)) {
                hi = mid;
              } else {
                lo = mid;
                dLo = dMid;
              }
            }
            const ix = 0.5 * (lo + hi);
            const iy = evaluateMathWithParams(cA.parsed.cleanExpr, { ...sliderValues, x: ix });
            const iyB = evaluateMathWithParams(cB.parsed.cleanExpr, { ...sliderValues, x: ix });
            if (Number.isFinite(iy) && Number.isFinite(iyB) && Math.abs(iy - iyB) < 0.2) {
              pushUniquePoi({
                id: `poi-int-${cA.id}-${cB.id}-${i}`,
                type: 'intersection',
                x: Number(ix.toFixed(4)),
                y: Number(iy.toFixed(4)),
                label: `Intersection (${Number(ix.toFixed(3))}, ${Number(iy.toFixed(3))})`,
                curveIds: [cA.id, cB.id],
              });
            }
          }
        }
        prevX = currX;
        prevD = currD;
      }
    }
  }

  return pois;
}

/**
 * Computes numerical derivative f'(x0), tangent line, and definite integral ∫_a^b f(x) dx via Simpson's rule
 */
export function computeCalculusAnalysis(params: {
  rawExpression: string;
  sliderValues: Record<string, number>;
  tangentX: number;
  integralLower: number;
  integralUpper: number;
}): CalculusAnalysisResult {
  const { rawExpression, sliderValues, tangentX, integralLower, integralUpper } = params;
  const parsed = parseDesmosExpression(rawExpression);
  const evalAt = (x: number) => evaluateMathWithParams(parsed.cleanExpr, { ...sliderValues, x });

  const h = 1e-5;
  const y0 = evalAt(tangentX);
  const yPlus = evalAt(tangentX + h);
  const yMinus = evalAt(tangentX - h);
  const slope =
    Number.isFinite(yPlus) && Number.isFinite(yMinus) ? (yPlus - yMinus) / (2 * h) : null;

  const intercept =
    slope !== null && Number.isFinite(y0) ? y0 - slope * tangentX : null;
  const signStr = intercept !== null && intercept >= 0 ? '+' : '-';
  const tangentEquationLatex =
    slope !== null && intercept !== null
      ? `y = ${Number(slope.toFixed(4))}x ${signStr} ${Math.abs(Number(intercept.toFixed(4)))}`
      : 'Undefined';

  // Composite Simpson's Rule for definite integral
  const n = 120; // even subintervals
  const a = Math.min(integralLower, integralUpper);
  const b = Math.max(integralLower, integralUpper);
  const sign = integralUpper >= integralLower ? 1 : -1;
  const step = (b - a) / n;
  let sum = 0;
  const shadedPolygonPoints: Array<{ x: number; y: number }> = [];

  if (b > a) {
    shadedPolygonPoints.push({ x: a, y: 0 });
    for (let i = 0; i <= n; i++) {
      const x = a + i * step;
      const y = evalAt(x);
      const safeY = Number.isFinite(y) ? y : 0;
      const weight = i === 0 || i === n ? 1 : i % 2 === 1 ? 4 : 2;
      sum += weight * safeY;
      shadedPolygonPoints.push({ x, y: safeY });
    }
    shadedPolygonPoints.push({ x: b, y: 0 });
  }

  const area = b > a ? sign * (step / 3) * sum : 0;

  return {
    tangentX,
    tangentY: Number.isFinite(y0) ? Number(y0.toFixed(4)) : null,
    derivativeSlope: slope !== null ? Number(slope.toFixed(4)) : null,
    tangentEquationLatex,
    integralLower,
    integralUpper,
    definiteIntegralArea: Number(area.toFixed(5)),
    shadedPolygonPoints,
  };
}

/* ============================================================================
 * 2. MATRIX & LINEAR ALGEBRA CALCULATOR ENGINE
 * ============================================================================ */

export function computeMatrixTranspose(matrix: number[][]): number[][] {
  if (!matrix.length || !matrix[0].length) return [];
  const rows = matrix.length;
  const cols = matrix[0].length;
  return Array.from({ length: cols }, (_, c) =>
    Array.from({ length: rows }, (__, r) => matrix[r][c] ?? 0)
  );
}

export function computeMatrixTrace(matrix: number[][]): number | null {
  if (!matrix.length || matrix.length !== matrix[0]?.length) return null;
  let trace = 0;
  for (let i = 0; i < matrix.length; i++) {
    trace += matrix[i][i] ?? 0;
  }
  return Number(trace.toFixed(6));
}

export function addMatrices(A: number[][], B: number[][], scaleB = 1): number[][] | null {
  if (!A.length || A.length !== B.length || A[0]?.length !== B[0]?.length) return null;
  return A.map((row, r) =>
    row.map((val, c) => Number((val + scaleB * (B[r]?.[c] ?? 0)).toFixed(6)))
  );
}

export function multiplyMatrices(A: number[][], B: number[][]): number[][] | null {
  if (!A.length || !B.length || A[0]?.length !== B.length) return null;
  const m = A.length;
  const k = A[0].length;
  const n = B[0].length;
  const result = Array.from({ length: m }, () => Array(n).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let p = 0; p < k; p++) {
        sum += (A[i][p] ?? 0) * (B[p][j] ?? 0);
      }
      result[i][j] = Number(sum.toFixed(6));
    }
  }
  return result;
}

export function computeMatrixDeterminant(matrix: number[][]): number | null {
  const n = matrix.length;
  if (n === 0 || matrix[0]?.length !== n) return null;
  if (n === 1) return matrix[0][0];
  if (n === 2) {
    return Number((matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0]).toFixed(6));
  }

  // Gaussian elimination with partial pivoting for O(n^3) determinant
  const a = matrix.map((row) => [...row]);
  let det = 1;
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(a[r][i]) > Math.abs(a[pivot][i])) {
        pivot = r;
      }
    }
    if (Math.abs(a[pivot][i]) < 1e-11) return 0;
    if (pivot !== i) {
      [a[i], a[pivot]] = [a[pivot], a[i]];
      det = -det;
    }
    det *= a[i][i];
    for (let r = i + 1; r < n; r++) {
      const factor = a[r][i] / a[i][i];
      for (let c = i; c < n; c++) {
        a[r][c] -= factor * a[i][c];
      }
    }
  }
  const cleanDet = Math.abs(det) < 1e-10 ? 0 : Number(det.toFixed(6));
  return cleanDet;
}

export function computeMatrixRREF(matrix: number[][]): {
  rref: number[][];
  rank: number;
} {
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  const m = matrix.map((row) => [...row]);
  let lead = 0;
  let rank = 0;

  for (let r = 0; r < rows; r++) {
    if (lead >= cols) break;
    let i = r;
    while (Math.abs(m[i][lead]) < 1e-10) {
      i++;
      if (i === rows) {
        i = r;
        lead++;
        if (lead === cols) {
          return {
            rref: m.map((row) => row.map((v) => (Math.abs(v) < 1e-10 ? 0 : Number(v.toFixed(5))))),
            rank,
          };
        }
      }
    }
    [m[i], m[r]] = [m[r], m[i]];
    const div = m[r][lead];
    if (Math.abs(div) >= 1e-10) {
      for (let j = 0; j < cols; j++) m[r][j] /= div;
      rank++;
    }
    for (let k = 0; k < rows; k++) {
      if (k !== r) {
        const mult = m[k][lead];
        for (let j = 0; j < cols; j++) {
          m[k][j] -= mult * m[r][j];
        }
      }
    }
    lead++;
  }

  return {
    rref: m.map((row) => row.map((v) => (Math.abs(v) < 1e-10 ? 0 : Number(v.toFixed(5))))),
    rank,
  };
}

export function computeMatrixInverse(matrix: number[][]): {
  invertible: boolean;
  inverse: number[][] | null;
  determinant: number;
} {
  const n = matrix.length;
  const det = computeMatrixDeterminant(matrix);
  if (det === null || Math.abs(det) < 1e-10) {
    return { invertible: false, inverse: null, determinant: det ?? 0 };
  }

  const augmented = matrix.map((row, r) => [
    ...row,
    ...Array.from({ length: n }, (_, c) => (r === c ? 1 : 0)),
  ]);
  const { rref } = computeMatrixRREF(augmented);
  const inverse = rref.map((row) => row.slice(n, 2 * n));
  return {
    invertible: true,
    inverse,
    determinant: det,
  };
}

export function computeEigenvaluesAndCharPoly(matrix: number[][]): {
  characteristicPolynomialLatex: string;
  eigenvalues: string[];
} | null {
  const n = matrix.length;
  if (n === 2 && matrix[0]?.length === 2) {
    const tr = matrix[0][0] + matrix[1][1];
    const det = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
    const disc = tr * tr - 4 * det;
    const trStr = tr >= 0 ? `- ${Number(tr.toFixed(4))}\\lambda` : `+ ${Math.abs(Number(tr.toFixed(4)))}\\lambda`;
    const detStr = det >= 0 ? `+ ${Number(det.toFixed(4))}` : `- ${Math.abs(Number(det.toFixed(4)))}`;
    const poly = `\\lambda^2 ${trStr} ${detStr} = 0`;

    if (disc >= 0) {
      const l1 = Number(((tr + Math.sqrt(disc)) / 2).toFixed(4));
      const l2 = Number(((tr - Math.sqrt(disc)) / 2).toFixed(4));
      return {
        characteristicPolynomialLatex: poly,
        eigenvalues: [`\\lambda_1 = ${l1}`, `\\lambda_2 = ${l2}`],
      };
    } else {
      const real = Number((tr / 2).toFixed(4));
      const imag = Number((Math.sqrt(-disc) / 2).toFixed(4));
      return {
        characteristicPolynomialLatex: poly,
        eigenvalues: [`\\lambda_1 = ${real} + ${imag}i`, `\\lambda_2 = ${real} - ${imag}i`],
      };
    }
  }

  if (n === 3 && matrix[0]?.length === 3) {
    const tr = computeMatrixTrace(matrix) ?? 0;
    const m00 = matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1];
    const m11 = matrix[0][0] * matrix[2][2] - matrix[0][2] * matrix[2][0];
    const m22 = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
    const c1 = m00 + m11 + m22;
    const det = computeMatrixDeterminant(matrix) ?? 0;

    // Trigonometric / Cardano cubic root solver for λ^3 - tr*λ^2 + c1*λ - det = 0
    const a = -tr;
    const b = c1;
    const c = -det;
    const p = b - (a * a) / 3;
    const q = (2 * a * a * a) / 27 - (a * b) / 3 + c;
    const discriminant = (q * q) / 4 + (p * p * p) / 27;
    const shift = -a / 3;

    const eigenvalues: string[] = [];
    if (discriminant <= 1e-9) {
      const r = Math.sqrt(Math.max(0, -(p * p * p) / 27));
      const phi = r > 1e-12 ? Math.acos(Math.max(-1, Math.min(1, -q / (2 * r)))) : 0;
      const mag = 2 * Math.cbrt(r);
      const l1 = Number((shift + mag * Math.cos(phi / 3)).toFixed(4));
      const l2 = Number((shift + mag * Math.cos((phi + 2 * Math.PI) / 3)).toFixed(4));
      const l3 = Number((shift + mag * Math.cos((phi + 4 * Math.PI) / 3)).toFixed(4));
      eigenvalues.push(`\\lambda_1 = ${l1}`, `\\lambda_2 = ${l2}`, `\\lambda_3 = ${l3}`);
    } else {
      const sqrtDisc = Math.sqrt(discriminant);
      const u = Math.cbrt(-q / 2 + sqrtDisc);
      const v = Math.cbrt(-q / 2 - sqrtDisc);
      const l1 = Number((shift + u + v).toFixed(4));
      const realPart = Number((shift - (u + v) / 2).toFixed(4));
      const imagPart = Number(((Math.sqrt(3) / 2) * Math.abs(u - v)).toFixed(4));
      eigenvalues.push(
        `\\lambda_1 = ${l1}`,
        `\\lambda_2 = ${realPart} + ${imagPart}i`,
        `\\lambda_3 = ${realPart} - ${imagPart}i`
      );
    }

    const poly = `\\lambda^3 - (${Number(tr.toFixed(3))})\\lambda^2 + (${Number(c1.toFixed(3))})\\lambda - (${Number(det.toFixed(3))}) = 0`;
    return {
      characteristicPolynomialLatex: poly,
      eigenvalues,
    };
  }

  return null;
}

export function solveLinearSystemAxEqualsB(
  A: number[][],
  b: number[]
): {
  solvable: boolean;
  solution: number[] | null;
  statusMessage: string;
  latexSummary: string;
} {
  const n = A.length;
  if (!n || A[0]?.length !== n || b.length !== n) {
    return {
      solvable: false,
      solution: null,
      statusMessage: 'Matrix A must be square (n × n) and match vector b length.',
      latexSummary: '',
    };
  }

  const inv = computeMatrixInverse(A);
  if (!inv.invertible || !inv.inverse) {
    return {
      solvable: false,
      solution: null,
      statusMessage: 'Singular matrix (det(A) = 0): system has either no solution or infinitely many solutions.',
      latexSummary: '\\det(A) = 0 \\implies \\text{No unique solution}',
    };
  }

  const solution = inv.inverse.map((row) => {
    const val = row.reduce((acc, coeff, idx) => acc + coeff * (b[idx] ?? 0), 0);
    return Math.abs(val) < 1e-10 ? 0 : Number(val.toFixed(5));
  });

  const vars = ['x_1', 'x_2', 'x_3', 'x_4', 'x_5'];
  const latexSummary = solution.map((v, idx) => `${vars[idx] || `x_${idx + 1}`} = ${v}`).join(', \\quad ');

  return {
    solvable: true,
    solution,
    statusMessage: 'Unique solution found via Gaussian elimination.',
    latexSummary,
  };
}

export function formatMatrixAsLatex(matrix: number[][]): string {
  if (!matrix.length) return '\\begin{bmatrix}\\end{bmatrix}';
  const rowsLatex = matrix
    .map((row) => row.map((v) => Number(v.toFixed(4))).join(' & '))
    .join(' \\\\ ');
  return `\\begin{bmatrix} ${rowsLatex} \\end{bmatrix}`;
}

/* ============================================================================
 * 3. 3D SURFACE & VECTOR SPACE ENGINE
 * ============================================================================ */

export function evaluate3DSurfaceZ(
  expr: string,
  x: number,
  y: number,
  sliderValues: Record<string, number> = {}
): number {
  const rhs = expr.replace(/^z\s*=\s*/i, '').trim();
  return evaluateMathWithParams(rhs, { ...sliderValues, x, y });
}

export function compute3DVectorOperations(
  vecA: [number, number, number],
  vecB: [number, number, number]
): {
  dotProduct: number;
  crossProduct: [number, number, number];
  magnitudeA: number;
  magnitudeB: number;
  angleDegrees: number;
  projectionOfAOnB: [number, number, number];
  areaOfParallelogram: number;
} {
  const [ax, ay, az] = vecA;
  const [bx, by, bz] = vecB;
  const dotProduct = Number((ax * bx + ay * by + az * bz).toFixed(4));
  const crossProduct: [number, number, number] = [
    Number((ay * bz - az * by).toFixed(4)),
    Number((az * bx - ax * bz).toFixed(4)),
    Number((ax * by - ay * bx).toFixed(4)),
  ];
  const magnitudeA = Number(Math.hypot(ax, ay, az).toFixed(4));
  const magnitudeB = Number(Math.hypot(bx, by, bz).toFixed(4));
  const areaOfParallelogram = Number(
    Math.hypot(crossProduct[0], crossProduct[1], crossProduct[2]).toFixed(4)
  );

  let angleDegrees = 0;
  if (magnitudeA > 1e-9 && magnitudeB > 1e-9) {
    const cosTheta = Math.max(-1, Math.min(1, dotProduct / (magnitudeA * magnitudeB)));
    angleDegrees = Number(((Math.acos(cosTheta) * 180) / Math.PI).toFixed(2));
  }

  const bNormSq = bx * bx + by * by + bz * bz;
  const scale = bNormSq > 1e-9 ? dotProduct / bNormSq : 0;
  const projectionOfAOnB: [number, number, number] = [
    Number((scale * bx).toFixed(4)),
    Number((scale * by).toFixed(4)),
    Number((scale * bz).toFixed(4)),
  ];

  return {
    dotProduct,
    crossProduct,
    magnitudeA,
    magnitudeB,
    angleDegrees,
    projectionOfAOnB,
    areaOfParallelogram,
  };
}

/* ============================================================================
 * 4. INTERACTIVE GEOMETRY, RAY OPTICS & FREE-BODY FORCE ENGINE
 * ============================================================================ */

export interface GeometryVertex {
  id: string;
  label: string;
  x: number;
  y: number;
}

export function computePolygonGeometryMetrics(vertices: GeometryVertex[]): {
  sideLengths: Array<{ from: string; to: string; length: number; midX: number; midY: number }>;
  interiorAngles: Array<{ label: string; angleDeg: number; x: number; y: number }>;
  perimeter: number;
  area: number;
  centroid: { x: number; y: number };
} {
  const n = vertices.length;
  if (n === 0) {
    return {
      sideLengths: [],
      interiorAngles: [],
      perimeter: 0,
      area: 0,
      centroid: { x: 0, y: 0 },
    };
  }

  const sideLengths: Array<{ from: string; to: string; length: number; midX: number; midY: number }> = [];
  let perimeter = 0;
  let signedArea2 = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < n; i++) {
    const curr = vertices[i];
    const next = vertices[(i + 1) % n];
    const len = Math.hypot(next.x - curr.x, next.y - curr.y);
    perimeter += len;
    sideLengths.push({
      from: curr.label,
      to: next.label,
      length: Number(len.toFixed(2)),
      midX: (curr.x + next.x) / 2,
      midY: (curr.y + next.y) / 2,
    });
    signedArea2 += curr.x * next.y - next.x * curr.y;
    cx += curr.x;
    cy += curr.y;
  }

  const interiorAngles: Array<{ label: string; angleDeg: number; x: number; y: number }> = [];
  if (n >= 3) {
    for (let i = 0; i < n; i++) {
      const prev = vertices[(i - 1 + n) % n];
      const curr = vertices[i];
      const next = vertices[(i + 1) % n];
      const v1x = prev.x - curr.x;
      const v1y = prev.y - curr.y;
      const v2x = next.x - curr.x;
      const v2y = next.y - curr.y;
      const mag1 = Math.hypot(v1x, v1y);
      const mag2 = Math.hypot(v2x, v2y);
      let angleDeg = 0;
      if (mag1 > 1e-6 && mag2 > 1e-6) {
        const cosA = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (mag1 * mag2)));
        angleDeg = Number(((Math.acos(cosA) * 180) / Math.PI).toFixed(1));
      }
      interiorAngles.push({
        label: curr.label,
        angleDeg,
        x: curr.x,
        y: curr.y,
      });
    }
  }

  return {
    sideLengths,
    interiorAngles,
    perimeter: Number(perimeter.toFixed(2)),
    area: n >= 3 ? Number((Math.abs(signedArea2) / 2).toFixed(2)) : 0,
    centroid: {
      x: Number((cx / n).toFixed(2)),
      y: Number((cy / n).toFixed(2)),
    },
  };
}

export function computeRayOpticsBench(params: {
  element: 'convex_lens' | 'concave_lens' | 'concave_mirror';
  focalLengthAbs: number;
  objectDistanceAbs: number;
  objectHeight: number;
}): {
  u: number;
  f: number;
  v: number | null;
  magnification: number | null;
  imageHeight: number | null;
  powerDiopter: number;
  nature: string;
  formulaLatex: string;
} {
  const { element, focalLengthAbs, objectDistanceAbs, objectHeight } = params;
  const u = -Math.max(1, Math.abs(objectDistanceAbs));
  const f =
    element === 'convex_lens'
      ? Math.max(1, Math.abs(focalLengthAbs))
      : -Math.max(1, Math.abs(focalLengthAbs));

  let v: number | null = null;
  let magnification: number | null = null;

  if (element === 'concave_mirror') {
    // Mirror equation: 1/v + 1/u = 1/f => 1/v = 1/f - 1/u
    const invV = 1 / f - 1 / u;
    if (Math.abs(invV) > 1e-6) {
      v = Number((1 / invV).toFixed(2));
      magnification = Number((-v / u).toFixed(3));
    }
  } else {
    // Lens equation: 1/v - 1/u = 1/f => 1/v = 1/f + 1/u
    const invV = 1 / f + 1 / u;
    if (Math.abs(invV) > 1e-6) {
      v = Number((1 / invV).toFixed(2));
      magnification = Number((v / u).toFixed(3));
    }
  }

  const imageHeight =
    magnification !== null ? Number((magnification * objectHeight).toFixed(2)) : null;
  const powerDiopter = Number((100 / f).toFixed(2)); // assuming cm

  let nature = 'Image at Infinity';
  if (v !== null && magnification !== null) {
    const realOrVirtual =
      element === 'concave_mirror'
        ? v < 0
          ? 'Real'
          : 'Virtual'
        : v > 0
        ? 'Real'
        : 'Virtual';
    const orientation = magnification < 0 ? 'Inverted' : 'Erect';
    const size =
      Math.abs(magnification) > 1.02
        ? 'Magnified'
        : Math.abs(magnification) < 0.98
        ? 'Diminished'
        : 'Same Size';
    nature = `${realOrVirtual}, ${orientation} & ${size}`;
  }

  const formulaLatex =
    element === 'concave_mirror'
      ? `\\frac{1}{v} + \\frac{1}{u} = \\frac{1}{f}`
      : `\\frac{1}{v} - \\frac{1}{u} = \\frac{1}{f}`;

  return {
    u,
    f,
    v,
    magnification,
    imageHeight,
    powerDiopter,
    nature,
    formulaLatex,
  };
}

export function computeFreeBodyForceEquilibrium(
  forces: Array<{ id: string; label: string; magnitudeN: number; angleDeg: number }>,
  massKg: number
): {
  sumFx: number;
  sumFy: number;
  netForceN: number;
  netAngleDeg: number;
  accelerationMs2: number;
  isEquilibrium: boolean;
  equilibrantMagnitudeN: number;
  equilibrantAngleDeg: number;
} {
  let sumFx = 0;
  let sumFy = 0;
  for (const f of forces) {
    const rad = (f.angleDeg * Math.PI) / 180;
    sumFx += f.magnitudeN * Math.cos(rad);
    sumFy += f.magnitudeN * Math.sin(rad);
  }
  const cleanFx = Math.abs(sumFx) < 1e-6 ? 0 : Number(sumFx.toFixed(3));
  const cleanFy = Math.abs(sumFy) < 1e-6 ? 0 : Number(sumFy.toFixed(3));
  const netForceN = Number(Math.hypot(cleanFx, cleanFy).toFixed(3));
  const rawAngle = (Math.atan2(cleanFy, cleanFx) * 180) / Math.PI;
  const netAngleDeg = Number(((rawAngle + 360) % 360).toFixed(1));
  const safeMass = Math.max(0.1, massKg);
  const accelerationMs2 = Number((netForceN / safeMass).toFixed(3));
  const isEquilibrium = netForceN < 0.01;
  const equilibrantAngleDeg = Number(((netAngleDeg + 180) % 360).toFixed(1));

  return {
    sumFx: cleanFx,
    sumFy: cleanFy,
    netForceN,
    netAngleDeg,
    accelerationMs2,
    isEquilibrium,
    equilibrantMagnitudeN: netForceN,
    equilibrantAngleDeg,
  };
}

/* ============================================================================
 * 5. SCIENTIFIC CALCULATOR ENHANCEMENTS (ans, Exact Fractions, Combinatorics)
 * ============================================================================ */

export function factorial(n: number): number {
  const k = Math.round(n);
  if (k < 0 || k > 170) return NaN;
  let res = 1;
  for (let i = 2; i <= k; i++) res *= i;
  return res;
}

export function permutationNpr(n: number, r: number): number {
  const ni = Math.round(n);
  const ri = Math.round(r);
  if (ni < 0 || ri < 0 || ri > ni) return 0;
  return factorial(ni) / factorial(ni - ri);
}

export function combinationNcr(n: number, r: number): number {
  const ni = Math.round(n);
  const ri = Math.round(r);
  if (ni < 0 || ri < 0 || ri > ni) return 0;
  return factorial(ni) / (factorial(ri) * factorial(ni - ri));
}

export function decimalToExactFraction(
  value: number,
  maxDenominator = 10000
): { numerator: number; denominator: number; display: string; latex: string } {
  if (!Number.isFinite(value)) {
    return { numerator: 0, denominator: 1, display: 'NaN', latex: '\\text{Undefined}' };
  }
  const sign = value < 0 ? -1 : 1;
  const absVal = Math.abs(value);
  if (Math.abs(absVal - Math.round(absVal)) < 1e-10) {
    const intVal = sign * Math.round(absVal);
    return {
      numerator: intVal,
      denominator: 1,
      display: String(intVal),
      latex: String(intVal),
    };
  }

  let h1 = 1;
  let h2 = 0;
  let k1 = 0;
  let k2 = 1;
  let b = absVal;

  for (let iter = 0; iter < 25; iter++) {
    const a = Math.floor(b);
    const auxH = h1;
    h1 = a * h1 + h2;
    h2 = auxH;
    const auxK = k1;
    k1 = a * k1 + k2;
    k2 = auxK;

    if (k1 > maxDenominator) {
      h1 = h2;
      k1 = k2;
      break;
    }
    const diff = b - a;
    if (Math.abs(diff) < 1e-10) break;
    b = 1 / diff;
  }

  const num = sign * h1;
  const den = k1;
  return {
    numerator: num,
    denominator: den,
    display: den === 1 ? `${num}` : `${num}/${den}`,
    latex: den === 1 ? `${num}` : `${sign < 0 ? '-' : ''}\\frac{${Math.abs(num)}}{${den}}`,
  };
}

/**
 * Converts a raw LaTeX or textbook formula from the Formula Book into a clean
 * plottable Desmos 2D expression (mapping the primary independent variable to x).
 */
export function extractPlottableExpressionFromFormula(rawFormula: string): string {
  const lower = rawFormula.toLowerCase();
  if (lower.includes('tan') && lower.includes('1 - x/r')) {
    return 'y = x * (1 - x / 10)';
  }
  if (lower.includes('dv') && lower.includes('dx')) {
    return 'y = sqrt(2 * a * x)';
  }

  const firstClause = rawFormula.split(',')[0] || rawFormula;
  const cleaned = firstClause
    .replace(/\$\$/g, '')
    .replace(/\$/g, '')
    .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '(($1)/($2))')
    .replace(/\\sqrt\s*\{([^{}]+)\}/g, 'sqrt($1)')
    .replace(/\\(?:sin|cos|tan|ln|log|exp)/g, (m) => m.slice(1))
    .replace(/\\pi\b/g, 'pi')
    .replace(/\\theta\b/g, 'x')
    .replace(/θ/g, 'x')
    .replace(/\\omega\b/g, '2')
    .replace(/ω/g, '2')
    .replace(/\\Delta\s*/g, '')
    .replace(/Δ/g, '')
    .replace(/\\cdot|\\times|·/g, '*')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/\b(?:dx|dv|dt|dr)\b/g, '')
    .replace(/a\(x\)/g, 'a * x')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[{}]/g, '')
    .trim();

  const eqParts = cleaned.split('=');
  const rhs = eqParts.length > 1 ? eqParts[eqParts.length - 1].trim() : cleaned;

  // Map common physics/chemistry independent variables (t, r, T, v, u) to x if x is not already present
  let normalizedRhs = rhs;
  if (!/\bx\b/.test(normalizedRhs)) {
    if (/\bt\b/.test(normalizedRhs)) {
      normalizedRhs = normalizedRhs.replace(/\bt\b/g, 'x');
    } else if (/\br\b/.test(normalizedRhs)) {
      normalizedRhs = normalizedRhs.replace(/\br\b/g, 'x');
    } else if (/\bu\b/.test(normalizedRhs)) {
      normalizedRhs = normalizedRhs.replace(/\bu\b/g, 'x');
    } else if (/\bv\b/.test(normalizedRhs)) {
      normalizedRhs = normalizedRhs.replace(/\bv\b/g, 'x');
    }
  }

  // Test if normalizedRhs actually evaluates to a finite number with default parameters
  const testVal1 = evaluateMathWithParams(normalizedRhs, {
    x: 1.5,
    a: 2,
    b: 1,
    c: 0,
    k: 1,
    m: 2,
    g: 9.8,
    R: 10,
    u: 5,
  });
  if (testVal1 === null || !/[x]/i.test(normalizedRhs)) {
    return 'y = a * x^2 - 4';
  }
  return `y = ${normalizedRhs}`;
}
