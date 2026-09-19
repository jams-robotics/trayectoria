import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { t } from '@trayectoria/i18n';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

// Sin WebGL en jsdom (mismo criterio que F2-12, #96, decisión 6). `Scene3D` resuelve
// `@react-three/fiber` desde `packages/widgets`, otra instancia de módulo, así que lo que se
// sustituye es la entrada `@trayectoria/widgets/scene3d` que este componente importa: el `Canvas`
// pasa a ser un div y `Frame` un marcador. Lo que se comprueba es el árbol declarado y las
// posiciones que sim-core calcula, no una imagen.
vi.mock('@trayectoria/widgets/scene3d', () => ({
  Scene3D: ({
    children,
    description,
  }: {
    children: ReactNode;
    description: string;
  }): ReactNode => (
    <div data-testid="canvas" role="img" aria-label={description}>
      {children}
    </div>
  ),
  Frame: ({ position_m }: { position_m?: readonly [number, number, number] }): ReactNode => (
    <div data-testid="frame" data-position={String(position_m)} />
  ),
}));

import { ArmViewer, translationOf } from './ArmViewer';

const CATALOG = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../catalog/arms');
const PLANAR_URDF = readFileSync(resolve(CATALOG, 'planar2dof/planar2dof.urdf'), 'utf8');

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

/** `fetch` que devuelve el URDF del brazo plano del catálogo. */
function stubCatalogFetch(body = PLANAR_URDF, ok = true): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok, status: ok ? 200 : 404, text: () => Promise.resolve(body) })),
  );
}

describe('ArmViewer (F5-01a)', () => {
  test('lee la traslación de la columna correcta del `Mat4` de sim-core', () => {
    // Columna-mayor: índices 12, 13 y 14 (sim-core math/mat4.ts).
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
    // El brazo de three cuelga del canvas como `<primitive>`; R3F no admite `data-*` ahí.
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
    // Los dos paneles quedan en flujo normal, sin envoltorio añadido.
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
    // Resúmenes de una línea con los valores dorados de F5-01a (q₁ = 90°, q₂ = 0°).
    expect(seen[0]?.summary).toBe('joint1 90.0° · joint2 0.0°');
    expect(seen[1]?.summary).toBe('x 0.000 y 0.350 z 0.000 m');

    // El contenido es el mismo de siempre, ahora dentro del envoltorio del consumidor.
    expect(screen.getAllByTestId('panel-wrapper')).toHaveLength(2);
    expect(screen.getByTestId('joint-sliders')).toBeInTheDocument();
    expect(screen.getByTestId('effector-panel')).toBeInTheDocument();
  });
});
