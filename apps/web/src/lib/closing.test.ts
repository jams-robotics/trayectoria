import { emptyProgress } from '@trayectoria/progress';
import { describe, expect, it } from 'vitest';

import { exerciseTally, nextStep } from './closing';
import type { RouteData } from './routes';

// Closing block of a topic (#546): the primary «Siguiente» step and the Verifica tally.

const FUNDAMENTOS: RouteData = {
  id: 'ruta-1',
  title: 'Fundamentos',
  shortTitle: 'Fundamentos',
  modules: [],
};
const ROBOT_MOVIL: RouteData = {
  id: 'ruta-2',
  title: 'Robot móvil',
  shortTitle: 'Robot móvil',
  follows: 'ruta-1',
  modules: [],
};
const ROUTES = [ROBOT_MOVIL, FUNDAMENTOS];

describe('nextStep', () => {
  it('points to the next topic of the route when there is one', () => {
    const next = { title: 'Caída libre', href: '/ruta/ruta-1/m01/t02' };
    expect(nextStep(next, FUNDAMENTOS, ROUTES)).toEqual({
      kind: 'topic',
      title: 'Caída libre',
      href: '/ruta/ruta-1/m01/t02',
    });
  });

  it('keeps a next topic that is not published yet without a link', () => {
    expect(nextStep({ title: 'Caída libre', href: undefined }, FUNDAMENTOS, ROUTES)).toEqual({
      kind: 'topic',
      title: 'Caída libre',
      href: undefined,
    });
  });

  it('continues with Robot móvil after the last topic of Fundamentos', () => {
    expect(nextStep(undefined, FUNDAMENTOS, ROUTES)).toEqual({
      kind: 'route',
      title: 'Robot móvil',
      href: '/ruta/ruta-2',
    });
  });

  it('goes back to the route index after the last topic of Robot móvil', () => {
    expect(nextStep(undefined, ROBOT_MOVIL, ROUTES)).toEqual({
      kind: 'index',
      title: 'Robot móvil',
      href: '/ruta/ruta-2',
    });
  });
});

describe('exerciseTally', () => {
  const IDS = ['e1', 'e2', 'e3', 'e4'];

  it('counts none before anything was recorded', () => {
    expect(exerciseTally(IDS, undefined)).toEqual({ correct: 0, total: 4 });
  });

  it('counts the topic exercises answered right, «3 de 4»', () => {
    const progress = { ...emptyProgress(), correctIds: ['e1', 'e2', 'e4'] };
    expect(exerciseTally(IDS, progress)).toEqual({ correct: 3, total: 4 });
  });

  it('ignores recorded ids that are not exercises of the topic', () => {
    const progress = { ...emptyProgress(), correctIds: ['e1', 'e9'] };
    expect(exerciseTally(IDS, progress)).toEqual({ correct: 1, total: 4 });
  });

  it('is 0 of 0 for a topic without exercises', () => {
    expect(exerciseTally([], undefined)).toEqual({ correct: 0, total: 0 });
  });
});
