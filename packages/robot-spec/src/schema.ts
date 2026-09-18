import { z } from 'zod';

// Schema of RobotSpec v1, exactly as docs/ROBOT-SPEC.md §1. Structural rules live in zod;
// the conditional `mobile`/`arm` rule and the arm invariants live in `superRefine` checks
// so `parseRobotSpec` reports them with the same i18n keys (prefix `robotSpec.`).

const Origin = z.object({
  xyz: z.tuple([z.number(), z.number(), z.number()]), // m
  rpy: z.tuple([z.number(), z.number(), z.number()]), // rad, URDF convention
});

export const MobileSpec = z.object({
  wheelRadius_m: z.number().min(0.005).max(0.3),
  wheelBase_m: z.number().min(0.03).max(1.0),
  maxMotorSpeed_rpm: z.number().min(1).max(30000), // motor rpm before the reduction
  gearRatio: z.number().min(1).max(1000), // n_motor / n_wheel
  maxAccel_radps2: z.number().positive().optional(),
  encoderTicksPerRev: z.number().int().min(1).optional(), // per wheel revolution (reduced)
  mass_kg: z.number().min(0.05).max(50),
  length_m: z.number().positive(), // for drawing
  width_m: z.number().positive(),
  lineSensors: z.object({
    count: z.number().int().min(1).max(16),
    spacing_m: z.number().positive(),
    forwardOffset_m: z.number(), // positive = ahead of the wheel axle
    footprint_m: z.number().positive().default(0.004),
  }),
  motor: z
    .object({
      stallTorque_Nm: z.number().positive(),
      nominalVoltage_V: z.number().positive(),
      efficiency: z.number().min(0).max(1),
    })
    .optional(),
  battery: z.object({ capacity_Wh: z.number().positive() }).optional(),
});

const ArmSpecObject = z.object({
  baseLink: z.string(),
  endEffectorLink: z.string(),
  links: z.array(
    z.object({
      name: z.string(),
      visual: z
        .object({
          meshPath: z.string().optional(), // relative to the package/zip root
          scale: z.tuple([z.number(), z.number(), z.number()]).default([1, 1, 1]),
          origin: Origin.default({ xyz: [0, 0, 0], rpy: [0, 0, 0] }),
          primitive: z
            .discriminatedUnion('type', [
              z.object({
                type: z.literal('box'),
                size: z.tuple([z.number(), z.number(), z.number()]),
              }),
              z.object({ type: z.literal('cylinder'), radius_m: z.number(), length_m: z.number() }),
              z.object({ type: z.literal('sphere'), radius_m: z.number() }),
            ])
            .optional(),
        })
        .optional(),
    }),
  ),
  joints: z.array(
    z.object({
      name: z.string(),
      type: z.enum(['revolute', 'continuous', 'prismatic', 'fixed']),
      parent: z.string(),
      child: z.string(),
      origin: Origin,
      axis: z.tuple([z.number(), z.number(), z.number()]).default([1, 0, 0]),
      limits: z
        .object({
          lower: z.number(),
          upper: z.number(), // rad or m
          velocity: z.number().optional(),
          effort: z.number().optional(),
        })
        .optional(),
    }),
  ),
});

type ArmSpecData = z.infer<typeof ArmSpecObject>;

function addIssue(ctx: z.RefinementCtx, path: PropertyKey[], key: string, message: string): void {
  ctx.addIssue({ code: 'custom', path, message, params: { key } });
}

function checkUniqueNames(
  items: readonly { name: string }[],
  ctx: z.RefinementCtx,
  field: 'links' | 'joints',
): void {
  const seen = new Set<string>();
  const key =
    field === 'links' ? 'robotSpec.arm.duplicateLinkName' : 'robotSpec.arm.duplicateJointName';
  const label = field === 'links' ? 'eslabón' : 'articulación';
  items.forEach((item, index) => {
    if (seen.has(item.name)) {
      addIssue(ctx, [field, index, 'name'], key, `Nombre de ${label} repetido: "${item.name}"`);
    }
    seen.add(item.name);
  });
}

// Every parent/child must name an existing link. Returns false if any reference is broken.
function checkLinkReferences(arm: ArmSpecData, ctx: z.RefinementCtx, links: Set<string>): boolean {
  let valid = true;
  if (!links.has(arm.baseLink)) {
    valid = false;
    const message = `El eslabón base "${arm.baseLink}" no existe`;
    addIssue(ctx, ['baseLink'], 'robotSpec.arm.baseLinkMissing', message);
  }
  if (!links.has(arm.endEffectorLink)) {
    valid = false;
    const message = `El efector final "${arm.endEffectorLink}" no existe`;
    addIssue(ctx, ['endEffectorLink'], 'robotSpec.arm.endEffectorMissing', message);
  }
  arm.joints.forEach((joint, index) => {
    for (const side of ['parent', 'child'] as const) {
      if (links.has(joint[side])) continue;
      valid = false;
      const message = `La articulación "${joint.name}" referencia un eslabón inexistente: "${joint[side]}"`;
      addIssue(ctx, ['joints', index, side], 'robotSpec.arm.unknownLink', message);
    }
  });
  return valid;
}

