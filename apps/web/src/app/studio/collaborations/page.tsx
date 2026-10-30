'use client';

import { useT } from '@/components/I18nProvider';
import { api } from '@/lib/api';
import { relativeTime } from '@/lib/format';
import { Check, Film, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Invitation {
  videoId: string;
  role: string;
  title: string;
  coverUrl: string | null;
  status: string;
  uploaderName: string;
  uploaderUsername: string;
  createdAt?: string;
  respondedAt?: string | null;
}

export default function StudioCollaborationsPage() {
  const t = useT();
  const [pending, setPending] = useState<Invitation[]>([]);
  const [accepted, setAccepted] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    const data = await api.get<{ pending: Invitation[]; accepted: Invitation[] }>(
      '/api/v1/studio/collaborations',
    );
    setPending(data.pending);
    setAccepted(data.accepted);
  };

  useEffect(() => {
    void load()
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : t('加载失败')),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const respond = async (videoId: string, accept: boolean) => {
    setError('');
    try {
      await api.post(`/api/v1/studio/collaborations/${videoId}/respond`, { accept });
      await load();
    } catch (respondError) {
      setError(respondError instanceof Error ? respondError.message : t('操作失败'));
    }
  };

  if (loading) return <div className="card p-10 text-sm text-muted">{t('加载中…')}</div>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">{t('联合投稿')}</h2>
        <p className="mt-1 text-sm text-muted">
          {t('接受邀请后，该稿件会出现在你的创作中心；破坏性操作仍由原投稿人负责。')}
        </p>
      </div>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      <section className="card p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Film className="h-4 w-4 text-brand" />
          {t('待处理邀请')}
        </h3>
        {pending.length === 0 ? (
          <p className="text-sm text-muted">{t('没有待处理的邀请')}</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((item) => (
              <li
                key={item.videoId}
                className="flex flex-wrap items-center gap-3 rounded-lg bg-canvas p-3"
              >
                <div className="h-12 w-20 shrink-0 overflow-hidden rounded bg-black/10">
                  {item.coverUrl && (
                    <img src={item.coverUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{item.title}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {item.uploaderName} · {t(item.role === 'assistant' ? '协助者' : '合作者')}
                    {item.createdAt ? ` · ${relativeTime(item.createdAt)}` : ''}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void respond(item.videoId, true)}
                    className="btn-primary"
                  >
                    <Check className="h-4 w-4" />
                    {t('接受')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void respond(item.videoId, false)}
                    className="btn-ghost"
                  >
                    <X className="h-4 w-4" />
                    {t('拒绝')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <h3 className="mb-3 text-sm font-semibold">{t('已加入的联合投稿')}</h3>
        {accepted.length === 0 ? (
          <p className="text-sm text-muted">{t('还没有加入任何联合投稿')}</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {accepted.map((item) => (
              <li key={item.videoId} className="flex items-center gap-3 py-2.5">
                <div className="h-10 w-16 shrink-0 overflow-hidden rounded bg-black/10">
                  {item.coverUrl && (
                    <img src={item.coverUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/studio/videos/${item.videoId}`}
                    className="truncate text-sm hover:text-brand"
                  >
                    {item.title}
                  </Link>
                  <div className="text-xs text-muted">
                    {item.uploaderName} · {t(item.role === 'assistant' ? '协助者' : '合作者')}
                  </div>
                </div>
                <span className="chip">{t(item.status)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
