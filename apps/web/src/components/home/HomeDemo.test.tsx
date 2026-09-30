import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import { HomeDemo } from './HomeDemo';

// #648 (decision 2): the server render of the demo is the box that holds the viewer's place and
// the link to the full simulator; the widget itself only loads in the browser, once idle. The
// autoplay and `prefers-reduced-motion` are covered end to end in `e2e/inicio.spec.ts`
// (`apps/web` has no component-rendering test library, see `sim/ViewerBox.test.tsx`).
describe('HomeDemo', () => {
  const markup = renderToStaticMarkup(<HomeDemo />);

  test('names the demo and links to the simulator', () => {
    expect(markup).toContain('aria-label="Simulador del seguidor de línea en modo demostración"');
    expect(markup).toContain('href="/simuladores/movil"');
    expect(markup).toContain('Abrir el simulador');
  });

  test('holds the 16:9 place of the viewer before the widget loads', () => {
    expect(markup).toContain('aspect-video');
    expect(markup).not.toContain('data-testid="line-follower"');
  });
});
