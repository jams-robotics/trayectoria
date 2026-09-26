import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';
import { Formula } from '@trayectoria/widgets';

import { MatrixBlock } from './MatrixBlock';
import { matrixRows } from './matrices';
import type { LinkTransform } from './matrices';

// F5-02 (#135, decisions 1, 3 and 7): the chain `⁰T_n = ⁰T_1 · … · ⁿ⁻¹T_n` with `Formula` and the
// chosen matrix with `MatrixBlock`. The chips are `aria-pressed` buttons inside a
// `radiogroup` (docs/DESIGN.md §5, chip version). No number comes from three: they all come from
// `matrices.ts`, which builds them with sim-core (docs/ARCHITECTURE.md §4.5).

/** Which of the three matrices of a link is shown. */
export type MatrixKind = 'origin' | 'joint' | 'cumulative';

/** The three matrices, in chip order. */
const KINDS: readonly MatrixKind[] = ['origin', 'joint', 'cumulative'];

/**
 * Short key of the two matrices with a fixed name; the cumulative one is not here because its name
 * carries the link index (`⁰T₂`) and is built by `matrixLabel`.
 */
const SHORT_KEY: Readonly<Record<'origin' | 'joint', string>> = {
  origin: 'sims.matrices.originShort',
  joint: 'sims.matrices.jointShort',
};

/** Long key of each matrix, the one used in the chip's `aria-label` and in the live region. */
const LONG_KEY: Readonly<Record<MatrixKind, string>> = {
  origin: 'sims.matrices.origin',
  joint: 'sims.matrices.joint',
  cumulative: 'sims.matrices.cumulative',
};

/** Superscript and subscript digits, to label `⁰T₂` without depending on KaTeX. */
const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const SUBSCRIPT = '₀₁₂₃₄₅₆₇₈₉';

/** Converts an integer to Unicode superscript or subscript. */
function toIndexText(value: number, digits: string): string {
  return [...String(value)].map((digit) => digits[Number(digit)] ?? digit).join('');
}

/**
 * The explicit chain `⁰T_n = ⁰T_1 · ¹T_2 · … · ⁿ⁻¹T_n` in LaTeX, or `null` if the chain has
 * no link beyond the base.
 */
export function chainLatex(linkCount: number): string | null {
  if (linkCount < 1) return null;
  const factors = Array.from(
    { length: linkCount },
    (_unused, index) => `{}^{${String(index)}}T_{${String(index + 1)}}`,
  );
  return `{}^{0}T_{${String(linkCount)}} = ${factors.join(' \\cdot ')}`;
}

/** Visible name of the matrix: the cumulative one is numbered with the link (`⁰T₂`). */
export function matrixLabel(kind: MatrixKind, index: number, t: Translate): string {
  if (kind !== 'cumulative') return t(SHORT_KEY[kind]);
  return `${toIndexText(0, SUPERSCRIPT)}T${toIndexText(index, SUBSCRIPT)}`;
}

/** A group of mutually exclusive chips: `aria-pressed` buttons with the radio role (docs/DESIGN.md §5). */
function ChipGroup<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: readonly { readonly value: T; readonly text: string; readonly title: string }[];
  selected: T;
  onSelect: (value: T) => void;
}): JSX.Element {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-pressed={active}
            aria-label={option.title}
            className={`rounded-sm border px-[10px] py-[3px] font-mono text-xs ${
              active
                ? 'bg-primary text-primary-fg border-primary'
                : 'border-border text-fg-muted bg-bg-raised'
            }`}
            onClick={() => {
              onSelect(option.value);
            }}
          >
            {option.text}
          </button>
        );
      })}
    </div>
  );
}

