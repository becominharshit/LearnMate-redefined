/** Helpers that prepare AI-written Markdown + LaTeX for remark-math (used by MathText). */

/** Models sometimes use \( \) and \[ \] delimiters; remark-math only understands $ and $$. */
export function normalizeMathDelimiters(input: string): string {
  return input
    .replace(/\\\[([\s\S]+?)\\\]/g, (_match, body: string) => `$$${body}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_match, body: string) => `$${body}$`);
}

/** remark-math renders $$…$$ as a display equation only when the delimiters sit on their own lines. */
export function toDisplayMathBlocks(input: string): string {
  return input.replace(/\$\$([\s\S]+?)\$\$/g, (_match, body: string) => `\n\n$$\n${body.trim()}\n$$\n\n`);
}

/** Display math renders as a block, which can't sit inside a sentence, so make it inline. */
export function toInlineMath(input: string): string {
  return input.replace(/\$\$([\s\S]+?)\$\$/g, (_match, body: string) => `$${body.trim()}$`);
}
