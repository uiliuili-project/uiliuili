'use client';

import { AuthShell } from '@/components/AuthShell';
import { api, ensureCsrf } from '@/lib/api';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function VerifyEmailPage() {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') ?? '');
    void ensureCsrf();
  }, []);

  const verify = async () => {
    setStatus('loading');
    try {
      await api.post('/api/v1/auth/email/verify', { token });
      setStatus('done');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : '验证失败');
    }
  };

  return (
    <AuthShell
      title="邮箱验证"
      subtitle="验证后即可使用完整功能"
      footer={
        <Link href="/" className="font-medium text-brand">
          返回首页
        </Link>
      }
    >
      {status === 'done' ? (
        <p className="rounded-lg bg-green-50 px-4 py-6 text-center text-sm text-green-700">
          邮箱验证成功。
        </p>
      ) : (
        <div className="space-y-4 text-center">
          {!token && <p className="text-sm text-red-500">链接无效或缺少验证令牌。</p>}
          {status === 'error' && <p className="text-sm text-red-500">{message}</p>}
          <button
            type="button"
            onClick={() => void verify()}
            disabled={!token || status === 'loading'}
            className="btn-primary w-full"
          >
            {status === 'loading' ? '验证中…' : '验证邮箱'}
          </button>
        </div>
      )}
    </AuthShell>
  );
}
