import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useSession } from '@trayectoria/auth';
import { useT } from '@trayectoria/i18n';
import { useTopicProgress } from '@trayectoria/progress';

import { exerciseTally } from '../../lib/closing';

export interface TopicClosingStatusProps {
  readonly topicId: string;
  /** Ids of the topic's Verifica exercises (`e1`, `e2`…). */
  readonly exerciseIds: readonly string[];
}

/**
 * Live part of the closing block of a topic (#546, decisions 2 and 4): the tally of Verifica
 * exercises answered right, read from the same progress store the exercises record into, and,
 * once the session has been read and there is none, a line saying an account keeps the
 * progress. The line waits for `ready`, like `ProgressNotice`, so it never flashes.
 *
 * The island is `client:visible`, so by the time it hydrates another island may already have
 * filled the store; the tally therefore reads it only after mount, and the first client render
 * matches the server markup (docs/audits F2-01a).
 */
export function TopicClosingStatus({ topicId, exerciseIds }: TopicClosingStatusProps): JSX.Element {
  const t = useT();
  const { session, ready } = useSession();
  const progress = useTopicProgress(topicId);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const { correct, total } = exerciseTally(exerciseIds, mounted ? progress : undefined);
  return (
    <>
      {total > 0 && (
        <p className="m-0 mt-4 text-sm tabular-nums" data-testid="closing-exercises">
          {t('topic.closing.exercises', { correct, total })}
        </p>
      )}
      {ready && session === null && (
        <p className="text-fg-muted m-0 mt-2 text-sm" data-testid="closing-save-hint">
          {t('topic.closing.saveHint')} <a href="/auth/registro">{t('topic.closing.register')}</a>
        </p>
      )}
    </>
  );
}
