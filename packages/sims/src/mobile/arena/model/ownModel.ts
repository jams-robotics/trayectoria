import type { Object3D } from 'three';

import { clearStoredModel, loadStoredModel, saveStoredModel } from '../stores/ownModelStore';
import { DEFAULT_ADJUST } from './adjust';
import type { ModelAdjust } from './adjust';
import { parseModel } from './loadModel';
import { checkNameAndSize, validateModel } from './modelFile';
import type { ModelCheckError, ModelKind } from './modelFile';

// The learner's own robot body, shared between the Pista panel (which edits it) and the 3D
// scene (which draws it). It lives here, outside React, so the scene can read it while it runs.

export interface OwnModel {
  readonly name: string;
  readonly kind: ModelKind;
  readonly bytes: ArrayBuffer;
  readonly object: Object3D;
  readonly adjust: ModelAdjust;
}

export type InstallError = ModelCheckError | 'parse';

let current: OwnModel | null = null;
const listeners = new Set<() => void>();

export function getOwnModel(): OwnModel | null {
  return current;
}

/** Calls `listener` after every change; returns the way to stop. */
export function subscribeOwnModel(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish(next: OwnModel | null): void {
  current = next;
  for (const listener of listeners) listener();
}

function persist(model: OwnModel): void {
  void saveStoredModel({ name: model.name, bytes: model.bytes, adjust: model.adjust });
}

/** Validates, parses and adopts `file`; returns what went wrong, or `null`. */
export async function installModel(file: File): Promise<InstallError | null> {
  const early = checkNameAndSize(file.name, file.size);
  if (!early.ok) return early.error;
  try {
    const bytes = await file.arrayBuffer();
    const checked = validateModel(file.name, new Uint8Array(bytes));
    if (!checked.ok) return checked.error;
    const object = await parseModel(checked.kind, bytes);
    const model = { name: file.name, kind: checked.kind, bytes, object, adjust: DEFAULT_ADJUST };
    publish(model);
    persist(model);
    return null;
  } catch {
    return 'parse';
  }
}

export function adjustOwnModel(patch: Partial<ModelAdjust>): void {
  if (current === null) return;
  const next = { ...current, adjust: { ...current.adjust, ...patch } };
  publish(next);
  persist(next);
}

export function removeOwnModel(): void {
  publish(null);
  void clearStoredModel();
}

/** Brings back the model of the last visit, if any; a model installed meanwhile wins. */
async function restore(): Promise<void> {
  const stored = await loadStoredModel();
  if (stored === null || current !== null) return;
  const checked = validateModel(stored.name, new Uint8Array(stored.bytes));
  if (!checked.ok) return;
  try {
    const object = await parseModel(checked.kind, stored.bytes);
    if (current === null) publish({ ...stored, kind: checked.kind, object });
  } catch {
    // A model that no longer parses is ignored: the usual robot stays.
  }
}

let restored = false;

/** The scene's hook: restores the saved model once, and calls `onChange` on every change. */
export function watchOwnModel(onChange: () => void): () => void {
  if (!restored) {
    restored = true;
    void restore();
  }
  return subscribeOwnModel(onChange);
}
