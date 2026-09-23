export {
  DEFAULT_CONTINUITY_TOLERANCE_M,
  DEFAULT_SNAP_TOLERANCE_M,
  HISTORY_LIMIT,
  addArc,
  addLine,
  canRedo,
  canUndo,
  continuity,
  createHistory,
  emptyEditor,
  fromJson,
  fromPreset,
  moveEndpoint,
  push,
  redo,
  removeSegment,
  segmentEndpoints,
  select,
  setLineWidth,
  setRadius,
  snap,
  toJson,
  undo,
} from './mobile/trackEditor';
export type {
  ContinuityReport,
  EditorState,
  Endpoint,
  History,
  TrackGap,
} from './mobile/trackEditor';
export {
  ARC_RADIUS_FACTOR,
  PICK_TOLERANCE_M,
  TRACK_FILE_NAME,
  TrackEditor,
  arcFromDrag,
  downloadJson,
  readFileText,
  useTrackEditor,
} from './mobile/trackEditor';
export type {
  DownloadTrigger,
  DragArc,
  TrackDraft,
  TrackEditorApi,
  TrackEditorProps,
  TrackTool,
  UseTrackEditorOptions,
} from './mobile/trackEditor';

// F4-06 (#191): the tracks saved in the account or in the browser. `serializeTrack` is
// re-exported because the Supabase adapter lives in `apps/web`, which cannot import sim-core
// (docs/ARCHITECTURE.md §2) and stores the track with the same text the editor exports.
export {
  LOCAL_TRACKS_KEY,
  MAX_NAME_LENGTH,
  deleteLocalTrack,
  listLocalTracks,
  saveLocalTrack,
} from './mobile/trackEditor';
export { serializeTrack } from '@trayectoria/sim-core';
export type { SavedTrack } from './mobile/trackEditor';

// #210: the 64 KiB bound of the `jsonb` columns the client writes (docs/ARCHITECTURE.md §5.1).
export { MAX_STORED_JSON_BYTES, fitsStoredJson } from './storedJson';

export {
  CATALOG_MOBILE_IDS,
  catalogMobileUrl,
  isCatalogMobileId,
  loadCatalogMobile,
  loadCatalogMobileAll,
  summaryOf,
} from './mobile/catalog';
export type {
  CatalogMobileEntry,
  CatalogMobileId,
  LoadCatalogMobileOptions,
} from './mobile/catalog';

export {
  CONTROLLERS,
  CONTROLLER_IDS,
  ControllerPanel,
  MANUAL_DIFF_RADPS,
  MANUAL_KEYSHORTCUTS,
  MANUAL_STEP_RADPS,
  ManualControls,
  ManualHelp,
  ManualViewer,
  commandOf,
  useManualKeyboard,
  useManualMode,
  HANDLE_RADIUS_M,
  LineFollowerView,
  LineFollowerWidget,
  START_BAND_M,
  S_STEP_M,
  Instruments,
  LapCard,
  MOBILE_PLOT_HEIGHT_PX,
  PLOT_HEIGHT_PX,
  PLOT_WINDOW_S,
  StartPoseHandle,
  StartPoseMarker,
  TANGENT_STEP_M,
  TRACK_INDEX_STEP_M,
  avgSpeed_mps,
  buildTrackIndex,
  createLapTimer,
  lostEvent,
  pidTerms,
  recordLap,
  useInstruments,
  controllerParams,
  createLineFollowerModel,
  crossedStart,
  isControllerId,
  poseOnTrack,
  projectOnTrack,
  resolveTrack,
  startPoseOf,
  useLineFollower,
  viewOf,
} from './mobile/lineFollower';
export type {
  ControllerDef,
  ControllerId,
  ControllerPanelProps,
  ControllerParams,
  InstrumentBuffers,
  InstrumentsProps,
  Lap,
  LapCardProps,
  LapTimer,
  LiveInstruments,
  LostEvent,
  ManualControlsProps,
  ManualDrive,
  ManualKey,
  UseManualKeyboardOptions,
  LineFollowerApi,
  LineFollowerInput,
  LineFollowerOptions,
  LineFollowerPlot,
  LineFollowerState,
  LineFollowerViewProps,
  LineFollowerWidgetProps,
  PidTerms,
  Pose,
  StartPose,
  StartPoseControl,
  StartPoseHandleProps,
  TrackIndex,
  TrackJson,
  TrackPreset,
  TrackSample,
  UseInstrumentsOptions,
  UseLineFollowerOptions,
} from './mobile/lineFollower';

// F4-05 (#131): guardar y compartir la configuración del simulador móvil.
export {
  SHARE_PARAM,
  SIM_CONFIGS_KEY,
  SaveConfigPanel,
  ShareLink,
  decode,
  deleteSimConfig,
  encode,
  listSimConfigs,
  parseSimConfig,
  saveSimConfig,
  shareLink,
} from './mobile/simConfig';
export type {
  DecodeError,
  SaveConfigPanelProps,
  ShareLinkProps,
  SimConfig,
} from './mobile/simConfig';

// Playground-only discovery/rendering (docs/STANDARDS.md §4: index.ts reexports the public
// API only); the implementation lives in ./dev/SimGallery.
export { SimGallery, stories } from './dev/SimGallery';
export type { SimGalleryProps, SimStories, SimStory } from './dev/SimGallery';
