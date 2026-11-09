/** Helpers that prepare AI-written Markdown + LaTeX for remark-math (used by MathText). */

/** Models sometimes use \( \) and \[ \] delimiters or emit unwrapped LaTeX commands; remark-math only understands $ and $$. */
export function normalizeMathDelimiters(input: string): string {
  if (!input) return '';

  let normalized = input
    .replace(/\\\[([\s\S]+?)\\\]/g, (_match, body: string) => `$$${body}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_match, body: string) => `$${body}$`);

  // Fast path if no remaining LaTeX backslash commands exist outside existing $...$
  if (!normalized.includes('\\')) {
    return normalized;
  }

  // Protect existing $$...$$, $...$, and fenced/inline code blocks with placeholders
  const protectedBlocks: string[] = [];
  const protect = (match: string): string => {
    const idx = protectedBlocks.length;
    protectedBlocks.push(match);
    return `__LM_MATH_BLK_${idx}__`;
  };

  normalized = normalized
    .replace(/```[\s\S]*?```/g, protect)
    .replace(/`[^`\n]+`/g, protect)
    .replace(/\$\$[\s\S]+?\$\$/g, protect)
    .replace(/\$[^$\n]+\$/g, protect);

  if (!normalized.includes('\\')) {
    return normalized.replace(/__LM_MATH_BLK_(\d+)__/g, (_m, i: string) => protectedBlocks[Number(i)] ?? _m);
  }

  // Wrap standalone display environments (\begin{pmatrix}...\end{pmatrix}, etc.)
  normalized = normalized.replace(
    /\\begin\{(pmatrix|bmatrix|vmatrix|matrix|aligned|cases)\}[\s\S]*?\\end\{\1\}/g,
    (envMatch) => protect(`$$${envMatch.trim()}$$`)
  );

  // Wrap contiguous unwrapped LaTeX commands (\frac{a}{b}, \sqrt{25}, \theta, \sum_{i=1}^{n}, \int_{a}^{b}, \ce{H2O}, \text{m/s}^2)
  const knownLatexCommands = new Set([
    'frac', 'dfrac', 'tfrac', 'sqrt', 'sum', 'prod', 'int', 'oint', 'lim',
    'vec', 'hat', 'bar', 'dot', 'ddot', 'overline', 'underline',
    'text', 'mathrm', 'mathbf', 'mathit', 'mathcal', 'ce',
    'alpha', 'beta', 'gamma', 'delta', 'Delta', 'epsilon', 'varepsilon',
    'zeta', 'eta', 'theta', 'vartheta', 'iota', 'kappa', 'lambda', 'Lambda',
    'mu', 'nu', 'xi', 'pi', 'Pi', 'rho', 'sigma', 'Sigma', 'tau', 'upsilon',
    'phi', 'varphi', 'Phi', 'chi', 'psi', 'Psi', 'omega', 'Omega',
    'times', 'cdot', 'div', 'pm', 'mp', 'leq', 'le', 'geq', 'ge', 'neq', 'ne',
    'approx', 'equiv', 'propto', 'infty', 'partial', 'nabla',
    'rightarrow', 'leftarrow', 'Rightarrow', 'Leftarrow', 'leftrightarrow',
    'Leftrightarrow', 'rightleftharpoons', 'to', 'perp', 'parallel', 'angle', 'circ',
  ]);

  const braceGroup = '\\{(?:[^{}]|\\{[^{}]*\\})*\\}';
  const rawLatexPattern = new RegExp(
    `(?:\\\\[a-zA-Z]+(?:\\s*${braceGroup}(?:\\s*${braceGroup})?)?(?:\\s*[_^]\\s*(?:${braceGroup}|[a-zA-Z0-9+-]+))*)+`,
    'g'
  );

  normalized = normalized.replace(rawLatexPattern, (match) => {
    const cmdMatch = match.match(/\\([a-zA-Z]+)/);
    if (!cmdMatch || !knownLatexCommands.has(cmdMatch[1])) {
      return match;
    }
    return `$${match.trim()}$`;
  });

  return normalized.replace(
    /__LM_MATH_BLK_(\d+)__/g,
    (_m, i: string) => protectedBlocks[Number(i)] ?? _m
  );
}

/** remark-math renders $$…$$ as a display equation only when the delimiters sit on their own lines. */
export function toDisplayMathBlocks(input: string): string {
  return input.replace(/\$\$([\s\S]+?)\$\$/g, (_match, body: string) => `\n\n$$\n${body.trim()}\n$$\n\n`);
}

/** Display math renders as a block, which can't sit inside a sentence, so make it inline. */
export function toInlineMath(input: string): string {
  return input.replace(/\$\$([\s\S]+?)\$\$/g, (_match, body: string) => `$${body.trim()}$`);
}
