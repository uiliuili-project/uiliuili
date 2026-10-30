import { Spin } from 'antd';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { InstallWizard } from './InstallWizard';

type GateState = 'loading' | 'install' | 'installed';

/**
 * The installer is only meaningful before the instance is installed.
 *
 * Once installed the API no longer serves `/api/install/status`, so any error
 * (404/410/network) is treated as "already installed". In that case the route
 * leaves the console instead of rendering a dead wizard for visitors without
 * any administrator role.
 */
export function InstallGate() {
  const [state, setState] = useState<GateState>('loading');

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ installed: boolean }>('/api/install/status')
      .then((status) => {
        if (!cancelled) setState(status.installed ? 'installed' : 'install');
      })
      .catch(() => {
        if (!cancelled) setState('installed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state === 'installed') window.location.replace('/');
  }, [state]);

  if (state === 'install') return <InstallWizard />;
  return (
    <div className="install-shell">
      <Spin size="large" />
    </div>
  );
}
