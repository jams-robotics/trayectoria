import { describe, expect, test } from 'vitest';

import { fillSubscriptText, subscriptRuns } from './subscriptText';

/** Context stub that records `fillText` and measures 10 px per character at any font. */
function stub(font = '11px mono', textAlign = 'left'): {
  ctx: CanvasRenderingContext2D;
  drawn: Array<[string, number, number, string]>;
} {
  const drawn: Array<[string, number, number, string]> = [];
  const ctx = {
    font,
    textAlign,
    measureText: (text: string) => ({ width: text.length * 10 }),
    fillText(this: { font: string }, text: string, x: number, y: number) {
      drawn.push([text, x, y, this.font]);
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, drawn };
}

describe('subscriptRuns', () => {
  test('a_c y P_{max} salen como base y subíndice', () => {
    expect(subscriptRuns('a_c')).toEqual([
      { text: 'a', sub: false },
      { text: 'c', sub: true },
    ]);
    expect(subscriptRuns('P_{max} = 3 W')).toEqual([
      { text: 'P', sub: false },
      { text: 'max', sub: true },
      { text: ' = 3 W', sub: false },
    ]);
  });

  test('un texto sin subíndices, o con guion bajo al inicio o tras un espacio, es una sola tirada', () => {
    expect(subscriptRuns('v izquierda')).toEqual([{ text: 'v izquierda', sub: false }]);
    expect(subscriptRuns('_c')).toEqual([{ text: '_c', sub: false }]);
    expect(subscriptRuns('a _c')).toEqual([{ text: 'a _c', sub: false }]);
  });
});

describe('fillSubscriptText', () => {
  test('sin subíndices es un solo fillText', () => {
    const { ctx, drawn } = stub();
    fillSubscriptText(ctx, 'v izquierda', 5, 7);
    expect(drawn).toEqual([['v izquierda', 5, 7, '11px mono']]);
  });

  test('el subíndice va más pequeño, más abajo y pegado a la base', () => {
    const { ctx, drawn } = stub();
    fillSubscriptText(ctx, 'a_c', 100, 50);
    expect(drawn[0]).toEqual(['a', 100, 50, '11px mono']);
    expect(drawn[1]?.[0]).toBe('c');
    expect(drawn[1]?.[1]).toBe(110);
    expect(drawn[1]?.[2]).toBeGreaterThan(50);
    expect(drawn[1]?.[3]).toBe('8.25px mono');
    expect(ctx.font).toBe('11px mono');
  });

  test('con alineación a la derecha el texto compuesto termina en x', () => {
    const { ctx, drawn } = stub('11px mono', 'right');
    fillSubscriptText(ctx, 'a_c', 100, 50);
    expect(drawn[0]?.[1]).toBe(80);
    expect(ctx.textAlign).toBe('right');
  });
});
