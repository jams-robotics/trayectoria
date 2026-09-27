import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

// Lists every public page for search engines (#579). Excludes /dev/, /cuenta, /auth and /aula,
// which robots.txt also disallows. No new dependency: a static endpoint instead of
// @astrojs/sitemap, per the orchestrator's decision.
const STATIC_PATHS = [
  '/',
  '/acerca',
  '/contribuir',
  '/docentes',
  '/unirse',
  '/simuladores/brazo',
  '/simuladores/movil',
  '/brazos',
];

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL('https://trayectoria.org');

  const routes = await getCollection('routes');
  const topics = await getCollection('topics');
  const arms = await getCollection('arms');

  const routePaths = routes.map((route) => `/ruta/${route.id}`);
  const topicPaths = topics.map((topic) => {
    const [ruta, slug] = topic.id.split('/');
    const [modulo, tema] = slug?.split('-') ?? [];
    return `/ruta/${ruta}/${modulo}/${tema}`;
  });
  const armPaths = arms.map((arm) => `/brazos/${arm.id}`);

  const paths = [...STATIC_PATHS, ...routePaths, ...topicPaths, ...armPaths];

  const urls = paths
    .map((path) => `  <url><loc>${new URL(path, base).toString()}</loc></url>`)
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml' },
  });
};
