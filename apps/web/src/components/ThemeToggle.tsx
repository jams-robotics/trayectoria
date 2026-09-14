import { useStore } from '@nanostores/react';
import type { JSX } from 'react';

import { $theme, toggleTheme } from '../stores/theme';

function MoonIcon(): JSX.Element {
  return (
    <svg
      className="dark:hidden"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunIcon(): JSX.Element {
  return (
    <svg
      className="hidden dark:block"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// The server does not know the theme, so the markup is theme-agnostic: both icons are rendered
// and CSS (`dark:` variant on [data-theme]) shows the right one; the label names both states.
export function ThemeToggle(): JSX.Element {
  useStore($theme);
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Cambiar entre tema claro y oscuro"
      className="text-fg-muted hover:text-fg border-border hover:border-fg-muted bg-bg-raised rounded-md inline-flex h-[44px] w-[44px] items-center justify-center border md:h-8 md:w-8"
    >
      <MoonIcon />
      <SunIcon />
    </button>
  );
}
