const REPO = 'https://github.com/jams-robotics/trayectoria';

/**
 * Contact address for the whole site (#591): the public one of the organisation while there is
 * no domain. `mailto:` links built from it go through `reportEmailHref` / `mailtoHref`, never
 * concatenated by hand.
 */
export const CONTACT_EMAIL = 'Jaime286tm@gmail.com';

/**
 * "Invite me for a coffee" link. Empty until the owner defines it (#591, decision 2): callers
 * must hide the element while this is `''`, and the i18n key stays ready for when it is filled.
 */
export const COFFEE_URL = '';

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
