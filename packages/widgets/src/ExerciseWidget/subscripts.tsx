import type { ReactNode } from 'react';

// The statements, options and labels of the exercises are plain i18n strings that write a
// subscript as `v_max` or `e_{k−1}` and a vector as `a⃗` (packages/i18n, content.json). On screen
// both are composed: the combining arrow (U+20D7) is in neither of our fonts.

/** A letter with the combining arrow, or `X_y` / `X_{y}` (the group after the underscore). */
const MARKUP = /(\p{L})⃗|_(?:\{([^}]*)\}|([\p{L}\p{N}]+))/gu;

/** The text with its subscripts as `<sub>` and its vectors as `.vec`; plain text comes back as is. */
export function withSubscripts(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(MARKUP)) {
    const start = match.index;
    const vector = match[1];
    // An underscore that opens the text or follows a space is not a subscript.
    if (vector === undefined && (start === 0 || /\s/u.test(text.charAt(start - 1)))) continue;
    parts.push(
      text.slice(last, start),
      vector === undefined ? (
        <sub key={start}>{match[2] ?? match[3]}</sub>
      ) : (
        <span key={start} className="vec">
          {vector}
        </span>
      ),
    );
    last = start + match[0].length;
  }
  if (parts.length === 0) return text;
  parts.push(text.slice(last));
  return parts;
}
