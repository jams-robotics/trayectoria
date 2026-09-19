import '@testing-library/jest-dom/vitest';
import { render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';

// The `Scene3D` section is loaded lazily by the gallery, and no WebGL renderer runs in jsdom:
// the `Canvas` of fiber and the drei helpers are mocked exactly as in `Scene3D.test.tsx` (#96,
// decision 6), so this file checks where the section lands, not what it paints.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  Html: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

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
      {
        title: 'ProjectileWidget',
        stories: [
          ['Launch', expect.any(Function)],
          ['Drop', expect.any(Function)],
          ['DropFromRobot', expect.any(Function)],
        ],
      },
      {
        title: 'RotationWidget',
        stories: [
          ['Disc', expect.any(Function)],
          ['Rolling', expect.any(Function)],
          ['AngularAccel', expect.any(Function)],
        ],
      },
      {
        title: 'EnergyWidget',
        stories: [
          ['Ramp', expect.any(Function)],
          ['RampFriction', expect.any(Function)],
          ['Power', expect.any(Function)],
        ],
      },
      {
        title: 'GearWidget',
        stories: [
          ['OneStage', expect.any(Function)],
          ['TwoStage', expect.any(Function)],
        ],
      },
      {
        title: 'DiffDriveWidget',
        stories: [
          ['Forward51', expect.any(Function)],
          ['Forward52', expect.any(Function)],
          ['Inverse53', expect.any(Function)],
          ['Odometry54', expect.any(Function)],
        ],
      },
      {
        title: 'ExerciseWidget',
        stories: [
          ['Scalar', expect.any(Function)],
          ['Vector', expect.any(Function)],
          ['Anonymous', expect.any(Function)],
        ],
      },
      {
        title: 'MyRobotWidget',
        stories: [
          ['Form', expect.any(Function)],
          ['Card', expect.any(Function)],
          ['Live', expect.any(Function)],
        ],
      },
    ]);
  });

  // #96, decision 2: `Scene3D` is not in `stories` on purpose. Importing its stories statically
  // would pull `three` into the main playground chunk, so the section is loaded with
  // `React.lazy` and only its own chunk carries `three` (docs/ARCHITECTURE.md §8).
  test('leaves `Scene3D` out of the statically imported catalogue', () => {
    expect(stories.map(({ title }) => title)).not.toContain('Scene3D');
  });

  // 30 s: the lazy chunk is resolved by a real dynamic `import()` of the stories module, which
  // pulls in fiber and drei; under coverage instrumentation that is well past the default 5 s.
  test('renders the `Scene3D` section lazily, after the statically imported ones', async () => {
    const { container } = render(<StoryGallery />);
    await waitFor(
      () => {
        expect(container.querySelector('[data-widget="Scene3D"]')).not.toBeNull();
      },
      { timeout: 25000 },
    );
    const titles = Array.from(container.querySelectorAll('[data-widget]')).map((element) =>
      element.getAttribute('data-widget'),
    );
    expect(titles[titles.length - 1]).toBe('Scene3D');
  }, 30000);

  test('renders the same story order on every call, matching `stories`', () => {
    const { container: first } = render(<StoryGallery />);
    const { container: second } = render(<StoryGallery />);
    // Only the statically imported sections: the lazy `Scene3D` one resolves on its own
    // microtask, so whether its stories are already in the DOM depends on timing (#96).
    const staticTitles = new Set(stories.map(({ title }) => title));
    const namesOf = (container: HTMLElement): readonly string[] =>
      Array.from(container.querySelectorAll('[data-widget]'))
        .filter((section) => staticTitles.has(section.getAttribute('data-widget') ?? ''))
        .flatMap((section) =>
          Array.from(section.querySelectorAll('[data-story]')).map(
            (element) => element.getAttribute('data-story') ?? '',
          ),
        );
    const expected = stories.flatMap(({ stories: cases }) => cases.map(([name]) => name));
    expect(namesOf(first)).toEqual(expected);
    expect(namesOf(second)).toEqual(expected);
  });
});
