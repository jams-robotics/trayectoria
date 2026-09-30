import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

import { topicUrl } from '../lib/routes';

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
  // Only published topics have a page (docs/ARCHITECTURE.md §3.2, «Filtro por status»); the
  // redirects of the old topic URLs are not listed either.
  const topics = (await getCollection('topics')).filter(
    (topic) => topic.data.status === 'published',
  );
  const arms = await getCollection('arms');

  const routePaths = routes.map((route) => `/ruta/${route.id}`);
  const topicPaths = topics.map((topic) => topicUrl(topic.id));
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
