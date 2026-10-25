'use client';
import { useLocale, useT } from './I18nProvider';

import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatCount } from '@/lib/format';
import type { VideoDetail } from '@uiliuili/shared';
import { Check, Clock, Coins, Flag, Share2, Star, ThumbsUp, UserPlus, X } from 'lucide-react';
import { useState } from 'react';

const reportReasons = [
  { value: 'spam', label: '垃圾广告' },
  { value: 'abuse', label: '辱骂攻击' },
  { value: 'porn', label: '色情低俗' },
  { value: 'violence', label: '暴力血腥' },
  { value: 'copyright', label: '侵权' },
  { value: 'misinformation', label: '不实信息' },
  { value: 'other', label: '其他' },
];

export function VideoActions({ video }: { video: VideoDetail }) {
  const t = useT();
  const locale = useLocale();
  const [liked, setLiked] = useState(video.liked);
  const [likes, setLikes] = useState(video.likes);
  const [coins, setCoins] = useState(video.coinCount);
  const [favorited, setFavorited] = useState(video.favorited);
  const [favorites, setFavorites] = useState(video.favorites);
  const [later, setLater] = useState(video.watchLater);
  const [following, setFollowing] = useState(video.following);
  const [message, setMessage] = useState('');
  const [reportOpen, setReportOpen] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setMessage('');
    try {
      await action();
    } catch (error) {
      const text = error instanceof Error ? error.message : t('操作失败');
      setMessage(
        text.includes('登录') || text.toLowerCase().includes('log in') || text.includes('401')
          ? t('请先登录后再操作')
          : text,
      );
    }
  };

  const toggleLike = () =>
    run(async () => {
      if (liked) {
        const data = await api.delete<{ liked: boolean; count: number }>(
          `/api/v1/videos/${video.id}/like`,
        );
        setLiked(data.liked);
        setLikes(data.count);
      } else {
        const data = await api.post<{ liked: boolean; count: number }>(
          `/api/v1/videos/${video.id}/like`,
        );
        setLiked(data.liked);
        setLikes(data.count);
      }
    });

  const addCoin = () =>
    run(async () => {
      const data = await api.post<{ count: number }>(`/api/v1/videos/${video.id}/coin`, {
        amount: 1,
      });
      setCoins(data.count);
      setMessage(t('投币成功'));
    });

  const toggleFavorite = () =>
    run(async () => {
      if (favorited) {
        await api.delete(`/api/v1/videos/${video.id}/favorite`);
        setFavorited(false);
        setFavorites((value) => Math.max(0, value - 1));
      } else {
        await api.post(`/api/v1/videos/${video.id}/favorite`);
        setFavorited(true);
        setFavorites((value) => value + 1);
      }
    });

  const toggleWatchLater = () =>
    run(async () => {
      if (later) {
        await api.delete(`/api/v1/videos/${video.id}/watch-later`);
        setLater(false);
        setMessage(t('已从稍后再看移除'));
      } else {
        await api.post(`/api/v1/videos/${video.id}/watch-later`);
        setLater(true);
        setMessage(t('已加入稍后再看'));
      }
    });

  const toggleFollow = () =>
    run(async () => {
      if (following) {
        await api.delete(`/api/v1/users/${video.uploader.id}/follow`);
        setFollowing(false);
      } else {
        await api.post(`/api/v1/users/${video.uploader.id}/follow`);
        setFollowing(true);
      }
    });

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: video.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setMessage(t('链接已复制'));
      }
    } catch {
      setMessage(t('复制失败，请手动复制地址栏链接'));
    }
  };

  const report = (reason: string) =>
    run(async () => {
      await api.post(`/api/v1/videos/${video.id}/report`, {
        targetType: 'video',
        targetId: video.id,
        reason,
      });
      setReportOpen(false);
      setMessage(t('举报已提交，我们会尽快处理'));
    });

  const notInterested = () =>
    run(async () => {
      await api.post('/api/v1/videos/feedback', {
        videoId: video.id,
        action: 'not_interested',
      });
      setMessage(t('已减少此类推荐'));
    });

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggleLike}
          className={cn(
            'btn-ghost h-10 rounded-full',
            liked && 'border-brand bg-brand-light text-brand-dark',
          )}
        >
          <ThumbsUp className={cn('h-4 w-4', liked && 'fill-current')} />
          {formatCount(likes, locale)}
        </button>
        <button type="button" onClick={addCoin} className="btn-ghost h-10 rounded-full">
          <Coins className="h-4 w-4" />
          {formatCount(coins, locale)}
        </button>
        <button
          type="button"
          onClick={toggleFavorite}
          className={cn(
            'btn-ghost h-10 rounded-full',
            favorited && 'border-brand bg-brand-light text-brand-dark',
          )}
        >
          <Star className={cn('h-4 w-4', favorited && 'fill-current')} />
          {formatCount(favorites, locale)}
        </button>
        <button
          type="button"
          onClick={toggleWatchLater}
          className={cn(
            'btn-ghost h-10 rounded-full',
            later && 'border-brand bg-brand-light text-brand-dark',
          )}
        >
          <Clock className={cn('h-4 w-4', later && 'fill-current')} />
          {t('稍后再看')}
        </button>
        <button type="button" onClick={share} className="btn-ghost h-10 rounded-full">
          <Share2 className="h-4 w-4" />
          {t('分享')}{' '}
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setReportOpen((open) => !open)}
            className="btn-ghost h-10 rounded-full"
          >
            <Flag className="h-4 w-4" />
            {t('举报')}{' '}
          </button>
          {reportOpen && (
            <div className="absolute left-0 top-12 z-20 w-44 rounded-xl border border-line bg-white p-1 shadow-float">
              {reportReasons.map((reason) => (
                <button
                  key={reason.value}
                  type="button"
                  onClick={() => report(reason.value)}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-canvas"
                >
                  {t(reason.label)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setReportOpen(false);
                  void notInterested();
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50"
              >
                <X className="mr-1 inline h-3.5 w-3.5" />
                {t('不感兴趣')}{' '}
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={toggleFollow}
          className={cn(
            'h-10 rounded-full px-4 text-sm font-medium transition',
            following
              ? 'border border-line bg-white text-muted hover:border-red-200 hover:text-red-500'
              : 'bg-brand text-white hover:bg-brand-dark',
          )}
        >
          {following ? (
            <>
              <Check className="mr-1 inline h-4 w-4" />
              {t('已关注')}{' '}
            </>
          ) : (
            <>
              <UserPlus className="mr-1 inline h-4 w-4" />
              {t('关注')}{' '}
            </>
          )}
        </button>
      </div>
      {(message || video.status !== 'published') && (
        <p
          className={cn(
            'mt-2 text-xs',
            video.status !== 'published' ? 'text-amber-600' : 'text-muted',
          )}
        >
          {message ||
            (video.status === 'pending_review'
              ? t('该视频正在等待审核，仅你和管理员可见')
              : video.status)}
        </p>
      )}
    </div>
  );
}
