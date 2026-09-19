import { useEffect } from 'react';
import type { JSX } from 'react';

/** How long a toast stays on screen (docs/DESIGN.md §5, Toast). */
export const TOAST_TIMEOUT_MS = 5000;

/** Colour of the 8 px dot that opens the line; never a coloured side stripe (docs/DESIGN.md §5). */
export type ToastTone = 'success' | 'error' | 'neutral';

export interface ToastProps {
  message: string;
  tone?: ToastTone;
  /** Called after 5 s or when the learner presses Escape. */
  onClose: () => void;
}

const DOT: Readonly<Record<ToastTone, string>> = {
  success: 'bg-success',
  error: 'bg-error',
  neutral: 'bg-fg-muted',
};

/**
 * Toast of docs/DESIGN.md §5: bottom-right corner, `bg-raised` with a `border` outline, an 8 px
 * tone dot before the text, `md` radius, `shadow-md` and `sm` text. It closes on its own after
 * `TOAST_TIMEOUT_MS` or with Escape.
 */
export function Toast({ message, tone = 'success', onClose }: ToastProps): JSX.Element {
  useEffect(() => {
    const timer = setTimeout(onClose, TOAST_TIMEOUT_MS);
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="toast"
      data-tone={tone}
      className="bg-bg-raised border-border rounded-md shadow-md fixed right-5 bottom-5 z-50 flex items-center gap-2 border px-4 py-3 text-sm"
    >
      <span className={`${DOT[tone]} h-2 w-2 shrink-0 rounded-full`} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
