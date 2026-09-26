import { useEffect } from 'react';
import type { JSX } from 'react';
import { Color, Mesh, MeshStandardMaterial } from 'three';
import type { Object3D } from 'three';
import type { URDFRobot } from 'urdf-loader';

import type { ActuatedJoint, ArmColors } from './types';

// F5-01a (#133, decision 5): the `urdf-loader` object is hung from the `Canvas` of `Scene3D` with
// `<primitive>`, and an effect applies `setJointValue` per joint whenever `q` changes. The
// URDF materials are replaced with the tokens of docs/DESIGN.md §6: base `fg-muted` and
// links `physical`. The joints, which in §6 are `fg` circles, are not drawn in this
// ticket: the URDF does not declare them as their own geometry and the catalog ships no meshes for them;
// what does mark them are the `Frame` frames, which are placed with sim-core.

/** `emissive` colour when the link is not highlighted: black, that is, no emission. */
const HIGHLIGHT_OFF = new Color(0x000000);

/**
 * Part of the arm a link belongs to (docs/DESIGN.md §6: «base `fg-muted`, eslabones
 * `physical`»). The joints are not links: they are drawn separately, with the `fg` token.
 */
function partOf(link: string, baseLink: string): 'base' | 'link' {
  return link === baseLink ? 'base' : 'link';
}

/** Marks that urdf-loader puts on the nodes of the robot hierarchy. */
interface UrdfNode {
  readonly isURDFVisual?: boolean;
}

/** Narrows a three node to the marks urdf-loader adds to it, without a type assertion. */
function isUrdfNode(node: Object3D): node is Object3D & UrdfNode {
  return 'isURDFVisual' in node;
}

/** Whether the node is a urdf-loader `<visual>`. */
function isVisual(node: Object3D): boolean {
  return isUrdfNode(node) && node.isURDFVisual === true;
}

/** The link's own `<visual>` nodes, without descending into the child links. */
function ownVisuals(link: Object3D): readonly Object3D[] {
  return link.children.filter(isVisual);
}

/**
 * Replaces the material of each robot mesh with one of the tokens of docs/DESIGN.md §6, according
 * to the link it hangs from. Returns the created materials so they can be disposed on unmount.
 */
export function applyArmMaterials(
  robot: URDFRobot,
  colors: ArmColors,
  baseLink: string,
): readonly MeshStandardMaterial[] {
  const created: MeshStandardMaterial[] = [];
  for (const [name, link] of Object.entries(robot.links)) {
    const color = new Color(colors[partOf(name, baseLink)]);
    // Only the link's own `<visual>` nodes: in urdf-loader the child links hang from the
    // parent, so walking the whole subtree would repaint the entire arm with a single token.
    for (const visual of ownVisuals(link)) {
      visual.traverse((node: Object3D) => {
        if (!(node instanceof Mesh)) return;
        const material = new MeshStandardMaterial({ color });
        created.push(material);
        node.material = material;
      });
    }
  }
  return created;
}

/**
 * Marks the link chosen in the matrix panel by painting `emissive` with the `primary` token
 * on the materials of its own `<visual>` nodes (#135, decision 4). Returns the function that
 * turns the mark off, to restore it when the link changes or on unmount.
 */
export function applyHighlight(robot: URDFRobot, link: string | null, color: string): () => void {
  const marked: MeshStandardMaterial[] = [];
  const target = link === null || color === '' ? undefined : robot.links[link];
  for (const visual of target === undefined ? [] : ownVisuals(target)) {
    visual.traverse((node: Object3D) => {
      if (!(node instanceof Mesh)) return;
      if (!(node.material instanceof MeshStandardMaterial)) return;
      node.material.emissive.set(new Color(color));
      marked.push(node.material);
    });
  }
  return () => {
    for (const material of marked) material.emissive.set(HIGHLIGHT_OFF);
  };
}

export interface UrdfModelProps {
  /** The robot loaded by `urdf-loader`; drawn as is, never read to display numbers. */
  robot: URDFRobot;
  /** Actuated joints, in the order of `q`. */
  joints: readonly ActuatedJoint[];
  /** Current configuration, in radians. */
  q_rad: readonly number[];
  /** Name of the base link, for the base material. */
  baseLink: string;
  /** Arm colours resolved from the tokens. */
  colors: ArmColors;
  /** Link to highlight in 3D, the one chosen in the matrix panel; `undefined` highlights nothing. */
  highlightLink?: string | undefined;
}

/**
 * The arm inside the `Canvas` of `Scene3D`: a `<primitive>` with the three object, with the
 * joint values of `q` and the token materials.
 */
export function UrdfModel({
  robot,
  joints,
  q_rad,
  baseLink,
  colors,
  highlightLink,
}: UrdfModelProps): JSX.Element {
  useEffect(() => {
    joints.forEach((joint, index) => {
      robot.setJointValue(joint.name, q_rad[index] ?? 0);
    });
  }, [robot, joints, q_rad]);

  useEffect(() => {
    const materials = applyArmMaterials(robot, colors, baseLink);
    return () => {
      for (const material of materials) material.dispose();
    };
  }, [robot, colors, baseLink]);

  // The highlight goes after the materials: `applyArmMaterials` creates new materials, so
  // marking earlier would paint the ones that have just been replaced. `colors` and `baseLink`
  // are in the dependencies for that very reason, to mark again when they are rebuilt.
  useEffect(
    () => applyHighlight(robot, highlightLink ?? null, colors.highlight),
    [robot, highlightLink, colors, baseLink],
  );

  // `<primitive>` only accepts props that R3F can assign to the three object: a `data-*` would make
  // `applyProps` try to write it into the `Object3D` and throw («R3F: Cannot set
  // "data-base-link"»). The component carries no attributes of its own; what the
  // tests check is the object it receives and the effects it applies to it.
  return <primitive object={robot} />;
}
