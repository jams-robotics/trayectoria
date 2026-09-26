// Own entry of LineFollowerWidget (#409, docs/WIDGETS.md; ADR-0009 applied to this package): the
// topic page loads it with `import('@trayectoria/sims/LineFollowerWidget')`, so a topic that
// declares it downloads the line follower and not the whole package, whose barrel also carries
// the arm and the URDF import.
export { LineFollowerWidget } from './mobile/lineFollower/LineFollowerWidget';
export type { LineFollowerWidgetProps } from './mobile/lineFollower/LineFollowerWidget';
