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

// Playground-only discovery/rendering (docs/STANDARDS.md §4: index.ts reexports the public
// API only); the implementation lives in ./dev/StoryGallery.
export { StoryGallery, stories } from './dev/StoryGallery';
export type { WidgetStory, WidgetStories } from './dev/StoryGallery';
