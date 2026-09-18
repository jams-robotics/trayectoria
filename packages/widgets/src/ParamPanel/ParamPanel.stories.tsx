import { useState } from 'react';
import type { JSX } from 'react';

import { ParamPanel } from './ParamPanel';
import type { ParamPanelParam } from './ParamPanel';

// `order` fixes the story sequence rendered by the /dev/widgets playground explicitly,
// independent of module export iteration order (docs/audits F2-01a: hydration mismatch).
export default { title: 'ParamPanel', order: ['Stack', 'Inline', 'Single'] };

const PID: readonly ParamPanelParam[] = [
  { key: 'kp', label: 'Ganancia proporcional', unit: '1/m', min: 0, max: 20, step: 0.5, value: 8 },
  { key: 'ki', label: 'Ganancia integral', unit: '1/(m·s)', min: 0, max: 5, step: 0.1, value: 0.4 },
  {
    key: 'kd',
    label: 'Ganancia derivativa',
    unit: 's/m',
    min: 0,
    max: 2,
    step: 0.05,
    value: 0.15,
    description: 'Amortigua la oscilación del seguidor de línea.',
  },
];

const ROBOT: readonly ParamPanelParam[] = [
  {
    key: 'wheelRadius_m',
    label: 'Radio de rueda',
    unit: 'm',
    min: 0.01,
    max: 0.1,
    step: 0.001,
    value: 0.033,
  },
  {
    key: 'wheelBase_m',
    label: 'Distancia entre ruedas',
    unit: 'm',
    min: 0.05,
    max: 0.3,
    step: 0.005,
    value: 0.16,
  },
];

function useParams(initial: readonly ParamPanelParam[]): {
  params: readonly ParamPanelParam[];
  onChange: (key: string, value: number) => void;
} {
  const [params, setParams] = useState(initial);
  return {
    params,
    onChange: (key, value) => {
      setParams((current) =>
        current.map((param) => (param.key === key ? { ...param, value } : param)),
      );
    },
  };
}

/** Three PID gains stacked, the default layout. */
export function Stack(): JSX.Element {
  const { params, onChange } = useParams(PID);
  return <ParamPanel params={params} onChange={onChange} />;
}

/** Two geometry parameters side by side. */
export function Inline(): JSX.Element {
  const { params, onChange } = useParams(ROBOT);
  return <ParamPanel params={params} onChange={onChange} layout="inline" />;
}

/** A single parameter with its description. */
export function Single(): JSX.Element {
  const { params, onChange } = useParams([PID[2] as ParamPanelParam]);
  return <ParamPanel params={params} onChange={onChange} />;
}
