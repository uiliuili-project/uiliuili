'use client';

import { AuthShell } from '@/components/AuthShell';
import { api, ensureCsrf, getMe } from '@/lib/api';
import type { AuthUser } from '@uiliuili/shared';
import { Github, Lock, Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [providers, setProviders] = useState<string[]>([]);

  useEffect(() => {
    void ensureCsrf();
    void getMe().then((user) => {
      if (user) router.replace('/');
    });
    void api
      .get<{ providers: string[] }>('/api/v1/auth/providers')
      .then((data) => setProviders(data.providers))
      .catch(() => undefined);
    const oauthError = new URLSearchParams(window.location.search).get('oauth_error');
    if (oauthError) setError(`第三方登录失败：${oauthError}`);
  }, [router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post<{ user: AuthUser }>('/api/v1/auth/login', {
        identifier,
        password,
        remember,
      });
      router.push('/');
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="登录 uiliuili"
      subtitle="继续观看、发弹幕、收藏和关注"
      footer={
        <>
          还没有账号？{' '}
          <Link href="/register" className="font-medium text-brand">
            立即注册
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
          <label className="label" htmlFor="identifier">
            用户名或邮箱
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              id="identifier"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className="input pl-9"
              autoComplete="username"
              required
            />
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="label mb-0" htmlFor="password">
              密码
            </label>
            <Link href="/forgot-password" className="text-xs text-muted hover:text-brand">
              忘记密码？
            </Link>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input pl-9"
              autoComplete="current-password"
              required
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className="h-4 w-4 accent-[#fb7299]"
          />
          记住我
        </label>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? '登录中…' : '登录'}
        </button>
      </form>

      {providers.length > 0 && (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" />
            或使用第三方账号
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="space-y-2">
            {providers.includes('github') && (
              <a href="/api/v1/auth/oauth/github" className="btn-ghost w-full">
                <Github className="h-4 w-4" />
                GitHub
              </a>
            )}
            {providers.includes('google') && (
              <a href="/api/v1/auth/oauth/google" className="btn-ghost w-full">
                Google
              </a>
            )}
            {providers.includes('oidc') && (
              <a href="/api/v1/auth/oauth/oidc" className="btn-ghost w-full">
                通用 OIDC
              </a>
            )}
          </div>
        </>
      )}
    </AuthShell>
  );
}
