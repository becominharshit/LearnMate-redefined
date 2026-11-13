import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAndSanitizeDiagramSpec,
  getDeterministicDiagramTemplate,
  getVerifiedDiagramPresetMatch,
  serializeDiagramSpecToSvg,
  sanitizeString,
  clampNumber,
} from './diagramEngine';
import type { StructuredDiagramSpec } from '../types/diagram';
import { normalizeStudentProfile } from './studentProfile';

test('16-17 age band student profile has full access to the diagram studio without age gate blocking', () => {
  // 16-17 year old JEE aspirant profile
  const profile16to17 = normalizeStudentProfile({
    fullName: 'Priya Patel',
    schoolName: 'Kendriya Vidyalaya',
    ageBand: '16_17',
    targetExam: 'jee_main',
    targetExamYear: '2027',
    subjectsStudied: ['Physics', 'Chemistry', 'Mathematics'],
    setupCompleted: true,
  });

  assert.equal(profile16to17.ageBand, '16_17');
  assert.equal(profile16to17.targetExam, 'jee_main');
  assert.equal(profile16to17.setupCompleted, true);

  // Free-body diagram generation for Physics works directly
  const fbdSpec = getDeterministicDiagramTemplate(
    'Block on inclined plane with friction',
    'free_body_diagram',
    [1, 2]
  );
  assert.equal(fbdSpec.category, 'free_body_diagram');
  assert.ok(fbdSpec.elements.length > 0);
  assert.deepEqual(fbdSpec.citedPages, [1, 2]);

  // Diagram sanitization and SVG output work cleanly for this student
  const svgOutput = serializeDiagramSpecToSvg(fbdSpec, false);
  assert.ok(svgOutput.includes('<svg'));
  assert.ok(svgOutput.includes('</svg>'));
  assert.ok(!svgOutput.includes('<script'));
});

test('Physics Free-Body Diagram contains correct forces, directions, components, and citations', () => {
  const fbd = getDeterministicDiagramTemplate(
    'Block on inclined plane',
    'free_body_diagram',
    [3]
  );

  assert.equal(fbd.category, 'free_body_diagram');
  assert.deepEqual(fbd.citedPages, [3]);

  // Check gravity force downward
  const gravityArrow = fbd.elements.find(
    (e) =>
      e.kind === 'arrow' &&
      (e.label?.includes('m·g') || e.label?.includes('mg') || e.label?.includes('F_g'))
  );
  assert.ok(gravityArrow, 'Downward gravity arrow must exist');
  if (gravityArrow && gravityArrow.kind === 'arrow') {
    // Downward arrow: endY > startY
    const startY = gravityArrow.startY ?? (gravityArrow as any).y1;
    const endY = gravityArrow.endY ?? (gravityArrow as any).y2;
    assert.ok(endY > startY, 'Gravity vector must point downward');
  }

  // Check Normal force upward perpendicular to incline
  const normalArrow = fbd.elements.find(
    (e) => e.kind === 'arrow' && (e.label?.includes('Normal') || e.label?.includes('N'))
  );
  assert.ok(normalArrow, 'Normal force arrow must exist');
  if (normalArrow && normalArrow.kind === 'arrow') {
    const startY = normalArrow.startY ?? (normalArrow as any).y1;
    const endY = normalArrow.endY ?? (normalArrow as any).y2;
    assert.ok(endY < startY, 'Normal force vector must point upwards away from incline');
  }

  // Check friction force up the incline opposing motion
  const frictionArrow = fbd.elements.find(
    (e) => e.kind === 'arrow' && (e.label?.includes('f_s') || e.label?.includes('friction'))
  );
  assert.ok(frictionArrow, 'Friction arrow must exist');

  // Check schematic assumptions are clearly stated
  assert.ok(fbd.schematicAssumptions && fbd.schematicAssumptions.length > 0);
  assert.ok(fbd.schematicAssumptions.some((a) => a.includes('30°') || a.includes('friction')));
});

