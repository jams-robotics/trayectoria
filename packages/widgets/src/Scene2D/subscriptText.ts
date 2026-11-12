// Labels of the scenes are plain i18n strings that write a subscript as `a_c` or `P_{max}`
// (the same rule as `withSubscripts` of ExerciseWidget); on the canvas they are composed.

/**
 * `X_y` and `X_{y}`: the group after the underscore is the subscript. The braced group is bounded
 * and takes no brace, so a text with many unclosed `_{` is still matched in linear time.
 */
const SUBSCRIPT = /_(?:\{([^{}]{0,32})\}|([\p{L}\p{N}]+))/gu;
/** Font size of a canvas font string (`600 11px "Source Sans 3"`), with bounded digit runs. */
const FONT_SIZE = /(\d{1,4}(?:\.\d{1,4})?)px/;
/** Size of a subscript relative to the font of the label. */
const SUB_SCALE = 0.75;
/** How far a subscript drops, as a share of the font size. */
const SUB_DROP = 0.25;

/** A stretch of a label: the text and whether it is drawn as a subscript. */
export interface TextRun {
  text: string;
  sub: boolean;
}

/** Splits a label at its subscripts; a label without them is a single run. */
export function subscriptRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let last = 0;
  for (const match of text.matchAll(SUBSCRIPT)) {
    const start = match.index;
    // An underscore that opens the text or follows a space is not a subscript.
    if (start === 0 || /\s/u.test(text.charAt(start - 1))) continue;
    if (start > last) runs.push({ text: text.slice(last, start), sub: false });
    runs.push({ text: match[1] ?? match[2] ?? '', sub: true });
    last = start + match[0].length;
  }
  if (last < text.length || runs.length === 0) runs.push({ text: text.slice(last), sub: false });
  return runs;
}

/**
 * Draws `text` at (x_px, y_px) honouring the `textAlign` and `textBaseline` of the context, with
 * `X_y` and `X_{y}` as a smaller, lowered subscript. A text without subscripts is one `fillText`.
 */
export function fillSubscriptText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x_px: number,
  y_px: number,
): void {
  const runs = subscriptRuns(text);
  const [first] = runs;
  if (runs.length === 1 && first !== undefined) {
    ctx.fillText(first.text, x_px, y_px);
    return;
  }
  const baseFont = ctx.font;
  const size = FONT_SIZE.exec(baseFont);
  const size_px = size === null ? 11 : Number(size[1]);
  const subFont = size === null ? baseFont : baseFont.replace(size[0], `${String(size_px * SUB_SCALE)}px`);
  const widthOf = (run: TextRun): number => {
    ctx.font = run.sub ? subFont : baseFont;
    return ctx.measureText(run.text).width;
  };
  const widths = runs.map(widthOf);
  const total = widths.reduce((sum, width) => sum + width, 0);
  const align = ctx.textAlign;
  let at_px = align === 'right' || align === 'end' ? x_px - total : align === 'center' ? x_px - total / 2 : x_px;
  ctx.textAlign = 'left';
  runs.forEach((run, index) => {
    ctx.font = run.sub ? subFont : baseFont;
    ctx.fillText(run.text, at_px, y_px + (run.sub ? size_px * SUB_DROP : 0));
    at_px += widths[index] ?? 0;
  });
  ctx.font = baseFont;
  ctx.textAlign = align;
}
