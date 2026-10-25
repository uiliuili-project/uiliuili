'use client';
import { useLocale, useT } from './I18nProvider';

import { api, csrfHeader } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatBytes, formatDate, formatDuration } from '@/lib/format';
import type { StudioPart, StudioStats, StudioSubtitle, StudioVideo } from '@/lib/types';
import {
  BarChart3,
  CalendarClock,
  Film,
  Image as ImageIcon,
  ListVideo,
  Loader2,
  Pencil,
  Subtitles,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface InitUpload {
  mode: 'local' | 's3';
  uploadId: string;
  storageKey: string;
  partSize: number;
  totalChunks: number;
  parts?: Array<{ partNumber: number; url: string | null }>;
}

const partStatus: Record<string, string> = {
  draft: '待上传',
  uploading: '上传中',
  processing: '转码中',
  ready: '已完成',
  failed: '处理失败',
};

export function StudioManage({
  video,
  onRefresh,
}: {
  video: StudioVideo;
  onRefresh: () => Promise<void> | void;
}) {
  const t = useT();
  const locale = useLocale();
  const [tab, setTab] = useState<'parts' | 'subtitles' | 'stats' | 'publish'>('parts');
  const [parts, setParts] = useState<StudioPart[]>([]);
  const [subtitles, setSubtitles] = useState<StudioSubtitle[]>([]);
  const [stats, setStats] = useState<StudioStats | null>(null);
  const [newPartTitle, setNewPartTitle] = useState('');
  const [progress, setProgress] = useState<{ partId: string; percent: number } | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [publishAt, setPublishAt] = useState('');
  const [language, setLanguage] = useState('zh-CN');
  const [label, setLabel] = useState('中文');
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const loadParts = async () => {
    const data = await api.get<{ items: StudioPart[] }>(`/api/v1/studio/videos/${video.id}/parts`);
    setParts(data.items);
  };

  const loadSubtitles = async () => {
    const data = await api.get<{ items: StudioSubtitle[] }>(
      `/api/v1/studio/videos/${video.id}/subtitles`,
    );
    setSubtitles(data.items);
  };

  const loadStats = async () => {
    setStats(await api.get<StudioStats>(`/api/v1/studio/videos/${video.id}/stats`));
  };

  useEffect(() => {
    setMessage('');
    setError('');
    void Promise.all([loadParts(), loadSubtitles(), loadStats()]).catch((loadError) =>
      setError(loadError instanceof Error ? loadError.message : t('加载失败')),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id]);

  const createPart = async () => {
    if (!newPartTitle.trim()) return;
    setError('');
    try {
      await api.post(`/api/v1/studio/videos/${video.id}/parts`, {
        title: newPartTitle.trim(),
      });
      setNewPartTitle('');
      await loadParts();
      setMessage(t('分 P 已创建'));
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t('创建失败'));
    }
  };

  const renamePart = async (part: StudioPart) => {
    const next = window.prompt(t('分 P 标题'), part.title);
    if (!next || next.trim() === part.title) return;
    await api.patch(`/api/v1/studio/videos/${video.id}/parts/${part.id}`, {
      title: next.trim(),
    });
    await loadParts();
  };

  const removePart = async (part: StudioPart) => {
    if (!window.confirm(t('确定删除分 P「{0}」吗？', { 0: part.title }))) return;
    try {
      await api.delete(`/api/v1/studio/videos/${video.id}/parts/${part.id}`);
      await loadParts();
      await onRefresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('删除失败'));
    }
  };

  const uploadPart = async (part: StudioPart, file: File) => {
    setProgress({ partId: part.id, percent: 0 });
    setMessage('');
    setError('');
    try {
      const init = await api.post<InitUpload>(`/api/v1/studio/videos/${video.id}/upload`, {
        filename: file.name,
        size: file.size,
        contentType: file.type || 'application/octet-stream',
        chunks: Math.ceil(file.size / (8 * 1024 * 1024)),
        partId: part.id,
      });
      if (init.mode === 'local') {
        for (let index = 0; index < init.totalChunks; index += 1) {
          const start = index * init.partSize;
          const end = Math.min(file.size, start + init.partSize);
          const response = await fetch(
            `/api/v1/studio/uploads/${init.uploadId}/parts/${index + 1}`,
            {
              method: 'PUT',
              credentials: 'include',
              headers: { 'Content-Type': 'application/octet-stream', ...csrfHeader() },
              body: file.slice(start, end),
            },
          );
          if (!response.ok) throw new Error(t('分片 {0} 上传失败', { 0: index + 1 }));
          setProgress({
            partId: part.id,
            percent: Math.round((end / file.size) * 100),
          });
        }
        await api.post(`/api/v1/studio/uploads/${init.uploadId}/complete`, {});
      } else {
        const uploaded: Array<{ partNumber: number; etag: string }> = [];
        for (let index = 0; index < init.totalChunks; index += 1) {
          const start = index * init.partSize;
          const end = Math.min(file.size, start + init.partSize);
          const url = init.parts?.[index]?.url;
          if (!url) throw new Error(t('缺少 S3 分片上传地址'));
          const response = await fetch(url, {
            method: 'PUT',
            body: file.slice(start, end),
          });
          if (!response.ok) throw new Error(t('S3 分片 {0} 上传失败', { 0: index + 1 }));
          uploaded.push({
            partNumber: index + 1,
            etag: response.headers.get('ETag') ?? '',
          });
          setProgress({
            partId: part.id,
            percent: Math.round((end / file.size) * 100),
          });
        }
        await api.post(`/api/v1/studio/uploads/${init.uploadId}/complete`, {
          parts: uploaded,
        });
      }
      setMessage(t('上传完成，正在转码…'));
      await loadParts();
      await onRefresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t('上传失败'));
    } finally {
      setProgress(null);
    }
  };

  const uploadSubtitle = async (file: File) => {
    setMessage('');
    setError('');
    try {
      const content = await file.text();
      await api.post(`/api/v1/studio/videos/${video.id}/subtitles`, {
        language,
        label: label || language,
        content,
      });
      await loadSubtitles();
      setMessage(t('字幕已上传'));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t('上传失败'));
    }
  };

  const removeSubtitle = async (subtitle: StudioSubtitle) => {
    if (!window.confirm(t('确定删除字幕「{0}」吗？', { 0: subtitle.label }))) return;
    await api.delete(
      `/api/v1/studio/videos/${video.id}/subtitles/${encodeURIComponent(subtitle.language)}`,
    );
    await loadSubtitles();
  };

  const uploadCroppedCover = async (file: File) => {
    setMessage('');
    setError('');
    try {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);
      image.src = objectUrl;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const context = canvas.getContext('2d');
      if (!context) throw new Error(t('浏览器不支持图片裁剪'));
      const targetRatio = 16 / 9;
      const sourceRatio = image.width / image.height;
      let sw = image.width;
      let sh = image.height;
      if (sourceRatio > targetRatio) sw = image.height * targetRatio;
      else sh = image.width / targetRatio;
      const sx = (image.width - sw) / 2;
      const sy = (image.height - sh) / 2;
      context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.9),
      );
      if (!blob) throw new Error(t('封面上传失败'));
      const response = await fetch(`/api/v1/studio/videos/${video.id}/cover`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'image/jpeg', ...csrfHeader() },
        body: blob,
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? t('封面上传失败'));
      }
      setMessage(t('封面已更新'));
      await onRefresh();
    } catch (coverError) {
      setError(coverError instanceof Error ? coverError.message : t('封面上传失败'));
    }
  };

  const schedule = async (at?: string) => {
    setMessage('');
    setError('');
    try {
      const iso = at ? new Date(at).toISOString() : undefined;
      await api.post(`/api/v1/studio/videos/${video.id}/publish`, {
        ...(iso ? { publishAt: iso } : {}),
      });
      setMessage(iso ? t('已安排定时发布') : t('视频已发布'));
      await onRefresh();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : t('发布失败'));
    }
  };

  const maxViews = stats ? Math.max(1, ...stats.daily.map((item) => item.views)) : 1;

  return (
    <div className="mt-5 border-t border-line pt-5">
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-canvas p-1 text-xs">
        {[
          { key: 'parts', label: t('分 P 管理'), icon: ListVideo },
          { key: 'subtitles', label: t('字幕'), icon: Subtitles },
          { key: 'stats', label: t('数据'), icon: BarChart3 },
          { key: 'publish', label: t('发布设置'), icon: CalendarClock },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key as typeof tab)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5',
              tab === item.key ? 'bg-white text-brand shadow-sm' : 'text-muted',
            )}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </button>
        ))}
      </div>

      {(message || error) && (
        <p className={cn('mb-3 text-xs', error ? 'text-red-500' : 'text-muted')}>
          {error || message}
        </p>
      )}

      {tab === 'parts' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              value={newPartTitle}
              onChange={(event) => setNewPartTitle(event.target.value)}
              maxLength={80}
              placeholder={t('新分 P 标题，例如：第二讲')}
              className="input max-w-sm"
            />
            <button
              type="button"
              onClick={() => void createPart()}
              disabled={!newPartTitle.trim()}
              className="btn-primary shrink-0"
            >
              {t('添加分 P')}
            </button>
          </div>
          {parts.map((part, index) => (
            <div key={part.id} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    P{index + 1} {part.title}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5',
                        part.status === 'ready'
                          ? 'bg-green-50 text-green-700'
                          : part.status === 'failed'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-canvas',
                      )}
                    >
                      {t(partStatus[part.status] ?? part.status)}
                    </span>
                    <span>{formatDuration(part.durationSeconds)}</span>
                    {part.sourceSize > 0 && <span>{formatBytes(part.sourceSize)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => void renamePart(part)}
                    className="btn-ghost h-8 px-2"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t('重命名')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void removePart(part)}
                    className="btn-ghost h-8 px-2 text-red-500 hover:border-red-200"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('删除')}
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputs.current[part.id]?.click()}
                    className="btn-soft h-8 px-2"
                  >
                    <UploadCloud className="h-3.5 w-3.5" />
                    {part.sourceFilename ? t('替换视频') : t('上传视频')}
                  </button>
                  <input
                    ref={(element) => {
                      fileInputs.current[part.id] = element;
                    }}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadPart(part, file);
                      event.target.value = '';
                    }}
                  />
                </div>
              </div>
              {progress?.partId === part.id && (
                <div className="mt-2">
                  <div className="mb-1 flex justify-between text-xs text-muted">
                    <span>{t('上传中…')}</span>
                    <span>{progress.percent}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full bg-brand transition-all"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>
              )}
              {part.sourceFilename && (
                <p className="mt-1 truncate text-[11px] text-muted">{part.sourceFilename}</p>
              )}
            </div>
          ))}
          {parts.length === 0 && (
            <p className="text-sm text-muted">{t('还没有分 P。单个视频会使用主视频文件播放。')}</p>
          )}
        </div>
      )}

      {tab === 'subtitles' && (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[120px_160px_minmax(0,1fr)_auto]">
            <input
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              placeholder={t('语言代码')}
              className="input h-9 text-sm"
            />
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={t('字幕名称')}
              className="input h-9 text-sm"
            />
            <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line px-3 text-xs text-muted hover:border-brand">
              <UploadCloud className="h-4 w-4" />
              {t('选择 .vtt 字幕文件')}
              <input
                type="file"
                accept=".vtt,text/vtt"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadSubtitle(file);
                  event.target.value = '';
                }}
              />
            </label>
          </div>
          {subtitles.map((subtitle) => (
            <div
              key={subtitle.language}
              className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium">{subtitle.label}</span>
                <span className="ml-2 text-xs text-muted">{subtitle.language}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted">
                <span>{formatDate(subtitle.createdAt, locale)}</span>
                <button
                  type="button"
                  onClick={() => void removeSubtitle(subtitle)}
                  className="text-red-500 hover:underline"
                >
                  {t('删除')}
                </button>
              </div>
            </div>
          ))}
          {subtitles.length === 0 && <p className="text-sm text-muted">{t('还没有字幕')}</p>}
        </div>
      )}

      {tab === 'stats' && (
        <div>
          {stats ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { label: t('播放'), value: stats.totals.views },
                  { label: t('点赞'), value: stats.totals.likes },
                  { label: t('投币'), value: stats.totals.coins },
                  { label: t('收藏'), value: stats.totals.favorites },
                  { label: t('评论'), value: stats.totals.comments },
                  { label: t('弹幕'), value: stats.totals.danmaku },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-canvas p-3">
                    <div className="text-xs text-muted">{item.label}</div>
                    <div className="mt-1 text-lg font-semibold tabular-nums">{item.value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-line p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-muted">
                  <span>{t('近 30 天播放趋势')}</span>
                  <span>
                    {t('完播率')} {stats.completionRate}%
                  </span>
                </div>
                {stats.daily.length > 0 ? (
                  <svg viewBox="0 0 300 100" className="h-40 w-full" role="img">
                    <polyline
                      fill="none"
                      stroke="#fb7299"
                      strokeWidth="2"
                      points={stats.daily
                        .map((item, index) => {
                          const x =
                            stats.daily.length === 1
                              ? 150
                              : (index / (stats.daily.length - 1)) * 296 + 2;
                          const y = 96 - (item.views / maxViews) * 88;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                    />
                    <line x1="2" y1="98" x2="298" y2="98" stroke="#e5e7eb" strokeWidth="1" />
                  </svg>
                ) : (
                  <p className="py-8 text-center text-xs text-muted">{t('暂无播放数据')}</p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">{t('加载中…')}</p>
          )}
        </div>
      )}

      {tab === 'publish' && (
        <div className="max-w-xl space-y-4">
          <div className="rounded-xl border border-line p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <ImageIcon className="h-4 w-4 text-brand" />
              {t('封面裁剪')}
            </div>
            <p className="mb-2 text-xs text-muted">
              {t('上传图片后会按 16:9 居中裁剪并覆盖当前封面。')}
            </p>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-brand">
              <UploadCloud className="h-4 w-4" />
              {t('选择封面图片')}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadCroppedCover(file);
                  event.target.value = '';
                }}
              />
            </label>
          </div>
          <div className="rounded-xl border border-line p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <CalendarClock className="h-4 w-4 text-brand" />
              {t('定时发布')}
            </div>
            <input
              type="datetime-local"
              value={publishAt}
              onChange={(event) => setPublishAt(event.target.value)}
              className="input h-9 max-w-xs text-sm"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void schedule(publishAt || undefined)}
                disabled={!publishAt}
                className="btn-primary"
              >
                {t('安排发布')}
              </button>
              <button type="button" onClick={() => void schedule()} className="btn-ghost">
                <Film className="h-4 w-4" />
                {t('立即发布')}
              </button>
            </div>
            {video.publishedAt && (
              <p className="mt-2 text-xs text-muted">
                {t('当前发布时间')}：{formatDate(video.publishedAt, locale)}
              </p>
            )}
          </div>
        </div>
      )}

      {progress && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t('正在上传')}
        </p>
      )}
    </div>
  );
}
