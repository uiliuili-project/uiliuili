export default function AboutPage() {
  return (
    <div className="container-page py-10">
      <div className="card mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold">关于 uiliuili</h1>
        <p className="mt-4 text-sm leading-7 text-muted">
          uiliuili 是一个开源、自托管的弹幕视频社区。它包含视频上传、FFmpeg HLS 转码、 Canvas
          弹幕播放器、评论、关注、收藏、投币、通知、搜索、推荐和可视化管理后台。
        </p>
        <p className="mt-3 text-sm leading-7 text-muted">
          项目以 MIT 许可证开源。运行时只需要 Node.js、PostgreSQL 和 FFmpeg；
          Redis、Meilisearch、S3、SMTP 与 OAuth 都是可选增强。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="/admin/install" className="btn-ghost">
            安装向导
          </a>
          <a href="/admin/" className="btn-ghost">
            管理后台
          </a>
        </div>
      </div>
    </div>
  );
}
