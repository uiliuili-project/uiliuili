'use client';

import { getMe } from '@/lib/api';
import { consoleAreaForGroup } from '@uiliuili/shared';
import { useEffect, useState } from 'react';
import { useT } from './I18nProvider';

interface AdminConsoleLinkProps {
  className?: string;
  children?: React.ReactNode;
}

/**
 * Renders the staff-console entry for reviewers, administrators and the owner.
 * The same check is applied by the console itself; this component only keeps
 * the link out of the public interface for everyone else.
 */
export function AdminConsoleLink({ className, children }: AdminConsoleLinkProps) {
  const t = useT();
  const [area, setArea] = useState<'review' | 'admin' | 'owner' | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getMe().then((user) => {
      if (cancelled) return;
      setArea(consoleAreaForGroup(user?.group));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!area) return null;
  return (
    <a href="/admin/" className={className}>
      {children ?? t(area === 'review' ? 'nav.review' : 'nav.admin')}
    </a>
  );
}
