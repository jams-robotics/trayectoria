import { useMemo } from 'react';
import type { JSX } from 'react';
import katex from 'katex';
import { useT } from '@trayectoria/i18n';

import 'katex/dist/katex.min.css';

export interface FormulaProps {
  latex: string;
  block?: boolean;
  highlight?: string;
  substituted?: string;
}

/** Class applied by `highlight` to the marked variable; styled with the primary token. */
export const HIGHLIGHT_CLASS = 'trayectoria-formula-highlight';

// `\htmlClass` is the only extension KaTeX needs from `trust`; every other trusted command
// (\href, \includegraphics, \url) stays denied (docs/ARCHITECTURE.md §6).
const OPTIONS: katex.KatexOptions = {
  throwOnError: false,
  output: 'html',
  strict: false,
  trust: (context) => context.command === '\\htmlClass',
};

/** Escapes the characters that would otherwise be a regular expression. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Wraps every occurrence of the variable in `\htmlClass{…}{…}`. A LaTeX command
 * (`\omega`) matches as a whole; a single letter (`r`) only when it is not part of a
 * longer identifier or of a command name.
 */
export function withHighlight(latex: string, variable: string): string {
  const escaped = escapeRegExp(variable);
  const pattern = variable.startsWith('\\')
    ? new RegExp(`${escaped}(?![a-zA-Z])`, 'g')
    : new RegExp(`(?<![a-zA-Z\\\\])${escaped}(?![a-zA-Z])`, 'g');
  return latex.replace(pattern, `\\htmlClass{${HIGHLIGHT_CLASS}}{$&}`);
}

function renderToHtml(latex: string, displayMode: boolean): string {
  return katex.renderToString(latex, { ...OPTIONS, displayMode });
}

/** KaTeX output; `trust` is limited to \htmlClass, so no other markup can enter here. */
function Rendered({ html, label }: { html: string; label: string }): JSX.Element {
  return <span role="math" aria-label={label} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** The substituted version under a divider (docs/DESIGN.md §5, formula block). */
function Substituted({ html, label }: { html: string; label: string }): JSX.Element {
  return (
    <span className="border-border mt-4 flex flex-col items-center gap-2 border-t pt-4">
      <span className="text-fg-muted font-mono text-xs tracking-[0.06em] uppercase">{label}</span>
      <Rendered html={html} label={label} />
    </span>
  );
}

const BLOCK = 'bg-bg-raised border-border rounded-lg flex flex-col items-center border p-6';

/**
 * LaTeX formula rendered with KaTeX; the only wrapper around katex in the platform
 * (docs/ARCHITECTURE.md §3.4). `block` uses the formula block of docs/DESIGN.md §5.
 */
export function Formula({
  latex,
  block = false,
  highlight,
  substituted,
}: FormulaProps): JSX.Element {
  const t = useT();
  const html = useMemo(
    () => renderToHtml(highlight === undefined ? latex : withHighlight(latex, highlight), block),
    [latex, block, highlight],
  );
  const substitutedHtml = useMemo(
    () => (substituted === undefined ? null : renderToHtml(substituted, block)),
    [substituted, block],
  );
  const body = (
    <>
      <style>{`.${HIGHLIGHT_CLASS} { color: var(--color-primary); }`}</style>
      <Rendered html={html} label={t('widgets.Formula.label')} />
      {substitutedHtml === null ? null : (
        <Substituted html={substitutedHtml} label={t('widgets.Formula.substituted')} />
      )}
    </>
  );
  if (!block) return <span data-block="false">{body}</span>;
  return (
    <div data-block="true" className={BLOCK}>
      {body}
    </div>
  );
}
