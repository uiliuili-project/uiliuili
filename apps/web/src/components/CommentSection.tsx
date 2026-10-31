'use client';
import { useLocale, useT } from './I18nProvider';

import { api, getMe } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatCount, relativeTime } from '@/lib/format';
import { regionLabel } from '@uiliuili/shared';
import type { CommentItem } from '@uiliuili/shared';
import { Heart, MessageCircle, Pin, Send, Smile, ThumbsUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface CommentResponse {
  items: CommentItem[];
  nextCursor: string | null;
}

const EMOJIS = ['😀', '😂', '🥰', '😭', '🤔', '😅', '👍', '❤️', '🎉', '🔥', '🌟', '👀'];

export function CommentSection({
  videoId,
  uploaderId,
}: {
  videoId: string;
  uploaderId: string;
}) {
  const t = useT();
  const locale = useLocale();
  const [items, setItems] = useState<CommentItem[]>([]);
  const [sort, setSort] = useState<'hot' | 'new'>('hot');
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [posting, setPosting] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const load = async (cursor?: string, append = false) => {
    setLoading(true);
    try {
      const data = await api.get<CommentResponse>(
        `/api/v1/videos/${videoId}/comments?sort=${sort}&limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      );
      setItems((current) => (append ? [...current, ...data.items] : data.items));
      setNextCursor(data.nextCursor);
    } catch {
      setMessage(t('评论加载失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [videoId, sort]);

  useEffect(() => {
    void getMe().then((user) => setIsOwner(Boolean(user && user.id === uploaderId)));
  }, [uploaderId]);

  const submit = async (parentId?: string) => {
    const content = (parentId ? replyText : text).trim();
    if (!content) return;
    setPosting(true);
    setMessage('');
    try {
      await api.post(`/api/v1/videos/${videoId}/comments`, {
        content,
        parentId: parentId ?? undefined,
      });
      if (parentId) {
        setReplyTo(null);
        setReplyText('');
      } else {
        setText('');
      }
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('发布失败'));
    } finally {
      setPosting(false);
    }
  };

  const insertEmoji = (emoji: string) => {
    setText((current) => `${current}${emoji}`);
    setEmojiOpen(false);
    textareaRef.current?.focus();
  };

  const toggleLike = async (comment: CommentItem, replyParentId?: string) => {
    try {
      const data = comment.liked
        ? await api.delete<{ liked: boolean; count: number }>(
            `/api/v1/videos/${videoId}/comments/${comment.id}/like`,
          )
        : await api.post<{ liked: boolean; count: number }>(
            `/api/v1/videos/${videoId}/comments/${comment.id}/like`,
          );
      setItems((current) =>
        current.map((item) => {
          if (item.id === comment.id) {
            return { ...item, liked: data.liked, likeCount: data.count };
          }
          if (replyParentId && item.id === replyParentId) {
            return {
              ...item,
              replies: item.replies.map((reply) =>
                reply.id === comment.id
                  ? { ...reply, liked: data.liked, likeCount: data.count }
                  : reply,
              ),
            };
          }
          return item;
        }),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('操作失败'));
    }
  };

  const togglePin = async (comment: CommentItem) => {
    try {
      const data = await api.post<{ pinned: boolean }>(
        `/api/v1/videos/${videoId}/comments/${comment.id}/pin`,
        { pinned: !comment.pinned },
      );
      setItems((current) =>
        current.map((item) => {
          if (item.id === comment.id) return { ...item, pinned: data.pinned };
          if (data.pinned) return { ...item, pinned: false };
          return item;
        }),
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('操作失败'));
    }
  };

  const toggleUpLike = async (comment: CommentItem) => {
    try {
      const data = comment.upLiked
        ? await api.delete<{ upLiked: boolean }>(
            `/api/v1/videos/${videoId}/comments/${comment.id}/up-like`,
          )
        : await api.post<{ upLiked: boolean }>(
            `/api/v1/videos/${videoId}/comments/${comment.id}/up-like`,
          );
      setItems((current) =>
        current.map((item) => (item.id === comment.id ? { ...item, upLiked: data.upLiked } : item)),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('操作失败'));
    }
  };

  const loadReplies = async (comment: CommentItem) => {
    try {
      const data = await api.get<CommentResponse>(
        `/api/v1/videos/${videoId}/comments/${comment.id}/replies?limit=50`,
      );
      setItems((current) =>
        current.map((item) =>
          item.id === comment.id
            ? {
                ...item,
                replies: data.items,
                replyCount: Math.max(item.replyCount, data.items.length),
              }
            : item,
        ),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('操作失败'));
    }
  };

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('评论')}</h2>
        <div className="flex gap-1 rounded-lg bg-canvas p-1 text-xs">
          <button
            type="button"
            onClick={() => setSort('hot')}
            className={cn('rounded-md px-3 py-1.5', sort === 'hot' && 'bg-white shadow-sm')}
          >
            {t('热门')}{' '}
          </button>
          <button
            type="button"
            onClick={() => setSort('new')}
            className={cn('rounded-md px-3 py-1.5', sort === 'new' && 'bg-white shadow-sm')}
          >
            {t('最新')}{' '}
          </button>
        </div>
      </div>

      <div className="card p-4">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={1000}
          rows={3}
          placeholder={t('发一条友善的评论…')}
          className="input resize-none"
        />
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setEmojiOpen((open) => !open)}
                className="inline-flex items-center gap-1 text-xs text-muted hover:text-brand"
              >
                <Smile className="h-4 w-4" />
                {t('表情')}
              </button>
              {emojiOpen && (
                <div className="motion-pop-in absolute bottom-8 left-0 z-20 grid w-48 origin-bottom-left grid-cols-6 gap-1 rounded-xl border border-line bg-white p-2 shadow-float">
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                      className="rounded p-1 text-lg hover:bg-canvas"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="text-xs text-muted">{text.length}/1000</span>
          </div>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={posting || !text.trim()}
            className="btn-primary"
          >
            <Send className="h-4 w-4" />
            {t('发布')}{' '}
          </button>
        </div>
        {message && <p className="mt-2 text-xs text-red-500">{message}</p>}
      </div>

      <div className="mt-5 space-y-5">
        {loading && items.length === 0 && <p className="text-sm text-muted">{t('评论加载中…')}</p>}
        {!loading && items.length === 0 && (
          <div className="rounded-xl border border-dashed border-line bg-white/60 py-10 text-center text-sm text-muted">
            {t('还没有评论，来抢沙发吧')}{' '}
          </div>
        )}
        {items.map((comment) => (
          <CommentRow
            key={comment.id}
            comment={comment}
            uploaderId={uploaderId}
            isOwner={isOwner}
            onLike={() => void toggleLike(comment)}
            onReply={() => {
              setReplyTo(comment.id);
              setReplyText('');
            }}
            onPin={() => void togglePin(comment)}
            onUpLike={() => void toggleUpLike(comment)}
            onLoadReplies={() => void loadReplies(comment)}
          >
            {replyTo === comment.id && (
              <div className="mt-3 flex gap-2">
                <input
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) void submit(comment.id);
                  }}
                  maxLength={1000}
                  placeholder={t('回复 @{0}', { 0: comment.user.displayName })}
                  className="input"
                />
                <button
                  type="button"
                  onClick={() => void submit(comment.id)}
                  disabled={posting}
                  className="btn-primary shrink-0"
                >
                  {t('回复')}{' '}
                </button>
              </div>
            )}
            {comment.replies.map((reply) => (
              <CommentRow
                key={reply.id}
                comment={reply}
                compact
                uploaderId={uploaderId}
                isOwner={false}
                onLike={() => void toggleLike(reply, comment.id)}
              />
            ))}
          </CommentRow>
        ))}
        {nextCursor && (
          <button
            type="button"
            onClick={() => void load(nextCursor, true)}
            className="btn-ghost w-full"
          >
            {t('加载更多评论')}{' '}
          </button>
        )}
      </div>
    </section>
  );
}

function CommentRow({
  comment,
  compact = false,
  uploaderId,
  isOwner,
  onLike,
  onReply,
  onPin,
  onUpLike,
  onLoadReplies,
  children,
}: {
  comment: CommentItem;
  compact?: boolean;
  uploaderId: string;
  isOwner: boolean;
  onLike: () => void;
  onReply?: () => void;
  onPin?: () => void;
  onUpLike?: () => void;
  onLoadReplies?: () => void;
  children?: React.ReactNode;
}) {
  const t = useT();
  const locale = useLocale();
  const isUploader = comment.isUploader || comment.user.id === uploaderId;
  return (
    <div className={cn('flex gap-3', compact && 'mt-3 pl-10')}>
      <div
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-light font-semibold text-brand-dark',
          compact ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm',
        )}
      >
        {comment.user.avatarUrl ? (
          <img src={comment.user.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          comment.user.displayName.slice(0, 1).toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="font-medium text-ink">{comment.user.displayName}</span>
          {isUploader && (
            <span className="rounded bg-brand px-1.5 py-0.5 text-[10px] font-medium text-white">
              {t('UP 主')}
            </span>
          )}
          {comment.pinned && (
            <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
              <Pin className="h-2.5 w-2.5" />
              {t('置顶')}
            </span>
          )}
          {comment.status === 'pending' && (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
              {t('待审核，仅自己可见')}
            </span>
          )}
          <span>{relativeTime(comment.createdAt, locale)}</span>
          {comment.ipRegion && (
            <span>{t('IP 属地：{0}', { 0: regionLabel(comment.ipRegion, locale) })}</span>
          )}
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{comment.content}</p>
        {comment.upLiked && (
          <p className="mt-1 inline-flex items-center gap-1 rounded bg-brand-light px-1.5 py-0.5 text-[11px] text-brand-dark">
            <ThumbsUp className="h-3 w-3 fill-current" />
            {t('UP 主觉得很赞')}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-4 text-xs text-muted">
          <button
            type="button"
            onClick={onLike}
            className={cn(
              'inline-flex items-center gap-1 hover:text-brand',
              comment.liked && 'text-brand',
            )}
          >
            <Heart className={cn('h-3.5 w-3.5', comment.liked && 'fill-current')} />
            {formatCount(comment.likeCount, locale)}
          </button>
          {onReply && (
            <button
              type="button"
              onClick={onReply}
              className="inline-flex items-center gap-1 hover:text-brand"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {t('回复')}{' '}
            </button>
          )}
          {isOwner && !compact && onPin && (
            <button
              type="button"
              onClick={onPin}
              className={cn(
                'inline-flex items-center gap-1 hover:text-brand',
                comment.pinned && 'text-brand',
              )}
            >
              <Pin className="h-3.5 w-3.5" />
              {comment.pinned ? t('取消置顶') : t('置顶')}
            </button>
          )}
          {isOwner && !compact && onUpLike && (
            <button
              type="button"
              onClick={onUpLike}
              className={cn(
                'inline-flex items-center gap-1 hover:text-brand',
                comment.upLiked && 'text-brand',
              )}
            >
              <ThumbsUp className={cn('h-3.5 w-3.5', comment.upLiked && 'fill-current')} />
              {t('UP 主点赞')}
            </button>
          )}
          {!compact && comment.replyCount > comment.replies.length && onLoadReplies && (
            <button type="button" onClick={onLoadReplies} className="text-brand hover:underline">
              {t('查看全部 {0} 条回复', { 0: comment.replyCount })}
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
