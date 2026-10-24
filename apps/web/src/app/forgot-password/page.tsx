'use client';

import { AuthShell } from '@/components/AuthShell';
import { api, ensureCsrf } from '@/lib/api';
import Link from 'next/link';
import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await ensureCsrf();
      await api.post('/api/v1/auth/password/forgot', { email });
      setSent(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '发送失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="找回密码"
      subtitle="输入注册邮箱，我们会发送重置链接"
      footer={
        <Link href="/login" className="font-medium text-brand">
          返回登录
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-lg bg-green-50 px-4 py-6 text-center text-sm text-green-700">
          如果该邮箱存在，重置链接已发送，请查收邮件。
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div>
            <label className="label" htmlFor="email">
              邮箱
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? '发送中…' : '发送重置链接'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
