import { useEffect } from 'react';
import type { JSX } from 'react';
import { Color, Mesh, MeshStandardMaterial } from 'three';
import type { Object3D } from 'three';
import type { URDFRobot } from 'urdf-loader';

import type { ActuatedJoint, ArmColors } from './types';

// F5-01a (#133, decisión 5): el objeto de `urdf-loader` se cuelga del `Canvas` de `Scene3D` con
// `<primitive>`, y un efecto le aplica `setJointValue` por articulación cuando cambia `q`. Los
// materiales del URDF se sustituyen por los tokens de docs/DESIGN.md §6: base `fg-muted` y
// eslabones `physical`. Las articulaciones, que en §6 son círculos `fg`, no se dibujan en este
// ticket: el URDF no las declara como geometría propia y el catálogo no trae mallas para ellas;
// lo que sí las marca son los marcos de `Frame`, que se colocan con sim-core.

/** Color de `emissive` cuando el eslabón no está resaltado: negro, es decir sin emisión. */
const HIGHLIGHT_OFF = new Color(0x000000);

/**
 * Parte del brazo a la que pertenece un eslabón (docs/DESIGN.md §6: «base `fg-muted`, eslabones
 * `physical`»). Las articulaciones no son eslabones: se dibujan aparte, con el token `fg`.
 */
function partOf(link: string, baseLink: string): 'base' | 'link' {
  return link === baseLink ? 'base' : 'link';
}

/** Marcas que urdf-loader pone en los nodos de la jerarquía del robot. */
interface UrdfNode {
  readonly isURDFVisual?: boolean;
}

/** Estrecha un nodo de three a las marcas que urdf-loader le añade, sin aserción de tipo. */
function isUrdfNode(node: Object3D): node is Object3D & UrdfNode {
  return 'isURDFVisual' in node;
}

/** Si el nodo es un `<visual>` de urdf-loader. */
function isVisual(node: Object3D): boolean {
  return isUrdfNode(node) && node.isURDFVisual === true;
}

/** Los `<visual>` propios de un eslabón, sin descender a los eslabones hijos. */
function ownVisuals(link: Object3D): readonly Object3D[] {
  return link.children.filter(isVisual);
}

/**
 * Sustituye el material de cada malla del robot por uno de los tokens de docs/DESIGN.md §6, según
 * el eslabón del que cuelga. Devuelve los materiales creados para liberarlos al desmontar.
 */
export function applyArmMaterials(
  robot: URDFRobot,
  colors: ArmColors,
  baseLink: string,
): readonly MeshStandardMaterial[] {
  const created: MeshStandardMaterial[] = [];
  for (const [name, link] of Object.entries(robot.links)) {
    const color = new Color(colors[partOf(name, baseLink)]);
    // Solo los `<visual>` propios del eslabón: en urdf-loader los eslabones hijos cuelgan del
    // padre, así que recorrer todo el subárbol repintaría el brazo entero con un solo token.
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
 * Marca el eslabón elegido en el panel de matrices pintando `emissive` con el token `primary`
 * sobre los materiales de sus `<visual>` propios (#135, decisión 4). Devuelve la función que
 * apaga la marca, para restaurarla al cambiar de eslabón o al desmontar.
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
  /** El robot cargado por `urdf-loader`; se dibuja tal cual, nunca se lee para mostrar números. */
  robot: URDFRobot;
  /** Articulaciones actuadas, en el orden de `q`. */
  joints: readonly ActuatedJoint[];
  /** Configuración actual, en radianes. */
  q_rad: readonly number[];
  /** Nombre del eslabón base, para el material de la base. */
  baseLink: string;
  /** Colores del brazo resueltos de los tokens. */
  colors: ArmColors;
  /** Eslabón a resaltar en 3D, el elegido en el panel de matrices; `undefined` no resalta nada. */
  highlightLink?: string | undefined;
}

/**
 * El brazo dentro del `Canvas` de `Scene3D`: un `<primitive>` con el objeto de three, con los
 * valores de articulación de `q` y los materiales de los tokens.
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

  // El resaltado va después de los materiales: `applyArmMaterials` crea materiales nuevos, así
  // que marcar antes pintaría los que acaban de sustituirse. `colors` y `baseLink` están en las
  // dependencias por eso mismo, para volver a marcar cuando se rehacen.
  useEffect(
    () => applyHighlight(robot, highlightLink ?? null, colors.highlight),
    [robot, highlightLink, colors, baseLink],
  );

  // `<primitive>` solo admite props que R3F pueda asignar al objeto de three: un `data-*` haría
  // que `applyProps` intentase escribirlo en el `Object3D` y lanzase («R3F: Cannot set
  // "data-base-link"»). El componente no lleva atributos propios; lo que se comprueba en los
  // tests es el objeto que recibe y los efectos que aplica sobre él.
  return <primitive object={robot} />;
}
