import type { ArmSpec } from '@trayectoria/robot-spec';
import { fromAxisAngle, fromRpy, identity, multiply, translate } from '@trayectoria/sim-core';
import type { Mat4 } from '@trayectoria/sim-core';

// F5-02 (#135, decisión 2): las tres matrices de cada eslabón de la cadena, construidas con las
// funciones de sim-core siguiendo `T_child = T_parent · T_origin(xyz, rpy) · T_joint(q)`
// (docs/ARCHITECTURE.md §4.5). La acumulada coincide entrada a entrada con `forwardKinematics`;
// un test lo comprueba. Ningún número de este módulo viene de three.

type Joint = ArmSpec['joints'][number];

/** Decimales de las entradas de una matriz (docs/DESIGN.md §6, panel de matrices). */
const ENTRY_DECIMALS = 3;

/** Lado de la matriz homogénea; el `Mat4` de sim-core es columna-mayor de 4×4. */
const SIDE = 4;

/** Las tres matrices de un eslabón de la cadena, en el orden en que las pinta el panel. */
export interface LinkTransform {
  /** Nombre del eslabón. */
  readonly link: string;
  /** Articulación que lo cuelga de su padre; `null` solo en el eslabón base. */
  readonly joint: string | null;
  /** Desplazamiento fijo del padre al marco de la articulación, `T_origin(xyz, rpy)`. */
  readonly T_origin: Mat4;
  /** Aportación de la articulación para la configuración actual, `T_joint(q)`. */
  readonly T_joint: Mat4;
  /** Transformada del eslabón respecto de la base, `⁰T_i`. */
  readonly T_cumulative: Mat4;
}

/** `T_origin(xyz, rpy)`: el desplazamiento fijo del eslabón padre al marco de la articulación. */
function originTransform(joint: Joint): Mat4 {
  const [x_m, y_m, z_m] = joint.origin.xyz;
  return multiply(translate(x_m, y_m, z_m), fromRpy(joint.origin.rpy));
}

/**
 * `T_joint(q)` de docs/ARCHITECTURE.md §4.5: rotación sobre `axis` en revolute y continuous,
 * traslación sobre `axis` en prismatic, identidad en fixed.
 */
function jointTransform(joint: Joint, q_rad: number): Mat4 {
  if (joint.type === 'fixed') return identity();
  if (joint.type === 'prismatic') {
    const [x, y, z] = joint.axis;
    const length = Math.hypot(x, y, z);
    if (length === 0) return identity();
    const d_m = q_rad / length;
    return translate(x * d_m, y * d_m, z * d_m);
  }
  return fromAxisAngle(joint.axis, q_rad);
}

/** El valor de `q` de cada articulación actuada, por nombre; las fijas no aparecen en `q`. */
function valuesByJoint(arm: ArmSpec, q_rad: readonly number[]): ReadonlyMap<string, number> {
  const actuated = arm.joints.filter((joint) => joint.type !== 'fixed');
  return new Map(actuated.map((joint, index) => [joint.name, q_rad[index] ?? 0]));
}

/** Las articulaciones que cuelgan de cada eslabón padre. */
function childrenByParent(arm: ArmSpec): ReadonlyMap<string, readonly Joint[]> {
  const children = new Map<string, Joint[]>();
  for (const joint of arm.joints) {
    const siblings = children.get(joint.parent);
    if (siblings === undefined) children.set(joint.parent, [joint]);
    else siblings.push(joint);
  }
  return children;
}

/**
 * `T_origin`, `T_joint(q)` y `⁰T_i` de cada eslabón, en orden de cadena desde `baseLink`. El
 * eslabón base abre la lista con la identidad y sin articulación. Los eslabones que no
 * descienden de la base no aparecen, igual que no aparecen en la cadena.
 */
export function linkTransforms(arm: ArmSpec, q_rad: readonly number[]): readonly LinkTransform[] {
  const valueOf = valuesByJoint(arm, q_rad);
  const childrenOf = childrenByParent(arm);
  const rows: LinkTransform[] = [
    {
      link: arm.baseLink,
      joint: null,
      T_origin: identity(),
      T_joint: identity(),
      T_cumulative: identity(),
    },
  ];
  // `rows` crece mientras se recorre: `for...of` recoge los eslabones que añade el cuerpo, así
  // que la cadena se visita en anchura desde la base y el padre siempre se resuelve antes.
  for (const node of rows) {
    for (const joint of childrenOf.get(node.link) ?? []) {
      const T_origin = originTransform(joint);
      const T_joint = jointTransform(joint, valueOf.get(joint.name) ?? 0);
      rows.push({
        link: joint.child,
        joint: joint.name,
        T_origin,
        T_joint,
        T_cumulative: multiply(node.T_cumulative, multiply(T_origin, T_joint)),
      });
    }
  }
  return rows;
}

/**
 * Una entrada de la matriz con tres decimales. El cero negativo y lo que redondea a cero se
 * normalizan a `0.000`: `−0.000` es ruido de coma flotante, no un valor (#135, decisión 3).
 */
export function formatEntry(value: number): string {
  const text = value.toFixed(ENTRY_DECIMALS);
  return text === `-${(0).toFixed(ENTRY_DECIMALS)}` ? (0).toFixed(ENTRY_DECIMALS) : text;
}

/** Las cuatro filas de la matriz, ya formateadas, leídas del `Mat4` columna-mayor de sim-core. */
export function matrixRows(transform: Mat4): readonly (readonly string[])[] {
  return Array.from({ length: SIDE }, (_unused, row) =>
    Array.from({ length: SIDE }, (_ignored, column) =>
      formatEntry(transform[column * SIDE + row] ?? 0),
    ),
  );
}
