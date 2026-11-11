import type { ReactNode } from 'react';

// The statements, options and labels of the exercises are plain i18n strings that write a
// subscript as `v_max` or `e_{k−1}` (packages/i18n, content.json). On screen it is composed.

/** `X_y` and `X_{y}`: the base stays in the text, the group after the underscore is the subscript. */
const SUBSCRIPT = /_(?:\{([^}]*)\}|([\p{L}\p{N}]+))/gu;

/** The text with every underscore subscript as a `<sub>`; a text without them comes back as is. */
export function withSubscripts(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(SUBSCRIPT)) {
    const start = match.index;
    // An underscore that opens the text or follows a space is not a subscript.
    if (start === 0 || /\s/u.test(text.charAt(start - 1))) continue;
    parts.push(text.slice(last, start), <sub key={start}>{match[1] ?? match[2]}</sub>);
    last = start + match[0].length;
  }
  if (parts.length === 0) return text;
  parts.push(text.slice(last));
  return parts;
}
