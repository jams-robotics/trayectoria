import type { ChangeEvent, JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import { presets } from '@trayectoria/sim-core';
import type { PresetName } from '@trayectoria/sim-core';

import { SaveTrackField } from './SaveTrackField';
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

// #189 (decisión 1): beside the simulator side panel the bar controls —four tools, undo, redo,
// export, import, «Nueva» (#190), «Guardar» (#191) and the preset— go with 8 px of padding and the
// `xs` body, the minimum of docs/DESIGN.md §9.2. Even so they ask for ~920 px and the viewer box
// measures 672 px at 1280 px, so the bar wraps into a second row (#225). The 44 px height is the
// touch target of docs/DESIGN.md §5.
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
   * Saves the track under the name the learner types, in the account or in the browser (F4-06,
   * #191, decision 3). Without it the bar shows no «Guardar»: the playground and its snapshots
   * stay as they were.
   */
  onSaveTrack?: (name: string) => void;
  /**
   * Compact controls for the viewer box (#189, decision 1): tighter padding and body so the bar
   * takes as few rows as possible. It still wraps when it does not fit (#225).
   */
  compact?: boolean;
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
      className="border-border rounded-md flex shrink-0 overflow-hidden border"
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
      {t('sims.trackEditor.importJson')}
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

/** A text button of the bar, with its label and its size. */
function BarButton({
  label,
  size,
  disabled,
  onClick,
}: {
  label: string;
  size: Sizing;
  disabled?: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      className={`${BUTTON} ${size.pad} ${size.text}`}
      onClick={onClick}
      disabled={disabled === true}
    >
      {label}
    </button>
  );
}

/** Undo, redo and «Exportar JSON»: what acts on the track already on the canvas. */
function HistoryGroup({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  size,
}: Pick<ToolbarProps, 'canUndo' | 'canRedo' | 'onUndo' | 'onRedo' | 'onSave'> & {
  size: Sizing;
}): JSX.Element {
  const t = useT();
  return (
    <>
      <BarButton label={t('sims.trackEditor.undo')} size={size} disabled={!canUndo} onClick={onUndo} />
      <BarButton label={t('sims.trackEditor.redo')} size={size} disabled={!canRedo} onClick={onRedo} />
      <BarButton label={t('sims.trackEditor.exportJson')} size={size} onClick={onSave} />
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
  const { onNew, onSaveTrack } = props;
  const tight = props.compact === true;
  // The bar wraps at every width: a row that does not fit would squeeze the tool picker away
  // (docs/DESIGN.md §9.3), and the tools keep their touch size (#225).
  const layout = tight ? 'flex-wrap gap-2' : 'flex-wrap gap-3';
  const size: Sizing = tight ? { pad: PAD_TIGHT, text: TEXT_TIGHT } : { pad: PAD, text: TEXT };
  return (
    <div className={`flex shrink-0 items-center ${layout}`} data-testid="track-editor-toolbar">
      <ToolGroup tool={tool} onTool={onTool} size={size} />
      <HistoryGroup
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        onSave={onSave}
        size={size}
      />
      {onSaveTrack === undefined ? null : (
        <SaveTrackField onSave={onSaveTrack} pad={size.pad} text={size.text} />
      )}
      <TrackGroup onLoad={onLoad} onNew={onNew} onPreset={onPreset} size={size} />
    </div>
  );
}
