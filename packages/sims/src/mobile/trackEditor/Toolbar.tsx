import type { ChangeEvent, JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import { presets } from '@trayectoria/sim-core';
import type { PresetName } from '@trayectoria/sim-core';

import type { TrackTool } from './useTrackEditor';

/** Tools of the segmented control, in the order of the spec of #126. */
const TOOLS: readonly TrackTool[] = ['select', 'line', 'arc', 'erase'];

/** True when `name` is one of the built-in presets of sim-core. */
function isPresetName(name: string): name is PresetName {
  return Object.hasOwn(presets, name);
}

/** Preset names of sim-core, in the order they are offered. */
const PRESET_NAMES: readonly PresetName[] = Object.keys(presets).filter(isPresetName);

// docs/DESIGN.md §5 (Tabs/segmentado) and §8: 44 px targets, visible focus, tokens only.
const SEGMENT =
  'min-h-11 border-border text-fg-muted focus-visible:outline-focus shrink-0 cursor-pointer border-r font-semibold last:border-r-0 focus-visible:outline-2 focus-visible:outline-offset-2';
const SEGMENT_ON = 'bg-primary text-primary-fg';
const BUTTON =
  'border-border bg-bg-raised text-fg rounded-md focus-visible:outline-focus min-h-11 shrink-0 cursor-pointer border font-semibold hover:border-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-45';
const SELECT =
  'border-border bg-bg text-fg rounded-sm focus-visible:outline-focus min-h-11 shrink-0 border px-2 font-mono focus-visible:outline-2 focus-visible:outline-offset-2';

// #189 (decisión 1): en una sola fila los controles de la barra —cuatro herramientas, deshacer,
// rehacer, guardar, cargar, «Nueva» (#190) y el preset— tienen que caber en la caja del visor,
// que a 1280 px mide unos 730 px. Con el padding y el cuerpo de siempre piden ~840 px y los últimos quedaban fuera, así que
// en esa maqueta van con 8 px de padding y el cuerpo `xs`, el mínimo de docs/DESIGN.md §9.2. El
// alto de 44 px no se toca: es el objetivo táctil de docs/DESIGN.md §5.
const PAD = 'px-4';
const PAD_TIGHT = 'px-2';
const TEXT = 'text-sm';
const TEXT_TIGHT = 'text-xs';

/** Las dos clases que aprietan un control de la barra: su padding lateral y su cuerpo. */
interface Sizing {
  readonly pad: string;
  readonly text: string;
}

export interface ToolbarProps {
  tool: TrackTool;
  onTool: (tool: TrackTool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onLoad: (file: File) => void;
  onPreset: (name: PresetName) => void;
  /** «Nueva»: deja el lienzo vacío, preguntando antes si hay algo que perder (#190, decisión 1). */
  onNew: () => void;
  /**
   * Toda la barra en una sola fila (#189, decisión 1). La usa la página cuando el editor ocupa la
   * caja del visor: allí una segunda fila se come el alto del lienzo. Sin ella la barra se reparte
   * en varias líneas cuando no cabe, que es como se ve en el playground.
   */
  singleRow?: boolean;
}

/** The segmented tool picker: one radio per tool, as docs/DESIGN.md §5 describes. */
function ToolGroup({
  tool,
  onTool,
  size,
}: Pick<ToolbarProps, 'tool' | 'onTool'> & { size: Sizing }): JSX.Element {
  const t = useT();
  return (
    <div
      role="radiogroup"
      aria-label={t('sims.trackEditor.tools')}
      className="border-border rounded-md flex overflow-hidden border"
    >
      {TOOLS.map((name) => (
        <button
          key={name}
          type="button"
          role="radio"
          aria-checked={tool === name}
          aria-label={t(`sims.trackEditor.tool.${name}`)}
          data-tool={name}
          onClick={() => {
            onTool(name);
          }}
          className={`${SEGMENT} ${size.pad} ${size.text} ${tool === name ? SEGMENT_ON : ''}`}
        >
          {t(`sims.trackEditor.tool.${name}`)}
        </button>
      ))}
    </div>
  );
}

/** The file input dressed as a button (docs/DESIGN.md §5, Botón secundario). */
function LoadButton({
  onLoad,
  size,
}: Pick<ToolbarProps, 'onLoad'> & { size: Sizing }): JSX.Element {
  const t = useT();
  const pickFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file !== undefined) onLoad(file);
    event.target.value = '';
  };
  return (
    <label className={`${BUTTON} ${size.pad} ${size.text} inline-flex items-center`}>
      {t('sims.trackEditor.load')}
      <input
        type="file"
        accept="application/json,.json"
        aria-label={t('sims.trackEditor.loadInput')}
        onChange={pickFile}
        className="sr-only"
      />
    </label>
  );
}

