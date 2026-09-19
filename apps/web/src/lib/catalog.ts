/** Where the simulator of F5-01b opens an arm; the page does not exist until then. */
export function simulatorHref(id: string): string {
  return `/simuladores/brazo?robot=${encodeURIComponent(id)}`;
}

/** Page of an arm inside the catalog. */
export function armHref(id: string): string {
  return `/brazos/${id}`;
}

/**
 * Formats a length in metres with the unit in the label, per docs/STANDARDS.md §3: the number
 * carries no unit suffix in the text, the caller puts it in the label.
 */
export function formatMetres(value_m: number): string {
  return value_m.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Formats an approximate cost in US dollars, rounded to whole dollars. */
export function formatUsd(cost_usd: number): string {
  return cost_usd.toLocaleString('es', { maximumFractionDigits: 0 });
}

/** Formats a mass in kilograms, or `undefined` when the source documents no figure. */
export function formatKilograms(value_kg: number | null): string | undefined {
  if (value_kg === null) return undefined;
  return value_kg.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
