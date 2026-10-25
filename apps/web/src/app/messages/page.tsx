'use client';
import { useLocale, useT } from '@/components/I18nProvider';

import { api, getMe } from '@/lib/api';
import { cn } from '@/lib/cn';
import { relativeTime } from '@/lib/format';
import type { AuthUser, ConversationItem, DirectMessageItem } from '@uiliuili/shared';
import { MessageSquare, RefreshCw, Send } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function MessagesPage() {
  const t = useT();
  const locale = useLocale();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessageItem[]>([]);
  const [text, setText] = useState('');
  const [newUser, setNewUser] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadConversations = async () => {
    const data = await api.get<{ items: ConversationItem[] }>('/api/v1/messages/conversations');
    setConversations(data.items);
    if (!activeId && data.items[0]) setActiveId(data.items[0].id);
  };

  const loadMessages = async (id: string) => {
    const data = await api.get<{ items: DirectMessageItem[] }>(
      `/api/v1/messages/conversations/${id}`,
    );
    setMessages(data.items);
    setConversations((current) =>
      current.map((item) => (item.id === id ? { ...item, unread: 0 } : item)),
    );
  };

  useEffect(() => {
    void getMe()
      .then(async (current) => {
        setUser(current);
        if (current) await loadConversations();
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : t('加载失败')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeId) void loadMessages(activeId).catch(() => undefined);
  }, [activeId]);

  const send = async () => {
    if (!activeId || !text.trim()) return;
    setSending(true);
    setMessage('');
    try {
      await api.post(`/api/v1/messages/conversations/${activeId}`, {
        content: text.trim(),
      });
      setText('');
      await loadMessages(activeId);
      await loadConversations();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('发送失败'));
    } finally {
      setSending(false);
    }
  };

  const startConversation = async () => {
    if (!newUser.trim() || !text.trim()) return;
    setSending(true);
    setMessage('');
    try {
      const profile = await api.get<{ user: { id: string } }>(
        `/api/v1/users/${encodeURIComponent(newUser.trim())}`,
      );
      const data = await api.post<{ conversationId: string }>('/api/v1/messages', {
        recipientId: profile.user.id,
        content: text.trim(),
      });
      setText('');
      setNewUser('');
      await loadConversations();
      setActiveId(data.conversationId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('发送失败'));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="container-page py-16 text-sm text-muted">{t('加载中…')}</div>;
  }

  if (!user) {
    return (
      <div className="container-page py-16">
        <div className="card mx-auto max-w-md p-10 text-center">
          <h1 className="text-xl font-semibold">{t('请先登录')}</h1>
          <Link href="/login" className="btn-primary mt-6">
            {t('去登录')}
          </Link>
        </div>
      </div>
    );
  }

  const active = conversations.find((item) => item.id === activeId) ?? null;

  return (
    <div className="container-page py-6">
      <h1 className="mb-4 flex items-center gap-2 text-xl font-semibold">
        <MessageSquare className="h-5 w-5 text-brand" />
        {t('私信')}
      </h1>
      {message && <p className="mb-3 text-xs text-red-500">{message}</p>}
      <div className="grid min-h-[520px] gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="card flex flex-col overflow-hidden p-2">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-sm font-semibold">{t('会话')}</span>
            <button
              type="button"
              onClick={() => void loadConversations()}
              className="text-muted hover:text-brand"
              title={t('刷新')}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto">
            {conversations.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveId(item.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg p-2 text-left transition',
                  activeId === item.id ? 'bg-brand-light' : 'hover:bg-canvas',
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-canvas text-xs font-semibold text-brand">
                  {item.user.avatarUrl ? (
                    <img src={item.user.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    item.user.displayName.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{item.user.displayName}</span>
                    {item.unread > 0 && (
                      <span className="rounded-full bg-brand px-1.5 text-[10px] text-white">
                        {item.unread}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted">{item.lastMessage}</span>
                </span>
              </button>
            ))}
            {conversations.length === 0 && (
              <p className="p-3 text-xs text-muted">{t('还没有会话')}</p>
            )}
          </div>
        </aside>

        <section className="card flex min-h-[520px] flex-col overflow-hidden">
          {active ? (
            <>
              <div className="border-b border-line p-3">
                <Link
                  href={`/space/${active.user.username}`}
                  className="text-sm font-semibold hover:text-brand"
                >
                  {active.user.displayName}
                </Link>
                <span className="ml-2 text-xs text-muted">@{active.user.username}</span>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.map((item) => (
                  <div
                    key={item.id}
                    className={cn('flex', item.mine ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[75%] rounded-2xl px-3 py-2 text-sm',
                        item.mine ? 'bg-brand text-white' : 'bg-canvas text-ink',
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{item.content}</p>
                      <p
                        className={cn(
                          'mt-1 text-[10px]',
                          item.mine ? 'text-white/70' : 'text-muted',
                        )}
                      >
                        {relativeTime(item.createdAt, locale)}
                      </p>
                    </div>
                  </div>
                ))}
                {messages.length === 0 && (
                  <p className="py-10 text-center text-xs text-muted">{t('还没有消息')}</p>
                )}
              </div>
              <div className="flex gap-2 border-t border-line p-3">
                <input
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void send();
                  }}
                  placeholder={t('输入私信内容')}
                  className="input"
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={sending || !text.trim()}
                  className="btn-primary shrink-0"
                >
                  <Send className="h-4 w-4" />
                  {t('发送')}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
              <p className="text-sm text-muted">{t('选择会话，或给某人发第一条私信')}</p>
              <div className="w-full max-w-md space-y-2">
                <input
                  value={newUser}
                  onChange={(event) => setNewUser(event.target.value)}
                  placeholder={t('对方用户名')}
                  className="input"
                />
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  rows={3}
                  placeholder={t('输入私信内容')}
                  className="input resize-none"
                />
                <button
                  type="button"
                  onClick={() => void startConversation()}
                  disabled={sending || !newUser.trim() || !text.trim()}
                  className="btn-primary w-full"
                >
                  {t('发送')}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
