const REPO = 'https://github.com/jams-robotics/trayectoria';

/**
 * Contact address for the whole site (#591): the domain address, forwarded by Cloudflare Email
 * Routing. Never a personal address. `mailto:` links built from it go through `reportEmailHref` / `mailtoHref`, never
 * concatenated by hand.
 */
export const CONTACT_EMAIL = 'contacto@trayectoria.org';

/**
 * "Invite me for a coffee" link (#591, #605). Callers hide the element if this is ever `''`.
 */
export const COFFEE_URL: string = 'https://ko-fi.com/jams286';

/** `mailto:` link with a prefilled subject, built with `URLSearchParams` (never string concatenation). */
export function mailtoHref(email: string, subject: string): string {
  return `mailto:${email}?${new URLSearchParams({ subject }).toString()}`;
}

/** The `mailto:` alternative to report an error in a topic, a simulator or the arm catalog. */
export function reportEmailHref(place: string): string {
  return mailtoHref(CONTACT_EMAIL, `[Trayectoria] Error en ${place}`);
}

/**
 * GitHub issue link, prefilled with the `reporte-tema.yml` form template (#591): title, label and
 * the `tema` field the template declares. Built with `URLSearchParams`, never by concatenating
 * unencoded text.
 */
export function reportIssueUrl(options: { title: string; label: string; tema: string }): string {
  const params = new URLSearchParams({
    template: 'reporte-tema.yml',
    title: options.title,
    labels: options.label,
    tema: options.tema,
  });
  return `${REPO}/issues/new?${params.toString()}`;
}
