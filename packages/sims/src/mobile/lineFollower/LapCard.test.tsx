import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { LapCard } from './LapCard';
import { createLapTimer, recordLap } from './metrics';

// F4-03 (#129, decision 5): the lap card. It only formats what the stopwatch gives it, so
// it is tested with hand-built stopwatches and not with an entire run.

describe('LapCard (F4-03)', () => {
  it('muestra «—» en las cuatro cifras mientras no hay ninguna vuelta cerrada', () => {
    render(<LapCard timer={createLapTimer(3)} />);
    for (const key of ['last', 'best', 'speed', 'distance']) {
      expect(screen.getByTestId(`lap-card-${key}`)).toHaveTextContent('—');
    }
  });

  it('muestra el último tiempo, el mejor, la velocidad media y la distancia recorrida', () => {
    // 3 m track: the first lap takes 12 s (0,25 m/s) and the second 10 s (0,30 m/s).
    const timer = recordLap(recordLap(createLapTimer(3), 12, 2.9), 22, 5.8);
    render(<LapCard timer={timer} />);

    expect(screen.getByTestId('lap-card-last')).toHaveTextContent('10.00 s');
    expect(screen.getByTestId('lap-card-best')).toHaveTextContent('10.00 s');
    expect(screen.getByTestId('lap-card-speed')).toHaveTextContent('0.30 m/s');
    // The distance travelled in that lap, less than the 3 m of the track (#170).
    expect(screen.getByTestId('lap-card-distance')).toHaveTextContent('2.90 m');
  });

  it('el mejor tiempo es el menor de todas las vueltas, no el de la última', () => {
    const timer = recordLap(recordLap(createLapTimer(3), 10, 2.9), 25, 5.8);
    render(<LapCard timer={timer} />);
    expect(screen.getByTestId('lap-card-last')).toHaveTextContent('15.00 s');
    expect(screen.getByTestId('lap-card-best')).toHaveTextContent('10.00 s');
  });

  it('va en el flujo, bajo el visor, y no superpuesta a la escena (#536)', () => {
    render(<LapCard timer={createLapTimer(3)} />);
    const card = screen.getByTestId('lap-card');
    expect(card).not.toHaveClass('absolute');
    expect(card).not.toHaveClass('shadow-sm');
  });

  it('las etiquetas salen de i18n y no hay literales de UI en el componente', () => {
    render(<LapCard timer={createLapTimer(3)} />);
    expect(screen.getByText('Última vuelta')).toBeInTheDocument();
    expect(screen.getByText('Mejor vuelta')).toBeInTheDocument();
    expect(screen.getByText('Velocidad media')).toBeInTheDocument();
    expect(screen.getByText('Distancia recorrida')).toBeInTheDocument();
  });
});
