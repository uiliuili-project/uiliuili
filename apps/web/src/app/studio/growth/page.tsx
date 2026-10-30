'use client';

import { useT } from '@/components/I18nProvider';
import { api } from '@/lib/api';
import { formatCount } from '@/lib/format';
import { Award, CheckCircle2, Circle, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

interface GrowthResponse {
  level: number;
  experience: number;
  currentLevelExperience: number;
  nextLevelExperience: number | null;
  progress: number;
  badges: Array<{ code: string; label: string; description: string; awardedAt: string }>;
  stats: {
    published: number;
    views: number;
    likes: number;
    followers: number;
    danmaku: number;
  };
  tasks: Array<{ code: string; label: string; done: boolean }>;
}

export default function StudioGrowthPage() {
  const t = useT();
  const [data, setData] = useState<GrowthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void api
      .get<GrowthResponse>('/api/v1/studio/growth')
      .then(setData)
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : t('加载失败')),
      )
      .finally(() => setLoading(false));
  }, [t]);

  if (loading) return <div className="card p-10 text-sm text-muted">{t('加载中…')}</div>;
  if (error)
    return <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;

  const stats = data?.stats;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">{t('成长中心')}</h2>
        <p className="mt-1 text-sm text-muted">{t('通过投稿和互动积累经验，解锁等级与勋章。')}</p>
      </div>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-lg font-bold text-brand-dark">
              Lv.{data?.level ?? 0}
            </div>
            <div>
              <div className="text-sm font-semibold">
                {formatCount(data?.experience ?? 0)} {t('经验')}
              </div>
              <div className="text-xs text-muted">
                {data?.nextLevelExperience
                  ? t('距离下一级还需 {0} 经验', {
                      0: Math.max(0, data.nextLevelExperience - (data.experience ?? 0)),
                    })
                  : t('已达到最高等级')}
              </div>
            </div>
          </div>
          <Sparkles className="h-6 w-6 text-brand" />
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/10">
          <div
            className="h-full rounded-full bg-brand"
            style={{ width: `${data?.progress ?? 0}%` }}
          />
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {[
          { label: '已发布', value: stats?.published ?? 0 },
          { label: '播放', value: stats?.views ?? 0 },
          { label: '获赞', value: stats?.likes ?? 0 },
          { label: '粉丝', value: stats?.followers ?? 0 },
          { label: '弹幕', value: stats?.danmaku ?? 0 },
        ].map((item) => (
          <div key={item.label} className="card p-4">
            <div className="text-sm text-muted">{t(item.label)}</div>
            <div className="mt-1 text-xl font-semibold">{formatCount(item.value)}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Award className="h-4 w-4 text-brand" />
            {t('勋章')}
          </h3>
          {data?.badges.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.badges.map((badge) => (
                <li key={badge.code} className="rounded-lg bg-canvas p-3">
                  <div className="text-sm font-medium">{badge.label}</div>
                  <div className="mt-0.5 text-xs text-muted">{badge.description}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t('还没有获得勋章')}</p>
          )}
        </section>

        <section className="card p-5">
          <h3 className="mb-3 text-sm font-semibold">{t('成长任务')}</h3>
          <ul className="space-y-2.5">
            {(data?.tasks ?? []).map((task) => (
              <li key={task.code} className="flex items-center gap-2 text-sm">
                {task.done ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <Circle className="h-4 w-4 text-muted" />
                )}
                <span className={task.done ? 'text-muted line-through' : ''}>{task.label}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
