import { AdminConsoleLink } from '@/components/AdminConsoleLink';
import { getT } from '@/lib/i18n-server';

export default async function AboutPage() {
  const t = await getT();
  return (
    <div className="container-page py-10">
      <div className="card mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold">{t('about.title')}</h1>
        <p className="mt-4 text-sm leading-7 text-muted">{t('about.intro')}</p>
        <p className="mt-3 text-sm leading-7 text-muted">{t('about.runtime')}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {/* Only staff see this; the console link checks the account itself. */}
          <AdminConsoleLink className="btn-ghost" />
        </div>
      </div>
    </div>
  );
}
