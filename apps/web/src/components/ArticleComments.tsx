'use client';

import { api, getMe } from '@/lib/api';
import { relativeTime } from '@/lib/format';
import { Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useT } from './I18nProvider';

interface ArticleComment {
  id: string;
  content: string;
  parentId: string | null;
  status: string;
  likeCount: number;
  ipRegion: string | null;
  userId: string;
  createdAt: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
}

export function ArticleComments({ articleId }: { articleId: string }) {
  const t = useT();
  const [items, setItems] = useState<ArticleComment[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [me, setMe] = useState<{ id: string; username: string } | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    const data = await api.get<{ items: ArticleComment[] }>(
      `/api/v1/articles/${articleId}/comments`,
    );
    setItems(data.items);
  };

  useEffect(() => {
    void Promise.all([load(), getMe()])
      .then(([, user]) => setMe(user ? { id: user.id, username: user.username } : null))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);

  const submit = async () => {
    const content = text.trim();
    if (!content) return;
    setPosting(true);
    setError('');
    try {
      await api.post(`/api/v1/articles/${articleId}/comments`, { content });
      setText('');
      await load();
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : t('评论失败'));
    } finally {
      setPosting(false);
    }
  };

  const remove = async (id: string) => {
    await api
      .delete(`/api/v1/articles/${articleId}/comments/${id}`)
      .then(load)
      .catch(() => undefined);
  };

  return (
    <section className="card mt-5 p-5">
      <h2 className="mb-3 text-sm font-semibold">{t('评论')}</h2>
      <div className="mb-4">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          maxLength={1000}
          placeholder={me ? t('说点什么…') : t('登录后参与评论')}
          className="input resize-y"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          {error ? <span className="text-xs text-red-600">{error}</span> : <span />}
          {me ? (
            <button
              type="button"
              onClick={() => void submit()}
              className="btn-primary"
              disabled={posting || !text.trim()}
            >
              {t('发送')}
            </button>
          ) : (
            <Link href="/login" className="btn-primary">
              {t('去登录')}
            </Link>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted">{t('加载中…')}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">{t('还没有评论，来抢沙发吧')}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex gap-3 border-t border-[var(--border)] pt-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-light text-xs font-semibold text-brand-dark">
                {item.avatarUrl ? (
                  <img src={item.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  item.displayName.slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <Link href={`/space/${item.username}`} className="font-medium text-ink">
                    {item.displayName}
                  </Link>
                  <span>Lv.{item.level}</span>
                  {item.ipRegion && <span>{item.ipRegion}</span>}
                  <span>{relativeTime(item.createdAt)}</span>
                  {item.status === 'pending' && <span className="chip">{t('审核中')}</span>}
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.content}</p>
              </div>
              {me && me.id === item.userId && (
                <button
                  type="button"
                  onClick={() => void remove(item.id)}
                  className="btn-ghost h-fit px-2 py-1 text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