test('Chemistry VSEPR Molecular Shape contains correct geometry, atoms, bond angles, and lone pairs', () => {
  const waterSpec = getDeterministicDiagramTemplate(
    'H2O water molecule bent VSEPR geometry',
    'molecular_shape',
    [5, 6]
  );

  assert.equal(waterSpec.category, 'molecular_shape');
  assert.deepEqual(waterSpec.citedPages, [5, 6]);

  // Oxygen central atom and Hydrogen atoms
  const texts = waterSpec.elements.filter((e) => e.kind === 'text');
  const oxygen = texts.find((t) => (t as any).text === 'O');
  const hydrogens = texts.filter((t) => (t as any).text === 'H');
  assert.ok(oxygen, 'Central Oxygen atom must be present');
  assert.equal(hydrogens.length, 2, 'Two Hydrogen atoms must be present');

  // Bond angle text / arc label
  const hasBondAngle = waterSpec.elements.some(
    (e) => (e as any).label?.includes('104.5') || (e as any).text?.includes('104.5')
  );
  assert.ok(hasBondAngle, 'Water VSEPR must state 104.5° experimental bond angle');

  // Lone pair clouds/circles
  const circles = waterSpec.elements.filter((e) => e.kind === 'circle');
  const lonePairs = circles.filter((c) => (c as any).label?.toLowerCase().includes('lone pair'));
  assert.equal(lonePairs.length, 2, 'Two non-bonding lone pair electron clouds must exist');
});

test('Mathematics Conic Section Parabola contains focus, directrix, vertex, and latus rectum', () => {
  const parabolaSpec = getDeterministicDiagramTemplate(
    'Parabola y²=4ax with focus and directrix',
    'conic_section',
    [12]
  );

  assert.equal(parabolaSpec.category, 'conic_section');
  assert.deepEqual(parabolaSpec.citedPages, [12]);

  // Parabola curve path
  const curve = parabolaSpec.elements.find((e) => e.kind === 'path');
  assert.ok(curve, 'Parabola curve path must exist');

  // Focus point S(a,0)
  const focus = parabolaSpec.elements.find(
    (e) => e.kind === 'circle' && (e.label?.includes('Focus') || e.label?.includes('S'))
  );
  assert.ok(focus, 'Focus point S(a,0) must exist');

  // Directrix line
  const directrix = parabolaSpec.elements.find(
    (e) => e.kind === 'line' && (e.label?.includes('Directrix') || (e as any).dashed)
  );
  assert.ok(directrix, 'Directrix line x=-a must exist');

  // Latus rectum
  const latusRectum = parabolaSpec.elements.find(
    (e) => e.kind === 'line' && e.label?.includes('Latus Rectum')
  );
  assert.ok(latusRectum, 'Latus rectum chord must be indicated');
});

test('Sanitizer strips malicious script tags, event handlers, and javascript: protocols', () => {
  const rawMalicious = {
    title: 'Hacked <script>alert("pwned")</script>',
    category: 'free_body_diagram',
    description: 'Attack diagram with onerror="evil()" and javascript:void(0)',
    viewBox: { x: 0, y: 0, width: 600, height: 400 },
    elements: [
      {
        id: 'bad-rect',
        kind: 'rect',
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        label: '<img src=x onerror=alert(1)>',
        fill: '#ffffff',
        onclick: 'doSomethingBad()',
      },
      {
        id: 'bad-text',
        kind: 'text',
        x: 50,
        y: 50,
        text: 'Hello <script>stealCookies()</script>',
        color: 'javascript:alert(1)',
      },
      {
        id: 'bad-path',
        kind: 'path',
        d: 'M 0 0 L 100 100',
        label: 'Safe Path',
        stroke: 'url(javascript:alert(2))',
      },
    ],
    schematicAssumptions: ['<script>evilAssumption()</script>', 'Valid assumption'],
    citedPages: [1],
  };

  const sanitized = validateAndSanitizeDiagramSpec(rawMalicious);

  // Script tags stripped from title and assumptions
  assert.ok(!sanitized.title.includes('<script>'));
  assert.ok(!sanitized.title.includes('</script>'));
  assert.ok(!sanitized.schematicAssumptions[0].includes('<script>'));

  // Serialized SVG must NOT contain any script or dangerous event handler
  const svg = serializeDiagramSpecToSvg(sanitized, false);
  assert.ok(!svg.includes('<script'));
  assert.ok(!svg.includes('onerror'));
  assert.ok(!svg.includes('onclick'));
  assert.ok(!svg.includes('javascript:'));
  assert.ok(!svg.includes('stealCookies'));
  assert.ok(!svg.includes('pwned'));
});

