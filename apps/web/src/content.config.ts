import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Content lives outside apps/web ("currículo como código", ADR-0005).
const CONTENT_BASE = '../../content/es';

const topicId = z
  .string()
  .regex(/^ruta-\d+\/m\d{2}-t\d{2}$/, 'Debe tener la forma ruta-N/mNN-tNN (p. ej. ruta-1/m04-t02)');

// Frontmatter of a topic (docs/CONTENT-STANDARDS.md §3).
const topicSchema = z.object({
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
});

// ruta.json: order and grouping of modules and topics (docs/ARCHITECTURE.md §3.3).
const routeSchema = z.object({
  id: z.string().regex(/^ruta-\d+$/),
  title: z.string().min(1),
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
});

const topics = defineCollection({
  loader: glob({
    pattern: '*/m*-t*/index.mdx',
    base: CONTENT_BASE,
    generateId: ({ entry }) => entry.replace(/\/index\.mdx$/, ''),
  }),
  schema: topicSchema,
});

const routes = defineCollection({
  loader: glob({
    pattern: '*/ruta.json',
    base: CONTENT_BASE,
    generateId: ({ entry }) => entry.replace(/\/ruta\.json$/, ''),
  }),
  schema: routeSchema,
});

export const collections = { topics, routes };
