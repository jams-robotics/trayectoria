import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { JSX } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { ParamPanel } from './ParamPanel';
import type { ParamPanelParam } from './ParamPanel';

const RANGE = { unit: 'm', min: 0, max: 10, step: 1 } as const;

/** A panel that owns its values, as a widget does, with one folded slider. */
function Owned({ onReset }: { onReset?: () => void }): JSX.Element {
  const [values, setValues] = useState({ a: 2, b: 5 });
  const params: ParamPanelParam[] = [{ key: 'a', label: 'A', value: values.a, ...RANGE }];
  const folded: ParamPanelParam[] = [{ key: 'b', label: 'B', value: values.b, ...RANGE }];
  return (
    <ParamPanel
      params={params}
      folded={folded}
      onChange={(key, value) => {
        setValues((current) => ({ ...current, [key]: value }));
      }}
      onReset={onReset}
    />
  );
}

describe('ParamPanel «Valores iniciales» (v1.5)', () => {
  test('vuelve cada slider, también los plegados, al valor con que abrió, y llama a onReset', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(<Owned onReset={onReset} />);
    const [a, b] = screen.getAllByRole('slider');
    await user.click(a as HTMLElement);
    await user.keyboard('{ArrowRight}{ArrowRight}');
    (b as HTMLElement).focus();
    await user.keyboard('{ArrowLeft}');
    expect(a).toHaveValue('4');
    expect(b).toHaveValue('4');
    await user.click(screen.getByRole('button', { name: 'Valores iniciales' }));
    expect(a).toHaveValue('2');
    expect(b).toHaveValue('5');
    expect(onReset).toHaveBeenCalledOnce();
  });

  test('resettable={false} lo oculta', () => {
    render(<ParamPanel params={[]} onChange={() => {}} resettable={false} />);
    expect(screen.queryByRole('button', { name: 'Valores iniciales' })).toBeNull();
  });
});
