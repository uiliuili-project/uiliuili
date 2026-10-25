'use client';
import { useLocale, useT } from '@/components/I18nProvider';

import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import type { AuthUser } from '@uiliuili/shared';
import { Monitor, Shield, User } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface SessionItem {
  id: string;
  userAgent: string;
  ipHash: string;
  createdAt: string;
  expiresAt: string;
}

export default function SettingsPage() {
  const t = useT();
  const locale = useLocale();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [tab, setTab] = useState<'profile' | 'security' | 'sessions'>('profile');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ user: AuthUser }>('/api/v1/auth/me')
      .then(({ user: current }) => {
        setUser(current);
        setDisplayName(current.displayName);
        setBio(current.bio ?? '');
        setAvatarUrl(current.avatarUrl ?? '');
        return api.get<{ sessions: SessionItem[] }>('/api/v1/auth/sessions');
      })
      .then((data) => setSessions(data.sessions))
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : t('加载失败')),
      )
      .finally(() => setLoading(false));
  }, []);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      const data = await api.patch<{ user: AuthUser }>('/api/v1/auth/profile', {
        displayName,
        bio,
        avatarUrl,
      });
      setUser(data.user);
      setMessage(t('资料已更新'));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('保存失败'));
    }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      await api.post('/api/v1/auth/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setMessage(t('密码已修改，其他设备需要重新登录'));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('修改失败'));
    }
  };

  const revoke = async (id: string) => {
    await api.delete(`/api/v1/auth/sessions/${id}`);
    setSessions((current) => current.filter((session) => session.id !== id));
  };

  const resend = async () => {
    try {
      await api.post('/api/v1/auth/email/resend');
      setMessage(t('验证邮件已发送'));
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : t('发送失败'));
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
            {t('去登录')}{' '}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-6">
      <h1 className="mb-5 text-xl font-semibold">{t('账号设置')}</h1>
      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="card h-fit p-2">
          {[
            { key: 'profile', label: t('个人资料'), icon: User },
            { key: 'security', label: t('账号安全'), icon: Shield },
            { key: 'sessions', label: t('登录设备'), icon: Monitor },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key as typeof tab)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition',
                tab === item.key ? 'bg-brand-light text-brand-dark' : 'hover:bg-canvas',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </aside>

        <div className="card p-6">
          {(message || error) && (
            <div
              className={cn(
                'mb-4 rounded-lg px-3 py-2 text-sm',
                error ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700',
              )}
            >
              {error || message}
            </div>
          )}
          {tab === 'profile' && (
            <form onSubmit={saveProfile} className="max-w-xl space-y-4">
              <div>
                <label className="label" htmlFor="displayName">
                  {t('昵称')}{' '}
                </label>
                <input
                  id="displayName"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={40}
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="avatar">
                  {t('头像 URL')}{' '}
                </label>
                <input
                  id="avatar"
                  value={avatarUrl}
                  onChange={(event) => setAvatarUrl(event.target.value)}
                  className="input"
                  placeholder="https://…"
                />
              </div>
              <div>
                <label className="label" htmlFor="bio">
                  {t('个人简介')}{' '}
                </label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  maxLength={500}
                  rows={4}
                  className="input resize-none"
                />
              </div>
              <button type="submit" className="btn-primary">
                {t('保存资料')}{' '}
              </button>
            </form>
          )}

          {tab === 'security' && (
            <div className="max-w-xl space-y-6">
              <div className="rounded-xl border border-line p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium">{t('邮箱')}</div>
                    <div className="mt-0.5 text-sm text-muted">{user.email}</div>
                  </div>
                  {user.emailVerified ? (
                    <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs text-green-700">
                      {t('已验证')}{' '}
                    </span>
                  ) : (
                    <button type="button" onClick={() => void resend()} className="btn-ghost">
                      {t('发送验证邮件')}{' '}
                    </button>
                  )}
                </div>
              </div>
              <form onSubmit={changePassword} className="space-y-4">
                <div>
                  <label className="label" htmlFor="currentPassword">
                    {t('当前密码')}{' '}
                  </label>
                  <input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className="input"
                    autoComplete="current-password"
                  />
                  <p className="mt-1 text-xs text-muted">
                    {t('第三方登录账号如果还没有密码，可以留空当前密码。')}{' '}
                  </p>
                </div>
                <div>
                  <label className="label" htmlFor="newPassword">
                    {t('新密码')}{' '}
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="input"
                    minLength={10}
                    required
                  />
                </div>
                <button type="submit" className="btn-primary">
                  {t('修改密码')}{' '}
                </button>
              </form>
            </div>
          )}

          {tab === 'sessions' && (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {session.userAgent || t('未知设备')}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {t('登录于')} {formatDate(session.createdAt, locale)} {t('· 过期')}{' '}
                      {formatDate(session.expiresAt, locale)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void revoke(session.id)}
                    className="btn-ghost text-red-500 hover:border-red-200 hover:text-red-600"
                  >
                    {t('退出')}{' '}
                  </button>
                </div>
              ))}
              {sessions.length === 0 && <p className="text-sm text-muted">{t('暂无登录设备')}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
