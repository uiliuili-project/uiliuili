'use client';

import { useT } from '@/components/I18nProvider';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { relativeTime } from '@/lib/format';
import type { StudioArticle } from '@/lib/types';
import { type Category, renderMarkdown } from '@uiliuili/shared';
import { Eye, Loader2, Save, Trash2, Undo2, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

export default function EditColumnPage() {
  const params = useParams<{ id: string }>();
  const t = useT();
  const router = useRouter();
  const [article, setArticle] = useState<StudioArticle | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [allowComments, setAllowComments] = useState(true);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const data = await api.get<StudioArticle & { content: string }>(
      `/api/v1/studio/articles/${params.id}`,
    );
    setArticle(data);
    setTitle(data.title);
    setSummary(data.summary);
    setContent(data.content ?? '');
    setCategoryId(data.categoryId ?? '');
    setVisibility(data.visibility);
    setAllowComments(data.allowComments);
  };

  useEffect(() => {
    void Promise.all([
      load(),
      api
        .get<{ items: Category[] }>('/api/v1/categories')
        .then((data) => setCategories(data.items ?? []))
        .catch(() => undefined),
    ])
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : t('加载失败')),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const rendered = useMemo(() => renderMarkdown(content), [content]);

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.patch(`/api/v1/studio/articles/${params.id}`, {
        title,
        summary,
        content,
        categoryId: categoryId || null,
        visibility,
        allowComments,
      });
      setMessage(t('已保存'));
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    setError('');
    try {
      await save();
      await api.post(`/api/v1/studio/articles/${params.id}/publish`);
      setMessage(t('已提交发布'));
      await load();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : t('发布失败'));
    }
  };

  const unpublish = async () => {
    await api
      .post(`/api/v1/studio/articles/${params.id}/unpublish`)
      .then(load)
      .catch(() => undefined);
  };

  const remove = async () => {
    if (!window.confirm(t('确定删除这篇专栏吗？'))) return;
    await api
      .delete(`/api/v1/studio/articles/${params.id}`)
      .then(() => router.push('/studio/columns'))
      .catch(() => undefined);
  };

  if (loading) return <div className="card p-10 text-sm text-muted">{t('加载中…')}</div>;
  if (!article) return <div className="card p-10 text-center text-sm text-muted">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="truncate text-base font-semibold">{article.title || t('未命名专栏')}</h2>
          <p className="mt-1 text-xs text-muted">
            {t(article.status)} · {relativeTime(article.updatedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setPreview((value) => !value)} className="btn-ghost">
            {preview ? <Undo2 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {t(preview ? '继续编辑' : '预览')}
          </button>
          {article.status === 'published' ? (
            <button type="button" onClick={() => void unpublish()} className="btn-ghost">
              {t('转为草稿')}
            </button>
          ) : (
            <button type="button" onClick={() => void publish()} className="btn-soft">
              <UploadCloud className="h-4 w-4" />
              {t('发布')}
            </button>
          )}
          {article.status === 'published' && (
            <Link href={`/columns/${article.id}`} target="_blank" className="btn-ghost">
              {t('查看')}
            </Link>
          )}
          <button
            type="button"
            onClick={() => void remove()}
            className="btn-ghost text-red-600"
            title={t('删除')}
          >
            <Trash2 className="h-4 w-4" />
          </button>
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="card grid gap-4 p-5">
          <label className="grid gap-1.5">
            <span className="label">{t('标题')}</span>
            <input
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              className="input"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="label">{t('摘要')}</span>
            <textarea
              value={summary}
              maxLength={300}
              rows={2}
              onChange={(event) => setSummary(event.target.value)}
              className="input resize-y"
            />
          </label>
          {preview ? (
            <div
              className="legal-content min-h-[320px] rounded-lg border border-[var(--border)] p-4 text-sm leading-7"
              dangerouslySetInnerHTML={{ __html: rendered }}
            />
          ) : (
            <label className="grid gap-1.5">
              <span className="label">{t('正文（Markdown）')}</span>
              <textarea
                value={content}
                rows={20}
                onChange={(event) => setContent(event.target.value)}
                className="input resize-y font-mono text-sm"
              />
            </label>
          )}
          <div>
            <button
              type="button"
              onClick={() => void save()}
              className="btn-primary"
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('保存修改')}
            </button>
          </div>
        </div>

        <aside className="card h-fit p-5">
          <h3 className="mb-3 text-sm font-semibold">{t('发布设置')}</h3>
          <div className="grid gap-3">
            <label className="grid gap-1.5">
              <span className="label">{t('分区')}</span>
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="input"
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
                value={visibility}
                onChange={(event) => setVisibility(event.target.value)}
                className="input"
              >
                <option value="public">{t('公开')}</option>
                <option value="unlisted">{t('仅链接可见')}</option>
                <option value="private">{t('私密')}</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowComments}
                onChange={(event) => setAllowComments(event.target.checked)}
              />
              {t('允许评论')}
            </label>
          </div>
        </aside>
      </div>
    </div>
  );
}
