import { useEffect, useState } from 'react';

// F5-01b (#134): the minimum needed to decide on the client whether the simulator panels go in an
// accordion (mobile) or in normal flow (desktop). Responsive classes are not enough here because the
// accordion changes the tree, not only its presentation: duplicating the panel in two branches would
// also duplicate its controls and its `aria-live`. `window` is allowed in `apps/web` (CLAUDE.md) and
// the island is `client:only`, so there is no server render to mismatch.

/** Width from which the mockup is the desktop one, in pixels (docs/DESIGN.md §9). */
export const DESKTOP_MIN_WIDTH_PX = 768;

/** Mobile media query: below the first desktop breakpoint. */
export const MOBILE_MEDIA_QUERY = `(max-width: ${String(DESKTOP_MIN_WIDTH_PX - 1)}px)`;

/** Whether the media query matches right now; re-evaluated when the viewport changes. */
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
