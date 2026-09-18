import { createElement } from 'react';
import type { JSX } from 'react';

import * as formulaStories from './Formula/Formula.stories';
import * as paramPanelStories from './ParamPanel/ParamPanel.stories';

export { ParamPanel } from './ParamPanel';
export type { ParamPanelParam, ParamPanelProps, ParamChangeHandler } from './ParamPanel';
export { Formula, HIGHLIGHT_CLASS } from './Formula';
export type { FormulaProps } from './Formula';

/** One named export of a `*.stories.tsx` file: a demo component with no props. */
export type WidgetStory = () => JSX.Element;

export interface WidgetStories {
  /** Widget name, the `title` of the default export of its stories file. */
  title: string;
  stories: ReadonlyArray<readonly [string, WidgetStory]>;
}

interface StoriesModule {
  default: { title: string };
}

/** Named exports of a stories module, in declaration order, without its `default`. */
function collect(module: StoriesModule): WidgetStories {
  const entries = Object.entries(module).filter(
    (entry): entry is [string, WidgetStory] => entry[0] !== 'default',
  );
  return { title: module.default.title, stories: entries };
}

/**
 * Catalogue rendered by the `/dev/widgets` playground. A new widget is registered here
 * together with its `*.stories.tsx` file (docs/WIDGETS.md, reglas comunes).
 */
export const stories: readonly WidgetStories[] = [
  collect(paramPanelStories),
  collect(formulaStories),
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
 * Renders every story of the catalogue, one section per widget. It is a single island so the
 * `/dev/widgets` page can hydrate it with `client:load` (Astro resolves islands statically).
 * Built with `createElement` because this barrel is a `.ts` file.
 */
export function StoryGallery(): JSX.Element {
  return createElement('div', null, stories.map(widgetSection));
}
