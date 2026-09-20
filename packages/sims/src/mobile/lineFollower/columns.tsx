import type { JSX, ReactNode, RefObject } from 'react';
import type { RobotSpec } from '@trayectoria/robot-spec';

import { ManualViewer } from './ManualControls';
import type { ManualDrive } from './useManualKeyboard';
import { Panel } from './ControllerPanel';
import type { useControllerChoice } from './ControllerPanel';

// F4-03 (#129): las dos columnas de `LineFollowerWidget`, aparte para mantener ese archivo bajo
// el límite de docs/STANDARDS.md §4.

/** The controller panel of the right column, with the gains the selector is showing. */
export function ControllerColumn({
  spec,
  choice,
  renderPanel,
}: {
  spec: RobotSpec;
  choice: ReturnType<typeof useControllerChoice>;
  renderPanel: ((panel: ReactNode) => ReactNode) | undefined;
}): JSX.Element {
  return (
    <Panel
      spec={spec}
      controller={choice.selected}
      params={choice.params}
      onController={choice.onController}
      onParam={choice.onParam}
      renderPanel={renderPanel}
    />
  );
}

/**
 * The viewer column: the focusable box the manual keyboard listens on (#130, decisión 2) and,
 * under it, the live plots of F4-03.
 *
 * The plots deliberately stay outside `ManualViewer`: that box is the one that takes keyboard
 * focus, and putting them inside would make a block nobody drives focusable.
 */
export function ViewerColumn({
  viewerRef,
  manual,
  drive,
  viewer,
  plots,
}: {
  viewerRef: RefObject<HTMLDivElement | null>;
  manual: boolean;
  drive: ManualDrive;
  viewer: ReactNode;
  plots: ReactNode;
}): JSX.Element {
  return (
    <>
      <ManualViewer viewerRef={viewerRef} manual={manual} drive={drive}>
        {viewer}
      </ManualViewer>
      {plots}
    </>
  );
}

