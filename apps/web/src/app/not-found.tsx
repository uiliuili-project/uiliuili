import { getT } from '@/lib/i18n-server';
import Link from 'next/link';

export default async function NotFound() {
  const t = await getT();
  return (
    <div className="container-page py-20 text-center">
      <div className="text-6xl font-black text-brand/30">404</div>
      <h1 className="mt-4 text-xl font-semibold">{t('页面不存在')}</h1>
      <p className="mt-2 text-sm text-muted">{t('你访问的内容可能已被删除或从未存在。')}</p>
      <Link href="/" className="btn-primary mt-6">
        {t('返回首页')}
      </Link>
    </div>
  );
}
