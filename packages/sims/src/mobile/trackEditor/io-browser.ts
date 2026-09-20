/**
 * Browser side of saving and loading a track (#126, decision 6). `packages/sims` may not touch
 * `window` (CLAUDE.md, prohibiciones), so the download is built from the globals that are not
 * `window.*`: `Blob`, `URL.createObjectURL` and `document.createElement('a')`. The click is
 * injectable so a test can observe the anchor instead of navigating.
 */

/** Name of the file a saved track is downloaded as. */
export const TRACK_FILE_NAME = 'pista.json';

/** Media type of the downloaded file. */
const JSON_MEDIA_TYPE = 'application/json';

/** What actually triggers the download; the default clicks the anchor. */
export type DownloadTrigger = (anchor: HTMLAnchorElement) => void;

/** Clicks the anchor: the browser then saves the blob under its `download` name. */
function clickAnchor(anchor: HTMLAnchorElement): void {
  anchor.click();
}

/** Downloads `json` as `pista.json`. `trigger` is injectable so tests never navigate. */
export function downloadJson(json: string, trigger: DownloadTrigger = clickAnchor): void {
  const blob = new Blob([json], { type: JSON_MEDIA_TYPE });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = TRACK_FILE_NAME;
  try {
    trigger(anchor);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Text of a file picked with an `<input type="file">`. */
export function readFileText(file: File): Promise<string> {
  return file.text();
}
