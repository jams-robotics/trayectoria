import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RingBuffer } from '@trayectoria/widgets';

import { Instruments, MOBILE_PLOT_HEIGHT_PX, PLOT_HEIGHT_PX } from './Instruments';
import type { InstrumentBuffers } from './useInstruments';

// F4-03 (#129, decisiones 4 y 6): qué gráficas se pintan y con qué alto. Los datos en sí los
// dibuja `Plot`, que tiene sus propios tests en `packages/widgets`.

function buffers(): InstrumentBuffers {
  return {
    error: new RingBuffer(16, 1),
    v: new RingBuffer(16, 1),
    omega: new RingBuffer(16, 1),
    pid: new RingBuffer(16, 3),
  };
}

describe('Instruments (F4-03)', () => {
  it('sin nada en `show` no pinta ninguna gráfica', () => {
    render(<Instruments buffers={buffers()} show={[]} />);
    expect(screen.queryByTestId('plot-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('plot-v')).not.toBeInTheDocument();
  });

  it('`show` elige qué gráficas se pintan y en el orden del catálogo', () => {
    render(<Instruments buffers={buffers()} show={['omega', 'error']} />);
    const drawn = [...screen.getByTestId('line-follower-plots').children].map((child) =>
      child.getAttribute('data-testid'),
    );
    expect(drawn).toEqual(['plot-error', 'plot-omega']);
  });

  it('la gráfica de términos solo aparece con el PID seleccionado', () => {
    const { rerender } = render(<Instruments buffers={buffers()} show={['pid']} pid={false} />);
    expect(screen.queryByTestId('plot-pid')).not.toBeInTheDocument();

    rerender(<Instruments buffers={buffers()} show={['pid']} pid />);
    expect(screen.getByTestId('plot-pid')).toBeInTheDocument();
  });

  it('la gráfica del PID lleva las tres series P, I y D', () => {
    render(<Instruments buffers={buffers()} show={['pid']} pid />);
    const pid = screen.getByTestId('plot-pid');
    for (const label of ['P', 'I', 'D']) {
      expect(pid).toHaveTextContent(label);
    }
  });

  it('en móvil se apilan a 120 px y en escritorio a 200 (docs/DESIGN.md §9 punto 8)', () => {
    // Los dos altos son los de la spec; el componente los pasa a `Plot` como `height`.
    expect(MOBILE_PLOT_HEIGHT_PX).toBe(120);
    expect(PLOT_HEIGHT_PX).toBe(200);
    const { container, rerender } = render(<Instruments buffers={buffers()} show={['v']} mobile />);
    expect(container.querySelector('[data-testid="plot-v"]')).toBeInTheDocument();
    rerender(<Instruments buffers={buffers()} show={['v']} />);
    expect(container.querySelector('[data-testid="plot-v"]')).toBeInTheDocument();
  });

  it('los títulos y las leyendas salen de i18n, no de literales', () => {
    render(<Instruments buffers={buffers()} show={['error', 'v', 'omega']} />);
    expect(screen.getByTestId('plot-error')).toHaveTextContent('Error');
    expect(screen.getByTestId('plot-omega')).toHaveTextContent('ω');
  });
});
