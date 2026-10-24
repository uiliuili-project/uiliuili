import { SearchClient } from '@/components/SearchClient';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="container-page py-16 text-sm text-muted">加载中…</div>}>
      <SearchClient />
    </Suspense>
  );
}
