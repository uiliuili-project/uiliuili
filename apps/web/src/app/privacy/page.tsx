import { getT } from '@/lib/i18n-server';
import { serverFetchSafe } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

interface SettingsPayload {
  legal?: { privacyHtml?: string; termsVersion?: string };
}

export default async function PrivacyPage() {
  const [t, settings] = await Promise.all([
    getT(),
    serverFetchSafe<SettingsPayload>('/api/v1/settings', {}),
  ]);
  return (
    <div className="container-page py-10">
      <article className="card mx-auto max-w-3xl p-8">
        <div className="mb-2 text-xs text-muted">{t('隐私政策')}</div>
        {settings.legal?.privacyHtml ? (
          <div
            className="legal-content text-sm leading-7 text-muted"
            dangerouslySetInnerHTML={{ __html: settings.legal.privacyHtml }}
          />
        ) : (
          <p className="text-sm text-muted">{t('站点尚未填写隐私政策。')}</p>
        )}
      </article>
    </div>
  );
}
