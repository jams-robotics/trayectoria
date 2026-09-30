import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// `apps/web` has no component-rendering test library (`@testing-library/*` is only wired for
// `packages/widgets` and `packages/sims`, and a ticket cannot add one, docs/STANDARDS.md §8/§10):
// static markup is checked instead, same pattern as BottomBar.test.tsx. `useEmailLink` is mocked
// so the component renders straight from a given status, without needing its async effect to run.

vi.mock('@trayectoria/auth', () => ({
  AuthGate: () => null,
  signInWithOtp: vi.fn(),
}));

const mockUseEmailLink = vi.fn<() => string>();
vi.mock('./emailLink', () => ({ useEmailLink: () => mockUseEmailLink() }));

const { Account } = await import('./Account');

const CTA = { title: '', body: '', register: '', login: '' };

describe('Account (#518, SEC-DB)', () => {
  it('shows no expired-link notice when the link is fine or there is none', () => {
    for (const status of ['none', 'pending', 'ok']) {
      mockUseEmailLink.mockReturnValue(status);
      const html = renderToStaticMarkup(<Account cta={CTA} />);
      expect(html).not.toContain('El enlace caducó o ya se usó; pide uno nuevo.');
    }
  });

  it('shows the same expired-link notice as /auth/recuperar, with a form to ask a new one', () => {
    mockUseEmailLink.mockReturnValue('expired');
    const html = renderToStaticMarkup(<Account cta={CTA} />);

    expect(html).toContain('El enlace caducó o ya se usó; pide uno nuevo.');
    // The request form stays available right below the notice, no reload needed (SEC-DB).
    expect(html).toContain('<form');
    expect(html).toContain('type="email"');
  });
});
