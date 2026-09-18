import type { ArmSpec, RobotSpec } from '@trayectoria/robot-spec';
import { parseRobotSpec } from '@trayectoria/robot-spec';

import type { UrdfError } from './validate';
import { urdfError, validate } from './validate';

// URDF to RobotSpec reader, following the mapping table of docs/ROBOT-SPEC.md §2.
// The DOM implementation is injected: the browser passes its own `DOMParser`, tests pass an
// adapter. Nothing here imports a DOM implementation.

/** The subset of the DOM element API this parser uses. */
export interface UrdfElement {
  readonly tagName: string;
  getAttribute(name: string): string | null;
  getElementsByTagName(name: string): { readonly length: number; item(index: number): unknown };
}

/** The subset of the DOM document API this parser uses. */
export interface UrdfDocument {
  getElementsByTagName(name: string): { readonly length: number; item(index: number): unknown };
}

/** The subset of `DOMParser` this parser uses. */
export interface DOMParserLike {
  parseFromString(source: string, mimeType: 'text/xml'): UrdfDocument;
}

export interface ParseUrdfOptions {
  /** DOM implementation: `new DOMParser()` in the browser, an adapter in Node. */
  readonly domParser: DOMParserLike;
  /** UUID the resulting `RobotSpec` is given. */
  readonly robotId: string;
}

export interface UrdfOk {
  readonly ok: true;
  readonly value: RobotSpec;
}

export interface UrdfFailure {
  readonly ok: false;
  readonly errors: readonly UrdfError[];
}

export type UrdfResult = UrdfOk | UrdfFailure;

type Vec3Tuple = [number, number, number];
type Origin = ArmSpec['joints'][number]['origin'];
type JointInput = ArmSpec['joints'][number];
type LinkInput = ArmSpec['links'][number];
type VisualInput = NonNullable<LinkInput['visual']>;
type PrimitiveInput = NonNullable<VisualInput['primitive']>;

/** Joint types of docs/ROBOT-SPEC.md §1.2; `floating` and `planar` are rejected in v1. */
const SUPPORTED_JOINT_TYPES: readonly JointInput['type'][] = [
  'revolute',
  'continuous',
  'prismatic',
  'fixed',
];

/** Narrows a raw `type` attribute to one of the four supported joint types. */
function isSupportedJointType(type: string): type is JointInput['type'] {
  return SUPPORTED_JOINT_TYPES.some((supported) => supported === type);
}

/** Link names that mark the end effector explicitly, in order of preference. */
const END_EFFECTOR_NAMES: readonly string[] = ['tool0', 'ee_link'];
const END_EFFECTOR_PREFIX = 'gripper';

const ZERO_ORIGIN: Origin = { xyz: [0, 0, 0], rpy: [0, 0, 0] };
const UNIT_SCALE: Vec3Tuple = [1, 1, 1];
const DEFAULT_AXIS: Vec3Tuple = [1, 0, 0];

/** Narrows the untyped `item()` result of the DOM collections to an element. */
function isElement(node: unknown): node is UrdfElement {
  if (typeof node !== 'object' || node === null) return false;
  if (!('tagName' in node) || !('getAttribute' in node)) return false;
  return typeof node.tagName === 'string' && typeof node.getAttribute === 'function';
}

/** All elements named `tagName` under `parent`, in document order. */
function childrenByTag(parent: UrdfDocument | UrdfElement, tagName: string): readonly UrdfElement[] {
  const collection = parent.getElementsByTagName(tagName);
  const elements: UrdfElement[] = [];
  for (let index = 0; index < collection.length; index += 1) {
    const node = collection.item(index);
    if (isElement(node)) elements.push(node);
  }
  return elements;
}

/** The first element named `tagName` under `parent`, or `undefined`. */
function firstByTag(
  parent: UrdfDocument | UrdfElement,
  tagName: string,
): UrdfElement | undefined {
  return childrenByTag(parent, tagName)[0];
}

/** Reads a numeric attribute; returns `undefined` when absent or not a finite number. */
function numberAttribute(element: UrdfElement, name: string): number | undefined {
  const raw = element.getAttribute(name);
  if (raw === null) return undefined;
  const value = Number(raw.trim());
  return Number.isFinite(value) ? value : undefined;
}

