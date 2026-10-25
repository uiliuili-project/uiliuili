'use client';
import { useT } from '@/components/I18nProvider';

import { VideoCard as VideoCardView } from '@/components/VideoCard';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { VideoCard } from '@uiliuili/shared';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Folder {
  id: string;
  name: string;
  isDefault: boolean;
  count: number;
  createdAt: string;
}

interface FavoritesResponse {
  folders: Folder[];
  folderId: string | null;
  items: VideoCard[];
}

export default function FavoritesPage() {
  const t = useT();
  const [data, setData] = useState<FavoritesResponse | null>(null);
  const [active, setActive] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const load = async (folderId?: string) => {
    setLoading(true);
    try {
      const result = await api.get<FavoritesResponse>(
        `/api/v1/me/favorites${folderId ? `?folderId=${folderId}` : ''}`,
      );
      setData(result);
      setActive(result.folderId ?? undefined);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('加载失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createFolder = async () => {
    if (!name.trim()) return;
    await api.post('/api/v1/me/favorites/folders', { name: name.trim() });
    setName('');
    setCreating(false);
    await load(active);
  };

  return (
    <div className="container-page py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t('我的收藏')}</h1>
        <button type="button" onClick={() => setCreating((value) => !value)} className="btn-ghost">
          <Plus className="h-4 w-4" />
          {t('新建收藏夹')}{' '}
        </button>
      </div>
      {creating && (
        <div className="mb-4 flex gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={40}
            placeholder={t('收藏夹名称')}
            className="input max-w-xs"
          />
          <button type="button" onClick={() => void createFolder()} className="btn-primary">
            {t('创建')}{' '}
          </button>
        </div>
      )}
      {error && (
        <div className="card p-8 text-center">
          <p className="text-sm text-muted">{error}</p>
          <Link href="/login" className="btn-primary mt-4">
            {t('去登录')}{' '}
          </Link>
        </div>
      )}
      {data && (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            {data.folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => void load(folder.id)}
                className={cn('chip', active === folder.id && 'chip-active')}
              >
                {folder.name} <span className="ml-1 opacity-70">{folder.count}</span>
              </button>
            ))}
          </div>
          {loading ? (
            <p className="text-sm text-muted">{t('加载中…')}</p>
          ) : data.items.length > 0 ? (
            <div className="video-grid">
              {data.items.map((video) => (
                <VideoCardView key={video.id} video={video} />
              ))}
            </div>
          ) : (
            <div className="card py-16 text-center text-sm text-muted">
              {t('这个收藏夹还是空的')}
            </div>
          )}
        </>
      )}
    </div>
  );
}
