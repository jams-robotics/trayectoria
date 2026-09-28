import { describe, expect, it } from 'vitest';

import { CONTACT_EMAIL, COFFEE_URL, mailtoHref, reportEmailHref, reportIssueUrl } from './contact';

describe('contact', () => {
  it('uses the domain contact address, never a personal one (#591, #605)', () => {
    expect(CONTACT_EMAIL).toBe('contacto@trayectoria.org');
  });

  it('points the coffee link at the Ko-fi page (#605)', () => {
    expect(COFFEE_URL).toBe('https://ko-fi.com/jams286');
  });

  it('builds a mailto link with an encoded subject', () => {
    expect(mailtoHref(CONTACT_EMAIL, 'Hola mundo')).toBe(
      `mailto:${CONTACT_EMAIL}?subject=Hola+mundo`,
    );
  });

  it('builds the mailto alternative to report an error in a place', () => {
    expect(reportEmailHref('m04-t02')).toBe(
      `mailto:${CONTACT_EMAIL}?subject=%5BTrayectoria%5D+Error+en+m04-t02`,
    );
  });

  it('builds the prefilled issue URL for the reporte-tema template', () => {
    const url = reportIssueUrl({
      title: '[Tema m04-t02] ',
      label: 'contenido',
      tema: 'ruta-1/m04-t02',
    });
    expect(url).toBe(
      'https://github.com/jams-robotics/trayectoria/issues/new?' +
        'template=reporte-tema.yml&title=%5BTema+m04-t02%5D+&labels=contenido&tema=ruta-1%2Fm04-t02',
    );
  });

  it('builds the bug-labelled issue URL for a simulator or the arm catalog', () => {
    const url = reportIssueUrl({
      title: '[Simulador] ',
      label: 'bug',
      tema: 'simuladores/brazo',
    });
    expect(url).toContain('labels=bug');
    expect(url).toContain('tema=simuladores%2Fbrazo');
  });
});
