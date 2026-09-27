// F5-01a (#133, decision 5): the arm materials come from the tokens of docs/DESIGN.md §6
// («base `fg-muted`, eslabones `physical`, articulaciones `fg`»). three.js parses a colour, never
// a `var(--…)`, so the token is resolved at runtime against `<html>`.

/** Token of each part of the arm (docs/DESIGN.md §6). */
export const ARM_TOKENS = {
  base: '--color-fg-muted',
  link: '--color-physical',
  joint: '--color-fg',
  // F5-02 (#135, decision 4): the link chosen in the matrix panel is marked with `primary`.
  highlight: '--color-primary',
} as const;

/** Light values of the tokens; they serve as a fallback where there is no stylesheet (jsdom). */
const FALLBACK: Readonly<Record<string, string>> = {
  '--color-fg-muted': '#526475',
  '--color-physical': '#a25607',
  '--color-fg': '#1a242f',
  '--color-primary': '#0d6a8e',
};

/** Arm colours, one per part. */
export interface ArmColors {
  readonly base: string;
  readonly link: string;
  readonly joint: string;
  /** Colour of the link highlighted in 3D (F5-02). */
  readonly highlight: string;
}

/** Resolves a token against `element`; the light value if there is no stylesheet to query. */
export function armToken(element: Element | null, token: string): string {
  const fallback = FALLBACK[token] ?? '';
  if (element === null || typeof globalThis.getComputedStyle !== 'function') return fallback;
  const value = globalThis.getComputedStyle(element).getPropertyValue(token).trim();
  return value === '' ? fallback : value;
}

/** The three arm colours read from the tokens of the current document. */
export function readArmColors(element: Element | null): ArmColors {
  return {
    base: armToken(element, ARM_TOKENS.base),
    link: armToken(element, ARM_TOKENS.link),
    joint: armToken(element, ARM_TOKENS.joint),
    highlight: armToken(element, ARM_TOKENS.highlight),
  };
}
