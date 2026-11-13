import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MathText } from './MathText';
import { formatStudyFormulaToLatex, normalizeMathDelimiters } from '../utils/mathMarkdown';

const render = (text: string, variant?: 'block' | 'inline') =>
  renderToStaticMarkup(React.createElement(MathText, { text, variant }));

test('normalizeMathDelimiters converts \\( \\) and \\[ \\] to dollar delimiters', () => {
  assert.equal(normalizeMathDelimiters('speed \\(v^2\\) here'), 'speed $v^2$ here');
  assert.equal(normalizeMathDelimiters('\\[F = ma\\]'), '$$F = ma$$');
});

test('MathText renders LaTeX and mhchem chemistry with KaTeX', () => {
  const html = render('Use $v = u + at$ for $\\ce{H2SO4}$.\n\n$$s = ut + \\frac{1}{2}at^2$$');
  // KaTeX keeps the TeX source in a hidden MathML <annotation>; only check what students see.
  const visible = html.replace(/<annotation[\s\S]*?<\/annotation>/g, '');
  assert.match(html, /class="katex"/);
  assert.match(html, /katex-display/, 'a one-line $$…$$ should render as a display equation');
  assert.ok(!visible.includes('$v = u'), 'raw LaTeX must not remain');
  assert.ok(!visible.includes('\\ce{'), 'mhchem must be rendered, not shown as source');
  assert.ok(!html.includes('katex-error'), 'no KaTeX errors expected');
});

test('MathText never renders raw HTML from AI text', () => {
  const html = render('<img src=x onerror="alert(1)"> and **bold**');
  assert.ok(!html.includes('<img'), 'raw HTML must not be rendered');
  assert.match(html, /<strong>bold<\/strong>/);
});

test('inline MathText keeps display math inside the line', () => {
  const html = render('Answer: $$\\frac{1}{2}$$', 'inline');
  assert.match(html, /class="katex"/);
  assert.ok(!html.includes('katex-display'));
  assert.ok(!html.includes('<div'));
  assert.ok(!html.includes('<p'));
});

test('formatStudyFormulaToLatex and MathText render bare JEE formulas cleanly with KaTeX', () => {
  const formatted = formatStudyFormulaToLatex('v = dx/dt, a = dv/dt = v(dv/dx), ∫v dt = Δx');
  const html = render(formatted, 'inline');
  assert.match(html, /class="katex"/);
  assert.ok(!html.includes('katex-error'), 'bare formula conversion must not produce KaTeX errors');
});

test('MathText handles Greek subscripts (μ_s, μ_k) and legend prose without KaTeX parse errors', () => {
  const text =
    'N = normal contact force, μ_s = static coefficient, μ_k = kinetic coefficient; at θ = 37° with μ_s = 0.5 and μ_k = 0.4; R = turn radius.';
  const html = render(text);
  assert.ok(!html.includes('katex-error'), `Unexpected katex-error in rendered HTML: ${html}`);
  assert.match(html, /class="katex"/);
});


