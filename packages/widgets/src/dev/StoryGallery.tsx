import { Suspense, createElement, lazy } from 'react';
import type { JSX } from 'react';

import * as diffDriveStories from '../DiffDriveWidget/DiffDriveWidget.stories';
import * as energyStories from '../EnergyWidget/EnergyWidget.stories';
import * as exerciseStories from '../ExerciseWidget/ExerciseWidget.stories';
import * as formulaStories from '../Formula/Formula.stories';
import * as freeBodyStories from '../FreeBodyWidget/FreeBodyWidget.stories';
import * as gearStories from '../GearWidget/GearWidget.stories';
import * as kinematicsStories from '../KinematicsWidget/KinematicsWidget.stories';
import * as myRobotStories from '../MyRobotWidget/MyRobotWidget.stories';
import * as paramPanelStories from '../ParamPanel/ParamPanel.stories';
import * as plotStories from '../Plot/Plot.stories';
import * as projectileStories from '../ProjectileWidget/ProjectileWidget.stories';
import * as rotationStories from '../RotationWidget/RotationWidget.stories';
import * as scene2DStories from '../Scene2D/Scene2D.stories';
import * as simControlsStories from '../SimControls/SimControls.stories';
import * as vectorStories from '../VectorWidget/VectorWidget.stories';

/** One named export of a `*.stories.tsx` file: a demo component with no props. */
export type WidgetStory = () => JSX.Element;

export interface WidgetStories {
  /** Widget name, the `title` of the default export of its stories file. */
  title: string;
  stories: ReadonlyArray<readonly [string, WidgetStory]>;
}

interface StoriesModule {
  // `order` fixes the story sequence explicitly: the iteration order of a module namespace
  // object is not guaranteed to match between the server render and the client bundle under
  // `client:load` (Vite/Astro dev), which caused a hydration mismatch (see docs/audits F2-01a).
  default: { title: string; order: readonly string[] };
  [exportName: string]: WidgetStory | { title: string; order: readonly string[] };
}

function isWidgetStory(value: StoriesModule[string] | undefined): value is WidgetStory {
  return typeof value === 'function';
}

/** Named exports of a stories module, ordered by its `default.order` (not module iteration order). */
function collect(module: StoriesModule): WidgetStories {
  const stories = module.default.order
    .map((name) => [name, module[name]] as const)
    .filter((entry): entry is [string, WidgetStory] => isWidgetStory(entry[1]));
  return { title: module.default.title, stories };
}

/**
 * Catalogue rendered by the `/dev/widgets` playground. A new widget is registered here
 * together with its `*.stories.tsx` file (docs/WIDGETS.md, reglas comunes).
 */
export const stories: readonly WidgetStories[] = [
  collect(paramPanelStories),
  collect(formulaStories),
  collect(plotStories),
  collect(scene2DStories),
  collect(simControlsStories),
  collect(vectorStories),
  collect(freeBodyStories),
  collect(kinematicsStories),
  collect(projectileStories),
  collect(rotationStories),
  collect(energyStories),
  collect(gearStories),
  collect(diffDriveStories),
  collect(exerciseStories),
  collect(myRobotStories),
];

function storyCase([name, Story]: readonly [string, WidgetStory]): JSX.Element {
  return createElement(
    'article',
    { key: name, 'data-story': name },
    createElement(
      'h3',
      { className: 'text-fg-muted font-mono text-xs tracking-[0.06em] uppercase' },
      name,
    ),
    createElement('div', { className: 'mt-3' }, createElement(Story)),
  );
}

function widgetSection({ title, stories: cases }: WidgetStories): JSX.Element {
  return createElement(
    'section',
    { key: title, className: 'mt-9', 'data-widget': title },
    createElement('h2', { className: 'text-lg leading-tight font-semibold' }, title),
    createElement('div', { className: 'mt-5 flex flex-col gap-6' }, cases.map(storyCase)),
  );
}

/**
 * The `Scene3D` section, resolved only when the browser renders it. Its stories are not
 * imported statically: that would pull `three` into the main playground chunk and, from there,
 * into every page that hydrates an island of this package (docs/ARCHITECTURE.md §8: «three solo
 * en páginas 3D, con `client:only` y `import()` dinámico»). Behind this single dynamic
 * `import()` the whole section lands in its own chunk, which no `/ruta/**` page references
 * (#96, decision 2). It keeps the `default.order` of its own module, like every other section.
 */
const SCENE_3D_TITLE = 'Scene3D';

const LazyScene3DSection = lazy(async () => {
  const module: StoriesModule = await import('../Scene3D/Scene3D.stories');
  const section = collect(module);
  return { default: (): JSX.Element => widgetSection(section) };
});

export interface StoryGalleryProps {
  /**
   * Renders only the section of this widget, by its `title`. Unknown or absent, the whole
   * catalogue is rendered (#108, decision 2). `/dev/widgets` fills it from the `section` search
   * parameter of the URL — read in `apps/web`, never here: `window` is off limits outside that
   * app (CLAUDE.md, prohibiciones). `null` is the shape a missing search parameter arrives in,
   * and means the same as absent: the whole catalogue.
   */
  section?: string | null;
}

/** The statically imported sections a `section` filter keeps; empty when it matches none. */
export function sectionsFor(section?: string | null): readonly WidgetStories[] {
  if (section === undefined || section === null || section === '') return stories;
  return stories.filter((widget) => widget.title === section);
}

/** Whether the lazy `Scene3D` section belongs in the output under a `section` filter. */
export function includesScene3D(section?: string | null): boolean {
  return (
    section === undefined || section === null || section === '' || section === SCENE_3D_TITLE
  );
}

/**
 * Renders the stories of the catalogue, one section per widget. It is a single island so the
 * `/dev/widgets` page can hydrate it with `client:load` (Astro resolves islands statically).
 * Built with `createElement` because this file is consumed as a plain module by the barrel.
 *
 * With `section` only that widget is rendered, so the visual snapshots of a widget do not move
 * when a story is added to another one (#108, decision 2; spec gap #117). Without it the
 * playground keeps showing everything.
 *
 * `Scene3D` comes last and lazily: its chunk carries `three` and must stay out of the bundle of
 * every other page (docs/ARCHITECTURE.md §8).
 */
export function StoryGallery({ section }: StoryGalleryProps = {}): JSX.Element {
  return createElement(
    'div',
    null,
    sectionsFor(section).map(widgetSection),
    includesScene3D(section)
      ? createElement(
          Suspense,
          { key: SCENE_3D_TITLE, fallback: null },
          createElement(LazyScene3DSection),
        )
      : null,
  );
}
