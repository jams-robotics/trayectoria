import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { t } from '@trayectoria/i18n';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

// No WebGL in jsdom (same criterion as F2-12, #96, decision 6). `Scene3D` resolves
// `@react-three/fiber` from `packages/widgets`, another module instance, so what gets
// replaced is the `@trayectoria/widgets/scene3d` entry that this component imports: the `Canvas`
// becomes a div and `Frame` a marker. What is checked is the declared tree and the
// positions computed by sim-core, not an image.
vi.mock('@trayectoria/widgets/scene3d', () => ({
  Scene3D: ({
    children,
    description,
    framePoints_m,
    cameraOffset_m,
  }: {
    children: ReactNode;
    description: string;
    framePoints_m?: readonly (readonly number[])[];
    cameraOffset_m?: readonly number[];
  }): ReactNode => (
    <div
      data-testid="canvas"
      role="img"
      aria-label={description}
      data-frame-points={JSON.stringify(framePoints_m)}
      data-camera={String(cameraOffset_m)}
    >
      {children}
    </div>
  ),
  Frame: ({ position_m }: { position_m?: readonly [number, number, number] }): ReactNode => (
    <div data-testid="frame" data-position={String(position_m)} />
  ),
}));

import { ArmViewer, matricesSummary, translationOf } from './ArmViewer';

const CATALOG = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../catalog/arms');
const PLANAR_URDF = readFileSync(resolve(CATALOG, 'planar2dof/planar2dof.urdf'), 'utf8');
const PLANAR_FICHA = readFileSync(resolve(CATALOG, 'planar2dof/ficha.json'), 'utf8');

beforeAll(() => {
  const warn = console.error.bind(console);
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('incorrect casing')) return;
    warn(...(args as [unknown]));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** `fetch` that returns the URDF of the catalog planar arm. */
function stubCatalogFetch(body = PLANAR_URDF, ok = true): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok, status: ok ? 200 : 404, text: () => Promise.resolve(body) })),
  );
}

describe('ArmViewer (F5-01a)', () => {
  test('lee la traslación de la columna correcta del `Mat4` de sim-core', () => {
    // Column-major: indices 12, 13 and 14 (sim-core math/mat4.ts).
    const transform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0.35, -0.2, 0.1, 1];
    expect(translationOf(transform)).toEqual([0.35, -0.2, 0.1]);
    expect(translationOf([])).toEqual([0, 0, 0]);
  });

  test('anuncia la carga y luego dibuja la escena, los sliders y el panel', async () => {
    stubCatalogFetch();
    render(<ArmViewer catalogId="planar2dof" show={['frames']} />);
    expect(screen.getByTestId('arm-viewer-status')).toHaveTextContent(t('sims.arm.loading'));

    await waitFor(() => {
      expect(screen.getByTestId('arm-viewer')).toBeInTheDocument();
    });
    expect(screen.getByTestId('canvas')).toHaveAttribute('role', 'img');
    expect(screen.getByTestId('canvas').getAttribute('aria-label')).toContain('Brazo plano 2 GDL');
    expect(screen.getAllByRole('slider')).toHaveLength(2);
    expect(screen.getByTestId('effector-panel')).toBeInTheDocument();
    // The three arm hangs from the canvas as a `<primitive>`; R3F does not accept `data-*` there.
    expect(screen.getByTestId('canvas').querySelector('primitive')).not.toBeNull();
  });

  test('con `show: [frames]` dibuja una tríada por eslabón y el interruptor la apaga', async () => {
    stubCatalogFetch();
    render(<ArmViewer catalogId="planar2dof" show={['frames']} />);
    await waitFor(() => {
      expect(screen.getByTestId('arm-viewer')).toBeInTheDocument();
    });
    // base_link, link1, link2 y tool0.
    expect(screen.getAllByTestId('frame')).toHaveLength(4);
    expect(screen.getByTestId('frames-toggle')).toHaveAttribute('aria-pressed', 'true');

    screen.getByTestId('frames-toggle').click();
    await waitFor(() => {
      expect(screen.queryAllByTestId('frame')).toHaveLength(0);
    });
  });

  test('sin `frames` no dibuja tríadas y el interruptor arranca apagado', async () => {
    stubCatalogFetch();
    render(<ArmViewer catalogId="planar2dof" show={[]} />);
    await waitFor(() => {
      expect(screen.getByTestId('arm-viewer')).toBeInTheDocument();
    });
    expect(screen.queryAllByTestId('frame')).toHaveLength(0);
    expect(screen.getByTestId('frames-toggle')).toHaveAttribute('aria-pressed', 'false');
  });

  test('`initialQ` fija la configuración y el panel muestra los valores dorados', async () => {
    stubCatalogFetch();
    render(<ArmViewer catalogId="planar2dof" initialQ={[Math.PI / 2, 0]} show={['frames']} />);
    await waitFor(() => {
      expect(screen.getByTestId('sims.arm.y')).toHaveTextContent('0.350');
    });
    expect(screen.getByTestId('sims.arm.x')).toHaveTextContent('0.000');
    expect(screen.getByTestId('sims.arm.z')).toHaveTextContent('0.000');
    expect(screen.getByTestId('sims.arm.yaw')).toHaveTextContent('90.0');
  });

  test('`compact` apila el visor en una sola columna', async () => {
    stubCatalogFetch();
    render(<ArmViewer catalogId="planar2dof" show={[]} compact />);
    await waitFor(() => {
      expect(screen.getByTestId('arm-viewer')).toHaveAttribute('data-compact', 'true');
    });
  });

  test('informa cuando el brazo del catálogo no se puede cargar', async () => {
    stubCatalogFetch('', false);
    render(<ArmViewer catalogId="planar2dof" show={['frames']} />);
    await waitFor(() => {
      expect(screen.getByTestId('arm-viewer-status')).toHaveTextContent(
        t('sims.arm.loadError', { id: 'planar2dof' }),
      );
    });
  });
});

