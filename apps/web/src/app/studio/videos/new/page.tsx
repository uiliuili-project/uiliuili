'use client';

import { useLocale, useT } from '@/components/I18nProvider';
import { api, csrfHeader, ensureCsrf } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatBytes } from '@/lib/format';
import { type UploadSession, uploadVideoParts } from '@/lib/studio-upload';
import type { RegionContextInfo, RegionOption, StudioVideo } from '@/lib/types';
import type { Category } from '@uiliuili/shared';
import {
  Check,
  CheckCircle2,
  FileVideo,
  Film,
  Loader2,
  ShieldAlert,
  UploadCloud,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

type Phase = 'idle' | 'creating' | 'uploading' | 'processing' | 'failed' | 'done';

const statusLabels: Record<string, string> = {
  draft: '草稿',
  uploading: '上传中',
  processing: '转码中',
  ready: '待发布',
  pending_review: '审核中',
  published: '已发布',
  blocked: '已下架',
  failed: '处理失败',
};

export default function StudioNewVideoPage() {
  const t = useT();
  const locale = useLocale();
  const [categories, setCategories] = useState<Category[]>([]);
  const [region, setRegion] = useState<RegionContextInfo | null>(null);
  const [regionOptions, setRegionOptions] = useState<RegionOption[]>([]);
  const [video, setVideo] = useState<StudioVideo | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [speed, setSpeed] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
  const [contentType, setContentType] = useState<'original' | 'repost' | 'ai'>('original');
  const [sourceUrl, setSourceUrl] = useState('');
  const [aiGenerated, setAiGenerated] = useState(false);
  const [allowComments, setAllowComments] = useState(true);
  const [allowDanmaku, setAllowDanmaku] = useState(true);
  const [restricted, setRestricted] = useState(false);
  const [regionMode, setRegionMode] = useState<'inherit' | 'block'>('inherit');
  const [regionCodes, setRegionCodes] = useState<string[]>([]);
  const [regionDenyBehavior, setRegionDenyBehavior] = useState<'default' | 'message' | 'not_found'>(
    'default',
  );
  const [regionDenyMessage, setRegionDenyMessage] = useState('');
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');

  const pollRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef(0);
  const videoRef = useRef<StudioVideo | null>(null);
  const busyRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  videoRef.current = video;

  useEffect(() => {
    void ensureCsrf();
    void Promise.all([
      api.get<{ items: Category[] }>('/api/v1/categories').catch(() => ({ items: [] })),
      api.get<RegionContextInfo>('/api/v1/region/context').catch(() => null),
      api.get<{ items: RegionOption[] }>('/api/v1/region/options').catch(() => ({ items: [] })),
    ]).then(([cats, context, options]) => {
      setCategories(cats.items ?? []);
      setRegion(context);
      setRegionOptions(options.items ?? []);
    });
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  const uploadCoverFile = async (videoId: string, coverFile: File) => {
    const response = await fetch(`/api/v1/studio/videos/${videoId}/cover`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': coverFile.type, ...csrfHeader() },
      body: coverFile,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      throw new Error(body?.error?.message ?? t('封面上传失败'));
    }
  };

  const pollStatus = (videoId: string) => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      const data = await api.get<StudioVideo>(`/api/v1/studio/videos/${videoId}`).catch(() => null);
      if (!data) return;
      setVideo(data);
      if (['ready', 'pending_review', 'published', 'failed'].includes(data.status)) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        pollRef.current = null;
        setPhase(data.status === 'failed' ? 'failed' : 'done');
        setMessage(
          data.status === 'failed' ? t('转码失败，请检查后台队列或重新上传') : t('视频处理完成'),
        );
      }
    }, 2500);
  };

  const beginUpload = async (target: StudioVideo, selected: File) => {
    setPhase('uploading');
    setProgress({ loaded: 0, total: selected.size });
    setSpeed(0);
    startedAtRef.current = performance.now();
    setMessage('');
    setError('');
    try {
      const session = await api.post<UploadSession>(`/api/v1/studio/videos/${target.id}/upload`, {
        filename: selected.name,
        size: selected.size,
        contentType: selected.type || 'application/octet-stream',
        chunks: Math.max(1, Math.ceil(selected.size / (8 * 1024 * 1024))),
      });
      const controller = new AbortController();
      abortRef.current = controller;
      const parts = await uploadVideoParts(session, selected, {
        signal: controller.signal,
        onProgress: (loaded, total) => {
          setProgress({ loaded, total });
          const elapsed = (performance.now() - startedAtRef.current) / 1000;
          if (elapsed > 0.2) setSpeed(loaded / elapsed);
        },
      });
      await api.post(
        `/api/v1/studio/uploads/${session.uploadId}/complete`,
        session.mode === 's3' ? { parts } : {},
      );
      setPhase('processing');
      setSpeed(0);
      pollStatus(target.id);
    } catch (uploadError) {
      setPhase('failed');
      setError(
        uploadError instanceof DOMException && uploadError.name === 'AbortError'
          ? t('上传已取消')
          : uploadError instanceof Error && uploadError.message === 'MISSING_PART_URL'
            ? t('缺少 S3 分片上传地址')
            : uploadError instanceof Error
              ? uploadError.message
              : t('上传失败，请重试'),
      );
    }
  };

  const startWithFile = async (selected: File) => {
    if (busyRef.current) return;
    if (videoRef.current) {
      setError(t('当前已有正在处理的稿件，请先完成或放弃后再上传新视频'));
      return;
    }
    if (
      !selected.type.startsWith('video/') &&
      !/\.(mp4|mov|mkv|webm|avi|flv|m4v)$/i.test(selected.name)
    ) {
      setError(t('仅支持视频文件'));
      return;
    }
    busyRef.current = true;
    setError('');
    setMessage('');
    setFile(selected);
    const fallbackTitle = selected.name.replace(/\.[^.]+$/, '').slice(0, 120) || t('未命名稿件');
    setTitle(fallbackTitle);
    setPhase('creating');
    try {
      const created = await api.post<StudioVideo>('/api/v1/studio/videos', {
        title: fallbackTitle,
        description: '',
        categoryId: categoryId || undefined,
        tags: [],
        visibility: 'public',
      });
      setVideo(created);
      setPhase('uploading');
      await beginUpload(created, selected);
    } catch (createError) {
      setPhase('idle');
      setFile(null);
      setError(createError instanceof Error ? createError.message : t('创建失败'));
    } finally {
      busyRef.current = false;
    }
  };

  const startRef = useRef(startWithFile);
  startRef.current = startWithFile;

  useEffect(() => {
    const carriesFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes('Files');
    const onDragEnter = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      setDragActive(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      setDragActive(true);
    };
    const onDragLeave = (event: DragEvent) => {
      if (event.relatedTarget === null) setDragActive(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      setDragActive(false);
      const dropped = event.dataTransfer?.files?.[0];
      if (dropped) void startRef.current(dropped);
    };
    const onDragEnd = () => setDragActive(false);
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    window.addEventListener('dragend', onDragEnd);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('dragend', onDragEnd);
    };
  }, []);

  const buildPayload = () => ({
    title: title.trim(),
    description,
    categoryId: categoryId || undefined,
    tags: tags
      .split(/[,，\s]+/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 12),
    visibility,
    contentType,
    sourceUrl: contentType === 'repost' ? sourceUrl : '',
    aiGenerated,
    allowComments,
    allowDanmaku,
    restricted: Boolean(region?.canUploadRestricted && restricted),
    regionMode,
    regionCodes,
    regionDenyBehavior,
    regionDenyMessage,
  });

  const saveMetadata = async () => {
    if (!video) return null;
    const updated = await api.patch<StudioVideo>(
      `/api/v1/studio/videos/${video.id}`,
      buildPayload(),
    );
    setVideo(updated);
    return updated;
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await saveMetadata();
      setMessage(t('稿件信息已保存'));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!video) return;
    setPublishing(true);
    setError('');
    setMessage('');
    try {
      await saveMetadata();
      const updated = await api.post<StudioVideo>(`/api/v1/studio/videos/${video.id}/publish`, {});
      setVideo(updated);
      setPhase('done');
      setMessage(
        updated.status === 'pending_review' ? t('已提交审核，请等待审核') : t('稿件已发布'),
      );
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : t('发布失败'));
    } finally {
      setPublishing(false);
    }
  };

  const discard = async () => {
    if (!video) return;
    if (!window.confirm(t('确定放弃本次投稿吗？稿件会移入回收站。'))) return;
    if (abortRef.current) abortRef.current.abort();
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = null;
    await api.delete(`/api/v1/studio/videos/${video.id}`).catch(() => undefined);
    reset();
  };

  const reset = () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = null;
    abortRef.current = null;
    setVideo(null);
    setFile(null);
    setPhase('idle');
    setProgress({ loaded: 0, total: 0 });
    setSpeed(0);
    setMessage('');
    setError('');
    setTitle('');
    setDescription('');
    setCategoryId('');
    setTags('');
    setVisibility('public');
    setContentType('original');
    setSourceUrl('');
    setAiGenerated(false);
    setAllowComments(true);
    setAllowDanmaku(true);
    setRestricted(false);
    setRegionMode('inherit');
    setRegionCodes([]);
    setRegionDenyBehavior('default');
    setRegionDenyMessage('');
    setCover(null);
    setCoverPreview('');
  };

  const selectCover = async (coverFile: File | null) => {
    if (!coverFile) return;
    setCover(coverFile);
    setCoverPreview(URL.createObjectURL(coverFile));
    if (video) {
      try {
        await uploadCoverFile(video.id, coverFile);
        setMessage(t('封面已更新'));
      } catch (coverError) {
        setError(coverError instanceof Error ? coverError.message : t('封面上传失败'));
      }
    }
  };

  const percent =
    progress.total > 0 ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : 0;
  const remaining =
    speed > 0 && progress.total > progress.loaded
      ? Math.max(0, Math.ceil((progress.total - progress.loaded) / speed))
      : 0;
  const status = video?.status ?? 'draft';
  const uploading = phase === 'uploading' || phase === 'creating';
  const processing = phase === 'processing' || status === 'processing';
  const canPublish = status === 'ready' || status === 'pending_review';
  const published = status === 'published' || status === 'pending_review';
  const failed = phase === 'failed';
  // The local phase moves ahead of `video.status`, which stays `draft` until
  // the first status poll, so the subtitle follows the phase first.
  const phaseLabel = failed
    ? t('处理失败')
    : uploading
      ? t('上传中')
      : processing
        ? t('转码中')
        : t(statusLabels[status] ?? status);
  const regionLabel = (code: string) => {
    const option = regionOptions.find((item) => item.code === code);
    return option ? (locale === 'en-US' ? option.nameEn : option.name) : code;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{t('投稿新视频')}</h2>
          <p className="mt-1 text-xs text-muted">{t('拖拽视频文件到窗口任意位置即可开始上传')}</p>
        </div>
        <Link href="/studio/videos" className="btn-ghost">
          {t('返回投稿管理')}
        </Link>
      </div>

      {(message || error) && (
        <div
          className={cn(
            'rounded-xl px-4 py-3 text-sm',
            error ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700',
          )}
        >
          {error || message}
        </div>
      )}

      {!video ? (
        <section className="card flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-light text-brand">
            {phase === 'creating' ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              <UploadCloud className="h-7 w-7" />
            )}
          </div>
          <h3 className="text-lg font-semibold">
            {phase === 'creating' ? t('正在创建稿件…') : t('拖拽视频文件到此处')}
          </h3>
          <p className="mt-2 max-w-md text-sm text-muted">
            {t(
              '松开鼠标即可开始上传，也可以点击下面的按钮选择文件。上传开始后仍可继续填写稿件信息。',
            )}
          </p>
          <p className="mt-1 text-xs text-muted">{t('支持 MP4、MOV、MKV、WebM 等视频格式')}</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary mt-6"
            disabled={phase === 'creating'}
          >
            <FileVideo className="h-4 w-4" />
            {t('选择视频文件')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) void startWithFile(selected);
              event.target.value = '';
            }}
          />
          <p className="mt-6 text-xs text-muted">{t('上传过程中请不要关闭页面。')}</p>
        </section>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <section className="card p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Film className="h-4 w-4 text-brand" />
                {t('稿件信息')}
              </h3>
              <div className="grid gap-4">
                <label className="grid gap-1.5">
                  <span className="label">{t('标题')}</span>
                  <input
                    value={title}
                    maxLength={120}
                    onChange={(event) => setTitle(event.target.value)}
                    className="input"
                    placeholder={t('给视频起个吸引人的标题')}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="label">{t('简介')}</span>
                  <textarea
                    value={description}
                    maxLength={5000}
                    rows={4}
                    onChange={(event) => setDescription(event.target.value)}
                    className="input resize-y"
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="label">{t('分区')}</span>
                    <select
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
                  </label>
                  <label className="grid gap-1.5">
                    <span className="label">{t('可见性')}</span>
                    <select
                      value={visibility}
                      onChange={(event) => setVisibility(event.target.value as typeof visibility)}
                      className="input"
                    >
                      <option value="public">{t('公开')}</option>
                      <option value="unlisted">{t('不列出')}</option>
                      <option value="private">{t('私密')}</option>
                    </select>
                  </label>
                </div>
                <label className="grid gap-1.5">
                  <span className="label">{t('标签')}</span>
                  <input
                    value={tags}
                    onChange={(event) => setTags(event.target.value)}
                    className="input"
                    placeholder={t('用逗号分隔，最多 12 个')}
                  />
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-3 text-sm text-muted">
                    <span className="flex h-16 w-28 items-center justify-center overflow-hidden rounded-lg border border-line bg-canvas">
                      {coverPreview ? (
                        <img src={coverPreview} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <FileVideo className="h-5 w-5" />
                      )}
                    </span>
                    {t('自定义封面（可选）')}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(event) => void selectCover(event.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              </div>

              <details className="mt-4 rounded-xl border border-line p-4">
                <summary className="cursor-pointer text-sm font-medium">{t('更多设置')}</summary>
                <div className="mt-4 grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-1.5">
                      <span className="label">{t('创作声明')}</span>
                      <select
                        value={contentType}
                        onChange={(event) =>
                          setContentType(event.target.value as typeof contentType)
                        }
                        className="input"
                      >
                        <option value="original">{t('原创')}</option>
                        <option value="repost">{t('转载')}</option>
                        <option value="ai">{t('AI 生成内容')}</option>
                      </select>
                    </label>
                    {contentType === 'repost' && (
                      <label className="grid gap-1.5">
                        <span className="label">{t('转载来源链接')}</span>
                        <input
                          value={sourceUrl}
                          onChange={(event) => setSourceUrl(event.target.value)}
                          className="input"
                          placeholder="https://"
                        />
                      </label>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-5 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={aiGenerated}
                        onChange={(event) => setAiGenerated(event.target.checked)}
                      />
                      {t('含 AI 生成内容')}
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={allowComments}
                        onChange={(event) => setAllowComments(event.target.checked)}
                      />
                      {t('允许评论')}
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={allowDanmaku}
                        onChange={(event) => setAllowDanmaku(event.target.checked)}
                      />
                      {t('允许弹幕')}
                    </label>
                  </div>

                  {region?.canUploadRestricted && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <label className="flex items-center gap-2 text-sm font-medium text-amber-800">
                        <input
                          type="checkbox"
                          checked={restricted}
                          onChange={(event) => setRestricted(event.target.checked)}
                        />
                        {t('限制级内容')}
                      </label>
                      {restricted && (
                        <p className="mt-2 text-xs leading-5 text-amber-700">
                          {t('限制级内容只会在无限制地区显示，并自动禁止在以下地区播放：{0}', {
                            0:
                              (region.blockedRegions ?? []).map(regionLabel).join('、') ||
                              t('暂无'),
                          })}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-1.5">
                      <span className="label">{t('地区限制')}</span>
                      <select
                        value={restricted ? 'inherit' : regionMode}
                        disabled={restricted}
                        onChange={(event) =>
                          setRegionMode(event.target.value === 'block' ? 'block' : 'inherit')
                        }
                        className="input disabled:opacity-60"
                      >
                        <option value="inherit">{t('不额外限制')}</option>
                        <option value="block">{t('禁止在指定国家播放')}</option>
                      </select>
                    </label>
                    <label className="grid gap-1.5">
                      <span className="label">{t('拒绝方式')}</span>
                      <select
                        value={regionDenyBehavior}
                        onChange={(event) =>
                          setRegionDenyBehavior(
                            event.target.value as 'default' | 'message' | 'not_found',
                          )
                        }
                        className="input"
                      >
                        <option value="default">{t('跟随站点默认')}</option>
                        <option value="message">{t('说明地区限制')}</option>
                        <option value="not_found">{t('显示视频不存在')}</option>
                      </select>
                    </label>
                  </div>

                  {regionMode === 'block' && !restricted && (
                    <label className="grid gap-1.5">
                      <span className="label">{t('禁止播放的国家')}</span>
                      <select
                        multiple
                        size={6}
                        value={regionCodes}
                        onChange={(event) =>
                          setRegionCodes(
                            Array.from(event.target.selectedOptions, (option) => option.value),
                          )
                        }
                        className="input h-auto"
                      >
                        {regionOptions.map((option) => (
                          <option key={option.code} value={option.code}>
                            {locale === 'en-US' ? option.nameEn : option.name} ({option.code})
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-muted">
                        {t('按住 Ctrl 或 Command 可选择多个国家。')}
                      </span>
                    </label>
                  )}

                  <label className="grid gap-1.5">
                    <span className="label">{t('拒绝提示文案')}</span>
                    <input
                      value={regionDenyMessage}
                      maxLength={200}
                      onChange={(event) => setRegionDenyMessage(event.target.value)}
                      className="input"
                      placeholder={t('留空则使用站点默认文案')}
                    />
                  </label>
                </div>
              </details>

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={() => void save()}
                  className="btn-ghost"
                  disabled={saving || !title.trim()}
                >
                  {saving ? t('保存中…') : t('保存稿件信息')}
                </button>
                {canPublish ? (
                  <button
                    type="button"
                    onClick={() => void publish()}
                    className="btn-primary"
                    disabled={publishing || !title.trim()}
                  >
                    {publishing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('发布中…')}
                      </>
                    ) : status === 'pending_review' ? (
                      t('重新提交审核')
                    ) : (
                      t('发布稿件')
                    )}
                  </button>
                ) : null}
                {published && (
                  <>
                    {status === 'published' && (
                      <Link href={`/video/${video.id}`} className="btn-soft" target="_blank">
                        {t('查看视频')}
                      </Link>
                    )}
                    <Link href={`/studio/videos/${video.id}`} className="btn-ghost">
                      {t('去稿件编辑')}
                    </Link>
                  </>
                )}
                {failed && (
                  <button
                    type="button"
                    onClick={() => {
                      if (file) void beginUpload(video, file);
                    }}
                    className="btn-primary"
                    disabled={!file}
                  >
                    {t('重试上传')}
                  </button>
                )}
                {!published && (
                  <button
                    type="button"
                    onClick={() => void discard()}
                    className="btn-ghost text-red-600"
                  >
                    {t('放弃投稿')}
                  </button>
                )}
                {(phase === 'done' || published) && (
                  <button type="button" onClick={reset} className="btn-ghost">
                    {t('再投一个')}
                  </button>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-4 xl:h-fit">
            <section className="card p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand">
                  <FileVideo className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{file?.name ?? title}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {formatBytes(file?.size ?? progress.total)}
                    {video ? ` · ${phaseLabel}` : ''}
                  </div>
                </div>
              </div>

              {uploading ? (
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted">
                    <span>{t('上传进度')}</span>
                    <span className="font-medium text-ink">{percent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-brand transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted">
                    <span>
                      {t('已上传 {0} / {1}', {
                        0: formatBytes(progress.loaded),
                        1: formatBytes(progress.total),
                      })}
                    </span>
                    <span>
                      {speed > 0 ? `${formatBytes(speed)}/s` : t('准备中…')}
                      {remaining > 0 ? ` · ${t('剩余 {0}', { 0: formatClock(remaining) })}` : ''}
                    </span>
                  </div>
                </div>
              ) : null}

              {processing ? (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-canvas px-3 py-2 text-xs text-muted">
                  <Loader2 className="h-4 w-4 animate-spin text-brand" />
                  {t('正在转码，完成后即可发布…')}
                </div>
              ) : null}

              {failed ? (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{t('上传或转码失败，请重试或联系管理员。')}</span>
                </div>
              ) : null}

              <ol className="mt-4 space-y-2 border-t border-line pt-3 text-xs">
                <Step
                  done={
                    !uploading && !failed && progress.loaded >= progress.total && progress.total > 0
                  }
                  active={uploading}
                  label={t('上传视频')}
                />
                <Step
                  done={status === 'ready' || published}
                  active={processing && !uploading}
                  label={t('视频转码')}
                />
                <Step
                  done={status === 'published'}
                  active={status === 'pending_review' || status === 'ready'}
                  label={t('发布稿件')}
                />
              </ol>
            </section>

            <section className="card p-4 text-xs leading-5 text-muted">
              <p>
                {t('上传过程中请不要关闭页面；转码在服务器后台进行，可以稍后回到稿件编辑页查看。')}
              </p>
              {status === 'ready' ? (
                <p className="mt-2 flex items-center gap-1 text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t('转码完成，填写信息后即可发布。')}
                </p>
              ) : null}
            </section>
          </aside>
        </div>
      )}

      {dragActive ? (
        <div className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center bg-brand/10 backdrop-blur-sm">
          <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-brand bg-white/95 px-12 py-10 text-center shadow-float">
            <UploadCloud className="mb-3 h-10 w-10 text-brand" />
            <p className="text-lg font-semibold">{t('松开鼠标即可开始上传')}</p>
            <p className="mt-1 text-sm text-muted">{t('支持 MP4、MOV、MKV、WebM 等视频格式')}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Step({ done, active, label }: { done: boolean; active: boolean; label: string }) {
  return (
    <li
      className={cn(
        'flex items-center gap-2',
        done ? 'text-green-700' : active ? 'text-ink' : 'text-muted',
      )}
    >
      <span
        className={cn(
          'flex h-4 w-4 items-center justify-center rounded-full border text-[9px]',
          done
            ? 'border-green-600 bg-green-600 text-white'
            : active
              ? 'border-brand text-brand'
              : 'border-line',
        )}
      >
        {done ? (
          <Check className="h-2.5 w-2.5" />
        ) : active ? (
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
        ) : null}
      </span>
      {label}
    </li>
  );
}

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