/** The two rows of chips of the panel: the link and the matrix (docs/DESIGN.md §6). */
function Chips({
  rows,
  index,
  selectedLink,
  kind,
  onLink,
  onKind,
}: {
  rows: readonly LinkTransform[];
  index: number;
  selectedLink: string;
  kind: MatrixKind;
  onLink: (link: string) => void;
  onKind: (kind: MatrixKind) => void;
}): JSX.Element {
  const t = useT();
  return (
    <>
      <ChipGroup
        label={t('sims.matrices.links')}
        selected={selectedLink}
        onSelect={onLink}
        options={rows.map((entry) => ({ value: entry.link, text: entry.link, title: entry.link }))}
      />
      <ChipGroup
        label={t('sims.matrices.matrix')}
        selected={kind}
        onSelect={onKind}
        options={KINDS.map((value) => ({
          value,
          // The cumulative one is numbered with the chosen link, like the matrix it shows (`⁰T₂`).
          text: matrixLabel(value, index, t),
          title: t(LONG_KEY[value]),
        }))}
      />
    </>
  );
}

export interface MatrixPanelProps {
  /** The matrices of each link of the chain, from `linkTransforms`. */
  rows: readonly LinkTransform[];
  /** Reports which link is chosen, to highlight it in 3D. */
  onHighlightLink?: ((link: string | null) => void) | undefined;
}

/** The chosen matrix within the link's row. */
function transformOf(row: LinkTransform, kind: MatrixKind): readonly number[] {
  if (kind === 'origin') return row.T_origin;
  return kind === 'joint' ? row.T_joint : row.T_cumulative;
}

/** What the panel has chosen: the link, the matrix and the index of the link in the chain. */
interface Selection {
  readonly selectedLink: string | null;
  readonly setLink: (link: string) => void;
  readonly kind: MatrixKind;
  readonly setKind: (kind: MatrixKind) => void;
  readonly index: number;
}

/**
 * The chosen link and matrix. If the arm changes, the chosen link may cease to exist:
 * it falls back to the last one in the chain. Reports outward which one it is, to highlight it in 3D.
 */
function useSelection(
  rows: readonly LinkTransform[],
  onHighlightLink: ((link: string | null) => void) | undefined,
): Selection {
  const lastLink = rows.at(-1)?.link ?? null;
  const [link, setLink] = useState<string | null>(lastLink);
  const [kind, setKind] = useState<MatrixKind>('cumulative');
  const selectedLink = rows.some((row) => row.link === link) ? link : lastLink;

  useEffect(() => {
    onHighlightLink?.(selectedLink);
  }, [onHighlightLink, selectedLink]);

  return {
    selectedLink,
    setLink,
    kind,
    setKind,
    index: rows.findIndex((row) => row.link === selectedLink),
  };
}

/**
 * Matrix panel of the arm (docs/DESIGN.md §6): the chain of transforms, the chips to
 * choose link and matrix, and the corresponding 4×4 matrix. It updates with `q` because `rows`
 * is recomputed outside.
 */
export function MatrixPanel({ rows, onHighlightLink }: MatrixPanelProps): JSX.Element | null {
  const t = useT();
  const { selectedLink, setLink, kind, setKind, index } = useSelection(rows, onHighlightLink);

  const row = rows[index];
  if (row === undefined || selectedLink === null) return null;

  const latex = chainLatex(rows.length - 1);
  const label = matrixLabel(kind, index, t);
  const values = matrixRows(transformOf(row, kind))
    .map((cells) => cells.join(' '))
    .join('; ');

  return (
    <section
      aria-label={t('sims.matrices.title')}
      data-testid="matrix-panel"
      className="flex w-0 min-w-full flex-col gap-3"
    >
      <h3 className="text-fg-muted font-mono text-xs tracking-[0.06em] uppercase">
        {t('sims.matrices.title')}
      </h3>
      {latex === null ? null : (
        <div aria-label={t('sims.matrices.chain')} data-testid="matrix-chain">
          <Formula latex={latex} />
        </div>
      )}
      <Chips
        rows={rows}
        index={index}
        selectedLink={selectedLink}
        kind={kind}
        onLink={setLink}
        onKind={setKind}
      />
      <MatrixBlock transform={transformOf(row, kind)} label={label} link={selectedLink} />
      <p className="sr-only" aria-live="polite" data-testid="matrix-panel-live">
        {t('sims.matrices.summary', { matrix: label, link: selectedLink, values })}
      </p>
    </section>
  );
}
