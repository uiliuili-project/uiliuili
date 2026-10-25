'use client';

import { getMe } from '@/lib/api';
import { isAdminGroup } from '@uiliuili/shared';
import { useEffect, useState } from 'react';
import { useT } from './I18nProvider';

interface AdminConsoleLinkProps {
  className?: string;
  children?: React.ReactNode;
}

/**
 * Renders the admin-console entry only for administrators. The same check is
 * applied by the administration console itself; this component only keeps the
 * link out of the public interface for everyone else.
 */
export function AdminConsoleLink({ className, children }: AdminConsoleLinkProps) {
  const t = useT();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getMe().then((user) => {
      if (cancelled) return;
      setVisible(
        Boolean(
          user &&
            (isAdminGroup(user.group) ||
              user.roles.includes('ADMIN') ||
              user.roles.includes('SUPER_ADMIN')),
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;
  return (
    <a href="/admin/" className={className}>
      {children ?? t('nav.admin')}
    </a>
  );
}
