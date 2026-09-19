import { Suspense, createElement, lazy } from 'react';
import type { JSX } from 'react';

import * as trackEditorStories from '../mobile/trackEditor/TrackEditor.stories';

/** One named export of a `*.stories.tsx` file: a demo component with no props. */
export type SimStory = () => JSX.Element;

export interface SimStories {
  /** Component name, the `title` of the default export of its stories file. */
  title: string;
  stories: ReadonlyArray<readonly [string, SimStory]>;
}

interface StoriesModule {
  // `order` fixes the story sequence explicitly: the iteration order of a module namespace
  // object is not guaranteed to match between renders (docs/audits F2-01a).
  default: { title: string; order: readonly string[] };
  [exportName: string]: SimStory | { title: string; order: readonly string[] };
}

function isSimStory(value: StoriesModule[string] | undefined): value is SimStory {
  return typeof value === 'function';
}

/** Named exports of a stories module, ordered by its `default.order` (not module export order). */
function collect(module: StoriesModule): SimStories {
  const stories = module.default.order
    .map((name) => [name, module[name]] as const)
    .filter((entry): entry is [string, SimStory] => isSimStory(entry[1]));
  return { title: module.default.title, stories };
}

/**
 * Catalogue rendered by the `/dev/sims` playground: the components of `packages/sims`, the same
 * way `StoryGallery` of `packages/widgets` renders the widget catalogue (#126, decision 2).
 */
export const stories: readonly SimStories[] = [collect(trackEditorStories)];

function storyCase([name, Story]: readonly [string, SimStory]): JSX.Element {
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

function simSection({ title, stories: cases }: SimStories): JSX.Element {
  return createElement(
    'section',
    { key: title, className: 'mt-9', 'data-section': title },
    createElement('h2', { className: 'text-lg leading-tight font-semibold' }, title),
    createElement('div', { className: 'mt-5 flex flex-col gap-6' }, cases.map(storyCase)),
  );
}

/**
 * La sección `ArmViewer`, resuelta solo cuando el navegador la renderiza. Sus stories no se
 * importan de forma estática: eso arrastraría `three` y `urdf-loader` al chunk principal del
 * playground y, desde ahí, a toda página que hidrate una isla de este paquete
 * (docs/ARCHITECTURE.md §8: «three solo en páginas 3D, con `client:only` y `import()` dinámico»).
 * Tras este único `import()` dinámico la sección entera cae en su propio chunk (#133, decisión 2).
 */
const ARM_VIEWER_TITLE = 'ArmViewer';

const LazyArmViewerSection = lazy(async () => {
  const module: StoriesModule = await import('../arm/ArmViewer.stories');
  const section = collect(module);
  return { default: (): JSX.Element => simSection(section) };
});

export interface SimGalleryProps {
  /**
   * Renders only the section of this component, by its `title`. Unknown or absent, the whole
   * catalogue is rendered. `/dev/sims` fills it from the `section` search parameter of the URL —
   * read in `apps/web`, never here: `window` is off limits outside that app (CLAUDE.md,
   * prohibiciones). `null` is the shape a missing search parameter arrives in, and means the
   * same as absent: the whole catalogue.
   */
  section?: string | null;
}

/** The sections a `section` filter keeps; empty when it matches none. */
export function sectionsFor(section?: string | null): readonly SimStories[] {
  if (section === undefined || section === null || section === '') return stories;
  return stories.filter((entry) => entry.title === section);
}

/** Si la sección perezosa `ArmViewer` entra en la salida bajo un filtro `section`. */
export function includesArmViewer(section?: string | null): boolean {
  return (
    section === undefined || section === null || section === '' || section === ARM_VIEWER_TITLE
  );
}

/**
 * Renders the stories of the catalogue, one section per component. It is a single island so the
 * `/dev/sims` page can hydrate it with `client:only`, and it carries the same `data-section` /
 * `data-story` convention as `/dev/widgets` so the visual snapshots and the e2e address it the
 * same way (#126, decision 2).
 */
export function SimGallery({ section }: SimGalleryProps = {}): JSX.Element {
  return createElement(
    'div',
    null,
    sectionsFor(section).map(simSection),
    includesArmViewer(section)
      ? createElement(
          Suspense,
          { key: ARM_VIEWER_TITLE, fallback: null },
          createElement(LazyArmViewerSection),
        )
      : null,
  );
}
