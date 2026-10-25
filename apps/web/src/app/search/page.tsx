import { SearchClient } from '@/components/SearchClient';
import { getT } from '@/lib/i18n-server';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

export default async function SearchPage() {
  const t = await getT();
  return (
    <Suspense
      fallback={<div className="container-page py-16 text-sm text-muted">{t('加载中…')}</div>}
    >
      <SearchClient />
    </Suspense>
  );
}
