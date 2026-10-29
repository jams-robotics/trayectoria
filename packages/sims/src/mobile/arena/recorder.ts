// Records the arena as a video for reels: every frame copies the 3D canvas onto a 2D canvas
// (cropped to fill the chosen format) and stamps the lap data and the site on it, and a
// MediaRecorder encodes that canvas. MP4 when the browser can, WebM otherwise.

export type RecordFormat = 'vertical' | 'landscape';

const SIZES: Readonly<Record<RecordFormat, readonly [number, number]>> = {
  vertical: [1080, 1920],
  landscape: [1920, 1080],
};

const MIME_TYPES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
const FPS = 30;
const BITRATE = 8_000_000;

/** Lines stamped on the video: a title on top, the live data under it and the site at the bottom. */
export interface Overlay {
  readonly title: string;
  readonly lines: readonly string[];
  readonly footer: string;
}

export interface Recording {
  /** Stops and hands back the video file. */
  stop(): Promise<{ blob: Blob; extension: string }>;
}

export function canRecord(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    MIME_TYPES.some((type) => MediaRecorder.isTypeSupported(type))
  );
}

/** Draws `source` scaled to cover `width × height`, centred, like `object-fit: cover`. */
function cover(
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  width: number,
  height: number,
): void {
  const scale = Math.max(width / source.width, height / source.height);
  const w = source.width * scale;
  const h = source.height * scale;
  context.drawImage(source, (width - w) / 2, (height - h) / 2, w, h);
}

function stamp(
  context: CanvasRenderingContext2D,
  overlay: Overlay,
  width: number,
  height: number,
  colors: { fg: string; accent: string },
): void {
  const unit = width / 1080;
  context.fillStyle = colors.fg;
  context.shadowColor = 'black';
  context.shadowBlur = 12 * unit;
  context.font = `600 ${56 * unit}px sans-serif`;
  context.fillText(overlay.title, 60 * unit, 120 * unit);
  context.font = `500 ${40 * unit}px monospace`;
  overlay.lines.forEach((line, i) => context.fillText(line, 60 * unit, (190 + i * 54) * unit));
  context.fillStyle = colors.accent;
  context.font = `600 ${44 * unit}px sans-serif`;
  context.fillText(overlay.footer, 60 * unit, height - 80 * unit);
  context.shadowBlur = 0;
}

function canvasOf(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** A recorder of `canvas` that pushes what it encodes into `chunks`. */
function recorderOf(canvas: HTMLCanvasElement, mimeType: string, chunks: Blob[]): MediaRecorder {
  const recorder = new MediaRecorder(canvas.captureStream(FPS), {
    mimeType,
    videoBitsPerSecond: BITRATE,
  });
  recorder.ondataavailable = (event) => chunks.push(event.data);
  return recorder;
}

/**
 * Starts recording `source`. `overlay` is asked for the stamped text on every frame, and
 * `colors` are the token colours of the arena (no literal palette here).
 */
export function startRecording(
  source: HTMLCanvasElement,
  format: RecordFormat,
  overlay: () => Overlay,
  colors: { fg: string; accent: string },
): Recording {
  const [width, height] = SIZES[format];
  const canvas = canvasOf(width, height);
  const context = canvas.getContext('2d');
  const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
  const chunks: Blob[] = [];
  const recorder = recorderOf(canvas, mimeType, chunks);
  let frame = 0;
  const draw = (): void => {
    if (context !== null) {
      cover(context, source, width, height);
      stamp(context, overlay(), width, height, colors);
    }
    frame = requestAnimationFrame(draw);
  };
  draw();
  recorder.start(250);
  return {
    stop: () =>
      new Promise((resolve) => {
        recorder.onstop = () => {
          cancelAnimationFrame(frame);
          resolve({
            blob: new Blob(chunks, { type: mimeType }),
            extension: mimeType.startsWith('video/mp4') ? 'mp4' : 'webm',
          });
        };
        recorder.stop();
      }),
  };
}

/** Offers `blob` as a download named `name`. */
export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
