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
  'min-h-11 border-border text-fg-muted focus-visible:outline-focus cursor-pointer border-r px-4 text-sm font-semibold last:border-r-0 focus-visible:outline-2 focus-visible:outline-offset-2';
const SEGMENT_ON = 'bg-primary text-primary-fg';
const BUTTON =
  'border-border bg-bg-raised text-fg rounded-md focus-visible:outline-focus min-h-11 cursor-pointer border px-4 text-sm font-semibold hover:border-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-45';
const SELECT =
  'border-border bg-bg text-fg rounded-sm focus-visible:outline-focus min-h-11 border px-2 font-mono text-sm focus-visible:outline-2 focus-visible:outline-offset-2';

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
}

/** The segmented tool picker: one radio per tool, as docs/DESIGN.md §5 describes. */
function ToolGroup({ tool, onTool }: Pick<ToolbarProps, 'tool' | 'onTool'>): JSX.Element {
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
          className={`${SEGMENT} ${tool === name ? SEGMENT_ON : ''}`}
        >
          {t(`sims.trackEditor.tool.${name}`)}
        </button>
      ))}
    </div>
  );
}

/** The file input dressed as a button (docs/DESIGN.md §5, Botón secundario). */
function LoadButton({ onLoad }: Pick<ToolbarProps, 'onLoad'>): JSX.Element {
  const t = useT();
  const pickFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file !== undefined) onLoad(file);
    event.target.value = '';
  };
  return (
    <label className={`${BUTTON} inline-flex items-center`}>
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

/** The preset picker; it goes back to its empty option so picking the same one twice works. */
function PresetPicker({ onPreset }: Pick<ToolbarProps, 'onPreset'>): JSX.Element {
  const t = useT();
  const pickPreset = (event: ChangeEvent<HTMLSelectElement>): void => {
    const name = event.target.value;
    if (isPresetName(name)) onPreset(name);
    event.target.value = '';
  };
  return (
    <label className="text-fg-muted flex items-center gap-2 text-sm">
      {t('sims.trackEditor.preset')}
      <select
        aria-label={t('sims.trackEditor.preset')}
        className={SELECT}
        defaultValue=""
        onChange={pickPreset}
      >
        <option value="">{'—'}</option>
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
 * Toolbar of the track editor: tools, undo/redo, save, load and the preset picker. Every control
 * carries its own label and reaches 44 px, so the whole bar is operable by keyboard and on a
 * phone (docs/DESIGN.md §8 and §9 point 3).
 */
export function Toolbar(props: ToolbarProps): JSX.Element {
  const { tool, onTool, canUndo, canRedo, onUndo, onRedo, onSave, onLoad, onPreset } = props;
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="track-editor-toolbar">
      <ToolGroup tool={tool} onTool={onTool} />
      <button
        type="button"
        aria-label={t('sims.trackEditor.undo')}
        className={BUTTON}
        onClick={onUndo}
        disabled={!canUndo}
      >
        {t('sims.trackEditor.undo')}
      </button>
      <button
        type="button"
        aria-label={t('sims.trackEditor.redo')}
        className={BUTTON}
        onClick={onRedo}
        disabled={!canRedo}
      >
        {t('sims.trackEditor.redo')}
      </button>
      <button
        type="button"
        aria-label={t('sims.trackEditor.save')}
        className={BUTTON}
        onClick={onSave}
      >
        {t('sims.trackEditor.save')}
      </button>
      <LoadButton onLoad={onLoad} />
      <PresetPicker onPreset={onPreset} />
    </div>
  );
}
