'use client';

import { api } from '@/lib/api';
import { useEffect, useState } from 'react';

interface SettingsShape {
  site: { name: string; maintenance: boolean };
}

export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SettingsShape | null>(null);

  useEffect(() => {
    void api
      .get<SettingsShape>('/api/v1/settings')
      .then(setSettings)
      .catch(() => undefined);
  }, []);

  if (settings?.site.maintenance) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
        <div className="card max-w-lg p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-[#ff9db5] text-xl font-bold text-white">
            u
          </div>
          <h1 className="mt-5 text-2xl font-semibold">{settings.site.name} 正在维护</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            站点暂时关闭进行维护。请稍后再来，或联系管理员。
          </p>
          <a href="/admin/" className="btn-ghost mt-6">
            管理后台
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
