export { ParamPanel } from './ParamPanel';
export type { ParamPanelParam, ParamPanelProps, ParamChangeHandler } from './ParamPanel';
export { Formula, HIGHLIGHT_CLASS } from './Formula';
export type { FormulaProps } from './Formula';
export { Plot, RingBuffer } from './Plot';
export type {
  PlotAxis,
  PlotLive,
  PlotMarker,
  PlotProps,
  PlotRefLine,
  PlotSegment,
  PlotSeries,
} from './Plot';
export {
  Scene2D,
  Axes,
  Circle,
  Grid,
  Label,
  Rect,
  RobotBody,
  Trace,
  TrackLayer,
  Vector,
} from './Scene2D';
export { createFrameClock, createTransform, lengthToPx, pxToWorld, worldToPx, useSimulationDriver } from './Scene2D';
export type {
  AxesProps,
  CircleProps,
  FrameClock,
  GridProps,
  LabelProps,
  RectProps,
  RobotBodyProps,
  RobotPose,
  Scene2DProps,
  SimulationDriver,
  SimulationDriverOptions,
  TraceProps,
  TrackLayerProps,
  Transform,
  TransformInput,
  VectorProps,
  WorldBounds,
} from './Scene2D';
export { SPEEDS, SimControls, formatTime } from './SimControls';
export type { SimControlsProps } from './SimControls';
export { VectorWidget, angleBetween, componentsOf, polarOf, readVectors } from './VectorWidget';
export type { Polar, VectorReadout, VectorShow, VectorWidgetProps } from './VectorWidget';
export {
  FreeBodyWidget,
  NORMAL_KEY,
  WEIGHT_KEY,
  forceComponents,
  readFreeBody,
  weightComponents,
} from './FreeBodyWidget';
export type {
  ForceInput,
  FreeBodyReadout,
  FreeBodyWidgetProps,
  ResolvedForce,
} from './FreeBodyWidget';
export {
  KinematicsWidget,
  SAMPLE_PERIOD_S,
  TANGENT_HALF_WIDTH_S,
  accelAt,
  positionAt,
  positionRange,
  sampleMotion,
  tangentSegment,
  velocityAt,
  worldWidthOf,
} from './KinematicsWidget';
export type {
  KinematicsEditable,
  KinematicsWidgetProps,
  Motion,
  MotionSamples,
  TangentSegment,
} from './KinematicsWidget';

export {
  ProjectileWidget,
  PATH_PERIOD_S,
  TRACE_PERIOD_S,
  flightTime,
  initialVelocity,
  maxHeight,
  range,
  robotPositionAt,
  samplePath,
  speedAt,
  traceDots,
} from './ProjectileWidget';
export type {
  Launch,
  ProjectileMode,
  ProjectileWidgetProps,
  VectorKind,
} from './ProjectileWidget';

export {
  RotationWidget,
  angleAt,
  angularAccel,
  centripetalAccel,
  frequency,
  maxCurveSpeed,
  omegaAt,
  omegaFor,
  period,
  rimSpeed,
  rollingAdvance,
  sampleOmega,
  tangentialAccel,
  timeToOmega,
  turnAdvance,
  turnsAt,
} from './RotationWidget';
export type {
  Curve,
  Rotation,
  RotationInputUnit,
  RotationMode,
  RotationWidgetProps,
} from './RotationWidget';

export {
  EnergyWidget,
  DT_S as ENERGY_DT_S,
  FLAT_LENGTH_M,
  MIN_SLOPE_RAD,
  // `accelAt` of KinematicsWidget is the acceleration of a 1-D motion; this one is the
  // acceleration along the ramp of the energy model, so the barrel keeps the two apart.
  accelAt as rampAccelAt,
  autonomy_min,
  electricalPower,
  energiesOf,
  heightAt,
  kineticEnergy,
  linearPower,
  mechanicalPower,
  netWork,
  onRamp,
  potentialEnergy,
  rampModel,
  readElectrical,
  readMechanical,
  shaftPower,
  trackLength_m,
  work,
} from './EnergyWidget';
export type {
  Electrical,
  Energies,
  EnergyMode,
  EnergyWidgetProps,
  Mechanical,
  MotorCount,
  Ramp,
  RampState,
} from './EnergyWidget';

export {
  GearWidget,
  MODULE_M as GEAR_MODULE_M,
  // `angleAt` of RotationWidget sweeps an angle with a possible ramp; this one is the angle of
  // a gear at constant speed, so the barrel keeps the two apart.
  angleAt as gearAngleAt,
  inputPower_W,
  outputOmega_radps,
  outputPower_W,
  outputSign,
  outputSpeed_rpm,
  outputTorque_Nm,
  pitchRadius_m,
  ratioFromSpeeds,
  shaftPower_W,
  shaftSpeeds,
  stageRatio,
  totalRatio,
} from './GearWidget';
export type { GearStages, GearWidgetProps, ShaftSpeeds, Train } from './GearWidget';

export {
  DiffDriveWidget,
  DT_S as DIFF_DRIVE_DT_S,
  INITIAL_POSE,
  defaultRobot,
  frameRows,
  headingTo,
  icrOf,
  isFeasible,
  maxSpeed_mps,
  mobileOf,
  poseRows,
  radiusText,
  readDiffDrive,
  rotationMatrix,
  saturate,
  // `statusOf` of the other widgets builds their own `aria-live` sentence; this one describes
  // the pose of the differential robot, so the barrel keeps them apart.
  statusOf as diffDriveStatusOf,
  toGlobal,
  toRobot,
  turningRadius_m,
  wheelCentres,
  wheelSpeed_mps,
} from './DiffDriveWidget';
export type {
  DiffDriveMode,
  DiffDriveShow,
  DiffDriveWidgetProps,
  Pose,
  Readout,
} from './DiffDriveWidget';

// Playground-only discovery/rendering (docs/STANDARDS.md §4: index.ts reexports the public
// API only); the implementation lives in ./dev/StoryGallery.
export { StoryGallery, stories } from './dev/StoryGallery';
export type { WidgetStory, WidgetStories } from './dev/StoryGallery';
