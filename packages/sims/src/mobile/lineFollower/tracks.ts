import { parseTrack, presets } from '@trayectoria/sim-core';
import type { Track } from '@trayectoria/sim-core';

// F4-03 (#129): la resolución de la pista del widget, aparte de `LineFollowerWidget.tsx` para
// mantener ese archivo bajo el límite de docs/STANDARDS.md §4.

/** Preset names the widget accepts, as `docs/WIDGETS.md` spells them. */
export type TrackPreset = 'oval' | 's' | 'tight' | 'cross';

/**
 * A track given as data: the serialized JSON of `parseTrack` (F1-04) or a `Track` already
 * parsed, which is what an editor of F4-01 hands over without a round trip through a string.
 */
export type TrackJson = string | Track;

const PRESET_TRACKS: Readonly<Record<TrackPreset, Track>> = {
  oval: presets.oval,
  s: presets.sCurve,
  tight: presets.tightCurves,
  cross: presets.crossing,
};

function isPreset(track: TrackJson): track is TrackPreset {
  return typeof track === 'string' && Object.hasOwn(PRESET_TRACKS, track);
}

/**
 * The track the widget simulates. A preset name resolves to the track of sim-core, a string is
 * parsed with `parseTrack` and an object is taken as it is; a string that does not parse falls
 * back to the oval rather than leaving the widget without a track.
 */
export function resolveTrack(track: TrackJson): Track {
  if (isPreset(track)) return PRESET_TRACKS[track];
  if (typeof track !== 'string') return track;
  const result = parseTrack(track);
  return result.ok ? result.value : presets.oval;
}

