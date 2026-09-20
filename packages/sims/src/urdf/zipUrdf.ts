/**
 * The one wrapper over `fflate` (ADR-0008): it opens an uploaded zip in the browser, validates it
 * with `validateUpload`, parses the URDF it holds and checks that every mesh the spec references
 * travels inside the archive. No other module imports `fflate`, and nothing outside this file
 * decompresses anything.
 */
import type { RobotSpec } from '@trayectoria/robot-spec';
import { parseUrdf, type DOMParserLike, type UrdfErrorCode } from '@trayectoria/sim-core';
import { unzipSync } from 'fflate';

import { validateUpload, type UploadErrorCode, type ZipEntry } from './validateUpload';

/** Raised when the bytes are not a readable zip, or the entry asked for is not in it. */
const INVALID_ZIP = 'urdf.invalidZip';

/**
 * Entries of the zip's directory, with their uncompressed sizes, read from its metadata without
 * decompressing a single byte: the `filter` always returns `false`, so `unzipSync` only collects
 * the `UnzipFileInfo` of each entry and extracts nothing (security finding 1, PR #174).
 */
export function listEntries(bytes: Uint8Array): readonly ZipEntry[] {
  const found: ZipEntry[] = [];
  try {
    unzipSync(bytes, {
      filter: (file) => {
        found.push({ path: file.name, size_bytes: file.originalSize });
        return false;
      },
    });
  } catch {
    throw new Error(INVALID_ZIP);
  }
  return found;
}

/** The bytes of one entry, by its path inside the zip. */
export function readEntry(bytes: Uint8Array, path: string): Uint8Array {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (file) => file.name === path });
  } catch {
    throw new Error(INVALID_ZIP);
  }
  const content = files[path];
  if (content === undefined) throw new Error(INVALID_ZIP);
  return content;
}

/**
 * Every error this module reports; each one is an i18n key of `locales/es/urdf.json`. Besides the
 * upload codes it carries the `urdf.*` keys `parseUrdf` produces (docs/ROBOT-SPEC.md §2).
 */
export type UrdfZipErrorCode = UploadErrorCode | 'urdf.invalidZip' | `urdf.${UrdfErrorCode}`;

export interface UrdfZipOk {
  readonly ok: true;
  /** Path of the `.urdf` entry inside the zip. */
  readonly urdfPath: string;
  /** Text of that URDF, decoded as UTF-8. */
  readonly urdfSource: string;
  /** Every path the zip holds, so a caller can resolve the meshes later (F5-04). */
  readonly paths: readonly string[];
}

export interface UrdfZipFailure {
  readonly ok: false;
  readonly code: UrdfZipErrorCode;
}

export type UrdfZipResult = UrdfZipOk | UrdfZipFailure;

/**
 * Opens an uploaded zip: lists its entries, applies the upload rules and, only when they all
 * pass, decompresses the single URDF it found. A zip that breaks a rule comes back as its error
 * code with nothing decompressed.
 */
export function readUrdfZip(bytes: Uint8Array): UrdfZipResult {
  let entries: readonly ZipEntry[];
  try {
    entries = listEntries(bytes);
  } catch {
    return { ok: false, code: INVALID_ZIP };
  }
  const checked = validateUpload(entries, bytes.length);
  if (!checked.ok) return { ok: false, code: checked.code };
  try {
    const urdfSource = new TextDecoder().decode(readEntry(bytes, checked.urdfPath));
    return {
      ok: true,
      urdfPath: checked.urdfPath,
      urdfSource,
      paths: entries.map((entry) => entry.path),
    };
  } catch {
    return { ok: false, code: INVALID_ZIP };
  }
}

export interface ParsedUpload {
  readonly ok: true;
  readonly spec: RobotSpec;
  /** Every path the zip holds. */
  readonly paths: readonly string[];
}

export type ParseUploadResult = ParsedUpload | UrdfZipFailure;

export interface ParseUploadOptions {
  /** DOM implementation: `new DOMParser()` in the browser. */
  readonly domParser: DOMParserLike;
  /** UUID the resulting `RobotSpec` is given. */
  readonly robotId: string;
}

/** The meshes the arm references must all be entries of the zip (ticket F3-04, decision 7). */
function missingMesh(spec: RobotSpec, paths: readonly string[]): boolean {
  const inZip = new Set(paths);
  return (spec.arm?.links ?? []).some((link) => {
    const meshPath = link.visual?.meshPath;
    return meshPath !== undefined && meshPath !== '' && !inZip.has(meshPath);
  });
}

/**
 * The whole client-side check of one upload: open the zip, parse its URDF and confirm its meshes
 * are inside it. Nothing is stored anywhere until this returns `ok`, so an invalid archive never
 * leaves the browser (docs/ARCHITECTURE.md §6).
 */
export function parseUploadedZip(
  bytes: Uint8Array,
  options: ParseUploadOptions,
): ParseUploadResult {
  const opened = readUrdfZip(bytes);
  if (!opened.ok) return opened;
  const parsed = parseUrdf(opened.urdfSource, options);
  if (!parsed.ok) {
    // `urdfError` of sim-core always builds the key as `urdf.<code>` (docs/ROBOT-SPEC.md §2).
    const first = parsed.errors[0]?.code ?? 'parse';
    return { ok: false, code: `urdf.${first}` };
  }
  if (missingMesh(parsed.value, opened.paths)) return { ok: false, code: 'urdf.missingMesh' };
  return { ok: true, spec: parsed.value, paths: opened.paths };
}
