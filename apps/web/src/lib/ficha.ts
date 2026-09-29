import { z } from 'astro/zod';

/**
 * `ficha.json` of a reference arm (`catalog/arms/<id>/ficha.json`, F5-05). It lives outside
 * `content.config.ts` so that a test and the schema generator can import it without pulling in
 * `astro:content`, which only resolves inside Astro. The equivalent JSON Schema is committed at
 * `catalog/arms/ficha.schema.json` and a test keeps both from diverging.
 */
export const fichaSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/, 'Debe ser minúsculas, dígitos o guiones'),
    name: z.string().min(1),
    dof: z.number().int().positive(),
    reach_m: z.number().positive(),
    // Null when the source documents no payload: the catalog never invents figures.
    payload_kg: z.number().positive().nullable(),
    // Null when the model is didactic and has no real-world cost: the catalog never invents figures.
    cost_usd_approx: z.number().min(0).nullable(),
    license: z
      .object({
        hardware: z.string().min(1),
        software: z.string().min(1),
      })
      .strict(),
    links: z
      .object({
        repo: z.url(),
        plans: z.url().optional(),
        bom: z.url().optional(),
        buy: z.url().optional(),
      })
      .strict(),
    verifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Debe ser una fecha ISO (AAAA-MM-DD)'),
    /** Path of the photo, relative to the directory of the arm. */
    photo: z.string().min(1),
    summary: z.string().min(1),
    /**
     * Readable name of each joint and link, by URDF name, for the arm simulator (#535). Optional:
     * without it the simulator shows the URDF names.
     */
    joint_labels: z.record(z.string(), z.string().min(1)).optional(),
    link_labels: z.record(z.string(), z.string().min(1)).optional(),
  })
  .strict();

/** The validated contents of a `catalog/arms/<id>/ficha.json`. */
export type Ficha = z.infer<typeof fichaSchema>;
