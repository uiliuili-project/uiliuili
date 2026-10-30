'use client';

import { useLocale, useT } from '@/components/I18nProvider';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { relativeTime } from '@/lib/format';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface AppealRow {
  id: string;
  videoId: string;
  videoTitle: string;
  videoStatus: string;
  reason: string;
  detail: string;
  status: string;
  handleNote: string;
  handledAt: string | null;
  createdAt: string;
}

const reasonLabels: Record<string, string> = {
  mistake: '误判',
  copyright: '版权问题',
  context: '缺少上下文',
  other: '其他原因',
};

export default function StudioAppealsPage() {
  const t = useT();
  const locale = useLocale();
  const [items, setItems] = useState<AppealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void api
      .get<{ items: AppealRow[] }>('/api/v1/studio/appeals?limit=50')
      .then((data) => setItems(data.items))
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : t('加载失败')),
      )
      .finally(() => setLoading(false));
  }, [t]);

  if (loading) return <div className="card p-10 text-sm text-muted">{t('加载中…')}</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">{t('审核申诉')}</h2>
        <p className="mt-1 text-sm text-muted">
          {t('对下架或审核结果有异议时，可在稿件详情页提交申诉。')}
        </p>
      </div>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      <div className="space-y-3">
        {items.map((item) => {
          const Icon =
            item.status === 'accepted'
              ? CheckCircle2
              : item.status === 'rejected'
                ? XCircle
                : Clock;
          return (
            <div key={item.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/studio/videos/${item.videoId}`}
                  className="truncate text-sm font-medium hover:text-brand"
                >
                  {item.videoTitle}
                </Link>
                <span
                  className={cn(
                    'chip',
                    item.status === 'accepted' && 'bg-green-50 text-green-700',
                    item.status === 'rejected' && 'bg-red-50 text-red-600',
                  )}
                >
                  <Icon className="mr-1 h-3.5 w-3.5" />
                  {t(
                    item.status === 'accepted'
                      ? '已通过'
                      : item.status === 'rejected'
                        ? '未通过'
                        : '处理中',
                  )}
                </span>
              </div>
              <div className="mt-2 text-xs text-muted">
                {t(reasonLabels[item.reason] ?? item.reason)} ·{' '}
                {relativeTime(item.createdAt, locale)}
              </div>
              {item.detail && <p className="mt-2 text-sm text-muted">{item.detail}</p>}
              {item.handleNote && (
                <p className="mt-2 rounded-lg bg-canvas px-3 py-2 text-sm">
                  {t('审核回复')}：{item.handleNote}
                </p>
              )}
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="card p-10 text-center text-sm text-muted">{t('还没有申诉记录')}</div>
        )}
      </div>
    </div>
  );
}
