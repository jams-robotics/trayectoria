import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

import { fichaSchema } from './lib/ficha';

// Content lives outside apps/web ("currículo como código", ADR-0005).
const CONTENT_BASE = '../../content/es';

// Reference arms live outside apps/web too (docs/ARCHITECTURE.md §2).
const ARMS_BASE = '../../catalog/arms';

const topicId = z
  .string()
  .regex(/^ruta-\d+\/m\d{2}-t\d{2}$/, 'Debe tener la forma ruta-N/mNN-tNN (p. ej. ruta-1/m01-t04)');

// Frontmatter of a topic (docs/CONTENT-STANDARDS.md §3).
const topicSchema = z
  .object({
    id: topicId,
    title: z.string().min(1),
    module: z.number().int().min(0),
    order: z.number().int().min(1),
    estimatedMinutes: z.number().int().positive(),
    prerequisites: z.array(topicId),
    objectives: z.array(z.string().min(1)).min(1),
    widgets: z.array(z.string().min(1)),
    requiredExercises: z.array(z.string().regex(/^e\d+$/)),
    references: z.array(z.string().min(1)),
    status: z.enum(['draft', 'review', 'published']),
    /** Falls back to `title` in <title> and Open Graph tags when missing (#579). */
    seoTitle: z.string().min(1).max(60).optional(),
    /** Falls back to `meta.description` when missing (#579). */
    seoDescription: z.string().min(120).max(155).optional(),
  })
  .strict();

// ruta.json: order and grouping of modules and topics (docs/ARCHITECTURE.md §3.3).
// Two chained routes since #574 (§3.2, «Rutas múltiples»): `shortTitle` names the route in the
// links between routes and in the classroom selector; `follows` is the id of the route it continues.
const routeId = z.string().regex(/^ruta-\d+$/);
const routeSchema = z
  .object({
    id: routeId,
    title: z.string().min(1),
    shortTitle: z.string().min(1),
    follows: routeId.optional(),
    modules: z
      .array(
        z.object({
          id: z.string().regex(/^m\d{2}$/),
          number: z.number().int().min(0),
          title: z.string().min(1),
          topics: z
            .array(
              z.object({
                id: z.string().regex(/^m\d{2}-t\d{2}$/),
                title: z.string().min(1),
              }),
            )
            .min(1),
        }),
      )
      .min(1),
  })
  .strict()
  .superRefine((route, ctx) => {
    route.modules.forEach((module, moduleIndex) => {
      if (Number(module.id.slice(1)) !== module.number) {
        ctx.addIssue({
          code: 'custom',
          path: ['modules', moduleIndex, 'number'],
          message: `module ${module.id} declares number ${module.number}`,
        });
      }
      module.topics.forEach((topic, topicIndex) => {
        if (!topic.id.startsWith(`${module.id}-`)) {
          ctx.addIssue({
            code: 'custom',
            path: ['modules', moduleIndex, 'topics', topicIndex, 'id'],
            message: `topic ${topic.id} is listed under module ${module.id}`,
          });
        }
      });
    });
  });

// Only the routes: the reserve (`content/es/reserva/<slug>/`, status draft) stays out of the
// collection (docs/ARCHITECTURE.md §3.3).
const topics = defineCollection({
  loader: glob({
    pattern: 'ruta-*/m*-t*/index.mdx',
    base: CONTENT_BASE,
    generateId: ({ entry }) => entry.replace(/\/index\.mdx$/, ''),
  }),
  schema: topicSchema,
});

const routes = defineCollection({
  loader: glob({
    pattern: 'ruta-*/ruta.json',
    base: CONTENT_BASE,
    generateId: ({ entry }) => entry.replace(/\/ruta\.json$/, ''),
  }),
  schema: routeSchema,
});

const arms = defineCollection({
  loader: glob({
    pattern: '*/ficha.json',
    base: ARMS_BASE,
    generateId: ({ entry }) => entry.replace(/\/ficha\.json$/, ''),
  }),
  schema: fichaSchema,
});

export const collections = { topics, routes, arms };
