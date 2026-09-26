import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { RotationWidget } from './RotationWidget';

/** The «Explora» of T-4.1 and T-4.2: the wheel of the profile at 200 rpm and r = 32 mm. */
const WHEEL = { omega_radps: 20.94, r_m: 0.032 } as const;

/** The value of one row of a values panel, by the text of its term. */
function valueOf(term: string, panelIndex = 0): string {
  const panel = screen.getAllByTestId('readout-panel')[panelIndex];
  if (panel === undefined) return '';
  return within(panel).getByText(term).nextElementSibling?.textContent ?? '';
}

/** The labels of the parameter sliders of the widget, in order (the `Plot` marker is not one). */
function sliderLabels(): readonly (string | null)[] {
  return screen
    .getAllByRole('region', { name: 'Parámetros' })
    .flatMap((panel) => within(panel).getAllByRole('slider'))
    .map((slider) => slider.getAttribute('aria-label'));
}

/** The slider whose accessible name starts with `label`. */
function sliderFor(label: string): HTMLElement {
  return screen.getByRole('slider', { name: new RegExp(`^${label}`) });
}

describe('RotationWidget (F2-06)', () => {
  test('el modo disc muestra los valores dorados de T-4.1 (200 rpm, r = 32 mm)', () => {
    render(<RotationWidget mode="disc" inputUnit="rpm" initial={WHEEL} />);

    expect(valueOf('Velocidad angular')).toBe('20.9 rad/s');
    expect(valueOf('Velocidad angular en rpm')).toBe('200 rpm');
    expect(valueOf('Período')).toBe('0.300 s');
    expect(valueOf('Frecuencia')).toBe('3.33 Hz');
    // v = 20.94 · 0.032 = 0.6702 m/s (e1 de T-4.2).
    expect(valueOf('Velocidad del borde')).toBe('0.670 m/s');
  });

  test('abierto en t = 10 s el disco lleva 33.3 vueltas y 209 rad (e3 y e4 de T-4.1)', () => {
    render(<RotationWidget mode="disc" inputUnit="rpm" initial={WHEEL} initialTime_s={10} />);

    expect(valueOf('Ángulo girado')).toBe('209 rad');
    expect(valueOf('Vueltas')).toBe('33.3');
  });

  test('el modo rolling avanza 2πr = 0.201 m en una vuelta (experimento 1 de T-4.2)', () => {
    // Una vuelta a 20.94 rad/s dura T = 0.3 s.
    render(<RotationWidget mode="rolling" inputUnit="rpm" initial={WHEEL} initialTime_s={0.3} />);

    expect(valueOf('Avance del centro')).toBe('0.201 m');
    expect(valueOf('Vueltas')).toBe('1.00');
    expect(valueOf('Velocidad del borde')).toBe('0.670 m/s');
  });

  test('cambiar inputUnit conserva el valor físico (60 rpm ↔ 6.2832 rad/s)', async () => {
    const user = userEvent.setup();
    render(
      <RotationWidget mode="disc" inputUnit="rpm" initial={{ omega_radps: 6.2832, r_m: 0.032 }} />,
    );

    expect(sliderFor('Velocidad angular').getAttribute('aria-valuetext')).toBe('60 rpm');
    expect(valueOf('Velocidad angular')).toBe('6.28 rad/s');

    await user.click(screen.getByRole('button', { name: 'rad/s' }));

    expect(sliderFor('Velocidad angular').getAttribute('aria-valuetext')).toBe('6.28 rad/s');
    // El valor físico no cambia: el panel sigue mostrando ambas unidades.
    expect(valueOf('Velocidad angular')).toBe('6.28 rad/s');
    expect(valueOf('Velocidad angular en rpm')).toBe('60.0 rpm');
  });

  test('el deslizador de ω cambia de rango y de paso con la unidad (decisión 4)', async () => {
    const user = userEvent.setup();
    render(<RotationWidget mode="disc" inputUnit="rpm" initial={WHEEL} />);

    const rpm = sliderFor('Velocidad angular');
    expect(rpm).toHaveAttribute('max', '600');
    expect(rpm).toHaveAttribute('step', '1');

    await user.click(screen.getByRole('button', { name: 'rad/s' }));

    const radps = sliderFor('Velocidad angular');
    expect(radps).toHaveAttribute('max', '62.83');
    expect(radps).toHaveAttribute('step', '0.01');
  });

  test('en rolling, fijar v = 1 m/s con r = 0.032 m da ω = 31.25 rad/s (e2 de T-4.2)', async () => {
    const user = userEvent.setup();
    render(<RotationWidget mode="rolling" initial={WHEEL} />);

    const field = screen.getByRole('textbox', { name: /Velocidad del robot/ });
    await user.clear(field);
    await user.type(field, '1{Enter}');

    // ω = 1/0.032 = 31.25 rad/s, que con tres cifras significativas se muestra 31.3.
    expect(valueOf('Velocidad angular')).toBe('31.3 rad/s');
    expect(valueOf('Velocidad angular en rpm')).toBe('298 rpm');
  });

  test('el modo angularAccel muestra α, a_t y el tiempo hasta 200 rpm (T-4.3)', () => {
    render(
      <RotationWidget
        mode="angularAccel"
        initial={{ omega_radps: 0, r_m: 0.032, alpha_radps2: 41.89 }}
      />,
    );

    // a_t = 41.89 · 0.032 = 1.340 m/s²; de 0 a 200 rpm tarda 0.5 s.
    expect(valueOf('Aceleración tangencial')).toBe('1.34 m/s²');
    expect(valueOf('Tiempo hasta 200 rpm')).toBe('0.500 s');
    expect(valueOf('Velocidad angular')).toBe('0.00 rad/s');
  });

  test('abierto en t = 0.5 s la rampa llega a 20.9 rad/s (experimento 1 de T-4.3)', () => {
    render(
      <RotationWidget
        mode="angularAccel"
        initial={{ omega_radps: 0, r_m: 0.032, alpha_radps2: 41.89 }}
        initialTime_s={0.5}
      />,
    );

    expect(valueOf('Velocidad angular')).toBe('20.9 rad/s');
    expect(valueOf('Velocidad angular en rpm')).toBe('200 rpm');
  });

  test('el panel de curva muestra a_c = 0.72 m/s² y v_max = 1.33 m/s (e2 y e4 de T-4.3)', async () => {
    const user = userEvent.setup();
    render(
      <RotationWidget
        mode="angularAccel"
        initial={{ omega_radps: 0, r_m: 0.032, alpha_radps2: 41.89 }}
      />,
    );

    // Defectos de la decisión 7: R = 0.5 m, v = 0.6 m/s, μs = 0.6 → a_c = 0.6²/0.5 = 0.72 m/s².
    expect(valueOf('Aceleración centrípeta', 1)).toBe('0.720 m/s²');

    const radius = screen.getByRole('textbox', { name: /Radio de la curva/ });
    await user.clear(radius);
    await user.type(radius, '0.3{Enter}');

    // v_max = √(0.6 · 9.81 · 0.3) = 1.329 m/s (e4 de T-4.3).
    expect(valueOf('Velocidad máxima en curva', 1)).toBe('1.33 m/s');
    // Reducir R con la misma v aumenta a_c (experimento 3 de T-4.3).
    expect(valueOf('Aceleración centrípeta', 1)).toBe('1.20 m/s²');
  });

  test('cada modo edita sólo sus parámetros, con su unidad', () => {
    const { unmount } = render(<RotationWidget mode="disc" initial={WHEEL} />);
    expect(sliderLabels()).toEqual([
      'Velocidad angular en rad/s',
      'Radio de la rueda en m',
    ]);
    unmount();

    const rolling = render(<RotationWidget mode="rolling" initial={WHEEL} />);
    expect(sliderLabels()).toEqual([
      'Velocidad angular en rad/s',
      'Radio de la rueda en m',
      'Velocidad del robot en m/s',
    ]);
    rolling.unmount();

    render(
      <RotationWidget
        mode="angularAccel"
        initial={{ omega_radps: 0, r_m: 0.032, alpha_radps2: 41.89 }}
      />,
    );
    expect(sliderLabels()).toEqual([
      'Velocidad angular en rad/s',
      'Radio de la rueda en m',
      'Aceleración angular en rad/s²',
      'Radio de la curva en m',
      'Velocidad en la curva en m/s',
      'Coeficiente de rozamiento estático en ',
    ]);
  });

  test('cambiar el radio no cambia ω ni el período (experimento 3 de T-4.1)', async () => {
    const user = userEvent.setup();
    render(<RotationWidget mode="disc" inputUnit="rpm" initial={WHEEL} />);

    const radius = screen.getByRole('textbox', { name: /Radio de la rueda/ });
    await user.clear(radius);
    await user.type(radius, '0.064{Enter}');

    expect(valueOf('Velocidad angular')).toBe('20.9 rad/s');
    expect(valueOf('Período')).toBe('0.300 s');
    // Sólo cambia la rapidez del punto del borde: se duplica (experimento 2 de T-4.2).
    expect(valueOf('Velocidad del borde')).toBe('1.34 m/s');
  });

  test('describe el estado en una región aria-live y es operable con teclado', async () => {
    const user = userEvent.setup();
    render(<RotationWidget mode="disc" inputUnit="rpm" initial={WHEEL} />);

    const live = screen
      .getAllByRole('status')
      .find((element) => element.textContent?.includes('velocidad angular') === true);
    expect(live).toHaveAttribute('aria-live', 'polite');

    const slider = sliderFor('Velocidad angular');
    slider.focus();
    await user.keyboard('{ArrowRight}');
    expect(valueOf('Velocidad angular en rpm')).toBe('201 rpm');
  });

  test('la vista del panel de curva avisa «patinaría» solo por encima de v_max (#387)', async () => {
    const user = userEvent.setup();
    render(
      <RotationWidget
        mode="angularAccel"
        initial={{ omega_radps: 0, r_m: 0.032, alpha_radps2: 41.89 }}
      />,
    );
    const view = (): HTMLElement => screen.getByRole('img', { name: /Vista cenital de una curva/ });
    const set = async (name: RegExp, value: string): Promise<void> => {
      const box = screen.getByRole('textbox', { name });
      await user.clear(box);
      await user.type(box, `${value}{Enter}`);
    };

    // Valores iniciales: R = 0.5 m, v = 0.6 m/s, a_c = 0.72 m/s²; v_max = 1.72 m/s, sin aviso.
    expect(view().getAttribute('aria-label')).toContain('0.720 m/s²');
    expect(screen.queryByText('Patinaría: v > v_max')).toBeNull();

    // R = 0.25 m: v_max = √(0.6·9.81·0.25) ≈ 1.213 m/s.
    await set(/Radio de la curva/, '0.25');
    await set(/Velocidad en la curva/, '1.21');
    expect(screen.queryByText('Patinaría: v > v_max')).toBeNull();
    await set(/Velocidad en la curva/, '1.22');
    expect(screen.getByText('Patinaría: v > v_max')).toBeInTheDocument();
    expect(view().getAttribute('aria-label')).toContain('Patinaría');
    }, 15000);

  test('los controles de simulación avanzan el tiempo del widget', async () => {
    const user = userEvent.setup();
    render(<RotationWidget mode="rolling" inputUnit="rpm" initial={WHEEL} />);

    expect(valueOf('Avance del centro')).toBe('0.00 m');
    await user.click(screen.getByRole('button', { name: 'Paso' }));
    expect(valueOf('Avance del centro')).not.toBe('0.00 m');

    await user.click(screen.getByRole('button', { name: 'Reiniciar' }));
    expect(valueOf('Avance del centro')).toBe('0.00 m');
  });

  // QA de PR #110, ronda 1: en /dev/widgets, story Disc, «Reproducir» parecía no arrancar la
  // animación. La causa real era ajena al modo disc (una carrera de hidratación del propio
  // playground, ya cubierta en widgets.spec.ts con un retry-poll como en RobotOnTrack); este
  // test usa el rAF real de jsdom (sin mock) para dejar constancia de que, una vez montado el
  // widget, «Reproducir» en disc sí avanza t_s y las vueltas.
  test('Reproducir en disc avanza t_s y las vueltas con el rAF real de jsdom', async () => {
    const user = userEvent.setup({ delay: null });
    render(<RotationWidget mode="disc" inputUnit="rpm" initial={WHEEL} />);

    expect(screen.getByTestId('sim-clock')).toHaveTextContent(/00\.00/);
    const turnsBefore = valueOf('Vueltas');
    const angleBefore = valueOf('Ángulo girado');

    await user.click(screen.getByRole('button', { name: 'Reproducir' }));

    await vi.waitFor(() => {
      expect(screen.getByTestId('sim-clock')).not.toHaveTextContent(/00\.00/);
    });
    expect(valueOf('Vueltas')).not.toBe(turnsBefore);
    expect(valueOf('Ángulo girado')).not.toBe(angleBefore);

    await user.click(screen.getByRole('button', { name: 'Pausa' }));
  });
});
