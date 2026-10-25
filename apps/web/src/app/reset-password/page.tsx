'use client';
import { useT } from '@/components/I18nProvider';

import { AuthShell } from '@/components/AuthShell';
import { api, ensureCsrf } from '@/lib/api';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function ResetPasswordPage() {
  const t = useT();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') ?? '');
    void ensureCsrf();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      setError(t('两次输入的密码不一致'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/api/v1/auth/password/reset', { token, password });
      setDone(true);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : t('重置失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={t('重置密码')}
      subtitle={t('设置一个新的密码')}
      footer={
        <Link href="/login" className="font-medium text-brand">
          {t('返回登录')}{' '}
        </Link>
      }
    >
      {done ? (
        <div className="space-y-4 text-center">
          <p className="rounded-lg bg-green-50 px-4 py-6 text-sm text-green-700">
            {t('密码已重置，请使用新密码登录。')}{' '}
          </p>
          <Link href="/login" className="btn-primary w-full">
            {t('去登录')}{' '}
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          {!token && <p className="text-sm text-red-500">{t('链接无效，请重新发起找回密码。')}</p>}
          <div>
            <label className="label" htmlFor="password">
              {t('新密码')}{' '}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input"
              minLength={10}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="confirm">
              {t('确认新密码')}{' '}
            </label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className="input"
              required
            />
          </div>
          <button type="submit" disabled={loading || !token} className="btn-primary w-full">
            {loading ? t('提交中…') : t('重置密码')}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
