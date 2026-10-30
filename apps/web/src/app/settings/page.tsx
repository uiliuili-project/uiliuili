'use client';
import { useLocale, useT } from '@/components/I18nProvider';

import { api, removeCover, uploadCover } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { cropCover } from '@/lib/image';
import type { FollowGroup, FollowGroupsResponse, RegionContextInfo } from '@/lib/types';
import type { AuthUser, PublicUser, TagInterest } from '@uiliuili/shared';
import {
  BellRing,
  Globe2,
  ImageIcon,
  Monitor,
  Shield,
  ShieldOff,
  Sparkles,
  User,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

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
  const [tab, setTab] = useState<
    | 'profile'
    | 'region'
    | 'recommend'
    | 'security'
    | 'sessions'
    | 'groups'
    | 'blocked'
    | 'notifications'
  >('profile');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [groups, setGroups] = useState<FollowGroupsResponse | null>(null);
  const [groupName, setGroupName] = useState('');
  const [blocked, setBlocked] = useState<PublicUser[]>([]);
  const [notificationState, setNotificationState] = useState('');
  const [region, setRegion] = useState<RegionContextInfo | null>(null);
  const [showRestricted, setShowRestricted] = useState(false);
  const [savingPreference, setSavingPreference] = useState(false);
  const [interests, setInterests] = useState<TagInterest[]>([]);
  const [interestsLoading, setInterestsLoading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
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
        setShowRestricted(current.showRestricted);
        return api.get<{ sessions: SessionItem[] }>('/api/v1/auth/sessions');
      })
      .then((data) => setSessions(data.sessions))
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : t('加载失败')),
      )
      .finally(() => setLoading(false));
    void api
      .get<RegionContextInfo>('/api/v1/region/context')
      .then(setRegion)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (tab === 'groups') {
      void api
        .get<FollowGroupsResponse>('/api/v1/me/follow-groups')
        .then(setGroups)
        .catch((error) => setError(error instanceof Error ? error.message : t('加载失败')));
    }
    if (tab === 'blocked') {
      void api
        .get<{ items: PublicUser[] }>('/api/v1/me/blocked')
        .then((data) => setBlocked(data.items))
        .catch((error) => setError(error instanceof Error ? error.message : t('加载失败')));
    }
    if (tab === 'recommend') {
      setInterestsLoading(true);
      void api
        .get<{ items: TagInterest[] }>('/api/v1/me/tag-interests')
        .then((data) => setInterests(data.items))
        .catch((error) => setError(error instanceof Error ? error.message : t('加载失败')))
        .finally(() => setInterestsLoading(false));
    }
  }, [tab]);

  const createGroup = async () => {
    if (!groupName.trim()) return;
    try {
      await api.post('/api/v1/me/follow-groups', { name: groupName.trim() });
      setGroupName('');
      setGroups(await api.get<FollowGroupsResponse>('/api/v1/me/follow-groups'));
      setMessage(t('分组已创建'));
    } catch (error) {
      setError(error instanceof Error ? error.message : t('保存失败'));
    }
  };

  const removeGroup = async (group: FollowGroup) => {
    if (!window.confirm(t('确定删除分组「{0}」吗？', { 0: group.name }))) return;
    await api.delete(`/api/v1/me/follow-groups/${group.id}`).catch(() => undefined);
    setGroups(await api.get<FollowGroupsResponse>('/api/v1/me/follow-groups'));
  };

  const assignGroup = async (userId: string, groupId: string) => {
    try {
      await api.post(`/api/v1/me/following/${userId}/group`, {
        groupId: groupId || null,
      });
      setGroups(await api.get<FollowGroupsResponse>('/api/v1/me/follow-groups'));
      setMessage(t('分组已更新'));
    } catch (error) {
      setError(error instanceof Error ? error.message : t('保存失败'));
    }
  };

  const unblock = async (userId: string) => {
    await api.delete(`/api/v1/me/blocks/${userId}`).catch(() => undefined);
    setBlocked((current) => current.filter((item) => item.id !== userId));
  };

  const enableNotifications = async () => {
    setNotificationState('');
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setNotificationState(t('当前浏览器不支持通知'));
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setNotificationState(t('通知权限未开启'));
        return;
      }
      await navigator.serviceWorker.register('/sw.js');
      const registration = await navigator.serviceWorker.ready;
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (key) {
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        });
        const json = subscription.toJSON() as {
          endpoint?: string;
          keys?: { p256dh?: string; auth?: string };
        };
        if (json.endpoint && json.keys?.p256dh && json.keys.auth) {
          await api.post('/api/v1/me/push-subscriptions', {
            endpoint: json.endpoint,
            keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          });
        }
      }
      setNotificationState(t('通知已开启'));
    } catch (error) {
      setNotificationState(error instanceof Error ? error.message : t('操作失败'));
    }
  };

  const saveShowRestricted = async (next: boolean) => {
    setMessage('');
    setError('');
    setSavingPreference(true);
    try {
      const data = await api.patch<{ user: AuthUser }>('/api/v1/auth/preferences', {
        showRestricted: next,
      });
      setUser(data.user);
      setShowRestricted(data.user.showRestricted);
      setMessage(t('偏好已更新'));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('保存失败'));
      setShowRestricted(user?.showRestricted ?? false);
    } finally {
      setSavingPreference(false);
    }
  };

  const handleCover = async (file: File | undefined) => {
    if (!file) return;
    setMessage('');
    setError('');
    setCoverUploading(true);
    try {
      const cropped = await cropCover(file);
      const data = await uploadCover(cropped);
      setUser(data.user);
      setMessage(t('头图已更新'));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t('上传失败'));
    } finally {
      setCoverUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  const clearCover = async () => {
    setMessage('');
    setError('');
    setCoverUploading(true);
    try {
      const data = await removeCover();
      setUser(data.user);
      setMessage(t('头图已移除'));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t('操作失败'));
    } finally {
      setCoverUploading(false);
    }
  };

  const removeInterest = async (tagId: string) => {
    setMessage('');
    setError('');
    try {
      await api.delete(`/api/v1/me/tag-interests/${tagId}`);
      setInterests((current) => current.filter((item) => item.tagId !== tagId));
      setMessage(t('已移除该标签兴趣'));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('操作失败'));
    }
  };

  const clearInterests = async () => {
    if (!window.confirm(t('确定清空全部标签兴趣吗？推荐将重新从浏览记录学习。'))) return;
    setMessage('');
    setError('');
    try {
      await api.delete('/api/v1/me/tag-interests');
      setInterests([]);
      setMessage(t('标签兴趣已清空'));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('操作失败'));
    }
  };

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
            {
              key: 'region',
              // Restricted regions have nothing to configure, so the tab only
              // shows the region itself.
              label: t(region && !region.unrestricted ? '地区' : '地区与限制级内容'),
              icon: Globe2,
            },
            { key: 'recommend', label: t('推荐偏好'), icon: Sparkles },
            { key: 'security', label: t('账号安全'), icon: Shield },
            { key: 'sessions', label: t('登录设备'), icon: Monitor },
            { key: 'groups', label: t('关注分组'), icon: Users },
            { key: 'blocked', label: t('黑名单'), icon: ShieldOff },
            { key: 'notifications', label: t('通知'), icon: BellRing },
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
              <div className="rounded-xl border border-line p-4">
                <div className="text-sm font-medium">{t('空间头图')}</div>
                <p className="mt-1 text-xs text-muted">
                  {t('建议上传横向图片，会按 4:1 居中裁剪为 1920×480。')}
                </p>
                <div className="mt-3 aspect-[4/1] overflow-hidden rounded-lg bg-canvas">
                  {user.coverUrl ? (
                    <img src={user.coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => void handleCover(event.target.files?.[0])}
                  />
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={coverUploading}
                    className="btn-ghost h-9"
                  >
                    {coverUploading ? t('处理中…') : t('上传头图')}
                  </button>
                  {user.coverUrl && (
                    <button
                      type="button"
                      onClick={() => void clearCover()}
                      disabled={coverUploading}
                      className="btn-ghost h-9 text-red-500 hover:border-red-200 hover:text-red-600"
                    >
                      {t('移除头图')}
                    </button>
                  )}
                </div>
              </div>
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

          {tab === 'region' && (
            <div className="max-w-xl space-y-5">
              <div className="rounded-xl border border-line p-4">
                <div className="text-sm font-medium">{t('当前地区')}</div>
                <div className="mt-1 text-sm text-muted">
                  {region?.region.code
                    ? `${locale === 'en-US' ? region.region.nameEn : region.region.name}（${region.region.code}）`
                    : t('未记录')}
                </div>
                <p className="mt-2 text-xs text-muted">
                  {t('地区由系统根据 IP 和请求头自动判定，不能自行修改。如需更正请联系管理员。')}
                </p>
              </div>
              {(!region || region.unrestricted) && (
                <div className="rounded-xl border border-line p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium">{t('显示限制级内容')}</div>
                      <p className="mt-1 text-sm text-muted">
                        {t('开启后可以浏览和播放限制级内容，仅无限制地区可用。')}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 accent-[#fb7299]"
                      checked={showRestricted}
                      disabled={!region?.unrestricted || savingPreference}
                      onChange={(event) => void saveShowRestricted(event.target.checked)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'recommend' && (
            <div className="max-w-2xl space-y-5">
              <div className="rounded-xl border border-line p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium">{t('标签兴趣')}</div>
                    <p className="mt-1 text-sm text-muted">
                      {t(
                        '系统会根据最近的观看记录学习你的标签偏好，并用于首页推荐。你可以随时移除或清空。',
                      )}
                    </p>
                  </div>
                  {interests.length > 0 && (
                    <button
                      type="button"
                      onClick={() => void clearInterests()}
                      className="btn-ghost h-9 shrink-0 text-red-500 hover:border-red-200 hover:text-red-600"
                    >
                      {t('全部清空')}
                    </button>
                  )}
                </div>
                {interestsLoading ? (
                  <p className="mt-3 text-xs text-muted">{t('加载中…')}</p>
                ) : interests.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {interests.map((interest) => (
                      <span
                        key={interest.tagId}
                        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-3 py-1 text-xs"
                        title={t('兴趣分值 {0}', { 0: interest.score.toFixed(2) })}
                      >
                        <span className="font-medium">#{interest.name}</span>
                        <span className="text-muted">{interest.score.toFixed(1)}</span>
                        <button
                          type="button"
                          onClick={() => void removeInterest(interest.tagId)}
                          className="text-muted hover:text-red-500"
                          aria-label={t('移除')}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-xs text-muted">
                    {t('还没有学习到标签兴趣，观看一些视频后再来看看。')}
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-line p-4 text-xs text-muted">
                {t(
                  '标签兴趣只保存在服务端，不会显示在个人主页。清空后首页会暂时回到分区与热门推荐。',
                )}
              </div>
            </div>
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

          {tab === 'groups' && (
            <div className="max-w-2xl space-y-5">
              <div className="flex gap-2">
                <input
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  maxLength={20}
                  placeholder={t('分组名称')}
                  className="input max-w-xs"
                />
                <button
                  type="button"
                  onClick={() => void createGroup()}
                  disabled={!groupName.trim()}
                  className="btn-primary shrink-0"
                >
                  {t('新建分组')}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {groups?.groups.map((group) => (
                  <span key={group.id} className="chip">
                    {group.name}
                    <span className="ml-1 opacity-70">{group.count}</span>
                    <button
                      type="button"
                      onClick={() => void removeGroup(group)}
                      className="ml-1 text-muted hover:text-red-500"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {groups && groups.groups.length === 0 && (
                  <p className="text-sm text-muted">{t('还没有关注分组')}</p>
                )}
              </div>
              <div className="space-y-2">
                {groups?.items.map((item) => (
                  <div
                    key={item.user.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3"
                  >
                    <Link
                      href={`/space/${item.user.username}`}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-brand-light text-xs font-semibold text-brand-dark">
                        {item.user.avatarUrl ? (
                          <img
                            src={item.user.avatarUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          item.user.displayName.slice(0, 1).toUpperCase()
                        )}
                      </span>
                      {item.user.displayName}
                    </Link>
                    <select
                      value={item.groupId ?? ''}
                      onChange={(event) => void assignGroup(item.user.id, event.target.value)}
                      className="input h-9 w-44"
                    >
                      <option value="">{t('默认分组')}</option>
                      {groups.groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                {groups && groups.items.length === 0 && (
                  <p className="text-sm text-muted">{t('还没有关注任何人')}</p>
                )}
              </div>
            </div>
          )}

          {tab === 'blocked' && (
            <div className="max-w-2xl space-y-2">
              {blocked.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line p-3"
                >
                  <Link
                    href={`/space/${item.username}`}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-brand-light text-xs font-semibold text-brand-dark">
                      {item.avatarUrl ? (
                        <img src={item.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        item.displayName.slice(0, 1).toUpperCase()
                      )}
                    </span>
                    {item.displayName}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void unblock(item.id)}
                    className="btn-ghost h-9 text-red-500 hover:border-red-200 hover:text-red-600"
                  >
                    {t('解除屏蔽')}
                  </button>
                </div>
              ))}
              {blocked.length === 0 && <p className="text-sm text-muted">{t('黑名单是空的')}</p>}
            </div>
          )}

          {tab === 'notifications' && (
            <div className="max-w-xl space-y-4">
              <div className="rounded-xl border border-line p-4">
                <div className="text-sm font-medium">{t('浏览器通知')}</div>
                <p className="mt-1 text-sm text-muted">
                  {t('开启后可以在浏览器收到回复、关注和系统通知。')}
                </p>
                <button
                  type="button"
                  onClick={() => void enableNotifications()}
                  className="btn-primary mt-3"
                >
                  <BellRing className="h-4 w-4" />
                  {t('开启通知')}
                </button>
                {notificationState && (
                  <p className="mt-2 text-xs text-muted">{notificationState}</p>
                )}
              </div>
              <div className="rounded-xl border border-line p-4 text-sm text-muted">
                {t('推送订阅保存在服务端，未配置 VAPID 密钥时仅开启本地通知权限。')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return output;
}
