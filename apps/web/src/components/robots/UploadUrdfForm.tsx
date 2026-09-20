import { useT } from '@trayectoria/i18n';
import { parseUploadedZip } from '@trayectoria/sims/urdf';
import type { RobotSpec } from '@trayectoria/widgets';
import { useState, type JSX } from 'react';

import { PRIMARY_BUTTON } from '../auth/fields';

/** What one accepted upload hands the island: the parsed spec and the bytes to store. */
export interface AcceptedUpload {
  readonly robotId: string;
  readonly spec: RobotSpec;
  readonly zipBytes: Uint8Array;
  /** Every path the zip holds, so the viewer can open its URDF and its meshes (F5-04). */
  readonly paths: readonly string[];
}

/**
 * What the form does with an accepted upload (F5-04, #137, decisión 4). `'save'` is the behaviour
 * of F3-04 and stays the default; `'parseOnly'` hands the caller the parsed zip and stores
 * nothing, which is what the importer of the arm simulator uses without a session.
 */
export type UploadMode = 'save' | 'parseOnly';

export interface UploadUrdfFormProps {
  /** Saves the robot, or just receives it in `'parseOnly'`; rejects when Supabase refuses it. */
  readonly onUpload: (upload: AcceptedUpload) => Promise<void>;
  /** Defaults to `'save'`, the behaviour of F3-04. */
  readonly mode?: UploadMode;
  /** Replaces the heading of the form; the upload page keeps its own. */
  readonly title?: string;
  /** Replaces the help line under the heading. */
  readonly help?: string;
}

/**
 * Every error code the check can report, mapped to its i18n key as a literal so the static check
 * of F0-06 sees it. An unknown code falls back to `urdf.parse`.
 */
const ERROR_KEYS: Readonly<Record<string, string>> = {
  'urdf.parse': 'urdf.parse',
  'urdf.noRoot': 'urdf.noRoot',
  'urdf.multipleRoots': 'urdf.multipleRoots',
  'urdf.cycle': 'urdf.cycle',
  'urdf.missingLink': 'urdf.missingLink',
  'urdf.unsupportedJoint': 'urdf.unsupportedJoint',
  'urdf.missingMesh': 'urdf.missingMesh',
  'urdf.badLimits': 'urdf.badLimits',
  'urdf.invalidZip': 'urdf.invalidZip',
  'urdf.tooLarge': 'urdf.tooLarge',
  'urdf.pathTraversal': 'urdf.pathTraversal',
  'urdf.badExtension': 'urdf.badExtension',
  'urdf.multipleUrdf': 'urdf.multipleUrdf',
  'urdf.noUrdf': 'urdf.noUrdf',
  'urdf.xacroUnsupported': 'urdf.xacroUnsupported',
};

type Checked =
  | { readonly ok: true; readonly upload: AcceptedUpload }
  | { readonly ok: false; readonly code: string };

/**
 * Reads the chosen zip, validates it and parses the URDF, all in the browser and before anything
 * is sent anywhere: an invalid file never reaches Supabase (docs/ARCHITECTURE.md §6).
 */
async function checkFile(file: File): Promise<Checked> {
  const zipBytes = new Uint8Array(await file.arrayBuffer());
  const robotId = crypto.randomUUID();
  const parsed = parseUploadedZip(zipBytes, { domParser: new DOMParser(), robotId });
  if (!parsed.ok) return { ok: false, code: parsed.code };
  return { ok: true, upload: { robotId, spec: parsed.spec, zipBytes, paths: parsed.paths } };
}

interface UploadState {
  readonly error: string;
  readonly pending: boolean;
  readonly submit: (event: { preventDefault: () => void }) => void;
  readonly onFile: (file: File | null) => void;
}

/** Runs the check and the save, and turns their outcome into the status of the form. */
function useUpload(onUpload: UploadUrdfFormProps['onUpload'], mode: UploadMode): UploadState {
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function run(): Promise<void> {
    if (file === null) {
      setError(t('auth.robots.noFile'));
      return;
    }
    setPending(true);
    setError('');
    try {
      const checked = await checkFile(file);
      if (!checked.ok) setError(t(ERROR_KEYS[checked.code] ?? 'urdf.parse'));
      else await onUpload(checked.upload);
    } catch {
      setError(t(mode === 'parseOnly' ? 'sims.import.loadFailed' : 'auth.robots.uploadFailed'));
    }
    setPending(false);
  }

  return {
    error,
    pending,
    onFile: (next) => {
      setFile(next);
      setError('');
    },
    submit: (event) => {
      event.preventDefault();
      void run();
    },
  };
}

/** The file input with its label; the only control the form has besides the submit button. */
function FileField({ onFile }: { readonly onFile: (file: File | null) => void }): JSX.Element {
  const t = useT();
  return (
    <div className="mt-4 flex flex-col gap-1">
      <label htmlFor="urdf-zip" className="font-medium">
        {t('auth.robots.uploadField')}
      </label>
      <input
        id="urdf-zip"
        name="urdf-zip"
        type="file"
        accept=".zip,application/zip"
        onChange={(event) => onFile(event.target.files?.[0] ?? null)}
        className="text-fg file:border-border file:bg-bg file:text-fg file:rounded-md file:mr-3 file:border file:px-3 file:py-2"
      />
    </div>
  );
}

/** «Subir un brazo»: one zip with a URDF and its meshes (F3-04). */
export function UploadUrdfForm({
  onUpload,
  mode = 'save',
  title,
  help,
}: UploadUrdfFormProps): JSX.Element {
  const t = useT();
  const { error, pending, submit, onFile } = useUpload(onUpload, mode);
  return (
    <form
      data-testid="upload-urdf-form"
      onSubmit={submit}
      className="border-border bg-bg-raised rounded-lg border p-6"
    >
      <h2 className="text-base font-semibold">{title ?? t('auth.robots.uploadTitle')}</h2>
      <p className="text-fg-muted mt-2 text-sm">{help ?? t('auth.robots.uploadHelp')}</p>
      <FileField onFile={onFile} />
      <p aria-live="polite" className="m-0 mt-2 min-h-[1.5em]">
        {error !== '' ? (
          <span role="alert" data-testid="upload-error" className="text-error">
            {error}
          </span>
        ) : null}
      </p>
      <button type="submit" disabled={pending} className={`${PRIMARY_BUTTON} mt-2`}>
        {pending ? t('auth.robots.uploading') : t('auth.robots.uploadSubmit')}
      </button>
    </form>
  );
}
