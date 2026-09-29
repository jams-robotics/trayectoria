// The catalog card (`catalog/arms/<id>/ficha.json`) as the viewer reads it (#535 and #556). The
// full card is validated at build time by `apps/web` against `catalog/arms/ficha.schema.json`;
// here only the fields the viewer uses are checked, and a card that cannot be read is not an
// error of the viewer: the arm is drawn with the default framing and the URDF names.

/** File name of the catalog card of an arm, next to its URDF. */
export const FICHA_FILE = 'ficha.json';

/** Readable names of the joints and links of an arm, by URDF name (#535). */
export interface ArmLabels {
  readonly joints: ReadonlyMap<string, string>;
  readonly links: ReadonlyMap<string, string>;
}

/** An arm without readable names: every label falls back to the URDF name. */
export const NO_LABELS: ArmLabels = { joints: new Map(), links: new Map() };

/**
 * What the viewer takes from the card: the reach that frames the initial camera (#556) and the
 * readable labels (#535). A zip import has no card.
 */
export interface ArmFicha {
  /** Reach of the arm, in metres. */
  readonly reach_m: number;
  readonly labels: ArmLabels;
}

/** The readable label of `id`, or `id` itself when the card gives none. */
export function labelOf(labels: ReadonlyMap<string, string>, id: string): string {
  return labels.get(id) ?? id;
}

/** A `*_labels` map of a card: only its non-empty string entries; anything else is ignored. */
function labelMapOf(value: unknown): ReadonlyMap<string, string> {
  if (typeof value !== 'object' || value === null) return new Map();
  return new Map(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '',
    ),
  );
}

/** What the viewer needs from a parsed card, or `null` if it has no positive `reach_m`. */
export function parseFicha(value: unknown): ArmFicha | null {
  if (typeof value !== 'object' || value === null) return null;
  const reach_m: unknown = Reflect.get(value, 'reach_m');
  if (typeof reach_m !== 'number' || !Number.isFinite(reach_m) || reach_m <= 0) return null;
  return {
    reach_m,
    labels: {
      joints: labelMapOf(Reflect.get(value, 'joint_labels')),
      links: labelMapOf(Reflect.get(value, 'link_labels')),
    },
  };
}

/** Downloads and parses the card at `url`; `null` on any failure (see the module note). */
export async function fetchFicha(url: string, request: typeof fetch): Promise<ArmFicha | null> {
  try {
    const response = await request(url);
    if (!response.ok) return null;
    const body: unknown = await response.json();
    return parseFicha(body);
  } catch {
    return null;
  }
}
