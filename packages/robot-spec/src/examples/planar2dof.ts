import type { RobotSpecInput } from '../schema';

// Planar 2-DoF arm of docs/ROBOT-SPEC.md §4 (catalog `planar2dof`): two revolute joints about Z,
// l1 = 0.20 m, l2 = 0.15 m, limits [-pi, pi], generated cylindrical meshes, end effector at the
// tip of l2. Frame convention of docs/GLOSSARY.md: X to the right, Y up, angles about Z.

const LINK1_LENGTH_M = 0.2;
const LINK2_LENGTH_M = 0.15;
const LINK_RADIUS_M = 0.01;
const JOINT_LIMIT_RAD = Math.PI;
// URDF cylinders extend along their local Z; a pitch of pi/2 lays them along the link's X.
const CYLINDER_ALONG_X_RPY_RAD: [number, number, number] = [0, Math.PI / 2, 0];

export const planar2dof: RobotSpecInput = {
  specVersion: 1,
  id: '7d2e3b7e-6b2a-4c6e-9a5f-2b1c6a1f0002',
  name: 'Brazo plano 2 GDL',
  kind: 'arm-serial',
  source: { type: 'catalog', catalogId: 'planar2dof' },
  arm: {
    baseLink: 'base_link',
    endEffectorLink: 'tool0',
    links: [
      {
        name: 'base_link',
        visual: { primitive: { type: 'cylinder', radius_m: 0.03, length_m: 0.02 } },
      },
      {
        name: 'link1',
        visual: {
          origin: { xyz: [LINK1_LENGTH_M / 2, 0, 0], rpy: CYLINDER_ALONG_X_RPY_RAD },
          primitive: { type: 'cylinder', radius_m: LINK_RADIUS_M, length_m: LINK1_LENGTH_M },
        },
      },
      {
        name: 'link2',
        visual: {
          origin: { xyz: [LINK2_LENGTH_M / 2, 0, 0], rpy: CYLINDER_ALONG_X_RPY_RAD },
          primitive: { type: 'cylinder', radius_m: LINK_RADIUS_M, length_m: LINK2_LENGTH_M },
        },
      },
      { name: 'tool0' },
    ],
    joints: [
      {
        name: 'joint1',
        type: 'revolute',
        parent: 'base_link',
        child: 'link1',
        origin: { xyz: [0, 0, 0], rpy: [0, 0, 0] },
        axis: [0, 0, 1],
        limits: { lower: -JOINT_LIMIT_RAD, upper: JOINT_LIMIT_RAD },
      },
      {
        name: 'joint2',
        type: 'revolute',
        parent: 'link1',
        child: 'link2',
        origin: { xyz: [LINK1_LENGTH_M, 0, 0], rpy: [0, 0, 0] },
        axis: [0, 0, 1],
        limits: { lower: -JOINT_LIMIT_RAD, upper: JOINT_LIMIT_RAD },
      },
      {
        name: 'tool0_joint',
        type: 'fixed',
        parent: 'link2',
        child: 'tool0',
        origin: { xyz: [LINK2_LENGTH_M, 0, 0], rpy: [0, 0, 0] },
      },
    ],
  },
};
