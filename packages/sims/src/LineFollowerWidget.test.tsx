import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { presets, serializeTrack } from '@trayectoria/sim-core';

import * as entry from './LineFollowerWidget';
import { LineFollowerWidget as fromBarrel } from './index';

const { LineFollowerWidget } = entry;

/**
 * Props as a topic MDX hands them to the island (#409, docs/WIDGETS.md): Astro serializes them
 * to JSON, so only values survive and the robot is never among them.
 */
function mdxProps(props: Record<string, unknown>): Parameters<typeof LineFollowerWidget>[0] {
  return JSON.parse(JSON.stringify(props)) as Parameters<typeof LineFollowerWidget>[0];
}

function slider(name: RegExp): HTMLElement {
  return screen.getByRole('slider', { name });
}

describe('@trayectoria/sims/LineFollowerWidget entry (#409)', () => {
  it('exports the widget under its own name, the same component as the barrel', () => {
    expect(entry.LineFollowerWidget).toBe(fromBarrel);
    expect(LineFollowerWidget.name).toBe('LineFollowerWidget');
  });

  it('opens the P controller with kp from initialParams and ignores an unknown key', () => {
    render(
      <LineFollowerWidget
        {...mdxProps({ track: 'oval', controller: 'p', initialParams: { kp: 12, Kp: 99 } })}
      />,
    );
    expect(screen.getByRole('button', { name: 'P' })).toHaveAttribute('aria-pressed', 'true');
    expect(slider(/^Kp/)).toHaveAttribute('aria-valuenow', '12');
    // The missing key takes its default; `Kp` is not a key of the code, so it adds no slider.
    expect(slider(/^Velocidad base/)).toHaveAttribute('aria-valuenow', '10');
    expect(screen.getAllByRole('slider')).toHaveLength(2);
  });

  it('fills the PID with REFERENCE_PID_PARAMS when initialParams is empty', () => {
    render(
      <LineFollowerWidget {...mdxProps({ track: 's', controller: 'pid', initialParams: {} })} />,
    );
    expect(slider(/^Velocidad base/)).toHaveAttribute('aria-valuenow', '10');
    expect(slider(/^Kp/)).toHaveAttribute('aria-valuenow', '20');
    expect(slider(/^Ki/)).toHaveAttribute('aria-valuenow', '2');
    expect(slider(/^Kd/)).toHaveAttribute('aria-valuenow', '0.8');
    expect(slider(/^Límite integral/)).toHaveAttribute('aria-valuenow', '1');
  });

  it('keeps the slider ranges of the spec for kp, ki, kd and iMax', () => {
    render(
      <LineFollowerWidget {...mdxProps({ track: 'oval', controller: 'pid', initialParams: {} })} />,
    );
    const ranges: Array<[RegExp, string, string, string]> = [
      [/^Kp/, '0', '20', '0.1'],
      [/^Ki/, '0', '10', '0.1'],
      [/^Kd/, '0', '5', '0.05'],
      [/^Límite integral/, '0', '10', '0.1'],
    ];
    for (const [name, min, max, step] of ranges) {
      const input = slider(name);
      expect(input).toHaveAttribute('aria-valuemin', min);
      expect(input).toHaveAttribute('aria-valuemax', max);
      expect(input).toHaveAttribute('step', step);
    }
  });

  it('opens on/off with its defaults, 10 and 4 rad/s', () => {
    render(
      <LineFollowerWidget
        {...mdxProps({ track: 'oval', controller: 'onoff', initialParams: {} })}
      />,
    );
    expect(slider(/^Velocidad base/)).toHaveAttribute('aria-valuenow', '10');
    expect(slider(/^Corrección/)).toHaveAttribute('aria-valuenow', '4');
  });

  it('takes a track as JSON text and hides the panel when compact', () => {
    render(
      <LineFollowerWidget
        {...mdxProps({
          track: serializeTrack(presets.sCurve),
          controller: 'pid',
          initialParams: {},
          compact: true,
          showPlots: ['error'],
          noiseSigma: 0.02,
          seed: 7,
        })}
      />,
    );
    expect(screen.getByTestId('line-follower-view')).toBeInTheDocument();
    expect(screen.queryByTestId('line-follower-controller')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('slider')).toHaveLength(0);
  });
});
