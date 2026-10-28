'use client';
import { useLocale, useT } from '@/components/I18nProvider';
import { StudioManage } from '@/components/StudioManage';

import { api, csrfHeader, ensureCsrf, getMe } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatBytes, formatDate, formatDuration } from '@/lib/format';
import type { StudioVideo } from '@/lib/types';
import { type AuthUser, type Category, isStaffGroup } from '@uiliuili/shared';
import { CheckCircle2, Clock, Film, Loader2, ShieldCheck, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

interface InitUpload {
  mode: 'local' | 's3';
  uploadId: string;
  storageKey: string;
  partSize: number;
  totalChunks: number;
  parts?: Array<{ partNumber: number; url: string | null }>;
}

const statusLabels: Record<string, string> = {
  draft: '草稿',
  uploading: '上传中',
  processing: '转码中',
  ready: '待发布',
  pending_review: '审核中',
  published: '已发布',
  blocked: '已下架',
  failed: '处理失败',
  deleted: '已删除',
};

export default function StudioPage() {
  const t = useT();
  const locale = useLocale();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [videos, setVideos] = useState<StudioVideo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [current, setCurrent] = useState<StudioVideo | null>(null);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const pollRef = useRef<number | null>(null);

  const loadVideos = async () => {
    const data = await api.get<{ items: StudioVideo[] }>('/api/v1/studio/videos?limit=50');
    setVideos(data.items);
  };

  useEffect(() => {
    void ensureCsrf();
    void getMe()
      .then(async (currentUser) => {
        setUser(currentUser);
        if (!currentUser) return;
        const [studio, cats] = await Promise.all([
          api.get<{ items: StudioVideo[] }>('/api/v1/studio/videos?limit=50'),
          api.get<{ items: Category[] }>('/api/v1/categories'),
        ]);
        setVideos(studio.items);
        setCategories(cats.items);
        setCategoryId(cats.items[0]?.id ?? '');
      })
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : t('加载失败')),
      )
      .finally(() => setLoading(false));
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  const createDraft = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setError('');
    setMessage('');
    try {
      const video = await api.post<StudioVideo>('/api/v1/studio/videos', {
        title,
        description,
        categoryId: categoryId || undefined,
        tags: tags
          .split(/[,，\s]+/)
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 12),
        visibility,
      });
      setCurrent(video);
      await loadVideos();
      setMessage(t('稿件已创建，请选择视频文件上传'));
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t('创建失败'));
    } finally {
      setCreating(false);
    }
  };

  const uploadVideo = async () => {
    if (!current || !file) return;
    setUploading(true);
    setError('');
    setMessage('');
    setUploadedBytes(0);
    try {
      const init = await api.post<InitUpload>(`/api/v1/studio/videos/${current.id}/upload`, {
        filename: file.name,
        size: file.size,
        contentType: file.type || 'application/octet-stream',
        chunks: Math.ceil(file.size / (8 * 1024 * 1024)),
      });
      const total = init.totalChunks;
      if (init.mode === 'local') {
        for (let index = 0; index < total; index += 1) {
          const start = index * init.partSize;
          const end = Math.min(file.size, start + init.partSize);
          const chunk = file.slice(start, end);
          const response = await fetch(
            `/api/v1/studio/uploads/${init.uploadId}/parts/${index + 1}`,
            {
              method: 'PUT',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/octet-stream',
                ...csrfHeader(),
              },
              body: chunk,
            },
          );
          if (!response.ok) {
            const body = (await response.json().catch(() => null)) as {
              error?: { message?: string };
            } | null;
            throw new Error(body?.error?.message ?? t('分片 {0} 上传失败', { 0: index + 1 }));
          }
          setUploadedBytes(end);
        }
        await api.post(`/api/v1/studio/uploads/${init.uploadId}/complete`, {});
      } else {
        const parts: Array<{ partNumber: number; etag: string }> = [];
        for (let index = 0; index < total; index += 1) {
          const start = index * init.partSize;
          const end = Math.min(file.size, start + init.partSize);
          const chunk = file.slice(start, end);
          const url = init.parts?.[index]?.url;
          if (!url) throw new Error(t('缺少 S3 分片上传地址'));
          const response = await fetch(url, {
            method: 'PUT',
            body: chunk,
          });
          if (!response.ok) throw new Error(t('S3 分片 {0} 上传失败', { 0: index + 1 }));
          parts.push({ partNumber: index + 1, etag: response.headers.get('ETag') ?? '' });
          setUploadedBytes(end);
        }
        await api.post(`/api/v1/studio/uploads/${init.uploadId}/complete`, { parts });
      }
      if (cover) await uploadCover(current.id, cover);
      setMessage(t('上传完成，正在转码…'));
      setFile(null);
      await pollStatus(current.id);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t('上传失败'));
    } finally {
      setUploading(false);
    }
  };

  const uploadCover = async (videoId: string, coverFile: File) => {
    const response = await fetch(`/api/v1/studio/videos/${videoId}/cover`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': coverFile.type,
        ...csrfHeader(),
      },
      body: coverFile,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      throw new Error(body?.error?.message ?? t('封面上传失败'));
    }
  };

  const pollStatus = async (videoId: string) => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      try {
        const video = await api.get<StudioVideo>(`/api/v1/studio/videos/${videoId}`);
        setCurrent(video);
        if (['ready', 'pending_review', 'published', 'failed'].includes(video.status)) {
          if (pollRef.current) window.clearInterval(pollRef.current);
          pollRef.current = null;
          await loadVideos();
          setMessage(
            video.status === 'failed' ? t('转码失败，请检查后台队列或重新上传') : t('视频处理完成'),
          );
        }
      } catch {}
    }, 3000);
  };

  const saveMetadata = async (video: StudioVideo) => {
    setError('');
    setMessage('');
    try {
      const updated = await api.patch<StudioVideo>(`/api/v1/studio/videos/${video.id}`, {
        title,
        description,
        categoryId: categoryId || undefined,
        visibility,
      });
      setCurrent(updated);
      await loadVideos();
      setMessage(t('稿件信息已保存'));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('保存失败'));
    }
  };

  const publish = async (video: StudioVideo) => {
    setError('');
    setMessage('');
    try {
      const updated = await api.post<StudioVideo>(`/api/v1/studio/videos/${video.id}/publish`, {});
      setCurrent(updated);
      await loadVideos();
      setMessage(updated.status === 'pending_review' ? t('已提交审核') : t('视频已发布'));
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : t('发布失败'));
    }
  };

  const remove = async (video: StudioVideo) => {
    if (!window.confirm(t('确定删除稿件「{0}」吗？', { 0: video.title }))) return;
    await api.delete(`/api/v1/studio/videos/${video.id}`);
    if (current?.id === video.id) setCurrent(null);
    await loadVideos();
  };

  if (loading) {
    return <div className="container-page py-16 text-sm text-muted">{t('加载中…')}</div>;
  }

  if (!user) {
    return (
      <div className="container-page py-16">
        <div className="card mx-auto max-w-md p-10 text-center">
          <h1 className="text-xl font-semibold">{t('请先登录')}</h1>
          <p className="mt-2 text-sm text-muted">{t('登录后即可上传视频')}</p>
          <Link href="/login" className="btn-primary mt-6">
            {t('去登录')}{' '}
          </Link>
        </div>
      </div>
    );
  }

  const progress = file && uploadedBytes ? Math.round((uploadedBytes / file.size) * 100) : 0;

  return (
    <div className="container-page py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('创作中心')}</h1>
          <p className="mt-1 text-sm text-muted">{t('上传、管理你的视频稿件')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/space/${user.username}`} className="btn-ghost">
            {t('查看我的空间')}{' '}
          </Link>
          {isStaffGroup(user.group) && (
            <a href="/admin/" className="btn-soft">
              <ShieldCheck className="h-4 w-4" />
              {t(user.group === 'REVIEWER' ? '审核中心' : '管理后台')}
            </a>
          )}
        </div>
      </div>

      {(message || error) && (
        <div
          className={cn(
            'mb-4 rounded-xl px-4 py-3 text-sm',
            error ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700',
          )}
        >
          {error || message}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
            <Film className="h-4 w-4 text-brand" />
            {t('新建稿件')}{' '}
          </h2>
          <form onSubmit={createDraft} className="space-y-4">
            <div>
              <label className="label" htmlFor="title">
                {t('标题')}{' '}
              </label>
              <input
                id="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                className="input"
                placeholder={t('给视频起个吸引人的标题')}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="description">
                {t('简介')}{' '}
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                maxLength={5000}
                className="input resize-none"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="category">
                  {t('分区')}{' '}
                </label>
                <select
                  id="category"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="input"
                >
                  <option value="">{t('不选择分区')}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="visibility">
                  {t('可见性')}{' '}
                </label>
                <select
                  id="visibility"
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value as typeof visibility)}
                  className="input"
                >
                  <option value="public">{t('公开')}</option>
                  <option value="unlisted">{t('不列出')}</option>
                  <option value="private">{t('私密')}</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="tags">
                {t('标签')}{' '}
              </label>
              <input
                id="tags"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                className="input"
                placeholder={t('用逗号分隔，最多 12 个')}
              />
            </div>

            {current ? (
              <div className="rounded-xl border border-line bg-canvas p-4">
                <div className="text-sm font-medium">{current.title}</div>
                <div className="mt-1 text-xs text-muted">
                  {t('状态：')}
                  {t(statusLabels[current.status] ?? current.status)}
                </div>
              </div>
            ) : (
              <button type="submit" disabled={creating} className="btn-primary w-full">
                {creating ? t('创建中…') : t('创建草稿')}
              </button>
            )}
          </form>

          {current && (
            <div className="mt-5 border-t border-line pt-5">
              <h3 className="mb-3 text-sm font-semibold">{t('上传视频')}</h3>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-line bg-canvas px-4 py-8 text-center transition hover:border-brand">
                <UploadCloud className="mb-2 h-7 w-7 text-brand" />
                <span className="text-sm font-medium">
                  {file ? file.name : t('点击选择视频文件')}
                </span>
                <span className="mt-1 text-xs text-muted">
                  {file ? formatBytes(file.size) : t('支持 MP4、MOV、MKV、WebM 等')}
                </span>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-muted">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => setCover(event.target.files?.[0] ?? null)}
                />
                {t('自定义封面（可选）')}{' '}
              </label>
              {uploading && (
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-muted">
                    <span>{t('上传中…')}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full bg-brand transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void saveMetadata(current)}
                  className="btn-ghost"
                >
                  {t('保存稿件信息')}{' '}
                </button>
                <button
                  type="button"
                  onClick={() => void uploadVideo()}
                  disabled={!file || uploading}
                  className="btn-primary"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('上传中')}{' '}
                    </>
                  ) : (
                    t('开始上传')
                  )}
                </button>
                {['ready', 'pending_review'].includes(current.status) && (
                  <button type="button" onClick={() => void publish(current)} className="btn-soft">
                    {current.status === 'pending_review' ? t('查看审核状态') : t('发布视频')}
                  </button>
                )}
                {current.status === 'published' && (
                  <Link href={`/video/${current.id}`} className="btn-ghost">
                    {t('查看视频')}{' '}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setCurrent(null);
                    setTitle('');
                    setDescription('');
                    setTags('');
                    setFile(null);
                    setCover(null);
                  }}
                  className="btn-ghost"
                >
                  {t('新建稿件')}{' '}
                </button>
              </div>
              <StudioManage
                video={current}
                onRefresh={async () => {
                  await loadVideos();
                  const refreshed = await api
                    .get<StudioVideo>(`/api/v1/studio/videos/${current.id}`)
                    .catch(() => null);
                  if (refreshed) setCurrent(refreshed);
                }}
              />
            </div>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-4 text-base font-semibold">{t('我的稿件')}</h2>
          <div className="space-y-3">
            {videos.map((video) => (
              <div
                key={video.id}
                className="flex gap-3 rounded-xl border border-line p-3 transition hover:border-brand"
              >
                <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-canvas">
                  {video.coverUrl ? (
                    <img src={video.coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted">
                      {t('无封面')}{' '}
                    </div>
                  )}
                  <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] text-white">
                    {formatDuration(video.durationSeconds)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm font-medium">{video.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
                        video.status === 'published'
                          ? 'bg-green-50 text-green-700'
                          : video.status === 'failed'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-canvas text-muted',
                      )}
                    >
                      {video.status === 'published' ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <Clock className="h-3 w-3" />
                      )}
                      {t(statusLabels[video.status] ?? video.status)}
                    </span>
                    <span>{formatDate(video.createdAt, locale)}</span>
                  </div>
                  <div className="mt-2 flex gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrent(video);
                        setTitle(video.title);
                        setDescription(video.description);
                        setCategoryId(video.categoryId ?? '');
                        setVisibility(video.visibility as typeof visibility);
                      }}
                      className="text-brand hover:underline"
                    >
                      {t('管理')}{' '}
                    </button>
                    {video.status === 'published' && (
                      <Link href={`/video/${video.id}`} className="text-muted hover:text-brand">
                        {t('查看')}{' '}
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => void remove(video)}
                      className="text-red-500 hover:underline"
                    >
                      {t('删除')}{' '}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {videos.length === 0 && (
              <p className="py-10 text-center text-sm text-muted">
                {t('还没有稿件，先创建一个吧')}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