// The joints form a tree rooted at baseLink: the root is nobody's child, every other link is
// the child of exactly one joint, and every link is reachable from the root.
function isTree(arm: ArmSpecData, links: Set<string>): boolean {
  const parentOf = new Map<string, string>();
  for (const joint of arm.joints) {
    if (joint.child === arm.baseLink || parentOf.has(joint.child)) return false;
    parentOf.set(joint.child, joint.parent);
  }
  const reached = new Set<string>([arm.baseLink]);
  const queue = [arm.baseLink];
  for (let link = queue.shift(); link !== undefined; link = queue.shift()) {
    for (const joint of arm.joints) {
      if (joint.parent === link && !reached.has(joint.child)) {
        reached.add(joint.child);
        queue.push(joint.child);
      }
    }
  }
  return reached.size === links.size;
}

function checkTopology(arm: ArmSpecData, ctx: z.RefinementCtx, links: Set<string>): void {
  if (!isTree(arm, links)) {
    const message = `Las articulaciones no forman un árbol con raíz en "${arm.baseLink}"`;
    addIssue(ctx, ['joints'], 'robotSpec.arm.notTree', message);
  }
  if (arm.joints.some((joint) => joint.parent === arm.endEffectorLink)) {
    const message = `El efector final "${arm.endEffectorLink}" no es una hoja: tiene articulaciones hijas`;
    addIssue(ctx, ['endEffectorLink'], 'robotSpec.arm.endEffectorNotLeaf', message);
  }
}

function checkLimits(arm: ArmSpecData, ctx: z.RefinementCtx): void {
  arm.joints.forEach((joint, index) => {
    const bounded = joint.type === 'revolute' || joint.type === 'prismatic';
    if (!bounded || joint.limits === undefined || joint.limits.lower < joint.limits.upper) return;
    const message = `Límites inválidos en "${joint.name}": lower debe ser menor que upper`;
    addIssue(ctx, ['joints', index, 'limits'], 'robotSpec.arm.badLimits', message);
  });
}

// Invariants of docs/ROBOT-SPEC.md §1.2, verified by parseRobotSpec.
function checkArmInvariants(arm: ArmSpecData, ctx: z.RefinementCtx): void {
  checkUniqueNames(arm.links, ctx, 'links');
  checkUniqueNames(arm.joints, ctx, 'joints');
  const links = new Set(arm.links.map((link) => link.name));
  if (checkLinkReferences(arm, ctx, links) && links.size === arm.links.length) {
    checkTopology(arm, ctx, links);
  }
  checkLimits(arm, ctx);
}

export const ArmSpec = ArmSpecObject.superRefine(checkArmInvariants);

export const SimConfig = z.object({
  id: z.string(),
  name: z.string(),
  track: z.unknown().optional(), // Track JSON (sim-core)
  controller: z.enum(['manual', 'onoff', 'p', 'pid']),
  params: z.record(z.string(), z.number()),
  seed: z.number().int(),
});

const RobotSpecObject = z.object({
  specVersion: z.literal(1),
  id: z.string().uuid(),
  name: z.string().min(1).max(80),
  kind: z.enum(['mobile-diff', 'arm-serial']),
  source: z.object({
    type: z.enum(['form', 'urdf', 'catalog']),
    catalogId: z.string().optional(),
    urdfPath: z.string().optional(), // path in Storage
    verifiedAt: z.string().datetime().optional(),
  }),
  mobile: MobileSpec.optional(), // required if kind === 'mobile-diff'
  arm: ArmSpec.optional(), // required if kind === 'arm-serial'
  simConfigs: z.array(SimConfig).default([]),
});

function checkKindSection(spec: z.infer<typeof RobotSpecObject>, ctx: z.RefinementCtx): void {
  if (spec.kind === 'mobile-diff' && spec.mobile === undefined) {
    const message = 'Un robot de tipo "mobile-diff" requiere la sección "mobile"';
    addIssue(ctx, ['mobile'], 'robotSpec.mobileRequired', message);
  }
  if (spec.kind === 'arm-serial' && spec.arm === undefined) {
    const message = 'Un robot de tipo "arm-serial" requiere la sección "arm"';
    addIssue(ctx, ['arm'], 'robotSpec.armRequired', message);
  }
}

export const RobotSpec = RobotSpecObject.superRefine(checkKindSection);

export type MobileSpec = z.infer<typeof MobileSpec>;
export type ArmSpec = z.infer<typeof ArmSpec>;
export type SimConfig = z.infer<typeof SimConfig>;
export type RobotSpec = z.infer<typeof RobotSpec>;
/** What users write: defaults (`simConfigs`, `footprint_m`, `axis`, `scale`, `origin`) may be omitted. */
export type RobotSpecInput = z.input<typeof RobotSpec>;

/** JSON Schema (draft 2020-12) of the parsed RobotSpec; refinements are not representable. */
export const robotSpecJsonSchema = z.toJSONSchema(RobotSpec);
