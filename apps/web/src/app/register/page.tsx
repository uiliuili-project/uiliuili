'use client';
import { useT } from '@/components/I18nProvider';

import { AuthShell } from '@/components/AuthShell';
import { api, ensureCsrf, getMe } from '@/lib/api';
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

  useEffect(() => {
    void ensureCsrf();
    void getMe().then((user) => {
      if (user) router.replace('/');
    });
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
      await api.post<{ user: AuthUser }>('/api/v1/auth/register', { username, email, password });
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
      title={t('创建账号')}
      subtitle={t('加入 uiliuili，开始分享你的视频')}
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
