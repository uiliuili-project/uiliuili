'use client';
import { useT } from './I18nProvider';

import { api, getMe } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { CollectionInfo } from '@uiliuili/shared';
import { Check, Layers, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export function AddToCollection({ videoId }: { videoId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(true);
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    const data = await api.get<{ items: CollectionInfo[] }>('/api/v1/me/collections');
    setCollections(data.items);
  };

  useEffect(() => {
    if (!open) return;
    void getMe().then(async (user) => {
      if (!user) {
        setSignedIn(false);
        return;
      }
      setSignedIn(true);
      await load().catch(() => undefined);
    });
  }, [open]);

  const create = async () => {
    if (!title.trim()) return;
    setCreating(true);
    setMessage('');
    try {
      const created = await api.post<CollectionInfo>('/api/v1/collections', {
        title: title.trim(),
        description: '',
        kind: 'collection',
        visibility: 'public',
      });
      setTitle('');
      setCollections((current) => [created, ...current]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('创建失败'));
    } finally {
      setCreating(false);
    }
  };

  const add = async (collectionId: string) => {
    setMessage('');
    try {
      await api.post(`/api/v1/collections/${collectionId}/items`, { videoId });
      setAdded((current) => new Set([...current, collectionId]));
      setMessage(t('已加入合集'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('操作失败'));
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost h-10 rounded-full">
        <Layers className="h-4 w-4" />
        {t('加入合集')}
      </button>
    );
  }

  return (
    <div className="relative inline-block">
      <button type="button" onClick={() => setOpen(false)} className="btn-soft h-10 rounded-full">
        <Layers className="h-4 w-4" />
        {t('加入合集')}
      </button>
      <div className="absolute left-0 top-12 z-30 w-72 rounded-xl border border-line bg-white p-3 shadow-float">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">{t('加入合集')}</span>
          <button type="button" onClick={() => setOpen(false)} className="text-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        {!signedIn ? (
          <p className="text-xs text-muted">{t('请先登录后再操作')}</p>
        ) : (
          <>
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {collections.map((collection) => (
                <button
                  key={collection.id}
                  type="button"
                  onClick={() => void add(collection.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-canvas"
                >
                  <span className="min-w-0 truncate">
                    {collection.title}
                    <span className="ml-1 text-[10px] text-muted">{collection.itemCount}</span>
                  </span>
                  {added.has(collection.id) ? (
                    <Check className="h-4 w-4 shrink-0 text-brand" />
                  ) : (
                    <Plus className="h-4 w-4 shrink-0 text-muted" />
                  )}
                </button>
              ))}
              {collections.length === 0 && (
                <p className="px-2 py-3 text-xs text-muted">{t('还没有合集，先创建一个')}</p>
              )}
            </div>
            <div className="mt-2 flex gap-2 border-t border-line pt-2">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={80}
                placeholder={t('合集名称')}
                className="input h-9 text-xs"
              />
              <button
                type="button"
                onClick={() => void create()}
                disabled={creating || !title.trim()}
                className={cn('btn-primary h-9 shrink-0 px-3 text-xs')}
              >
                {t('创建')}
              </button>
            </div>
          </>
        )}
        {message && <p className="mt-2 text-xs text-muted">{message}</p>}
      </div>
    </div>
  );
}
