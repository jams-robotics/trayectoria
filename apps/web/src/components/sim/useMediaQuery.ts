import { useEffect, useState } from 'react';

// F5-01b (#134): mínimo necesario para decidir en el cliente si los paneles del simulador van en
// acordeón (móvil) o en flujo normal (escritorio). Las clases responsive no bastan aquí porque el
// acordeón cambia el árbol, no solo su presentación: duplicar el panel en dos ramas duplicaría
// también sus controles y sus `aria-live`. `window` está permitido en `apps/web` (CLAUDE.md) y la
// isla es `client:only`, así que no hay render de servidor que desencajar.

/** Ancho a partir del cual la maqueta es de escritorio, en píxeles (docs/DESIGN.md §9). */
export const DESKTOP_MIN_WIDTH_PX = 768;

/** Media query del móvil: por debajo del primer punto de ruptura de escritorio. */
export const MOBILE_MEDIA_QUERY = `(max-width: ${String(DESKTOP_MIN_WIDTH_PX - 1)}px)`;

/** Si la media query se cumple ahora mismo; se vuelve a evaluar cuando el viewport cambia. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    setMatches(list.matches);
    const onChange = (event: MediaQueryListEvent): void => {
      setMatches(event.matches);
    };
    list.addEventListener('change', onChange);
    return () => {
      list.removeEventListener('change', onChange);
    };
  }, [query]);

  return matches;
}
