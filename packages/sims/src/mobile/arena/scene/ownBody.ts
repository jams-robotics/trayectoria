import { Box3, Group, Material, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { Color } from 'three';
import type { MobileSpec } from '@trayectoria/robot-spec';

import { autoScale } from '../model/modelFile';
import type { OwnModel } from '../model/ownModel';

const QUARTER = Math.PI / 2;
const MM = 0.001;

/** Gives each mesh its own copy of the material (STL has a neutral one, tinted with `body`). */
function ownMaterials(root: Group, model: OwnModel, body: Color): void {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const material: unknown = child.material;
    if (model.kind === 'stl') {
      child.material = new MeshStandardMaterial({ color: body, metalness: 0.2, roughness: 0.4 });
    } else {
      const list: unknown[] = Array.isArray(material) ? material : [material];
      child.material = list.filter((m) => m instanceof Material).map((m) => m.clone());
    }
    child.castShadow = true;
    child.receiveShadow = true;
  });
}

/**
 * The learner's model as the robot's body: turned by the adjust, scaled so its box fits the
 * chassis (length of the spec by wheel track), and set on the plate. Its own copy of the tree,
 * so the scene can free it without touching the original.
 */
export function buildOwnBody(model: OwnModel, spec: MobileSpec, body: Color): Group {
  // Same place as the stock chassis plate in robotMesh.ts.
  const centerX_m = spec.lineSensors.forwardOffset_m + 0.012 - spec.length_m / 2;
  const plateZ_m = spec.wheelRadius_m * 0.75;
  const { quarters, scale, lift_mm } = model.adjust;
  const inner = new Group();
  const clone = model.object.clone(true);
  inner.add(clone);
  inner.rotation.set(quarters[0] * QUARTER, quarters[1] * QUARTER, quarters[2] * QUARTER);
  inner.updateMatrixWorld(true);
  const box = new Box3().setFromObject(inner);
  const size = box.getSize(new Vector3());
  const fit = autoScale(size, spec.length_m, spec.wheelBase_m) * scale;
  const center = box.getCenter(new Vector3());
  const root = new Group();
  root.add(inner);
  inner.position.set(-center.x * fit, -center.y * fit, -box.min.z * fit);
  inner.scale.setScalar(fit);
  root.position.set(centerX_m, 0, plateZ_m + lift_mm * MM);
  ownMaterials(root, model, body);
  return root;
}
