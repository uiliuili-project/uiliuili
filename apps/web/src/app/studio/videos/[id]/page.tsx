'use client';

import { useLocale, useT } from '@/components/I18nProvider';
import { StudioManage } from '@/components/StudioManage';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { relativeTime } from '@/lib/format';
import type { StudioCollaborator, StudioHistoryEntry, StudioVideo } from '@/lib/types';
import { type Category, VIDEO_APPEAL_REASONS } from '@uiliuili/shared';
import { AlertTriangle, History, Loader2, Save, UserPlus, X } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface DetailedVideo extends StudioVideo {
  isOwner: boolean;
  collaborators: StudioCollaborator[];
}

const appealReasonLabels: Record<string, string> = {
  mistake: '误判',
  copyright: '版权问题',
  context: '缺少上下文',
  other: '其他原因',
};

export default function StudioVideoPage() {
  const params = useParams<{ id: string }>();
  const t = useT();
  const locale = useLocale();
  const [video, setVideo] = useState<DetailedVideo | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [history, setHistory] = useState<StudioHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('coauthor');
  const [appealReason, setAppealReason] = useState('mistake');
  const [appealDetail, setAppealDetail] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    categoryId: '',
    visibility: 'public',
    contentType: 'original',
    sourceUrl: '',
    aiGenerated: false,
    allowComments: true,
    allowDanmaku: true,
  });

  const load = async () => {
    const [detail, cats, log] = await Promise.all([
      api.get<DetailedVideo>(`/api/v1/studio/videos/${params.id}`),
      api.get<{ items: Category[] }>('/api/v1/categories').catch(() => ({ items: [] })),
      api.get<{ items: StudioHistoryEntry[] }>(`/api/v1/studio/videos/${params.id}/history`),
    ]);
    setVideo(detail);
    setCategories(cats.items ?? []);
    setHistory(log.items ?? []);
    setForm({
      title: detail.title,
      description: detail.description,
      categoryId: detail.categoryId ?? '',
      visibility: detail.visibility,
      contentType: detail.contentType ?? 'original',
      sourceUrl: detail.sourceUrl ?? '',
      aiGenerated: detail.aiGenerated ?? false,
      allowComments: detail.allowComments ?? true,
      allowDanmaku: detail.allowDanmaku ?? true,
    });
  };

  useEffect(() => {
    void load()
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : t('加载失败')),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.patch(`/api/v1/studio/videos/${params.id}`, {
        title: form.title,
        description: form.description,
        categoryId: form.categoryId || undefined,
        visibility: form.visibility,
        contentType: form.contentType,
        sourceUrl: form.contentType === 'repost' ? form.sourceUrl : '',
        aiGenerated: form.aiGenerated,
        allowComments: form.allowComments,
        allowDanmaku: form.allowDanmaku,
      });
      setMessage(t('已保存'));
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const invite = async () => {
    if (!inviteName.trim()) return;
    setError('');
    try {
      await api.post(`/api/v1/studio/videos/${params.id}/collaborators`, {
        username: inviteName.trim(),
        role: inviteRole,
      });
      setInviteName('');
      setMessage(t('邀请已发送'));
      await load();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : t('邀请失败'));
    }
  };

  const removeCollaborator = async (userId: string) => {
    await api
      .delete(`/api/v1/studio/videos/${params.id}/collaborators/${userId}`)
      .then(() => load())
      .catch(() => undefined);
  };

  const submitAppeal = async () => {
    setError('');
    try {
      await api.post(`/api/v1/studio/videos/${params.id}/appeals`, {
        reason: appealReason,
        detail: appealDetail,
      });
      setAppealDetail('');
      setMessage(t('申诉已提交，请等待审核'));
      await load();
    } catch (appealError) {
      setError(appealError instanceof Error ? appealError.message : t('提交失败'));
    }
  };

  if (loading) return <div className="card p-10 text-sm text-muted">{t('加载中…')}</div>;
  if (!video) {
    return (
      <div className="card p-10 text-center text-sm text-muted">
        {error || t('稿件不存在')}
        <div className="mt-4">
          <Link href="/studio/videos" className="btn-ghost">
            {t('返回投稿管理')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{video.title || t('未命名稿件')}</h2>
          <p className="mt-1 text-xs text-muted">
            {t(video.status)} · {relativeTime(video.updatedAt, locale)}
            {!video.isOwner && ` · ${t('联合投稿')}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {video.status === 'published' && (
            <Link href={`/video/${video.id}`} className="btn-ghost" target="_blank">
              {t('查看稿件')}
            </Link>
          )}
          <Link href="/studio/videos" className="btn-ghost">
            {t('返回投稿管理')}
          </Link>
        </div>
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

      {video.status === 'blocked' && (
        <section className="card border-amber-200 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-700">
            <AlertTriangle className="h-4 w-4" />
            {t('稿件已被下架')}
          </h3>
          <p className="mt-2 text-sm text-muted">
            {video.regionDenyMessage || t('你可以提交申诉，审核通过后将自动恢复。')}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)_auto]">
            <select
              value={appealReason}
              onChange={(event) => setAppealReason(event.target.value)}
              className="input"
            >
              {VIDEO_APPEAL_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {t(appealReasonLabels[reason] ?? reason)}
                </option>
              ))}
            </select>
            <input
              value={appealDetail}
              onChange={(event) => setAppealDetail(event.target.value)}
              placeholder={t('补充说明（可选）')}
              className="input"
              maxLength={1000}
            />
            <button type="button" onClick={() => void submitAppeal()} className="btn-primary">
              {t('提交申诉')}
            </button>
          </div>
        </section>
      )}

      <section className="card p-5">
        <h3 className="mb-4 text-sm font-semibold">{t('稿件信息')}</h3>
        <div className="grid gap-4">
          <label className="grid gap-1.5">
            <span className="label">{t('标题')}</span>
            <input
              value={form.title}
              maxLength={120}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              className="input"
              disabled={!video.isOwner}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="label">{t('简介')}</span>
            <textarea
              value={form.description}
              maxLength={5000}
              rows={5}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="input resize-y"
              disabled={!video.isOwner}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="label">{t('分区')}</span>
              <select
                value={form.categoryId}
                onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
                className="input"
                disabled={!video.isOwner}
              >
                <option value="">{t('未选择')}</option>
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
                value={form.visibility}
                onChange={(event) => setForm({ ...form, visibility: event.target.value })}
                className="input"
                disabled={!video.isOwner}
              >
                <option value="public">{t('公开')}</option>
                <option value="unlisted">{t('仅链接可见')}</option>
                <option value="private">{t('私密')}</option>
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="label">{t('创作声明')}</span>
              <select
                value={form.contentType}
                onChange={(event) => setForm({ ...form, contentType: event.target.value })}
                className="input"
                disabled={!video.isOwner}
              >
                <option value="original">{t('原创')}</option>
                <option value="repost">{t('转载')}</option>
                <option value="ai">{t('AI 生成内容')}</option>
              </select>
            </label>
            {form.contentType === 'repost' && (
              <label className="grid gap-1.5">
                <span className="label">{t('转载来源链接')}</span>
                <input
                  value={form.sourceUrl}
                  onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })}
                  className="input"
                  placeholder="https://"
                  disabled={!video.isOwner}
                />
              </label>
            )}
          </div>
          <div className="flex flex-wrap gap-5 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.aiGenerated}
                onChange={(event) => setForm({ ...form, aiGenerated: event.target.checked })}
                disabled={!video.isOwner}
              />
              {t('含 AI 生成内容')}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.allowComments}
                onChange={(event) => setForm({ ...form, allowComments: event.target.checked })}
                disabled={!video.isOwner}
              />
              {t('允许评论')}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.allowDanmaku}
                onChange={(event) => setForm({ ...form, allowDanmaku: event.target.checked })}
                disabled={!video.isOwner}
              />
              {t('允许弹幕')}
            </label>
          </div>
          {video.isOwner && (
            <div>
              <button
                type="button"
                onClick={() => void save()}
                className="btn-primary"
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {t('保存修改')}
              </button>
            </div>
          )}
        </div>
      </section>

      <StudioManage
        video={video}
        onRefresh={async () => {
          await load();
        }}
      />

      <section className="card p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <UserPlus className="h-4 w-4 text-brand" />
          {t('联合投稿')}
        </h3>
        {video.isOwner && (
          <div className="mb-4 flex flex-wrap gap-2">
            <input
              value={inviteName}
              onChange={(event) => setInviteName(event.target.value)}
              placeholder={t('用户名或邮箱')}
              className="input max-w-xs"
            />
            <select
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value)}
              className="input max-w-[160px]"
            >
              <option value="coauthor">{t('合作者')}</option>
              <option value="assistant">{t('协助者')}</option>
            </select>
            <button type="button" onClick={() => void invite()} className="btn-soft">
              {t('发送邀请')}
            </button>
          </div>
        )}
        {video.collaborators?.length ? (
          <ul className="divide-y divide-[var(--border)]">
            {video.collaborators.map((item) => (
              <li key={item.userId} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{item.displayName}</div>
                  <div className="text-xs text-muted">
                    @{item.username} · {t(item.role === 'assistant' ? '协助者' : '合作者')} ·{' '}
                    {t(
                      item.status === 'accepted'
                        ? '已接受'
                        : item.status === 'rejected'
                          ? '已拒绝'
                          : '待接受',
                    )}
                  </div>
                </div>
                {video.isOwner && (
                  <button
                    type="button"
                    onClick={() => void removeCollaborator(item.userId)}
                    className="btn-ghost px-2 py-1 text-red-600"
                    title={t('移除')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t('还没有联合投稿成员')}</p>
        )}
      </section>

      <section className="card p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <History className="h-4 w-4 text-brand" />
          {t('状态记录')}
        </h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted">{t('暂无状态记录')}</p>
        ) : (
          <ol className="space-y-2 border-l border-[var(--border)] pl-4">
            {history.map((entry) => (
              <li key={entry.id} className="text-sm">
                <span className="font-medium">
                  {t(entry.fromStatus || '新建')} → {t(entry.toStatus)}
                </span>
                <span className="ml-2 text-xs text-muted">
                  {relativeTime(entry.createdAt, locale)}
                  {entry.actor ? ` · ${entry.actor}` : ''}
                  {entry.reason ? ` · ${t(entry.reason)}` : ''}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
