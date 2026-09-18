import type { ArmSpec } from '@trayectoria/robot-spec';

// Structural validation of the tree already extracted from the URDF XML, as
// docs/ROBOT-SPEC.md §2. Every code has an i18n key `urdf.<code>`; the Spanish texts live in
// `apps/web` and are added by the ticket that shows them.

/** Error codes of docs/ROBOT-SPEC.md §2. */
export type UrdfErrorCode =
  | 'parse'
  | 'noRoot'
  | 'multipleRoots'
  | 'cycle'
  | 'missingLink'
  | 'unsupportedJoint'
  | 'missingMesh'
  | 'badLimits';

/** One problem found in a URDF document. `key` is the i18n key, always `urdf.<code>`. */
export interface UrdfError {
  readonly code: UrdfErrorCode;
  readonly key: string;
  /** Name of the affected joint or link, or the reason the document could not be parsed. */
  readonly detail?: string;
}

/** Builds an error with its i18n key derived from the code. */
export function urdfError(code: UrdfErrorCode, detail?: string): UrdfError {
  const key = `urdf.${code}`;
  return detail === undefined ? { code, key } : { code, key, detail };
}

/** The joints that carry a configuration value are the ones whose limits must be ordered. */
const BOUNDED_TYPES: ReadonlySet<string> = new Set(['revolute', 'prismatic']);

type Joint = ArmSpec['joints'][number];
type Link = ArmSpec['links'][number];

/** Every `parent` and `child` must name a declared `<link>`. */
function checkLinkReferences(links: readonly Link[], joints: readonly Joint[]): UrdfError[] {
  const declared = new Set(links.map((link) => link.name));
  const errors: UrdfError[] = [];
  for (const joint of joints) {
    for (const side of ['parent', 'child'] as const) {
      const name = joint[side];
      if (!declared.has(name)) errors.push(urdfError('missingLink', name));
    }
  }
  return errors;
}

/** `lower` must be strictly below `upper` in revolute and prismatic joints. */
function checkLimits(joints: readonly Joint[]): UrdfError[] {
  const errors: UrdfError[] = [];
  for (const joint of joints) {
    if (!BOUNDED_TYPES.has(joint.type)) continue;
    const limits = joint.limits;
    if (limits !== undefined && limits.lower >= limits.upper) {
      errors.push(urdfError('badLimits', joint.name));
    }
  }
  return errors;
}

/** The links that are never a `child`: the roots of the joint forest. */
function rootLinks(links: readonly Link[], joints: readonly Joint[]): readonly string[] {
  const children = new Set(joints.map((joint) => joint.child));
  return links.map((link) => link.name).filter((name) => !children.has(name));
}

/** True when every link is reachable from `root` by walking the joints downwards. */
function reachesEveryLink(root: string, links: readonly Link[], joints: readonly Joint[]): boolean {
  const byParent = new Map<string, string[]>();
  for (const joint of joints) {
    const siblings = byParent.get(joint.parent);
    if (siblings === undefined) byParent.set(joint.parent, [joint.child]);
    else siblings.push(joint.child);
  }
  const visited = new Set<string>([root]);
  const pending: string[] = [root];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    for (const child of byParent.get(next) ?? []) {
      if (visited.has(child)) continue;
      visited.add(child);
      pending.push(child);
    }
  }
  return visited.size === links.length;
}

/**
 * Topology of the joint graph: exactly one root, and every link hanging from it. A link that is
 * the child of two joints, or a group of links closed on itself, leaves links unreachable.
 */
function checkTopology(links: readonly Link[], joints: readonly Joint[]): UrdfError[] {
  const roots = rootLinks(links, joints);
  if (roots.length === 0) return [urdfError('noRoot')];
  if (roots.length > 1) return [urdfError('multipleRoots', roots.join(', '))];
  const root = roots[0] ?? '';
  if (!reachesEveryLink(root, links, joints)) return [urdfError('cycle', root)];
  return [];
}

/**
 * Validates the extracted arm. Returns every problem found; an empty list means the tree is
 * structurally sound and can be handed to `parseRobotSpec`.
 */
export function validate(links: readonly Link[], joints: readonly Joint[]): readonly UrdfError[] {
  const references = checkLinkReferences(links, joints);
  // Topology only makes sense once every parent and child names a declared link.
  const topology = references.length === 0 ? checkTopology(links, joints) : [];
  return [...references, ...topology, ...checkLimits(joints)];
}
