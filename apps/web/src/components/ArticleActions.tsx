'use client';

import { api, getMe } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatCount } from '@/lib/format';
import { Bookmark, Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useT } from './I18nProvider';

export function ArticleActions({
  articleId,
  likeCount,
  favoriteCount,
  liked,
  favorited,
}: {
  articleId: string;
  likeCount: number;
  favoriteCount: number;
  liked: boolean;
  favorited: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [state, setState] = useState({ liked, favorited, likeCount, favoriteCount });
  const [error, setError] = useState('');

  useEffect(() => {
    void getMe().then((user) => setSignedIn(Boolean(user)));
  }, []);

  const act = async (kind: 'like' | 'favorite') => {
    if (!signedIn) {
      router.push('/login');
      return;
    }
    setError('');
    const active = kind === 'like' ? state.liked : state.favorited;
    try {
      if (kind === 'like') {
        if (active) await api.delete(`/api/v1/articles/${articleId}/like`);
        else await api.post(`/api/v1/articles/${articleId}/like`);
        setState((current) => ({
          ...current,
          liked: !active,
          likeCount: Math.max(0, current.likeCount + (active ? -1 : 1)),
        }));
      } else {
        if (active) await api.delete(`/api/v1/articles/${articleId}/favorite`);
        else await api.post(`/api/v1/articles/${articleId}/favorite`);
        setState((current) => ({
          ...current,
          favorited: !active,
          favoriteCount: Math.max(0, current.favoriteCount + (active ? -1 : 1)),
        }));
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t('操作失败'));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void act('like')}
        className={cn('btn-soft', state.liked && 'bg-brand/10 text-brand')}
      >
        <Heart className={cn('h-4 w-4', state.liked && 'fill-current')} />
        {formatCount(state.likeCount)} {t('点赞')}
      </button>
      <button
        type="button"
        onClick={() => void act('favorite')}
        className={cn('btn-soft', state.favorited && 'bg-brand/10 text-brand')}
      >
        <Bookmark className={cn('h-4 w-4', state.favorited && 'fill-current')} />
        {formatCount(state.favoriteCount)} {t('收藏')}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
