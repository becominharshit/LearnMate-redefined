/** Helpers that prepare AI-written Markdown + LaTeX for remark-math (used by MathText). */

/** Converts raw Unicode/ASCII formula strings (e.g. "T = (2u sin θ)/g") into clean LaTeX delimiters for KaTeX. */
export function formatStudyFormulaToLatex(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('$') || trimmed.includes('\\(') || trimmed.includes('\\[')) {
    return trimmed;
  }

  let expr = trimmed
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/⁻¹/g, '^{-1}')
    .replace(/⁻²/g, '^{-2}')
    .replace(/⁰/g, '^0')
    .replace(/¹/g, '^1')
    .replace(/½/g, '\\frac{1}{2}')
    .replace(/¼/g, '\\frac{1}{4}')
    .replace(/¾/g, '\\frac{3}{4}')
    .replace(/θ/g, '\\theta ')
    .replace(/φ/g, '\\phi ')
    .replace(/Φ/g, '\\Phi ')
    .replace(/α/g, '\\alpha ')
    .replace(/β/g, '\\beta ')
    .replace(/γ/g, '\\gamma ')
    .replace(/δ/g, '\\delta ')
    .replace(/Δ/g, '\\Delta ')
    .replace(/λ/g, '\\lambda ')
    .replace(/μ/g, '\\mu ')
    .replace(/π/g, '\\pi ')
    .replace(/ρ/g, '\\rho ')
    .replace(/σ/g, '\\sigma ')
    .replace(/Σ/g, '\\Sigma ')
    .replace(/τ/g, '\\tau ')
    .replace(/ω/g, '\\omega ')
    .replace(/Ω/g, '\\Omega ')
    .replace(/ε/g, '\\varepsilon ')
    .replace(/η/g, '\\eta ')
    .replace(/∞/g, '\\infty ')
    .replace(/°/g, '^\\circ ')
    .replace(/≤/g, '\\le ')
    .replace(/≥/g, '\\ge ')
    .replace(/≠/g, '\\ne ')
    .replace(/≈/g, '\\approx ')
    .replace(/∝/g, '\\propto ')
    .replace(/×/g, '\\times ')
    .replace(/·/g, '\\cdot ')
    .replace(/÷/g, '\\div ')
    .replace(/±/g, '\\pm ')
    .replace(/→/g, '\\to ')
    .replace(/⇒/g, '\\Rightarrow ')
    .replace(/⇌/g, '\\rightleftharpoons ')
    .replace(/∫/g, '\\int ')
    .replace(/∑/g, '\\sum ')
    .replace(/√\[([^\]]+)\]/g, '\\sqrt{$1}')
    .replace(/√\(([^)]+)\)/g, '\\sqrt{$1}')
    .replace(/√([a-zA-Z0-9]+)/g, '\\sqrt{$1}')
    .replace(/\b(sin|cos|tan|cot|sec|csc|log|ln|lim)\b/g, '\\$1');

  // Group multi-character subscripts like f_s, μ_k, v_max -> f_{s}, \mu_{k}, v_{max}
  expr = expr
    .replace(/_([a-zA-Z]{2,}|[0-9]{2,})/g, '_{$1}')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // If the line is purely a compact formula (or comma-separated formulas), wrap directly in inline math
  if (!/[.!?]\s+[A-Z]/.test(expr) && /[=\\^_{}]/.test(expr) && expr.length <= 160) {
    // Split multi-part comma-separated equations onto crisp math spans when explanatory words exist
    if (/[a-zA-Z]{5,}\s+[a-zA-Z]{5,}/.test(expr) && !/=/.test(expr)) {
      return expr;
    }
    return `$${expr}$`;
  }
  return expr;
}

/** Models sometimes use \( \) and \[ \] delimiters or emit unwrapped LaTeX commands; remark-math only understands $ and $$. */
export function normalizeMathDelimiters(input: string): string {
  if (!input) return '';

  let normalized = input
    .replace(/\\\[([\s\S]+?)\\\]/g, (_match, body: string) => `$$${body}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_match, body: string) => `$${body}$`);

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

  // Convert bare inline unicode/calculus equations inside prose (e.g. "v = dr/dt", "μ_s = 0.5", "y = x tan θ")
  // only when outside existing $...$ and Markdown formatting
  if (/[θφΦαβγδΔλμπρσΣτωΩεη²³⁻¹√∫∑≤≥≠≈∝⇌]|d[A-Za-z]\/d[A-Za-z]/.test(normalized)) {
    normalized = normalized
      // Equations like v = dr/dt, f_s = mg sin θ, μ_s = 0.5, y(t) = (u sin θ)t - 1/2 gt^2
      .replace(
        /(?<![A-Za-z0-9_\\$θφΦαβγδΔλμπρσΣτωΩεη])([A-Za-zΔΣμθφΦαβγδλμπρσΣτωΩεη][A-Za-z0-9_()]*\s*(?:=|≤|≥|≈|∝)\s*[A-Za-z0-9_()+*/−\-·.,²³⁻¹½¼¾√θφΦαβγδΔλμπρσΣτωΩεη]+(?:\s*[+\-−*/=≤≥]\s*[A-Za-z0-9_()+*/−\-·.,²³⁻¹½¼¾√θφΦαβγδΔλμπρσΣτωΩεη]+)*)/g,
        (eq) => {
          if (eq.length < 3 || eq.length > 90) return eq;
          const eqParts = eq.split(/=|≤|≥|≈|∝/);
          const rhs = eqParts[1]?.trim() || '';
          // Skip prose legend definitions like "N = normal" or "R = turn"
          if (/^[a-z]{3,}$/.test(rhs)) return eq;
          const latex = formatStudyFormulaToLatex(eq);
          return latex.startsWith('$') ? protect(latex) : eq;
        }
      )
      // Standalone trig / Greek expressions like u cos θ, mg sin θ, tan θ, μ_s
      .replace(
        /(?<![A-Za-z0-9_\\$θφΦαβγδΔλμπρσΣτωΩεη])((?:[a-zA-Z0-9]+\s+)?(?:sin|cos|tan)\s*[θφΦαβγδ]|(?:μ_[a-zA-Z0-9]+|μ|Δ[A-Za-z]+))/g,
        (expr) => {
          if (expr.endsWith('_')) return expr;
          const latex = formatStudyFormulaToLatex(expr);
          return latex.startsWith('$') ? protect(latex) : expr;
        }
      );
  }

  // Fast path if no remaining LaTeX backslash commands exist outside existing $...$
  if (!normalized.includes('\\')) {
    return normalized.replace(
      /__LM_MATH_BLK_(\d+)__/g,
      (_m, i: string) => protectedBlocks[Number(i)] ?? _m
    );
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
