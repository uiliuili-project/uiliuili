'use client';

import { useT } from '@/components/I18nProvider';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { relativeTime } from '@/lib/format';
import { FolderPlus, Loader2, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface CollectionRow {
  id: string;
  title: string;
  description: string;
  kind: string;
  visibility: string;
  itemCount: number;
  updatedAt: string;
}

interface CollectionItem {
  videoId: string;
  title: string;
  coverUrl: string | null;
  status: string;
  sort: number;
}

export default function StudioCollectionsPage() {
  const t = useT();
  const [items, setItems] = useState<CollectionRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [entries, setEntries] = useState<CollectionItem[]>([]);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'collection' | 'series'>('collection');
  const [videoId, setVideoId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    const data = await api.get<{ items: CollectionRow[] }>('/api/v1/studio/collections');
    setItems(data.items);
  };

  useEffect(() => {
    void load()
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : t('加载失败')),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async () => {
    if (!title.trim()) return;
    setError('');
    try {
      await api.post('/api/v1/studio/collections', { title: title.trim(), kind });
      setTitle('');
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t('创建失败'));
    }
  };

  const remove = async (row: CollectionRow) => {
    if (!window.confirm(t('确定删除合集「{0}」吗？', { 0: row.title }))) return;
    await api
      .delete(`/api/v1/studio/collections/${row.id}`)
      .then(load)
      .catch(() => undefined);
  };

  const toggle = async (row: CollectionRow) => {
    if (expanded === row.id) {
      setExpanded(null);
      setEntries([]);
      return;
    }
    setExpanded(row.id);
    const data = await api
      .get<{ items: CollectionItem[] }>(`/api/v1/studio/collections/${row.id}/items`)
      .catch(() => ({ items: [] }));
    setEntries(data.items);
  };

  const addItem = async (collectionId: string) => {
    if (!videoId.trim()) return;
    setError('');
    try {
      await api.post(`/api/v1/studio/collections/${collectionId}/items`, {
        videoId: videoId.trim(),
      });
      setVideoId('');
      const data = await api.get<{ items: CollectionItem[] }>(
        `/api/v1/studio/collections/${collectionId}/items`,
      );
      setEntries(data.items);
      await load();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : t('添加失败'));
    }
  };

  const removeItem = async (collectionId: string, id: string) => {
    await api
      .delete(`/api/v1/studio/collections/${collectionId}/items/${id}`)
      .then(async () => {
        const data = await api.get<{ items: CollectionItem[] }>(
          `/api/v1/studio/collections/${collectionId}/items`,
        );
        setEntries(data.items);
        await load();
      })
      .catch(() => undefined);
  };

  if (loading) return <div className="card p-10 text-sm text-muted">{t('加载中…')}</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">{t('合集与系列')}</h2>
        <p className="mt-1 text-sm text-muted">
          {t('把相关稿件整理成合集，观众可以按顺序连续观看。')}
        </p>
      </div>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      <div className="card flex flex-wrap items-center gap-2 p-4">
        <FolderPlus className="h-4 w-4 text-brand" />
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t('合集名称')}
          className="input max-w-xs"
        />
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as typeof kind)}
          className="input max-w-[140px]"
        >
          <option value="collection">{t('合集')}</option>
          <option value="series">{t('系列')}</option>
        </select>
        <button type="button" onClick={() => void create()} className="btn-primary">
          <Plus className="h-4 w-4" />
          {t('创建')}
        </button>
      </div>

      <div className="space-y-3">
        {items.map((row) => (
          <div key={row.id} className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {row.title}{' '}
                  <span className="chip ml-1">{t(row.kind === 'series' ? '系列' : '合集')}</span>
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  {row.itemCount} {t('个稿件')} · {relativeTime(row.updatedAt)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void toggle(row)}
                  className={cn('btn-soft', expanded === row.id && 'bg-brand/10 text-brand')}
                >
                  {t(expanded === row.id ? '收起' : '管理条目')}
                </button>
                <button
                  type="button"
                  onClick={() => void remove(row)}
                  className="btn-ghost px-2 py-1 text-red-600"
                  title={t('删除')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {expanded === row.id && (
              <div className="motion-rise-in mt-3 border-t border-[var(--border)] pt-3">
                <div className="mb-2 flex flex-wrap gap-2">
                  <input
                    value={videoId}
                    onChange={(event) => setVideoId(event.target.value)}
                    placeholder={t('稿件 ID')}
                    className="input max-w-xs"
                  />
                  <button type="button" onClick={() => void addItem(row.id)} className="btn-soft">
                    {t('添加稿件')}
                  </button>
                </div>
                {entries.length === 0 ? (
                  <p className="text-sm text-muted">{t('合集里还没有稿件')}</p>
                ) : (
                  <ul className="divide-y divide-[var(--border)]">
                    {entries.map((entry) => (
                      <li key={entry.videoId} className="flex items-center gap-3 py-2">
                        <span className="w-6 text-xs text-muted">{entry.sort}</span>
                        <div className="h-9 w-14 shrink-0 overflow-hidden rounded bg-black/10">
                          {entry.coverUrl && (
                            <img
                              src={entry.coverUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                        <span className="min-w-0 flex-1 truncate text-sm">{entry.title}</span>
                        <span className="chip">{t(entry.status)}</span>
                        <button
                          type="button"
                          onClick={() => void removeItem(row.id, entry.videoId)}
                          className="btn-ghost px-2 py-1 text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div className="card p-10 text-center text-sm text-muted">
            <Loader2 className="mx-auto mb-2 h-4 w-4" />
            {t('还没有合集，先创建一个吧')}
          </div>
        )}
      </div>
    </div>
  );
}
