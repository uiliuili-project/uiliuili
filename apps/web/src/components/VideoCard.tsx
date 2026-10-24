import { formatCount, formatDuration, relativeTime } from '@/lib/format';
import type { VideoCard as VideoCardType } from '@uiliuili/shared';
import { MessageSquare, Play } from 'lucide-react';
import Link from 'next/link';

export function VideoCard({ video }: { video: VideoCardType }) {
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
          <div className="flex h-full items-center justify-center text-sm text-muted">暂无封面</div>
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
          <span>{relativeTime(video.publishedAt ?? video.createdAt)}</span>
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <Play className="h-3 w-3" />
            {formatCount(video.views)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {formatCount(video.danmaku)}
          </span>
          {video.category && <span className="truncate">{video.category.name}</span>}
        </div>
      </div>
    </article>
  );
}
