import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import type { Color } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { sensorPositions } from '@trayectoria/sim-core';
import type { DiffDriveState, LineReading } from '@trayectoria/sim-core';
import type { MobileSpec } from '@trayectoria/robot-spec';

import type { ArenaPalette } from './palette';

// The 3D robot is built from the very numbers of the spec: wheel radius and track, chassis
// length and width, and the sensor array (count, spacing, forward offset). Changing «Mi robot»
// changes the model on screen.

const WHEEL_WIDTH_M = 0.018;
const PLATE_M = 0.004;
const DECK_GAP_M = 0.03;
/** Height of the sensor board over the mat, in metres. */
const SENSOR_HEIGHT_M = 0.012;

export interface RobotMesh {
  readonly group: Group;
  /** Places the robot at `robot` and lights each sensor with its reading. */
  update(robot: DiffDriveState, reading: LineReading): void;
  /** Scales the opacity of the whole robot, `0` hides it (the ghost fades near the camera). */
  fade(k: number): void;
}

/** Every material under `group` with the opacity it was built with. */
function materialsOf(group: Group): Array<{ material: Material; opacity: number }> {
  const found: Array<{ material: Material; opacity: number }> = [];
  group.traverse((child) => {
    if (child instanceof Mesh && child.material instanceof MeshStandardMaterial) {
      found.push({ material: child.material, opacity: child.material.opacity });
    }
  });
  return found;
}

function standard(
  color: Color,
  options: { opacity?: number; metalness?: number; roughness?: number } = {},
): MeshStandardMaterial {
  const { opacity = 1, metalness = 0.1, roughness = 0.55 } = options;
  return new MeshStandardMaterial({
    color,
    metalness,
    roughness,
    transparent: opacity < 1,
    opacity,
  });
}