describe('ArmViewer · renderPanel (F5-01b, #134)', () => {
  test('sin `renderPanel` el marcado de los paneles es el de siempre', async () => {
    stubCatalogFetch();
    render(<ArmViewer catalogId="planar2dof" show={[]} />);
    await waitFor(() => {
      expect(screen.getByTestId('arm-viewer')).toBeInTheDocument();
    });
    // Both panels stay in normal flow, with no added wrapper.
    expect(screen.getByTestId('joint-sliders')).toBeInTheDocument();
    expect(screen.getByTestId('effector-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-wrapper')).toBeNull();
  });

  test('con `renderPanel` recibe `id`, `title`, `summary` y `content` de cada panel', async () => {
    stubCatalogFetch();
    const seen: Array<{ id: string; title: string; summary: string }> = [];
    render(
      <ArmViewer
        catalogId="planar2dof"
        initialQ={[Math.PI / 2, 0]}
        show={[]}
        renderPanel={(panel) => {
          seen.push({ id: panel.id, title: panel.title, summary: panel.summary });
          return (
            <div data-testid="panel-wrapper" data-panel={panel.id}>
              {panel.content}
            </div>
          );
        }}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('arm-viewer')).toBeInTheDocument();
    });

    expect(seen.map((panel) => panel.id)).toEqual(['joints', 'effector']);
    expect(seen[0]?.title).toBe(t('sims.arm.joints'));
    expect(seen[1]?.title).toBe(t('sims.arm.effector'));
    // One-line summaries with the F5-01a golden values (q₁ = 90°, q₂ = 0°).
    expect(seen[0]?.summary).toBe('joint1 90.0° · joint2 0.0°');
    expect(seen[1]?.summary).toBe('x 0.000 y 0.350 z 0.000 m');

    // The content is the same as always, now inside the consumer's wrapper.
    expect(screen.getAllByTestId('panel-wrapper')).toHaveLength(2);
    expect(screen.getByTestId('joint-sliders')).toBeInTheDocument();
    expect(screen.getByTestId('effector-panel')).toBeInTheDocument();
  });
});

describe('ArmViewer con matrices (F5-02)', () => {
  test('sin `matrices` el panel no existe', async () => {
    stubCatalogFetch();
    render(<ArmViewer catalogId="planar2dof" show={['frames']} />);
    await waitFor(() => {
      expect(screen.getByTestId('arm-viewer')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('matrix-panel')).toBeNull();
  });

  test('con `show: [matrices]` pinta el panel con los valores de sim-core', async () => {
    stubCatalogFetch();
    render(<ArmViewer catalogId="planar2dof" initialQ={[Math.PI / 2, 0]} show={['matrices']} />);
    await waitFor(() => {
      expect(screen.getByTestId('matrix-panel')).toBeInTheDocument();
    });
    // `⁰T` of the last link of the chain (`tool0`) with q = (90°, 0°): the F5-01a effector
    // golden value, (0.000, 0.350, 0.000), in the translation column.
    const cells = screen.getAllByRole('cell');
    expect(cells[3]).toHaveTextContent('0.000');
    expect(cells[7]).toHaveTextContent('0.350');
    expect(cells[11]).toHaveTextContent('0.000');
  });

  test('el panel de matrices llega a `renderPanel` como un panel más', async () => {
    stubCatalogFetch();
    const seen: string[] = [];
    render(
      <ArmViewer
        catalogId="planar2dof"
        initialQ={[Math.PI / 2, 0]}
        show={['matrices']}
        renderPanel={(panel) => {
          seen.push(panel.id);
          return <div data-testid="panel-wrapper">{panel.content}</div>;
        }}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('matrix-panel')).toBeInTheDocument();
    });
    expect(seen).toContain('matrices');
    expect(seen.at(-1)).toBe('matrices');
  });
});

