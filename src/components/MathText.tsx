import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
// KaTeX's stylesheet is imported once in main.tsx.
import 'katex/contrib/mhchem';
import { normalizeMathDelimiters, toDisplayMathBlocks, toInlineMath } from '../utils/mathMarkdown';

interface MathTextProps {
  text: string;
  /** "block" renders paragraphs and lists; "inline" renders one line (options, labels). */
  variant?: 'block' | 'inline';
  className?: string;
}

const remarkPlugins = [remarkMath, remarkGfm];
const rehypePlugins: React.ComponentProps<typeof ReactMarkdown>['rehypePlugins'] = [
  [rehypeKatex, { throwOnError: false, strict: 'ignore' }],
];

/**
 * Renders AI-written text that mixes Markdown, LaTeX ($…$, $$…$$) and chemistry (\ce{…}).
 * Raw HTML in the text is never rendered (react-markdown escapes it), so model output
 * cannot inject markup into the page.
 */
export const MathText = memo(function MathText({
  text,
  variant = 'block',
  className = '',
}: MathTextProps) {
  const normalized = normalizeMathDelimiters(text || '');

  if (variant === 'inline') {
    return (
      <span className={`lm-math-inline ${className}`}>
        <ReactMarkdown
          remarkPlugins={remarkPlugins}
          rehypePlugins={rehypePlugins}
          components={{ p: ({ children }) => <>{children}</> }}
        >
          {toInlineMath(normalized)}
        </ReactMarkdown>
      </span>
    );
  }

  return (
    <div className={`lm-prose ${className}`}>
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
        {toDisplayMathBlocks(normalized)}
      </ReactMarkdown>
    </div>
  );
});
