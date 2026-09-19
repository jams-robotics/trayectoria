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
  PlotSeries,
} from './Plot';
export { Scene2D, Axes, Circle, Grid, Label, Rect, Trace, Vector } from './Scene2D';
export { createTransform, lengthToPx, pxToWorld, worldToPx } from './Scene2D';
export type {
  AxesProps,
  CircleProps,
  GridProps,
  LabelProps,
  RectProps,
  Scene2DProps,
  TraceProps,
  Transform,
  TransformInput,
  VectorProps,
  WorldBounds,
} from './Scene2D';

// Playground-only discovery/rendering (docs/STANDARDS.md §4: index.ts reexports the public
// API only); the implementation lives in ./dev/StoryGallery.
export { StoryGallery, stories } from './dev/StoryGallery';
export type { WidgetStory, WidgetStories } from './dev/StoryGallery';
