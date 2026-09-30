import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';

import { LoginForm, MagicLinkButton } from './LoginForm';

// #543: «Enviarme un enlace mágico» stays disabled until there is an email, and a grey button with
// no reason reads as broken. So while it waits it carries the reason in its `title` and points
// its accessible description at a visible line under the buttons. `apps/web` has no DOM testing
// library, so the markup is checked as rendered on the server.

const HINT = 'Escribe tu correo para recibir el enlace.';

describe('MagicLinkButton (#543)', () => {
  test('without an email it is disabled and says why', () => {
    const html = renderToStaticMarkup(<LoginForm />);
    const hintId = /<p id="([^"]+)"[^>]*data-testid="magic-link-hint"[^>]*>([^<]*)<\/p>/.exec(html);
    expect(hintId?.[2]).toBe(HINT);
    const button = /<button[^>]*aria-describedby="([^"]+)"[^>]*>Enviarme un enlace mágico<\/button>/.exec(
      html,
    );
    expect(button?.[1]).toBe(hintId?.[1]);
    expect(button?.[0]).toContain('disabled=""');
    expect(button?.[0]).toContain(`title="${HINT}"`);
  });

  test('with an email the reason goes away', () => {
    const html = renderToStaticMarkup(
      <MagicLinkButton email="ada@example.org" pending={false} run={vi.fn()} />,
    );
    expect(html).not.toContain(HINT);
    expect(html).not.toContain('aria-describedby');
    expect(html).not.toContain('disabled=""');
  });
});
