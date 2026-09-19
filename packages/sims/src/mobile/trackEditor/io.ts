import {
  parseTrack,
  presets,
  serializeTrack,
  type PresetName,
  type Result,
} from '@trayectoria/sim-core';
import type { EditorState } from './model';

/** Serializes the edited track with the sim-core track format. */
export function toJson(state: EditorState): string {
  return serializeTrack(state.track);
}

/**
 * Parses a track serialized by `toJson` into a fresh editor state with nothing selected. Invalid
 * JSON or a malformed track come back as an error rather than a throw.
 */
export function fromJson(json: string): Result<EditorState, string> {
  const parsed = parseTrack(json);
  return parsed.ok ? { ok: true, value: { track: parsed.value, selected: null } } : parsed;
}

/** An editor over the built-in preset `name`, with nothing selected. */
export function fromPreset(name: PresetName): EditorState {
  return { track: presets[name], selected: null };
}
