// F5-01a (#133, decisión 5): los materiales del brazo salen de los tokens de docs/DESIGN.md §6
// («base `fg-muted`, eslabones `physical`, articulaciones `fg`»). three.js parsea un color, nunca
// un `var(--…)`, así que el token se resuelve en tiempo de ejecución contra `<html>`.

/** Token de cada parte del brazo (docs/DESIGN.md §6). */
export const ARM_TOKENS = {
  base: '--color-fg-muted',
  link: '--color-physical',
  joint: '--color-fg',
} as const;

/** Valores claros de los tokens; sirven de reserva donde no hay hoja de estilos (jsdom). */
const FALLBACK: Readonly<Record<string, string>> = {
  '--color-fg-muted': '#526475',
  '--color-physical': '#a25607',
  '--color-fg': '#1a242f',
};

/** Colores del brazo, uno por parte. */
export interface ArmColors {
  readonly base: string;
  readonly link: string;
  readonly joint: string;
}

/** Resuelve un token contra `element`; el valor claro si no hay hoja de estilos que consultar. */
export function armToken(element: Element | null, token: string): string {
  const fallback = FALLBACK[token] ?? '';
  if (element === null || typeof globalThis.getComputedStyle !== 'function') return fallback;
  const value = globalThis.getComputedStyle(element).getPropertyValue(token).trim();
  return value === '' ? fallback : value;
}

/** Los tres colores del brazo leídos de los tokens del documento actual. */
export function readArmColors(element: Element | null): ArmColors {
  return {
    base: armToken(element, ARM_TOKENS.base),
    link: armToken(element, ARM_TOKENS.link),
    joint: armToken(element, ARM_TOKENS.joint),
  };
}
