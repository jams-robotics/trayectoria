import { describe, expect, it, vi } from 'vitest';

vi.mock('@trayectoria/auth', () => ({ verifyEmailLink: vi.fn() }));

const { emailLinkFrom, withoutEmailLink } = await import('./emailLink');

describe('emailLinkFrom (#518)', () => {
  it('reads the token_hash and the type of the links of the templates', () => {
    expect(emailLinkFrom('?token_hash=pkce_abc&type=email')).toEqual({
      tokenHash: 'pkce_abc',
      type: 'email',
    });
    expect(emailLinkFrom('?token_hash=pkce_def&type=recovery')).toEqual({
      tokenHash: 'pkce_def',
      type: 'recovery',
    });
  });

  it('ignores a page without a link, without a hash or with another type', () => {
    expect(emailLinkFrom('')).toBeNull();
    expect(emailLinkFrom('?type=email')).toBeNull();
    expect(emailLinkFrom('?token_hash=&type=email')).toBeNull();
    expect(emailLinkFrom('?token_hash=pkce_abc&type=signup')).toBeNull();
    expect(emailLinkFrom('?token_hash=pkce_abc')).toBeNull();
  });
});

describe('withoutEmailLink (#518)', () => {
  it('removes the link parameters and keeps the rest of the URL', () => {
    expect(withoutEmailLink('https://trayectoria.org/cuenta?token_hash=pkce_abc&type=email')).toBe(
      'https://trayectoria.org/cuenta',
    );
    expect(
      withoutEmailLink('https://trayectoria.org/auth/recuperar?a=1&token_hash=x&type=recovery#top'),
    ).toBe('https://trayectoria.org/auth/recuperar?a=1#top');
  });
});
