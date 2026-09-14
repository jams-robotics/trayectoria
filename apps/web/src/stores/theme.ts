import { atom, onMount } from 'nanostores';

export type Theme = 'light' | 'dark';

// Also read by the inline anti-flash script in layouts/Base.astro; keep both in sync.
export const THEME_STORAGE_KEY = 'trayectoria:theme';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function systemTheme(): Theme {
  if (!isBrowser()) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// The inline script in Base.astro has already set data-theme when this module runs in the
// browser; starting from it keeps the store consistent with the page from the first read.
function initialTheme(): Theme {
  if (!isBrowser()) return 'light';
  return document.documentElement.dataset['theme'] === 'dark' ? 'dark' : 'light';
}

export const $theme = atom<Theme>(initialTheme());

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset['theme'] = theme;
}

onMount($theme, () => {
  if (!isBrowser()) return;
  $theme.set(storedTheme() ?? systemTheme());
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const followSystem = (): void => {
    if (storedTheme() === null) $theme.set(systemTheme());
  };
  media.addEventListener('change', followSystem);
  const unsubscribe = $theme.subscribe(applyTheme);
  return () => {
    media.removeEventListener('change', followSystem);
    unsubscribe();
  };
});

export function toggleTheme(): void {
  const next: Theme = $theme.get() === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Storage unavailable (private mode, blocked site data): the choice lasts this page only.
  }
  $theme.set(next);
}
