'use client';
import { useT } from '@/components/I18nProvider';

import { AuthShell } from '@/components/AuthShell';
import { api, ensureCsrf, getMe } from '@/lib/api';
import type { RegionContextInfo } from '@/lib/types';
import type { AuthUser } from '@uiliuili/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function RegisterPage() {
  const t = useT();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [claimToken, setClaimToken] = useState('');
  const [region, setRegion] = useState<RegionContextInfo | null>(null);
  const [setup, setSetup] = useState<{ needsOwner: boolean; claimRequired: boolean } | null>(null);

  useEffect(() => {
    void ensureCsrf();
    void getMe().then((user) => {
      if (user) router.replace('/');
    });
    void api
      .get<{ needsOwner: boolean; claimRequired: boolean }>('/api/v1/auth/setup-status')
      .then(setSetup)
      .catch(() => undefined);
    void api
      .get<RegionContextInfo>('/api/v1/region/context')
      .then(setRegion)
      .catch(() => undefined);
  }, [router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      setError(t('两次输入的密码不一致'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await api.post<{ user: AuthUser }>('/api/v1/auth/register', {
        username,
        email,
        password,
        claimToken: claimToken || undefined,
      });
      if (result.user.group === 'OWNER') {
        window.location.href = '/admin/';
        return;
      }
      router.push('/');
      router.refresh();
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : t('注册失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={setup?.needsOwner ? t('创建站长账号') : t('创建账号')}
      subtitle={
        setup?.needsOwner
          ? t('这是本站的第一个账号，注册后将自动成为站长并拥有全部管理权限。')
          : t('加入 uiliuili，开始分享你的视频')
      }
      footer={
        <>
          {t('已经有账号？')}{' '}
          <Link href="/login" className="font-medium text-brand">
            {t('去登录')}{' '}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {setup?.needsOwner && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {t('站点尚未设置站长。请先完成注册，再开放站点访问；该账号将成为站长。')}
          </div>
        )}
        {region?.region.code && (
          <div className="rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-muted">
            <div className="font-medium text-ink">
              {t('注册地区：{0}（{1}）', {
                0: region.region.name,
                1: region.region.code,
              })}
            </div>
            <p className="mt-1">{t('地区由系统根据 IP 和请求头自动判定，注册后不能自行修改。')}</p>
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}
        <div>
          <label className="label" htmlFor="username">
            {t('用户名')}{' '}
          </label>
          <input
            id="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="input"
            autoComplete="username"
            minLength={3}
            maxLength={32}
            required
          />
          <p className="mt-1 text-xs text-muted">
            {t('3–32 个字符，只能包含字母、数字、下划线和短横线')}
          </p>
        </div>
        <div>
          <label className="label" htmlFor="email">
            {t('邮箱')}{' '}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="input"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            {t('密码')}{' '}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="input"
            autoComplete="new-password"
            minLength={10}
            required
          />
          <p className="mt-1 text-xs text-muted">{t('至少 10 个字符，并包含字母和数字')}</p>
        </div>
        {setup?.claimRequired && (
          <div>
            <label className="label" htmlFor="claimToken">
              {t('站长认领码')}{' '}
            </label>
            <input
              id="claimToken"
              value={claimToken}
              onChange={(event) => setClaimToken(event.target.value)}
              className="input"
              autoComplete="off"
              required
            />
            <p className="mt-1 text-xs text-muted">
              {t('安装完成时显示的一次性认领码；仅从非本机地址注册时需要。')}
            </p>
          </div>
        )}
        <div>
          <label className="label" htmlFor="confirm">
            {t('确认密码')}{' '}
          </label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className="input"
            autoComplete="new-password"
            required
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? t('创建中…') : t('创建账号')}
        </button>
      </form>
    </AuthShell>
  );
}
