import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';
import { Formula } from '@trayectoria/widgets';

import { MatrixBlock } from './MatrixBlock';
import { matrixRows } from './matrices';
import type { LinkTransform } from './matrices';

// F5-02 (#135, decisiones 1, 3 y 7): la cadena `⁰T_n = ⁰T_1 · … · ⁿ⁻¹T_n` con `Formula` y la
// matriz elegida con `MatrixBlock`. Los chips son botones `aria-pressed` dentro de un
// `radiogroup` (docs/DESIGN.md §5, versión chip). Ningún número sale de three: todos vienen de
// `matrices.ts`, que los construye con sim-core (docs/ARCHITECTURE.md §4.5).

/** Cuál de las tres matrices de un eslabón se muestra. */
export type MatrixKind = 'origin' | 'joint' | 'cumulative';

/** Las tres matrices, en el orden de los chips. */
const KINDS: readonly MatrixKind[] = ['origin', 'joint', 'cumulative'];

/**
 * Clave corta de las dos matrices de nombre fijo; la acumulada no está aquí porque su nombre
 * lleva el índice del eslabón (`⁰T₂`) y lo construye `matrixLabel`.
 */
const SHORT_KEY: Readonly<Record<'origin' | 'joint', string>> = {
  origin: 'sims.matrices.originShort',
  joint: 'sims.matrices.jointShort',
};

/** Clave larga de cada matriz, la que va en el `aria-label` del chip y en la región viva. */
const LONG_KEY: Readonly<Record<MatrixKind, string>> = {
  origin: 'sims.matrices.origin',
  joint: 'sims.matrices.joint',
  cumulative: 'sims.matrices.cumulative',
};

/** Dígitos en superíndice y en subíndice, para etiquetar `⁰T₂` sin depender de KaTeX. */
const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const SUBSCRIPT = '₀₁₂₃₄₅₆₇₈₉';

/** Pasa un entero a superíndice o subíndice Unicode. */
function toIndexText(value: number, digits: string): string {
  return [...String(value)].map((digit) => digits[Number(digit)] ?? digit).join('');
}

/**
 * La cadena explícita `⁰T_n = ⁰T_1 · ¹T_2 · … · ⁿ⁻¹T_n` en LaTeX, o `null` si la cadena no
 * tiene ningún eslabón más allá de la base.
 */
export function chainLatex(linkCount: number): string | null {
  if (linkCount < 1) return null;
  const factors = Array.from(
    { length: linkCount },
    (_unused, index) => `{}^{${String(index)}}T_{${String(index + 1)}}`,
  );
  return `{}^{0}T_{${String(linkCount)}} = ${factors.join(' \\cdot ')}`;
}

/** Nombre visible de la matriz: la acumulada se numera con el eslabón (`⁰T₂`). */
export function matrixLabel(kind: MatrixKind, index: number, t: Translate): string {
  if (kind !== 'cumulative') return t(SHORT_KEY[kind]);
  return `${toIndexText(0, SUPERSCRIPT)}T${toIndexText(index, SUBSCRIPT)}`;
}

/** Un grupo de chips excluyentes: botones `aria-pressed` con rol de radio (docs/DESIGN.md §5). */
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

/** Las dos filas de chips del panel: el eslabón y la matriz (docs/DESIGN.md §6). */
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
          // La acumulada se numera con el eslabón elegido, como la matriz que muestra (`⁰T₂`).
          text: matrixLabel(value, index, t),
          title: t(LONG_KEY[value]),
        }))}
      />
    </>
  );
}

export interface MatrixPanelProps {
  /** Las matrices de cada eslabón de la cadena, de `linkTransforms`. */
  rows: readonly LinkTransform[];
  /** Avisa de qué eslabón está elegido, para resaltarlo en 3D. */
  onHighlightLink?: ((link: string | null) => void) | undefined;
}

/** La matriz elegida dentro de la fila del eslabón. */
function transformOf(row: LinkTransform, kind: MatrixKind): readonly number[] {
  if (kind === 'origin') return row.T_origin;
  return kind === 'joint' ? row.T_joint : row.T_cumulative;
}

/** Lo que el panel tiene elegido: el eslabón, la matriz y el índice del eslabón en la cadena. */
interface Selection {
  readonly selectedLink: string | null;
  readonly setLink: (link: string) => void;
  readonly kind: MatrixKind;
  readonly setKind: (kind: MatrixKind) => void;
  readonly index: number;
}

/**
 * El eslabón y la matriz elegidos. Si cambia el brazo, el eslabón elegido puede dejar de existir:
 * se vuelve al último de la cadena. Avisa fuera de cuál es, para resaltarlo en 3D.
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
 * Panel de matrices del brazo (docs/DESIGN.md §6): la cadena de transformaciones, los chips para
 * elegir eslabón y matriz, y la matriz 4×4 correspondiente. Se actualiza con `q` porque `rows`
 * se recalcula fuera.
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
      className="flex flex-col gap-3"
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
