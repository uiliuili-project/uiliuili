import { getT } from '@/lib/i18n-server';
import { AdminConsoleLink } from './AdminConsoleLink';

/**
 * Server-rendered maintenance screen. Staff bypass it in the root layout, so
 * it never hides the public site from reviewers, administrators or the owner.
 */
export async function MaintenanceScreen({ siteName }: { siteName: string }) {
  const t = await getT();
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="card max-w-lg p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-[#ff9db5] text-xl font-bold text-white">
          萌
        </div>
        <h1 className="mt-5 text-2xl font-semibold">
          {siteName} {t('正在维护')}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          {t('站点暂时关闭进行维护。请稍后再来，或联系管理员。')}{' '}
        </p>
        <AdminConsoleLink className="btn-ghost mt-6" />
      </div>
    </div>
  );
}
