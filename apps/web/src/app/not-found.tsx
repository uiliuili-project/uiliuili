import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container-page py-20 text-center">
      <div className="text-6xl font-black text-brand/30">404</div>
      <h1 className="mt-4 text-xl font-semibold">页面不存在</h1>
      <p className="mt-2 text-sm text-muted">你访问的内容可能已被删除或从未存在。</p>
      <Link href="/" className="btn-primary mt-6">
        返回首页
      </Link>
    </div>
  );
}