function shadowed(mesh: Mesh): Mesh {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function wheel(spec: MobileSpec, palette: ArenaPalette, side: 1 | -1, ghost: number): Group {
  const tire = shadowed(
    new Mesh(
      new CylinderGeometry(spec.wheelRadius_m, spec.wheelRadius_m, WHEEL_WIDTH_M, 32),
      standard(palette.wheel, { opacity: ghost, roughness: 0.95 }),
    ),
  );
  const hub = new Mesh(
    new BoxGeometry(spec.wheelRadius_m * 1.5, WHEEL_WIDTH_M * 1.08, spec.wheelRadius_m * 0.28),
    standard(palette.robot, { opacity: ghost }),
  );
  const group = new Group();
  group.add(tire, hub);
  group.position.set(0, (side * spec.wheelBase_m) / 2, spec.wheelRadius_m);
  return group;
}

/** Upper deck with the battery and the controller board, centred at `centerX_m`. */
function upperDeck(
  spec: MobileSpec,
  palette: ArenaPalette,
  ghost: number,
  centerX_m: number,
  plateZ_m: number,
): Mesh[] {
  const length_m = spec.length_m;
  const deck = shadowed(
    new Mesh(
      new RoundedBoxGeometry(length_m * 0.55, spec.width_m * 0.5, PLATE_M, 3, 0.002),
      standard(palette.deck, { opacity: ghost }),
    ),
  );
  deck.position.set(centerX_m - length_m * 0.12, 0, plateZ_m + DECK_GAP_M);
  const battery = shadowed(
    new Mesh(
      new BoxGeometry(length_m * 0.3, spec.width_m * 0.32, DECK_GAP_M * 0.7),
      standard(palette.wheel, { opacity: ghost }),
    ),
  );
  battery.position.set(centerX_m - length_m * 0.12, 0, plateZ_m + DECK_GAP_M * 0.45);
  const board = shadowed(
    new Mesh(
      new BoxGeometry(length_m * 0.28, spec.width_m * 0.3, PLATE_M),
      standard(palette.board, { opacity: ghost, roughness: 0.4 }),
    ),
  );
  board.position.set(centerX_m - length_m * 0.12, 0, plateZ_m + DECK_GAP_M + PLATE_M);
  return [deck, battery, board];
}

function chassis(spec: MobileSpec, palette: ArenaPalette, body: Color, ghost: number): Group {
  const group = new Group();
  const length_m = spec.length_m;
  const centerX_m = spec.lineSensors.forwardOffset_m + 0.012 - length_m / 2;
  const plateZ_m = spec.wheelRadius_m * 0.75;
  const plate = shadowed(
    new Mesh(
      new RoundedBoxGeometry(length_m, spec.width_m - WHEEL_WIDTH_M * 2.4, PLATE_M, 3, 0.002),
      standard(body, { opacity: ghost, roughness: 0.35, metalness: 0.2 }),
    ),
  );
  plate.position.set(centerX_m, 0, plateZ_m);
  const caster = shadowed(
    new Mesh(
      new SphereGeometry(0.009, 16, 12),
      standard(palette.deck, { opacity: ghost, metalness: 0.8 }),
    ),
  );
  caster.position.set(centerX_m - length_m * 0.4, 0, 0.009);
  group.add(plate, ...upperDeck(spec, palette, ghost, centerX_m, plateZ_m), caster);
  return group;
}

interface SensorParts {
  readonly group: Group;
  readonly leds: MeshStandardMaterial[];
  readonly beams: MeshBasicMaterial[];
}

function sensorBar(spec: MobileSpec, palette: ArenaPalette, ghost: number): SensorParts {
  const group = new Group();
  const { count, spacing_m, forwardOffset_m } = spec.lineSensors;
  const bar = shadowed(
    new Mesh(
      new BoxGeometry(0.012, spacing_m * count + 0.012, PLATE_M),
      standard(palette.deck, { opacity: ghost }),
    ),
  );
  bar.position.set(forwardOffset_m, 0, SENSOR_HEIGHT_M + PLATE_M);
  group.add(bar);
  const leds: MeshStandardMaterial[] = [];
  const beams: MeshBasicMaterial[] = [];
  for (const [x_m, y_m] of sensorPositions(spec)) {
    const led = standard(palette.sensorOff, { opacity: ghost });
    const chip = new Mesh(new BoxGeometry(0.006, 0.006, 0.003), led);
    chip.position.set(x_m, y_m, SENSOR_HEIGHT_M);
    const beamMaterial = new MeshBasicMaterial({
      color: palette.sensorOn,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const beam = new Mesh(new ConeGeometry(0.005, SENSOR_HEIGHT_M, 16, 1, true), beamMaterial);
    beam.rotation.x = Math.PI / 2;
    beam.position.set(x_m, y_m, SENSOR_HEIGHT_M / 2);
    group.add(chip, beam);
    leds.push(led);
    beams.push(beamMaterial);
  }
  return { group, leds, beams };
}

/** Lights each sensor LED and beam with its reading; the ghost shows no beams. */
function lightSensors(
  bar: SensorParts,
  palette: ArenaPalette,
  reading: LineReading,
  ghost: boolean,
): void {
  reading.values.forEach((value, k) => {
    const led = bar.leds[k];
    const beam = bar.beams[k];
    if (led !== undefined) {
      led.color.copy(palette.sensorOff).lerp(palette.sensorOn, value);
      led.emissive.copy(palette.sensorOn).multiplyScalar(value * 1.6);
    }
    if (beam !== undefined) beam.opacity = ghost ? 0 : 0.15 + value * 0.55;
  });
}

/** The ghost casts no shadow: it is a reference, not a body on the mat. */
function dropShadows(group: Group): void {
  group.traverse((child) => {
    if (child instanceof Mesh) child.castShadow = false;
  });
}

/**
 * Builds the robot of `spec`. `ghost` builds the translucent reference robot, which shows no
 * sensor beams so the learner's robot stays the one that reads the line. Without `sensors` the
 * sensor bar and its beams are left out: the free arena has no line to read.
 */
export function buildRobot(
  spec: MobileSpec,
  palette: ArenaPalette,
  ghost = false,
  sensors = true,
): RobotMesh {
  const opacity = ghost ? 0.38 : 1;
  const group = new Group();
  const left = wheel(spec, palette, 1, opacity);
  const right = wheel(spec, palette, -1, opacity);
  const bar = sensorBar(spec, palette, opacity);
  bar.group.visible = sensors;
  group.add(
    chassis(spec, palette, ghost ? palette.ghost : palette.robot, opacity),
    left,
    right,
    bar.group,
  );
  if (ghost) dropShadows(group);
  const materials = materialsOf(group);
  return {
    group,
    fade(k) {
      group.visible = k > 0.02;
      for (const { material, opacity } of materials) material.opacity = opacity * k;
    },
    update(robot, reading) {
      group.position.set(robot.x_m, robot.y_m, 0);
      group.rotation.z = robot.theta_rad;
      left.rotation.y = robot.wheelAngleL_rad;
      right.rotation.y = robot.wheelAngleR_rad;
      lightSensors(bar, palette, reading, ghost);
    },
  };
}

/** Frees the GPU memory of everything under `group`. */
export function disposeGroup(group: Group): void {
  group.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const geometry: unknown = child.geometry;
    if (geometry instanceof BufferGeometry) geometry.dispose();
    const material: unknown = child.material;
    const materials: unknown[] = Array.isArray(material) ? material : [material];
    for (const each of materials) if (each instanceof Material) each.dispose();
  });
}