describe('matricesSummary (F5-02)', () => {
  test('resume con el eslabón elegido, y con la base si aún no hay ninguno', () => {
    expect(matricesSummary('link2', t)).toBe('link2');
    expect(matricesSummary(null, t)).toBe(t('sims.matrices.baseLink'));
  });
});

/** `fetch` of the catalog planar arm with its card: the URDF and `ficha.json` by URL. */
function stubCatalogWithFicha(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const body = url.endsWith('ficha.json') ? PLANAR_FICHA : PLANAR_URDF;
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(body),
        json: () => Promise.resolve(JSON.parse(body) as unknown),
      });
    }),
  );
}

/** Renders the viewer and waits for the arm to be drawn. */
async function renderReady(node: ReactNode): Promise<ReturnType<typeof render>> {
  const view = render(node);
  await waitFor(() => {
    expect(screen.getByTestId('arm-viewer')).toBeInTheDocument();
  });
  return view;
}

describe('ArmViewer · catalog card and framing (#535, #556)', () => {
  test('the sliders take the readable names of the card, with the URDF id as auxiliary text', async () => {
    stubCatalogWithFicha();
    await renderReady(<ArmViewer catalogId="planar2dof" show={['frames']} />);
    const sliders = within(screen.getByTestId('joint-sliders'));
    expect(sliders.getByText('Articulación 1')).toBeInTheDocument();
    expect(sliders.getByText('joint1')).toBeInTheDocument();
  });

  test('the initial camera frames the link origins at rest, from sim-core (#556)', async () => {
    stubCatalogFetch();
    await renderReady(<ArmViewer catalogId="planar2dof" show={[]} />);
    // base_link, link1, link2 and tool0 of the planar arm with q = 0 (l₁ = 0.20 m, l₂ = 0.15 m).
    const points = JSON.parse(
      screen.getByTestId('canvas').getAttribute('data-frame-points') ?? '[]',
    ) as number[][];
    expect(points).toEqual([
      [0, 0, 0],
      [0, 0, 0],
      [0.2, 0, 0],
      [0.35, 0, 0],
    ]);
  });

  test('without a card: URDF names', async () => {
    stubCatalogFetch();
    await renderReady(<ArmViewer catalogId="planar2dof" show={[]} />);
    expect(within(screen.getByTestId('joint-sliders')).getByText('joint1')).toBeInTheDocument();
  });

  test('passes the camera the page kept to the scene (#556)', async () => {
    stubCatalogWithFicha();
    await renderReady(
      <ArmViewer catalogId="planar2dof" show={[]} cameraOffset_m={[0.5, -0.5, 0.4]} />,
    );
    expect(screen.getByTestId('canvas')).toHaveAttribute('data-camera', '0.5,-0.5,0.4');
  });
});

describe('ArmViewer · «Marcos» owned by the page (#537)', () => {
  test('with `framesToggle={false}` there is no button and the frames follow `show`', async () => {
    stubCatalogFetch();
    const { rerender } = await renderReady(
      <ArmViewer catalogId="planar2dof" show={['frames']} framesToggle={false} />,
    );
    expect(screen.queryByTestId('frames-toggle')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('frame')).toHaveLength(4);

    rerender(<ArmViewer catalogId="planar2dof" show={[]} framesToggle={false} />);
    expect(screen.queryAllByTestId('frame')).toHaveLength(0);
  });

  test('the own button of the viewer shows its active state with the primary fill', async () => {
    stubCatalogFetch();
    await renderReady(<ArmViewer catalogId="planar2dof" show={['frames']} />);
    expect(screen.getByTestId('frames-toggle').className).toContain('bg-primary');
    screen.getByTestId('frames-toggle').click();
    await waitFor(() => {
      expect(screen.getByTestId('frames-toggle').className).not.toContain('bg-primary');
    });
  });
});