/** Valor de la opción «Vacía» del selector, que no es un preset de sim-core (#190, decisión 2). */
const EMPTY_OPTION = 'empty';

/**
 * The preset picker; it goes back to its placeholder so picking the same one twice works. Its
 * first option is «Vacía», que equivale a «Nueva»: vaciar el lienzo es una forma más de partir de
 * cero, y quien busca la pista de la que arrancar mira aquí (#190, decisión 2).
 */
function PresetPicker({
  onPreset,
  onNew,
  size,
}: Pick<ToolbarProps, 'onPreset' | 'onNew'> & { size: Sizing }): JSX.Element {
  const t = useT();
  const pickPreset = (event: ChangeEvent<HTMLSelectElement>): void => {
    const name = event.target.value;
    if (name === EMPTY_OPTION) onNew();
    else if (isPresetName(name)) onPreset(name);
    event.target.value = '';
  };
  return (
    <label className={`text-fg-muted flex shrink-0 items-center gap-2 ${size.text}`}>
      {t('sims.trackEditor.preset')}
      <select
        aria-label={t('sims.trackEditor.preset')}
        className={`${SELECT} ${size.text}`}
        defaultValue=""
        onChange={pickPreset}
      >
        <option value="">{'—'}</option>
        <option value={EMPTY_OPTION}>{t('sims.trackEditor.presetName.empty')}</option>
        {PRESET_NAMES.map((name) => (
          <option key={name} value={name}>
            {t(`sims.trackEditor.presetName.${name}`)}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * De dónde sale la pista entera: cargarla de un archivo, empezar una en blanco o partir de un
 * preset (#190, decisiones 1 y 2). «Nueva» va junto a «Cargar» y al selector porque las tres
 * responden a la misma pregunta, y no junto a las herramientas de dibujo.
 */
function TrackGroup({
  onLoad,
  onNew,
  onPreset,
  size,
}: Pick<ToolbarProps, 'onLoad' | 'onNew' | 'onPreset'> & { size: Sizing }): JSX.Element {
  const t = useT();
  return (
    <>
      <LoadButton onLoad={onLoad} size={size} />
      <button
        type="button"
        aria-label={t('sims.trackEditor.newTrack')}
        data-testid="track-editor-new"
        className={`${BUTTON} ${size.pad} ${size.text}`}
        onClick={onNew}
      >
        {t('sims.trackEditor.newTrack')}
      </button>
      <PresetPicker onPreset={onPreset} onNew={onNew} size={size} />
    </>
  );
}

/**
 * Toolbar of the track editor: tools, undo/redo, save, load and the preset picker. Every control
 * carries its own label and reaches 44 px, so the whole bar is operable by keyboard and on a
 * phone (docs/DESIGN.md §8 and §9 point 3).
 */
export function Toolbar(props: ToolbarProps): JSX.Element {
  const { tool, onTool, canUndo, canRedo, onUndo, onRedo, onSave, onLoad, onPreset } = props;
  const { onNew } = props;
  const t = useT();
  // En una sola fila la barra no envuelve y desplaza en horizontal lo que no quepa, en lugar de
  // robarle una segunda fila al lienzo (#189, decisión 1).
  const tight = props.singleRow === true;
  // Una sola fila desde `md`: a 390 px los controles no caben ni apretados, y una fila que
  // se desplaza en horizontal esconde justo el selector de herramienta (docs/DESIGN.md §9.3), así
  // que en móvil la barra sigue repartiéndose en varias líneas.
  const layout = tight ? 'flex-wrap gap-2 md:flex-nowrap' : 'flex-wrap gap-3';
  const size: Sizing = tight ? { pad: PAD_TIGHT, text: TEXT_TIGHT } : { pad: PAD, text: TEXT };
  return (
    <div className={`flex shrink-0 items-center ${layout}`} data-testid="track-editor-toolbar">
      <ToolGroup tool={tool} onTool={onTool} size={size} />
      <button
        type="button"
        aria-label={t('sims.trackEditor.undo')}
        className={`${BUTTON} ${size.pad} ${size.text}`}
        onClick={onUndo}
        disabled={!canUndo}
      >
        {t('sims.trackEditor.undo')}
      </button>
      <button
        type="button"
        aria-label={t('sims.trackEditor.redo')}
        className={`${BUTTON} ${size.pad} ${size.text}`}
        onClick={onRedo}
        disabled={!canRedo}
      >
        {t('sims.trackEditor.redo')}
      </button>
      <button
        type="button"
        aria-label={t('sims.trackEditor.save')}
        className={`${BUTTON} ${size.pad} ${size.text}`}
        onClick={onSave}
      >
        {t('sims.trackEditor.save')}
      </button>
      <TrackGroup onLoad={onLoad} onNew={onNew} onPreset={onPreset} size={size} />
    </div>
  );
}
