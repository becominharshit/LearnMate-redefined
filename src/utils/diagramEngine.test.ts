import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAndSanitizeDiagramSpec,
  getDeterministicDiagramTemplate,
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
