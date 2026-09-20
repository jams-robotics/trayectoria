import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { LapCard } from './LapCard';
import { createLapTimer, recordLap } from './metrics';

// F4-03 (#129, decisión 5): la tarjeta de vuelta. Solo formatea lo que el cronómetro le da, así
// que se prueba con cronómetros construidos a mano y no con una corrida entera.

describe('LapCard (F4-03)', () => {
  it('muestra «—» en las cuatro cifras mientras no hay ninguna vuelta cerrada', () => {
    render(<LapCard timer={createLapTimer(3)} />);
    for (const key of ['last', 'best', 'speed', 'distance']) {
      expect(screen.getByTestId(`lap-card-${key}`)).toHaveTextContent('—');
    }
  });

  it('muestra el último tiempo, el mejor, la velocidad media y la distancia recorrida', () => {
    // Pista de 3 m: la primera vuelta tarda 12 s (0,25 m/s) y la segunda 10 s (0,30 m/s).
    const timer = recordLap(recordLap(createLapTimer(3), 12, 2.9), 22, 5.8);
    render(<LapCard timer={timer} />);

    expect(screen.getByTestId('lap-card-last')).toHaveTextContent('10.00 s');
    expect(screen.getByTestId('lap-card-best')).toHaveTextContent('10.00 s');
    expect(screen.getByTestId('lap-card-speed')).toHaveTextContent('0.30 m/s');
    // La distancia recorrida en esa vuelta, menor que los 3 m de la pista (#170).
    expect(screen.getByTestId('lap-card-distance')).toHaveTextContent('2.90 m');
  });

  it('el mejor tiempo es el menor de todas las vueltas, no el de la última', () => {
    const timer = recordLap(recordLap(createLapTimer(3), 10, 2.9), 25, 5.8);
    render(<LapCard timer={timer} />);
    expect(screen.getByTestId('lap-card-last')).toHaveTextContent('15.00 s');
    expect(screen.getByTestId('lap-card-best')).toHaveTextContent('10.00 s');
  });

  it('las etiquetas salen de i18n y no hay literales de UI en el componente', () => {
    render(<LapCard timer={createLapTimer(3)} />);
    expect(screen.getByText('Última vuelta')).toBeInTheDocument();
    expect(screen.getByText('Mejor vuelta')).toBeInTheDocument();
    expect(screen.getByText('Velocidad media')).toBeInTheDocument();
    expect(screen.getByText('Distancia recorrida')).toBeInTheDocument();
  });
});
