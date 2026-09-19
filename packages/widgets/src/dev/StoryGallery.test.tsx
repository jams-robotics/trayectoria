import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { StoryGallery, stories } from './StoryGallery';

// F2-01a (ronda 1): the story order must be fixed and explicit — it must not depend on the
// iteration order of a stories module's export object, which differs between the server render
// and the client bundle under `client:load` and caused a hydration mismatch
// (`data-story="Stack"` vs `"Inline"`, docs/audits F2-01a).
describe('stories catalogue', () => {
  test('orders each widget´s stories per its declared `default.order`, not export order', () => {
    expect(stories).toEqual([
      {
        title: 'ParamPanel',
        stories: [
          ['Stack', expect.any(Function)],
          ['Inline', expect.any(Function)],
          ['Single', expect.any(Function)],
        ],
      },
      {
        title: 'Formula',
        stories: [
          ['Inline', expect.any(Function)],
          ['Block', expect.any(Function)],
          ['Highlighted', expect.any(Function)],
          ['Substituted', expect.any(Function)],
        ],
      },
      {
        title: 'Plot',
        stories: [
          ['Static', expect.any(Function)],
          ['Live', expect.any(Function)],
          ['PlotStress', expect.any(Function)],
        ],
      },
      {
        title: 'Scene2D',
        stories: [
          ['Primitives', expect.any(Function)],
          ['OffCentre', expect.any(Function)],
          ['RobotOnTrack', expect.any(Function)],
        ],
      },
      {
        title: 'SimControls',
        stories: [
          ['Full', expect.any(Function)],
          ['Compact', expect.any(Function)],
        ],
      },
      {
        title: 'VectorWidget',
        stories: [['Curriculum', expect.any(Function)]],
      },
      {
        title: 'FreeBodyWidget',
        stories: [
          ['Plane', expect.any(Function)],
          ['Ramp15', expect.any(Function)],
        ],
      },
      {
        title: 'KinematicsWidget',
        stories: [
          ['Curriculum03', expect.any(Function)],
          ['Mru', expect.any(Function)],
          ['Mrua', expect.any(Function)],
        ],
      },
    ]);
  });

  test('renders the same story order on every call, matching `stories`', () => {
    const { container: first } = render(<StoryGallery />);
    const { container: second } = render(<StoryGallery />);
    const namesOf = (container: HTMLElement): readonly string[] =>
      Array.from(container.querySelectorAll('[data-story]')).map(
        (element) => element.getAttribute('data-story') ?? '',
      );
    const expected = stories.flatMap(({ stories: cases }) => cases.map(([name]) => name));
    expect(namesOf(first)).toEqual(expected);
    expect(namesOf(second)).toEqual(expected);
  });
});
