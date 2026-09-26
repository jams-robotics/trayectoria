import { describe, expect, it } from 'vitest';

import { TOPIC_WIDGETS, loadWidget, widgetNames } from './widgetRegistry';

describe('TOPIC_WIDGETS', () => {
  it('lists the serializable topic widgets of docs/WIDGETS.md (#246)', () => {
    expect([...TOPIC_WIDGETS]).toEqual([
      'DiffDriveWidget',
      'EnergyWidget',
      'FreeBodyWidget',
      'GearWidget',
      'KinematicsWidget',
      'LineSensorWidget',
      'MyRobotWidget',
      'PowerWidget',
      'ProjectileWidget',
      'RotationWidget',
      'VectorWidget',
    ]);
  });

  it('only names widgets the registry can load', () => {
    for (const name of TOPIC_WIDGETS) expect(widgetNames()).toContain(name);
  });

  it('leaves out the widgets whose props cannot cross an island', () => {
    for (const name of ['ParamPanel', 'Plot', 'ExerciseWidget', 'Formula']) {
      expect(TOPIC_WIDGETS).not.toContain(name);
    }
  });

  it('resolves each one to the component its entry exports under its own name', async () => {
    const [rotation, myRobot] = await Promise.all([
      loadWidget('RotationWidget'),
      loadWidget('MyRobotWidget'),
    ]);

    expect(rotation.name).toBe('RotationWidget');
    expect(myRobot.name).toBe('MyRobotWidget');
  });

  it('loads LineSensorWidget from its own entry of @trayectoria/widgets (T-6.1)', async () => {
    const lineSensor = await loadWidget('LineSensorWidget');

    expect(lineSensor.name).toBe('LineSensorWidget');
  });
});
