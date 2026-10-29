'use client';

import { useLocale, useT } from '@/components/I18nProvider';
import { formatCount, formatDuration, relativeTime } from '@/lib/format';
import type { VideoCard as VideoCardType } from '@uiliuili/shared';
import { MessageSquare, Play, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export function VideoCard({ video }: { video: VideoCardType }) {
  const t = useT();
  const locale = useLocale();
  return (
    <article className="group min-w-0">
      <Link
        href={`/video/${video.id}`}
        className="relative block aspect-video overflow-hidden rounded-xl2 bg-gradient-to-br from-slate-200 to-slate-100"
      >
        {video.coverUrl ? (
          <img
            src={video.coverUrl}
            alt={video.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            {t('暂无封面')}
          </div>
        )}
        {video.restricted && (
          <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
            <ShieldAlert className="h-3 w-3" />
            {t('限制级')}
          </span>
        )}
        <div className="absolute bottom-1.5 right-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[11px] font-medium text-white">
          {formatDuration(video.durationSeconds)}
        </div>
      </Link>
      <div className="mt-2.5">
        <Link
          href={`/video/${video.id}`}
          className="line-clamp-2 text-[15px] font-medium leading-snug text-ink transition hover:text-brand"
        >
          {video.title}
        </Link>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
          <Link
            href={`/space/${video.uploader.username}`}
            className="truncate transition hover:text-brand"
          >
            {video.uploader.displayName}
          </Link>
          <span>·</span>
          <span>{relativeTime(video.publishedAt ?? video.createdAt, locale)}</span>
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <Play className="h-3 w-3" />
            {formatCount(video.views, locale)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {formatCount(video.danmaku, locale)}
          </span>
          {video.category && <span className="truncate">{video.category.name}</span>}
        </div>
      </div>
    </article>
  );
}
