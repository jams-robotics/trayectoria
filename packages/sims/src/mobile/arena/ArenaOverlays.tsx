import type { JSX } from 'react';

import { PlaybackBar } from './ArenaBars';
import { ChallengeBanner } from './ArenaParts';
import { DuoLayer } from './DuoHud';
import { FreeLayer } from './FreeHud';
import { StepsLayer } from './StepsHud';
import { KICK_RAD } from './race';
import type { ArenaLoop } from './useArenaLoop';
import type { ArenaSettingsApi } from './useArenaSettings';
import type { FreeDriveApi } from './useFreeDrive';
import type { StepsApi } from './useSteps';

/** Start, restart, kick and speed, centred under the canvas. */
function Playback({ loop, api }: { loop: ArenaLoop; api: ArenaSettingsApi }): JSX.Element {
  return (
    <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center px-3 lg:bottom-4">
      <PlaybackBar
        running={loop.running}
        speed={api.settings.speed}
        onToggle={() => loop.setRunning(!loop.running)}
        onReset={() => loop.reset()}
        onKick={() => loop.kick(KICK_RAD)}
        onSpeed={(speed) => api.update({ speed })}
      />
    </div>
  );
}

/** Back to the start with nothing running. */
export function restart(loop: ArenaLoop, steps: StepsApi): void {
  steps.stop();
  loop.reset();
}

/** What floats over the canvas besides the top bar: the free arena's board and pad, or the track's banner. */
export function StageOverlays({
  loop,
  api,
  free,
  steps,
}: {
  loop: ArenaLoop;
  api: ArenaSettingsApi;
  free: FreeDriveApi;
  steps: StepsApi;
}): JSX.Element {
  if (api.settings.players === 2)
    return (
      <DuoLayer progress={loop.snapshot?.duo ?? null} drive={free} onRestart={() => loop.reset()} />
    );
  if (api.settings.steps)
    return (
      <StepsLayer
        steps={steps}
        goal={api.settings.stepGoal}
        snapshot={loop.snapshot}
        onRestart={() => restart(loop, steps)}
      />
    );
  if (api.settings.free)
    return (
      <FreeLayer
        progress={loop.snapshot?.free ?? null}
        drive={free}
        onRestart={() => loop.reset()}
      />
    );
  return (
    <>
      <ChallengeBanner settings={api.settings} />
      <Playback loop={loop} api={api} />
    </>
  );
}
