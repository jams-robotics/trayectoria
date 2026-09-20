import { AuthGate, useSession, type AuthGateCta } from '@trayectoria/auth';
import { getDbClient } from '@trayectoria/db';
import { useT } from '@trayectoria/i18n';
import { Toast, robotSpecToJson, type ToastTone } from '@trayectoria/widgets';
import { useCallback, useEffect, useState, type JSX } from 'react';

import {
  deleteRobot,
  listRobots,
  makeDefault,
  renameRobot,
  saveUploadedRobot,
  type RobotRow,
} from '../../lib/robots/storage';
import { RobotList } from './RobotList';
import { UploadUrdfForm, type AcceptedUpload } from './UploadUrdfForm';

export interface RobotsIslandProps {
  readonly cta: AuthGateCta;
}

type Phase = 'loading' | 'ready' | 'error';

interface Notice {
  readonly message: string;
  readonly tone: ToastTone;
}

interface RobotsState {
  readonly robots: readonly RobotRow[];
  readonly phase: Phase;
  readonly refresh: () => Promise<void>;
}

function useRobots(ownerId: string): RobotsState {
  const [robots, setRobots] = useState<readonly RobotRow[]>([]);
  const [phase, setPhase] = useState<Phase>('loading');
  const refresh = useCallback(async (): Promise<void> => {
    try {
      setRobots(await listRobots(getDbClient(), ownerId));
      setPhase('ready');
    } catch {
      setPhase('error');
    }
  }, [ownerId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { robots, phase, refresh };
}

function Phasing({ phase }: { readonly phase: Phase }): JSX.Element {
  const t = useT();
  const loading = phase === 'loading';
  return (
    <p
      aria-live="polite"
      role={loading ? undefined : 'alert'}
      className={loading ? 'text-fg-muted m-0' : 'text-error m-0'}
    >
      {loading ? t('auth.robots.loading') : t('auth.robots.error')}
    </p>
  );
}

/** One action of the list, with the toast it shows when it succeeds and when it fails. */
type RunAction = (action: () => Promise<void>, done: string, failed: string) => Promise<void>;

/** Runs one action and reports its outcome, refreshing the list when it succeeded. */
function useRunner(refresh: () => Promise<void>, notify: (notice: Notice) => void): RunAction {
  return useCallback(
    async (action, done, failed) => {
      try {
        await action();
        await refresh();
        notify({ message: done, tone: 'success' });
      } catch {
        notify({ message: failed, tone: 'error' });
      }
    },
    [refresh, notify],
  );
}

interface ActionsProps {
  readonly ownerId: string;
  readonly robots: readonly RobotRow[];
  readonly run: RunAction;
}

/** The table with the three row actions wired to their statements and toasts. */
function RobotActions({ ownerId, robots, run }: ActionsProps): JSX.Element {
  const t = useT();
  return (
    <RobotList
      robots={robots}
      onRename={(robot, name) =>
        run(
          async () => {
            await renameRobot(getDbClient(), ownerId, robot.id, name);
          },
          t('auth.robots.renamed'),
          t('auth.robots.renameFailed'),
        )
      }
      onDelete={(robot) =>
        run(
          () => deleteRobot(getDbClient(), ownerId, robot),
          t('auth.robots.deleted'),
          t('auth.robots.deleteFailed'),
        )
      }
      onMakeDefault={(robot) =>
        run(
          () => makeDefault(getDbClient(), ownerId, robot.id),
          t('auth.robots.madeDefault'),
          t('auth.robots.makeDefaultFailed'),
        )
      }
    />
  );
}

/** The panel behind the session: the list, the upload form and the toast of the last action. */
function RobotsPanel({ ownerId }: { readonly ownerId: string }): JSX.Element {
  const t = useT();
  const { robots, phase, refresh } = useRobots(ownerId);
  const [notice, setNotice] = useState<Notice | null>(null);
  const run = useRunner(refresh, setNotice);

  const onUpload = async (upload: AcceptedUpload): Promise<void> => {
    await saveUploadedRobot(getDbClient(), {
      ownerId,
      robotId: upload.robotId,
      name: upload.spec.name,
      spec: robotSpecToJson(upload.spec),
      specVersion: upload.spec.specVersion,
      zipBytes: upload.zipBytes,
    });
    await refresh();
    setNotice({ message: t('auth.robots.uploaded'), tone: 'success' });
  };

  if (phase !== 'ready') return <Phasing phase={phase} />;

  return (
    <div className="flex flex-col gap-7">
      <RobotActions ownerId={ownerId} robots={robots} run={run} />
      <UploadUrdfForm onUpload={onUpload} />
      {notice !== null ? (
        <Toast message={notice.message} tone={notice.tone} onClose={() => setNotice(null)} />
      ) : null}
    </div>
  );
}

function Guarded(): JSX.Element {
  const { session } = useSession();
  if (session === null) return <></>;
  return <RobotsPanel ownerId={session.user.id} />;
}

/**
 * The one island of `/cuenta/robots`, hydrated with `client:load` (docs/ARCHITECTURE.md §3.1).
 * Like `Account` and `AulaIsland`, the panel is a plain child of `AuthGate` and not a nested
 * island, which would be server-rendered without a session and hydrated with one.
 */
export function RobotsIsland({ cta }: RobotsIslandProps): JSX.Element {
  return (
    <AuthGate cta={cta}>
      <Guarded />
    </AuthGate>
  );
}
