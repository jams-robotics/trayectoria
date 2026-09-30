import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// Same static-markup approach as Account.test.tsx: `apps/web` has no component-rendering test
// library (docs/STANDARDS.md §8/§10), and `useEmailLink`/`useSession` are mocked so the component
// renders straight from a given status.

vi.mock('@trayectoria/auth', () => ({
  useSession: () => ({ session: null, ready: true }),
  resetPassword: vi.fn(),
  updatePassword: vi.fn(),
  $passwordRecovery: {},
}));
vi.mock('@nanostores/react', () => ({ useStore: () => false }));

const mockUseEmailLink = vi.fn<() => string>();
vi.mock('./emailLink', () => ({ useEmailLink: () => mockUseEmailLink() }));

const { RecoverForm } = await import('./RecoverForm');

describe('RecoverForm (SEC-DB)', () => {
  it('shows the request form below the expired-link notice, so a new link needs no reload', () => {
    mockUseEmailLink.mockReturnValue('expired');
    const html = renderToStaticMarkup(<RecoverForm />);

    expect(html).toContain('El enlace caducó o ya se usó; pide uno nuevo.');
    expect(html).toContain('<form');
    expect(html).toContain('type="email"');
  });

  it('shows the plain request form with no notice when the link is fine or there is none', () => {
    for (const status of ['none', 'pending', 'ok']) {
      mockUseEmailLink.mockReturnValue(status);
      const html = renderToStaticMarkup(<RecoverForm />);
      expect(html).not.toContain('El enlace caducó o ya se usó; pide uno nuevo.');
      expect(html).toContain('<form');
    }
  });
});
