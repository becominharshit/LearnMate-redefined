import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDomainRestriction,
  detectFreeParameters,
  parseDesmosExpression,
  computePointsOfInterest,
  computeCalculusAnalysis,
  computeMatrixDeterminant,
  computeMatrixInverse,
  computeMatrixRREF,
  multiplyMatrices,
  computeEigenvaluesAndCharPoly,
  solveLinearSystemAxEqualsB,
  compute3DVectorOperations,
  computePolygonGeometryMetrics,
  computeRayOpticsBench,
  computeFreeBodyForceEquilibrium,
  decimalToExactFraction,
  combinationNcr,
  permutationNpr,
  extractPlottableExpressionFromFormula,
} from './desmosStudyToolsEngine';

test('Desmos 2D parser handles domain restrictions, inequalities, polar, and free parameters', () => {
  const dom = parseDomainRestriction('y = a * sin(b * x) {-3.14 <= x <= 3.14}');
  assert.equal(dom.withoutDomain, 'y = a * sin(b * x)');
  assert.equal(dom.domain?.min, -3.14);
  assert.equal(dom.domain?.max, 3.14);

  const params = detectFreeParameters(['y = a * x^2 + b * x + c', 'r = k * theta']);
  assert.deepEqual(params, ['a', 'b', 'c', 'k']);

  const ineq = parseDesmosExpression('y <= 2*x + 3 {0 < x < 5}');
  assert.equal(ineq.mode, 'inequality');
  assert.equal(ineq.inequalityOp, '<=');
  assert.equal(ineq.domain?.min, 0);
  assert.equal(ineq.domain?.max, 5);

  const polar = parseDesmosExpression('r = 2 * cos(3 * theta)');
  assert.equal(polar.mode, 'polar');
});

test('Desmos POI solver finds roots, extrema, y-intercept, and curve intersections', () => {
  const pois = computePointsOfInterest({
    curves: [
      { id: 'c1', rawExpression: 'y = x^2 - 4', visible: true },
      { id: 'c2', rawExpression: 'y = 2*x - 1', visible: true },
    ],
    xMin: -5,
    xMax: 5,
    yMin: -6,
    yMax: 10,
    sliderValues: {},
  });

  const roots = pois.filter((p) => p.type === 'root' && p.curveIds.includes('c1'));
  assert.ok(roots.some((r) => Math.abs(r.x - 2) < 0.05));
  assert.ok(roots.some((r) => Math.abs(r.x + 2) < 0.05));

  const mins = pois.filter((p) => p.type === 'min' && p.curveIds.includes('c1'));
  assert.ok(mins.some((m) => Math.abs(m.x) < 0.1 && Math.abs(m.y + 4) < 0.1));

  const intersections = pois.filter((p) => p.type === 'intersection');
  // x^2 - 4 = 2x - 1 => x^2 - 2x - 3 = 0 => (x - 3)(x + 1) = 0 => x = 3, y = 5 and x = -1, y = -3
  assert.ok(intersections.some((pt) => Math.abs(pt.x - 3) < 0.05 && Math.abs(pt.y - 5) < 0.1));
  assert.ok(intersections.some((pt) => Math.abs(pt.x + 1) < 0.05 && Math.abs(pt.y + 3) < 0.1));
});

test('Calculus analysis computes accurate tangent slope and Simpson definite integral', () => {
  const calc = computeCalculusAnalysis({
    rawExpression: 'y = x^2',
    sliderValues: {},
    tangentX: 3,
    integralLower: 0,
    integralUpper: 3,
  });

  // f'(3) = 6, ∫_0^3 x^2 dx = 9
  assert.ok(calc.derivativeSlope !== null && Math.abs(calc.derivativeSlope - 6) < 0.001);
  assert.ok(Math.abs(calc.definiteIntegralArea - 9) < 0.001);
});

test('Matrix calculator computes determinant, inverse, RREF, eigenvalues, and Ax = b', () => {
  const A = [
    [2, 1],
    [5, 3],
  ];
  assert.equal(computeMatrixDeterminant(A), 1);

  const inv = computeMatrixInverse(A);
  assert.equal(inv.invertible, true);
  assert.deepEqual(inv.inverse, [
    [3, -1],
    [-5, 2],
  ]);

  const prod = multiplyMatrices(A, inv.inverse!);
  assert.deepEqual(prod, [
    [1, 0],
    [0, 1],
  ]);

  const rrefRes = computeMatrixRREF(A);
  assert.equal(rrefRes.rank, 2);

  const eig = computeEigenvaluesAndCharPoly([
    [4, 1],
    [2, 3],
  ]);
  // trace = 7, det = 10 => (λ - 5)(λ - 2) = 0
  assert.ok(eig !== null);
  assert.ok(eig.eigenvalues.some((s) => s.includes('5')));
  assert.ok(eig.eigenvalues.some((s) => s.includes('2')));

  const sys = solveLinearSystemAxEqualsB(A, [4, 11]);
  // 2x + y = 4, 5x + 3y = 11 => x = 1, y = 2
  assert.equal(sys.solvable, true);
  assert.deepEqual(sys.solution, [1, 2]);
});

test('3D vector operations, geometry polygon metrics, ray optics, and force equilibrium work accurately', () => {
  const vec = compute3DVectorOperations([1, 0, 0], [0, 1, 0]);
  assert.equal(vec.dotProduct, 0);
  assert.deepEqual(vec.crossProduct, [0, 0, 1]);
  assert.equal(vec.angleDegrees, 90);

  const tri = computePolygonGeometryMetrics([
    { id: 'A', label: 'A', x: 0, y: 0 },
    { id: 'B', label: 'B', x: 4, y: 0 },
    { id: 'C', label: 'C', x: 0, y: 3 },
  ]);
  assert.equal(tri.perimeter, 12);
  assert.equal(tri.area, 6);

  const optics = computeRayOpticsBench({
    element: 'convex_lens',
    focalLengthAbs: 20,
    objectDistanceAbs: 30,
    objectHeight: 4,
  });
  // 1/v = 1/20 + 1/(-30) = 1/60 => v = 60, m = 60/(-30) = -2
  assert.equal(optics.v, 60);
  assert.equal(optics.magnification, -2);
  assert.equal(optics.imageHeight, -8);

  const fbd = computeFreeBodyForceEquilibrium(
    [
      { id: 'f1', label: 'F1', magnitudeN: 10, angleDeg: 0 },
      { id: 'f2', label: 'F2', magnitudeN: 10, angleDeg: 180 },
    ],
    2
  );
  assert.equal(fbd.isEquilibrium, true);
  assert.equal(fbd.netForceN, 0);

  const frac = decimalToExactFraction(0.75);
  assert.equal(frac.display, '3/4');
  assert.equal(combinationNcr(5, 2), 10);
  assert.equal(permutationNpr(5, 2), 20);

  const plotted = extractPlottableExpressionFromFormula('$K = \\frac{1}{2} m v^2$');
  assert.ok(plotted.startsWith('y ='));
});
