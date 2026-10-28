import { useRef, useState, useSyncExternalStore } from 'react';
import type { DragEvent, JSX, RefObject } from 'react';
import { useT } from '@trayectoria/i18n';

import { LIFT_RANGE_MM, SCALE_RANGE, turned } from './model/adjust';
import type { ModelAdjust } from './model/adjust';
import { MAX_MODEL_BYTES } from './model/modelFile';
import {
  adjustOwnModel,
  getOwnModel,
  installModel,
  removeOwnModel,
  subscribeOwnModel,
} from './model/ownModel';
import type { InstallError } from './model/ownModel';

const BUTTON =
  'rounded-md border border-border bg-bg px-3 py-1 text-sm text-fg hover:border-fg-muted';
const AXES = [
  [0, 'rotX'],
  [1, 'rotY'],
  [2, 'rotZ'],
] as const;

function FileInput({
  input,
  onFile,
}: {
  input: RefObject<HTMLInputElement | null>;
  onFile: (file: File) => void;
}): JSX.Element {
  return (
    <input
      ref={input}
      type="file"
      accept=".stl,.glb"
      className="hidden"
      data-testid="own-model-input"
      onChange={(event) => {
        const file = event.target.files?.[0];
        if (file !== undefined) onFile(file);
        event.target.value = '';
      }}
    />
  );
}

function DropZone({ onFile }: { onFile: (file: File) => void }): JSX.Element {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const drop = (event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    setOver(false);
    const file = event.dataTransfer.files[0];
    if (file !== undefined) onFile(file);
  };
  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
      className={`flex flex-col gap-1 rounded-md border border-dashed p-3 text-center text-sm text-fg-muted transition-colors ${
        over ? 'border-primary bg-primary/10' : 'border-border hover:border-fg-muted'
      }`}
    >
      <span className="font-semibold text-fg">{t('sims.arena.ownModel.pick')}</span>
      <span className="text-xs">
        {t('sims.arena.ownModel.limit', { mb: MAX_MODEL_BYTES / (1024 * 1024) })}
      </span>
      <FileInput input={input} onFile={onFile} />
    </button>
  );
}

function ScaleRow({ scale }: { scale: number }): JSX.Element {
  const t = useT();
  const rescale = (by: number): void =>
    adjustOwnModel({
      scale: Math.min(SCALE_RANGE.max, Math.max(SCALE_RANGE.min, +(scale + by).toFixed(2))),
    });
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium text-fg">{t('sims.arena.ownModel.scale')}</span>
      <div className="flex items-center gap-2">
        <button type="button" className={BUTTON} onClick={() => rescale(-SCALE_RANGE.step)}>
          {t('sims.arena.ownModel.smaller')}
        </button>
        <span className="font-mono text-sm text-fg">{`${Math.round(scale * 100)}%`}</span>
        <button type="button" className={BUTTON} onClick={() => rescale(SCALE_RANGE.step)}>
          {t('sims.arena.ownModel.bigger')}
        </button>
      </div>
    </div>
  );
}

function Adjust({ adjust }: { adjust: ModelAdjust }): JSX.Element {
  const t = useT();
  const { scale, quarters, lift_mm, wheels } = adjust;
  return (
    <div className="flex flex-col gap-3">
      <ScaleRow scale={scale} />
      <div className="flex flex-wrap gap-2">
        {AXES.map(([axis, key]) => (
          <button
            key={key}
            type="button"
            className={BUTTON}
            onClick={() => adjustOwnModel({ quarters: turned(quarters, axis) })}
          >
            {t(`sims.arena.ownModel.${key}`)}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium text-fg">
        {`${t('sims.arena.ownModel.lift')}: ${lift_mm} mm`}
        <input
          type="range"
          {...LIFT_RANGE_MM}
          value={lift_mm}
          onChange={(event) => adjustOwnModel({ lift_mm: Number(event.target.value) })}
          className="w-full accent-primary"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-fg">
        <input
          type="checkbox"
          checked={wheels}
          onChange={(event) => adjustOwnModel({ wheels: event.target.checked })}
          className="accent-primary"
        />
        {t('sims.arena.ownModel.wheels')}
      </label>
    </div>
  );
}

/** «Tu robot en 3D»: upload an STL or GLB as the visual body; the physics stays the spec's. */
export function OwnModelSection(): JSX.Element {
  const t = useT();
  const model = useSyncExternalStore(subscribeOwnModel, getOwnModel);
  const [error, setError] = useState<InstallError | null>(null);
  const onFile = (file: File): void => {
    void installModel(file).then(setError);
  };
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-3">
      <h3 className="text-sm font-semibold text-fg">{t('sims.arena.ownModel.title')}</h3>
      <p className="text-xs text-fg-muted">{t('sims.arena.ownModel.hint')}</p>
      <DropZone onFile={onFile} />
      {error === null ? null : (
        <p role="alert" className="text-xs text-error">
          {t(`sims.arena.ownModel.error.${error}`)}
        </p>
      )}
      {model === null ? null : (
        <>
          <p className="truncate font-mono text-xs text-fg-muted">{model.name}</p>
          <Adjust adjust={model.adjust} />
          <button type="button" className={BUTTON} onClick={removeOwnModel}>
            {t('sims.arena.ownModel.remove')}
          </button>
        </>
      )}
    </section>
  );
}
