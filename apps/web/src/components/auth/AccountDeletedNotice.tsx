import { useT } from '@trayectoria/i18n';
import { useEffect, useState, type JSX } from 'react';

/** Query-string parameter the deletion flow lands on: `/?cuenta=eliminada`. */
const PARAM = 'cuenta';
const VALUE = 'eliminada';

/**
 * The notice the home page shows after "Eliminar mi cuenta" (F3-03). The parameter is read in an
 * effect, not during render: the page is prerendered and this island hydrates on the client, so
 * reading `window.location` while rendering would not match the server output.
 */
export function AccountDeletedNotice(): JSX.Element {
  const t = useT();
  const [deleted, setDeleted] = useState(false);
  useEffect(() => {
    setDeleted(new URLSearchParams(window.location.search).get(PARAM) === VALUE);
  }, []);
  if (!deleted) return <></>;
  return (
    <p
      data-testid="account-deleted"
      role="status"
      className="border-border bg-bg-raised rounded-md m-0 mb-7 border p-4"
    >
      {t('auth.deleteAccount.done')}
    </p>
  );
}
