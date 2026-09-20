/**
 * Upload rules of a robot zip (F3-04, docs/ARCHITECTURE.md §6), as pure functions over the entry
 * list: size, extensions and paths. Nothing here decompresses anything — the caller runs this
 * first and only opens the entries it accepts, so a hostile archive is rejected before its
 * contents are ever read.
 */

/** One entry of the zip directory, as `listEntries` of `zipUrdf.ts` reports it. */
export interface ZipEntry {
  /** Path inside the zip, with `/` separators, relative to its root. */
  readonly path: string;
  /** Uncompressed size of the entry. */
  readonly size_bytes: number;
}

/** Largest upload accepted: 20 MB, the `file_size_limit` of the `urdf` bucket (migration 0003). */
export const MAX_UPLOAD_SIZE_BYTES = 20_971_520;

/** Extensions an entry may carry (ticket F3-04); everything else is refused. */
export const ALLOWED_EXTENSIONS: readonly string[] = [
  '.urdf',
  '.stl',
  '.dae',
  '.obj',
  '.png',
  '.jpg',
  '.jpeg',
];

/** Folder macOS adds to an archive; its entries are metadata and are ignored. */
const MACOS_FOLDER = '__MACOSX/';

/** Error codes this module reports; each one is an i18n key of `locales/es/urdf.json`. */
export type UploadErrorCode =
  | 'urdf.tooLarge'
  | 'urdf.pathTraversal'
  | 'urdf.badExtension'
  | 'urdf.xacroUnsupported'
  | 'urdf.multipleUrdf';

export interface UploadOk {
  readonly ok: true;
  /** Path of the single `.urdf` entry, the one the caller decompresses. */
  readonly urdfPath: string;
}

export interface UploadFailure {
  readonly ok: false;
  readonly code: UploadErrorCode;
}

export type UploadResult = UploadOk | UploadFailure;

/** Lowercase extension of a path, including the dot, or the empty string when it has none. */
function extensionOf(path: string): string {
  const dot = path.lastIndexOf('.');
  const slash = path.lastIndexOf('/');
  return dot > slash ? path.slice(dot).toLowerCase() : '';
}

/** Directories and the macOS metadata folder carry no payload and are not validated. */
function isIgnored(entry: ZipEntry): boolean {
  return entry.path.endsWith('/') || entry.path.startsWith(MACOS_FOLDER);
}

/**
 * True when the path leaves the root of the zip: a `..` segment, a leading `/`, a Windows drive
 * letter or a backslash, which some archivers write as a separator and which would turn into a
 * directory when the entry is written out.
 */
function escapesRoot(path: string): boolean {
  if (path.includes('\\')) return true;
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path)) return true;
  return path.split('/').includes('..');
}

/** The first rule the entries break, or `undefined` when they break none. */
function checkEntries(entries: readonly ZipEntry[]): UploadErrorCode | undefined {
  for (const entry of entries) {
    if (escapesRoot(entry.path)) return 'urdf.pathTraversal';
    const extension = extensionOf(entry.path);
    if (extension === '.xacro') return 'urdf.xacroUnsupported';
    if (!ALLOWED_EXTENSIONS.includes(extension)) return 'urdf.badExtension';
  }
  return undefined;
}

/**
 * Checks one upload: the compressed size first, then every entry that carries content, and
 * finally that exactly one of them is the `.urdf`. Returns the path of that URDF, which is the
 * only entry the caller needs to decompress to parse the robot.
 */
export function validateUpload(
  entries: readonly ZipEntry[],
  size_bytes: number,
): UploadResult {
  if (size_bytes > MAX_UPLOAD_SIZE_BYTES) return { ok: false, code: 'urdf.tooLarge' };
  const files = entries.filter((entry) => !isIgnored(entry));
  const broken = checkEntries(files);
  if (broken !== undefined) return { ok: false, code: broken };
  const urdfs = files.filter((entry) => extensionOf(entry.path) === '.urdf');
  const urdfPath = urdfs[0]?.path;
  if (urdfs.length !== 1 || urdfPath === undefined) {
    return { ok: false, code: 'urdf.multipleUrdf' };
  }
  return { ok: true, urdfPath };
}
