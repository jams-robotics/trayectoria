import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { withSubscripts } from './subscripts';

function html(text: string): string {
  return render(<p>{withSubscripts(text)}</p>).container.querySelector('p')!.innerHTML;
}

describe('withSubscripts', () => {
  it('composes a plain subscript and keeps the text around it', () => {
    expect(html('Tu robot tiene v_max = 0.670 m/s')).toBe('Tu robot tiene v<sub>max</sub> = 0.670 m/s');
  });

  it('composes a braced subscript', () => {
    expect(html('de e_{k−1} = −0.99 a e_k = −0.09')).toBe(
      'de e<sub>k−1</sub> = −0.99 a e<sub>k</sub> = −0.09',
    );
  });

  it('handles Greek bases and several subscripts', () => {
    expect(html('ω_base, Δt_c y Δticks_L')).toBe(
      'ω<sub>base</sub>, Δt<sub>c</sub> y Δticks<sub>L</sub>',
    );
  });

  it('leaves a text without subscripts untouched', () => {
    expect(withSubscripts('¿Cuánto tarda la vuelta, en s?')).toBe('¿Cuánto tarda la vuelta, en s?');
    expect(html('_ suelto y a _b')).toBe('_ suelto y a _b');
  });
});
