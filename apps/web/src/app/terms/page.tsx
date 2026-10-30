import { getT } from '@/lib/i18n-server';
import { serverFetchSafe } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

interface SettingsPayload {
  legal?: { termsHtml?: string; termsVersion?: string };
}

export default async function TermsPage() {
  const [t, settings] = await Promise.all([
    getT(),
    serverFetchSafe<SettingsPayload>('/api/v1/settings', {}),
  ]);
  return (
    <div className="container-page py-10">
      <article className="card mx-auto max-w-3xl p-8">
        <div className="mb-2 text-xs text-muted">
          {t('版本')} {settings.legal?.termsVersion ?? '1'}
        </div>
        {settings.legal?.termsHtml ? (
          <div
            className="legal-content text-sm leading-7 text-muted"
            dangerouslySetInnerHTML={{ __html: settings.legal.termsHtml }}
          />
        ) : (
          <p className="text-sm text-muted">{t('站点尚未填写用户协议。')}</p>
        )}
      </article>
    </div>
  );
}