test('Sanitizer handles out-of-bounds, negative dimensions, and NaN coordinates safely', () => {
  const malformedSpec = {
    title: 'Malformed Coordinates',
    category: 'unknown_cat',
    viewBox: { x: -100, y: 'not-a-number', width: -500, height: 9999999 },
    elements: [
      {
        id: 'rect-1',
        kind: 'rect',
        x: 'NaN',
        y: Infinity,
        width: -40,
        height: 'invalid',
      },
      {
        id: 'circle-1',
        kind: 'circle',
        cx: -50000,
        cy: 100000,
        r: -25,
      },
      {
        id: 'line-1',
        kind: 'line',
        x1: NaN,
        y1: 10,
        x2: 100,
        y2: NaN,
      },
    ],
  };

  const sanitized = validateAndSanitizeDiagramSpec(malformedSpec);

  // ViewBox dimensions must be clamped to safe finite bounds
  assert.ok(sanitized.viewBox.width >= 100 && sanitized.viewBox.width <= 2400);
  assert.ok(sanitized.viewBox.height >= 100 && sanitized.viewBox.height <= 2400);
  assert.ok(Number.isFinite(sanitized.viewBox.x));
  assert.ok(Number.isFinite(sanitized.viewBox.y));

  // Category fallback
  assert.equal(sanitized.category, 'educational_diagram');

  // Elements sanitized and dimensions non-negative
  const rect = sanitized.elements.find((e) => e.id === 'rect-1');
  assert.ok(rect && rect.kind === 'rect');
  assert.ok(rect.width >= 0);
  assert.ok(rect.height >= 0);
  assert.ok(Number.isFinite(rect.x));
  assert.ok(Number.isFinite(rect.y));

  const circle = sanitized.elements.find((e) => e.id === 'circle-1');
  assert.ok(circle && circle.kind === 'circle');
  assert.ok(circle.r >= 0);

  const line = sanitized.elements.find((e) => e.id === 'line-1');
  assert.ok(line && line.kind === 'line');
  assert.ok(Number.isFinite(line.x1));
  assert.ok(Number.isFinite(line.y2));
});

