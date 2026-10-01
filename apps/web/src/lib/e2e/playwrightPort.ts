// Port of the web server that Playwright starts (apps/web/playwright.config.ts, #666). Two
// worktrees can run e2e at the same time by giving each its own PLAYWRIGHT_PORT.
export const DEFAULT_PLAYWRIGHT_PORT = 4321;
const MIN_PORT = 1024;
const MAX_PORT = 65535;

export function resolvePlaywrightPort(value: string | undefined): number {
  if (value === undefined || value === '') return DEFAULT_PLAYWRIGHT_PORT;
  const port = /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    throw new Error(
      `PLAYWRIGHT_PORT must be an integer between ${MIN_PORT} and ${MAX_PORT}, got "${value}"`,
    );
  }
  return port;
}