/** Reads a whitespace-separated triple of numbers, as URDF writes `xyz`, `rpy` and `scale`. */
function tripleAttribute(element: UrdfElement, name: string): Vec3Tuple | undefined {
  const raw = element.getAttribute(name);
  if (raw === null) return undefined;
  const parts = raw.trim().split(/\s+/).map(Number);
  if (parts.length !== 3 || parts.some((value) => !Number.isFinite(value))) return undefined;
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/** `<origin xyz rpy>`; both attributes default to zero, as URDF does. */
function readOrigin(parent: UrdfElement): Origin {
  const element = firstByTag(parent, 'origin');
  if (element === undefined) return ZERO_ORIGIN;
  return {
    xyz: tripleAttribute(element, 'xyz') ?? [0, 0, 0],
    rpy: tripleAttribute(element, 'rpy') ?? [0, 0, 0],
  };
}

/**
 * `package://pkg/path` refers to the root of the uploaded zip, so the package segment is dropped
 * and the mesh path stays relative to it.
 */
function resolveMeshPath(filename: string): string {
  const trimmed = filename.trim();
  const prefix = 'package://';
  if (!trimmed.startsWith(prefix)) return trimmed.replace(/^\.?\//, '');
  const withoutScheme = trimmed.slice(prefix.length);
  const separator = withoutScheme.indexOf('/');
  return separator === -1 ? '' : withoutScheme.slice(separator + 1);
}

/** `<box|cylinder|sphere>` of `<visual><geometry>`; meshes are handled separately. */
function readPrimitive(geometry: UrdfElement): PrimitiveInput | undefined {
  const box = firstByTag(geometry, 'box');
  if (box !== undefined) {
    const size = tripleAttribute(box, 'size');
    if (size !== undefined) return { type: 'box', size };
  }
  const cylinder = firstByTag(geometry, 'cylinder');
  if (cylinder !== undefined) {
    const radius_m = numberAttribute(cylinder, 'radius');
    const length_m = numberAttribute(cylinder, 'length');
    if (radius_m !== undefined && length_m !== undefined) {
      return { type: 'cylinder', radius_m, length_m };
    }
  }
  const sphere = firstByTag(geometry, 'sphere');
  if (sphere !== undefined) {
    const radius_m = numberAttribute(sphere, 'radius');
    if (radius_m !== undefined) return { type: 'sphere', radius_m };
  }
  return undefined;
}

interface VisualResult {
  readonly visual?: VisualInput;
  readonly errors: readonly UrdfError[];
}

/**
 * `<visual>` of a link: mesh path and scale, or a primitive, plus the visual origin.
 * `<collision>`, `<inertial>`, `<transmission>` and `<gazebo>` are ignored in v1.
 */
function readVisual(link: UrdfElement, linkName: string): VisualResult {
  const visualElement = firstByTag(link, 'visual');
  if (visualElement === undefined) return { errors: [] };
  const geometry = firstByTag(visualElement, 'geometry');
  if (geometry === undefined) return { errors: [] };

  const origin = readOrigin(visualElement);
  const mesh = firstByTag(geometry, 'mesh');
  if (mesh !== undefined) {
    const filename = mesh.getAttribute('filename');
    if (filename === null || filename.trim() === '') {
      return { errors: [urdfError('missingMesh', linkName)] };
    }
    const scale = tripleAttribute(mesh, 'scale') ?? UNIT_SCALE;
    return { visual: { meshPath: resolveMeshPath(filename), scale, origin }, errors: [] };
  }

  const primitive = readPrimitive(geometry);
  if (primitive === undefined) return { errors: [] };
  return { visual: { scale: UNIT_SCALE, origin, primitive }, errors: [] };
}

interface LinksResult {
  readonly links: readonly LinkInput[];
  readonly errors: readonly UrdfError[];
}

/** Every `<link>` of the document, with its visual. */
function readLinks(robot: UrdfElement): LinksResult {
  const links: LinkInput[] = [];
  const errors: UrdfError[] = [];
  for (const element of childrenByTag(robot, 'link')) {
    const name = element.getAttribute('name') ?? '';
    const { visual, errors: visualErrors } = readVisual(element, name);
    errors.push(...visualErrors);
    links.push(visual === undefined ? { name } : { name, visual });
  }
  return { links, errors };
}

/** `<limit lower upper velocity effort>`; absent in `fixed` and `continuous` joints. */
function readLimits(joint: UrdfElement): JointInput['limits'] {
  const element = firstByTag(joint, 'limit');
  if (element === undefined) return undefined;
  const lower = numberAttribute(element, 'lower');
  const upper = numberAttribute(element, 'upper');
  if (lower === undefined || upper === undefined) return undefined;
  const velocity = numberAttribute(element, 'velocity');
  const effort = numberAttribute(element, 'effort');
  return {
    lower,
    upper,
    ...(velocity === undefined ? {} : { velocity }),
    ...(effort === undefined ? {} : { effort }),
  };
}

interface JointsResult {
  readonly joints: readonly JointInput[];
  readonly errors: readonly UrdfError[];
}

/**
 * `<transmission>` repeats the actuated joint by name in its own `<joint name>` (no `type`
 * attribute, ROS control convention); `getElementsByTagName` returns descendants at any depth, so
 * those references would otherwise be misread as unsupported joints.
 */
function transmissionJointNames(robot: UrdfElement): ReadonlySet<UrdfElement> {
  const nested = new Set<UrdfElement>();
  for (const transmission of childrenByTag(robot, 'transmission')) {
    for (const joint of childrenByTag(transmission, 'joint')) nested.add(joint);
  }
  return nested;
}

/** Every `<joint>` of the document; `floating` and `planar` are reported as unsupported. */
function readJoints(robot: UrdfElement): JointsResult {
  const joints: JointInput[] = [];
  const errors: UrdfError[] = [];
  const transmissionJoints = transmissionJointNames(robot);
  for (const element of childrenByTag(robot, 'joint')) {
    if (transmissionJoints.has(element)) continue;
    const name = element.getAttribute('name') ?? '';
    const type = element.getAttribute('type') ?? '';
    if (!isSupportedJointType(type)) {
      errors.push(urdfError('unsupportedJoint', `${name}: ${type}`));
      continue;
    }
    const limits = readLimits(element);
    joints.push({
      name,
      type,
      parent: firstByTag(element, 'parent')?.getAttribute('link') ?? '',
      child: firstByTag(element, 'child')?.getAttribute('link') ?? '',
      origin: readOrigin(element),
      axis: tripleAttribute(firstByTag(element, 'axis') ?? element, 'xyz') ?? DEFAULT_AXIS,
      ...(limits === undefined ? {} : { limits }),
    });
  }
  return { joints, errors };
}

/** Depth of each link measured in joints from `root`. */
function linkDepths(root: string, joints: readonly JointInput[]): ReadonlyMap<string, number> {
  const byParent = new Map<string, string[]>();
  for (const joint of joints) {
    const siblings = byParent.get(joint.parent);
    if (siblings === undefined) byParent.set(joint.parent, [joint.child]);
    else siblings.push(joint.child);
  }
  const depths = new Map<string, number>([[root, 0]]);
  const pending: string[] = [root];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const depth = depths.get(next) ?? 0;
    for (const child of byParent.get(next) ?? []) {
      if (depths.has(child)) continue;
      depths.set(child, depth + 1);
      pending.push(child);
    }
  }
  return depths;
}

/**
 * End effector of the table in docs/ROBOT-SPEC.md §2: a link named `tool0`, `ee_link` or
 * `gripper*` if one exists, otherwise the deepest leaf.
 */
function findEndEffector(
  baseLink: string,
  links: readonly LinkInput[],
  joints: readonly JointInput[],
): string {
  const parents = new Set(joints.map((joint) => joint.parent));
  const leaves = links.map((link) => link.name).filter((name) => !parents.has(name));
  for (const preferred of END_EFFECTOR_NAMES) {
    if (leaves.includes(preferred)) return preferred;
  }
  const gripper = leaves.find((name) => name.startsWith(END_EFFECTOR_PREFIX));
  if (gripper !== undefined) return gripper;
  const depths = linkDepths(baseLink, joints);
  let deepest = baseLink;
  let deepestDepth = -1;
  for (const leaf of leaves) {
    const depth = depths.get(leaf) ?? -1;
    if (depth > deepestDepth) {
      deepest = leaf;
      deepestDepth = depth;
    }
  }
  return deepest;
}

/** The link that is never a child; `validate` has already guaranteed there is exactly one. */
function findBaseLink(links: readonly LinkInput[], joints: readonly JointInput[]): string {
  const children = new Set(joints.map((joint) => joint.child));
  return links.map((link) => link.name).find((name) => !children.has(name)) ?? '';
}

/** The `<robot>` element of a parsed document, or `undefined` if the XML is not a URDF. */
function findRobot(document: UrdfDocument): UrdfElement | undefined {
  // xmldom reports a malformed document through a <parsererror> element instead of throwing.
  if (childrenByTag(document, 'parsererror').length > 0) return undefined;
  return firstByTag(document, 'robot');
}

/**
 * Reads a URDF document into a `RobotSpec` with `kind: 'arm-serial'`, validating it structurally
 * and then against the schema of `@trayectoria/robot-spec`. Mapping table: docs/ROBOT-SPEC.md §2.
 */
export function parseUrdf(xml: string, options: ParseUrdfOptions): UrdfResult {
  let document: UrdfDocument;
  try {
    document = options.domParser.parseFromString(xml, 'text/xml');
  } catch (error) {
    const detail = error instanceof Error ? error.message : undefined;
    return { ok: false, errors: [urdfError('parse', detail)] };
  }

  const robot = findRobot(document);
  if (robot === undefined) {
    return { ok: false, errors: [urdfError('parse', 'missing <robot> element')] };
  }

  const { links, errors: linkErrors } = readLinks(robot);
  const { joints, errors: jointErrors } = readJoints(robot);
  const extractionErrors = [...linkErrors, ...jointErrors];
  if (extractionErrors.length > 0) return { ok: false, errors: extractionErrors };

  const structuralErrors = validate(links, joints);
  if (structuralErrors.length > 0) return { ok: false, errors: structuralErrors };

  const baseLink = findBaseLink(links, joints);
  const parsed = parseRobotSpec({
    specVersion: 1,
    id: options.robotId,
    name: robot.getAttribute('name') ?? '',
    kind: 'arm-serial',
    source: { type: 'urdf' },
    arm: { baseLink, endEffectorLink: findEndEffector(baseLink, links, joints), links, joints },
  });
  if (parsed.ok) return { ok: true, value: parsed.value };
  const errors = parsed.errors.map((error) => urdfError('parse', `${error.path}: ${error.message}`));
  return { ok: false, errors };
}
