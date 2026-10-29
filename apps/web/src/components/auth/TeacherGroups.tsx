import { useT } from '@trayectoria/i18n';
import type { JSX } from 'react';

import { useTeacherGroups } from '../aula/useClassroom';
import { SECONDARY_BUTTON } from './fields';

export interface TeacherGroupsProps {
  readonly userId: string;
}

/** "Mis grupos" of `/cuenta` for a teacher: the groups they own, each opening its page in `/aula`. */
export function TeacherGroups({ userId }: TeacherGroupsProps): JSX.Element {
  const t = useT();
  const groups = useTeacherGroups(userId);
  return (
    <section
      data-testid="teacher-groups"
      className="border-border bg-bg-raised rounded-lg border p-6"
      aria-labelledby="teacher-groups-title"
    >
      <h2 id="teacher-groups-title" className="text-base font-semibold">
        {t('auth.groups.title')}
      </h2>
      {groups.length > 0 ? (
        <ul data-testid="teacher-group-list" className="m-0 mt-3 list-none p-0">
          {groups.map((group) => (
            <li key={group.id} className="border-border border-b py-2 last:border-b-0">
              <a href={`/aula?grupo=${encodeURIComponent(group.id)}`}>{group.name}</a>
            </li>
          ))}
        </ul>
      ) : null}
      <a href="/aula" className={`${SECONDARY_BUTTON} mt-5 no-underline`}>
        {t('auth.groups.openAula')}
      </a>
    </section>
  );
}
