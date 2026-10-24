'use client';

import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatCount, relativeTime } from '@/lib/format';
import type { CommentItem } from '@uiliuili/shared';
import { Heart, MessageCircle, Send } from 'lucide-react';
import { useEffect, useState } from 'react';

interface CommentResponse {
  items: CommentItem[];
  nextCursor: string | null;
}

export function CommentSection({ videoId }: { videoId: string }) {
  const [items, setItems] = useState<CommentItem[]>([]);
  const [sort, setSort] = useState<'hot' | 'new'>('hot');
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [posting, setPosting] = useState(false);

  const load = async (cursor?: string, append = false) => {
    setLoading(true);
    try {
      const data = await api.get<CommentResponse>(
        `/api/v1/videos/${videoId}/comments?sort=${sort}&limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      );
      setItems((current) => (append ? [...current, ...data.items] : data.items));
      setNextCursor(data.nextCursor);
    } catch {
      setMessage('评论加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [videoId, sort]);

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
      setMessage(error instanceof Error ? error.message : '发布失败');
    } finally {
      setPosting(false);
    }
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
      setMessage(error instanceof Error ? error.message : '操作失败');
    }
  };

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">评论</h2>
        <div className="flex gap-1 rounded-lg bg-canvas p-1 text-xs">
          <button
            type="button"
            onClick={() => setSort('hot')}
            className={cn('rounded-md px-3 py-1.5', sort === 'hot' && 'bg-white shadow-sm')}
          >
            热门
          </button>
          <button
            type="button"
            onClick={() => setSort('new')}
            className={cn('rounded-md px-3 py-1.5', sort === 'new' && 'bg-white shadow-sm')}
          >
            最新
          </button>
        </div>
      </div>

      <div className="card p-4">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="发一条友善的评论…"
          className="input resize-none"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted">{text.length}/1000</span>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={posting || !text.trim()}
            className="btn-primary"
          >
            <Send className="h-4 w-4" />
            发布
          </button>
        </div>
        {message && <p className="mt-2 text-xs text-red-500">{message}</p>}
      </div>

      <div className="mt-5 space-y-5">
        {loading && items.length === 0 && <p className="text-sm text-muted">评论加载中…</p>}
        {!loading && items.length === 0 && (
          <div className="rounded-xl border border-dashed border-line bg-white/60 py-10 text-center text-sm text-muted">
            还没有评论，来抢沙发吧
          </div>
        )}
        {items.map((comment) => (
          <CommentRow
            key={comment.id}
            comment={comment}
            onLike={() => void toggleLike(comment)}
            onReply={() => {
              setReplyTo(comment.id);
              setReplyText('');
            }}
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
                  placeholder={`回复 @${comment.user.displayName}`}
                  className="input"
                />
                <button
                  type="button"
                  onClick={() => void submit(comment.id)}
                  disabled={posting}
                  className="btn-primary shrink-0"
                >
                  回复
                </button>
              </div>
            )}
            {comment.replies.map((reply) => (
              <CommentRow
                key={reply.id}
                comment={reply}
                compact
                onLike={() => void toggleLike(reply, comment.id)}
              />
            ))}
            {comment.replyCount > comment.replies.length && (
              <p className="mt-2 text-xs text-muted">
                还有 {comment.replyCount - comment.replies.length} 条回复
              </p>
            )}
          </CommentRow>
        ))}
        {nextCursor && (
          <button
            type="button"
            onClick={() => void load(nextCursor, true)}
            className="btn-ghost w-full"
          >
            加载更多评论
          </button>
        )}
      </div>
    </section>
  );
}

function CommentRow({
  comment,
  compact = false,
  onLike,
  onReply,
  children,
}: {
  comment: CommentItem;
  compact?: boolean;
  onLike: () => void;
  onReply?: () => void;
  children?: React.ReactNode;
}) {
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
          <span>{relativeTime(comment.createdAt)}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{comment.content}</p>
        <div className="mt-1.5 flex items-center gap-4 text-xs text-muted">
          <button
            type="button"
            onClick={onLike}
            className={cn(
              'inline-flex items-center gap-1 hover:text-brand',
              comment.liked && 'text-brand',
            )}
          >
            <Heart className={cn('h-3.5 w-3.5', comment.liked && 'fill-current')} />
            {formatCount(comment.likeCount)}
          </button>
          {onReply && (
            <button
              type="button"
              onClick={onReply}
              className="inline-flex items-center gap-1 hover:text-brand"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              回复
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