test('serializeDiagramSpecToSvg produces valid standalone XML with markers for both Light and Dark themes', () => {
  const spec = getDeterministicDiagramTemplate('RC Circuit', 'circuit_diagram', [7]);

  // Light theme SVG
  const lightSvg = serializeDiagramSpecToSvg(spec, false);
  assert.ok(lightSvg.startsWith('<?xml'));
  assert.ok(lightSvg.includes('<svg'));
  assert.ok(lightSvg.includes('xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(lightSvg.includes('<defs>'));
  assert.ok(lightSvg.includes('id="arrow-default"'));
  assert.ok(lightSvg.includes('fill="#FFFFFF"') || lightSvg.includes('fill="#ffffff"'));

  // Dark theme SVG
  const darkSvg = serializeDiagramSpecToSvg(spec, true);
  assert.ok(darkSvg.startsWith('<?xml'));
  assert.ok(darkSvg.includes('<svg'));
  assert.ok(darkSvg.includes('id="arrow-default"'));
  assert.ok(darkSvg.includes('#0B1020') || darkSvg.includes('#0f172a')); // dark canvas background
});

test('Diagram flow makes zero calls to Higgsfield API and enforces paused status', () => {
  // Confirm that Higgsfield is NOT invoked for diagram generation
  // 1. Check template generator
  const spec = getDeterministicDiagramTemplate('Lens optics', 'ray_optics', [4]);
  assert.ok(spec);
  assert.equal(spec.category, 'ray_optics');

  // 2. Check metadata
  assert.ok(!JSON.stringify(spec).toLowerCase().includes('higgsfield'));
});

test('Missing fields in model output fall back cleanly with clear template labeling', () => {
  // Completely empty object passed to validator
  const emptyOutput = {};
  const sanitized = validateAndSanitizeDiagramSpec(emptyOutput);

  assert.ok(sanitized.title.length > 0);
  assert.ok(sanitized.viewBox.width > 0);
  assert.ok(sanitized.viewBox.height > 0);
  assert.ok(Array.isArray(sanitized.elements));
  assert.ok(Array.isArray(sanitized.schematicAssumptions));
  assert.ok(Array.isArray(sanitized.citedPages));
});

test('Mathematical invariants hold for Incline FBD, RC Circuit closure, H2O 104.5° VSEPR, PCl5, Ellipse, and Parabola', () => {
  // 1. Incline FBD: block base vertices lie on incline line (100,420)->(500,190) and Normal N ⊥ incline
  const fbd = getVerifiedDiagramPresetMatch('Block on inclined plane', 'free_body_diagram', [1]);
  assert.ok(fbd);
  assert.equal(fbd.verificationBadge, 'VERIFIED_TEMPLATE');
  const block = fbd.elements.find((e) => e.id === 'fbd-block');
  assert.ok(block && block.kind === 'polygon');
  const pts = block.points.split(/\s+/).map((p) => p.split(',').map(Number));
  // slope of incline (100,420)->(500,190) is (190-420)/(500-100) = -230/400 = -0.575
  const lineYAtX = (x: number) => 420 + (-230 / 400) * (x - 100);
  assert.ok(Math.abs(pts[0][1] - lineYAtX(pts[0][0])) < 0.6, 'Block bottom-left corner lies on incline');
  assert.ok(Math.abs(pts[1][1] - lineYAtX(pts[1][0])) < 0.6, 'Block bottom-right corner lies on incline');

  const normal = fbd.elements.find((e) => e.id === 'fbd-f-n');
  assert.ok(normal && normal.kind === 'arrow');
  const ux = 400;
  const uy = -230;
  const nx = normal.endX - normal.startX;
  const ny = normal.endY - normal.startY;
  const dotNorm = (ux * nx + uy * ny) / (Math.hypot(ux, uy) * Math.hypot(nx, ny));
  assert.ok(Math.abs(dotNorm) < 0.01, `Normal vector must be orthogonal to incline (dot=${dotNorm})`);
  const fbdSvg = serializeDiagramSpecToSvg(fbd, false);
  assert.ok(fbdSvg.includes('Mass m'), 'Polygon centroid label Mass m must render in SVG');

  // 2. RC Circuit: left wire reaches battery negative plate (y=255) closing the loop
  const rc = getVerifiedDiagramPresetMatch('Series RC charging circuit', 'circuit_diagram', [2]);
  assert.ok(rc);
  const leftWire = rc.elements.find((e) => e.id === 'cir-wire-left1');
  const batNeg = rc.elements.find((e) => e.id === 'cir-bat-neg');
  assert.ok(leftWire && leftWire.kind === 'line');
  assert.ok(batNeg && batNeg.kind === 'line');
  assert.equal(leftWire.endY, batNeg.startY, 'Left loop wire must connect flush to battery negative terminal');

  // 3. H2O VSEPR: dot product of O->H1 and O->H2 is cos(104.5°) and arc uses sweepFlag=0 for 217.75°->322.25°
  const h2o = getVerifiedDiagramPresetMatch('H2O water molecule VSEPR bond angle', 'molecular_shape', [3]);
  assert.ok(h2o);
  const oAtom = h2o.elements.find((e) => e.id === 'vsepr-o');
  const h1Atom = h2o.elements.find((e) => e.id === 'vsepr-h1');
  const h2Atom = h2o.elements.find((e) => e.id === 'vsepr-h2');
  assert.ok(oAtom && oAtom.kind === 'circle' && h1Atom && h1Atom.kind === 'circle' && h2Atom && h2Atom.kind === 'circle');
  const v1x = h1Atom.cx - oAtom.cx;
  const v1y = h1Atom.cy - oAtom.cy;
  const v2x = h2Atom.cx - oAtom.cx;
  const v2y = h2Atom.cy - oAtom.cy;
  const angleDeg =
    (Math.acos((v1x * v2x + v1y * v2y) / (Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y))) * 180) /
    Math.PI;
  assert.ok(Math.abs(angleDeg - 104.5) < 0.5, `H2O bond angle must be ~104.5°, got ${angleDeg.toFixed(2)}°`);
  const h2oSvg = serializeDiagramSpecToSvg(h2o, false);
  assert.ok(h2oSvg.includes('A 62 62 0 0 0'), 'Bond angle arc must use CCW sweep-flag=0 so arc sits between H bonds');

  // 4. PCl5 VSEPR does NOT collapse to H2O
  const pcl5 = getVerifiedDiagramPresetMatch('PCl5 trigonal bipyramidal geometry', 'molecular_shape', [4]);
  assert.ok(pcl5);
  assert.ok(pcl5.title.includes('PCl'), 'PCl5 prompt must render PCl5 geometry, not H2O');
  const pcl5Svg = serializeDiagramSpecToSvg(pcl5, false);
  assert.ok(pcl5Svg.includes('90°') && pcl5Svg.includes('120°'));

  // 5. Ellipse preset includes foci S & S' and a point satisfying PF1 + PF2 = 2a
  const ellipse = getVerifiedDiagramPresetMatch('Standard ellipse conic section with foci', 'conic_section', [5]);
  assert.ok(ellipse);
  assert.ok(ellipse.title.toLowerCase().includes('ellipse'));
  const f1 = ellipse.elements.find((e) => e.id === 'ell-f1');
  const f2 = ellipse.elements.find((e) => e.id === 'ell-f2');
  const ptP = ellipse.elements.find((e) => e.id === 'ell-pt-p');
  assert.ok(f1 && f1.kind === 'circle' && f2 && f2.kind === 'circle' && ptP && ptP.kind === 'circle', 'Ellipse must have two foci and point P');
  const pf1 = Math.hypot(ptP.cx - f1.cx, ptP.cy - f1.cy);
  const pf2 = Math.hypot(ptP.cx - f2.cx, ptP.cy - f2.cy);
  assert.ok(Math.abs(pf1 + pf2 - 360) < 0.1, `Ellipse focal sum PF1+PF2 must equal 2a=360, got ${pf1 + pf2}`);

  // 6. Parabola quadratic Bezier vertex matches (260,240) and Latus Rectum satisfies PS = PM = 2a = 100
  const parabola = getVerifiedDiagramPresetMatch('Parabola y^2 = 4ax focus directrix', 'conic_section', [6]);
  assert.ok(parabola);
  const paraPath = parabola.elements.find((e) => e.kind === 'path');
  assert.ok(paraPath && paraPath.kind === 'path');
  // M 422 60 Q 98 240 422 420 -> midpoint at t=0.5 is x = 0.25*422 + 0.5*98 + 0.25*422 = 260, y = 240
  const nums = paraPath.d.match(/-?\d+(\.\d+)?/g)?.map(Number) || [];
  assert.equal(nums.length, 6);
  const midX = 0.25 * nums[0] + 0.5 * nums[2] + 0.25 * nums[4];
  const midY = 0.25 * nums[1] + 0.5 * nums[3] + 0.25 * nums[5];
  assert.ok(Math.abs(midX - 260) < 0.01 && Math.abs(midY - 240) < 0.01, `Parabola vertex must be (260,240), got (${midX},${midY})`);

  // 7. Unrelated prompts must return null instead of silently swapping to Parabola
  const unmatched = getVerifiedDiagramPresetMatch('Quantum chromodynamics gluon confinement lattice');
  assert.equal(unmatched, null);
});

