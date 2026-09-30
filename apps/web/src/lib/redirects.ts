/**
 * Redirects of the old topic URLs (#574; docs/ARCHITECTURE.md §3.2, «Redirecciones»): the 15 URLs
 * of rows 14 to 28 of the equivalence table of docs/CURRICULUM.md, old URL → new URL. With
 * `output: 'static'`, Astro's `redirects` writes a page with `<meta http-equiv="refresh">` and
 * `<link rel="canonical">` at each old URL, which serves the same on Cloudflare Workers and with
 * Caddy. The three old URLs that now serve another topic (`/ruta/ruta-1/m01/t03`,
 * `/ruta/ruta-1/m01/t04`, `/ruta/ruta-1/m02/t03`) cannot redirect. `redirects.test.ts` checks this
 * list against `TOPIC_ID_MAP` of `@trayectoria/progress`.
 */
export const TOPIC_REDIRECTS: Readonly<Record<string, string>> = {
  '/ruta/ruta-1/m04/t01': '/ruta/ruta-1/m01/t03',
  '/ruta/ruta-1/m04/t02': '/ruta/ruta-1/m01/t04',
  '/ruta/ruta-1/m04/t03': '/ruta/ruta-1/m02/t03',
  '/ruta/ruta-1/m04/t04': '/ruta/ruta-1/m02/t04',
  '/ruta/ruta-1/m04/t05': '/ruta/ruta-2/m00/t01',
  '/ruta/ruta-1/m05/t01': '/ruta/ruta-2/m00/t02',
  '/ruta/ruta-1/m05/t02': '/ruta/ruta-2/m01/t01',
  '/ruta/ruta-1/m05/t03': '/ruta/ruta-2/m01/t02',
  '/ruta/ruta-1/m05/t04': '/ruta/ruta-2/m01/t03',
  '/ruta/ruta-1/m05/t05': '/ruta/ruta-2/m01/t04',
  '/ruta/ruta-1/m06/t01': '/ruta/ruta-2/m02/t01',
  '/ruta/ruta-1/m06/t02': '/ruta/ruta-2/m02/t02',
  '/ruta/ruta-1/m06/t03': '/ruta/ruta-2/m02/t03',
  '/ruta/ruta-1/m06/t04': '/ruta/ruta-2/m02/t04',
  '/ruta/ruta-1/m06/t05': '/ruta/ruta-2/m02/t05',
};
