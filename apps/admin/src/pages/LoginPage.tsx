import { GithubOutlined, GoogleOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Divider, Form, Input, Space, Typography, notification } from 'antd';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiError, api } from '../api';
import { AdminLanguageSwitcher, useT } from '../i18n';
import type { AuthUser } from '../types';

const { Title, Paragraph, Text } = Typography;

export function LoginPage() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .get<{ installed: boolean }>('/api/install/status')
      .then((status) => {
        if (!status.installed) navigate('/install', { replace: true });
      })
      .catch(() => undefined);
    void api.get<{ token: string }>('/api/v1/auth/csrf').catch(() => undefined);
    void api
      .get<{ providers: string[] }>('/api/v1/auth/providers')
      .then((data) => setProviders(data.providers))
      .catch(() => undefined);
    void api
      .get<{ user: AuthUser }>('/api/v1/auth/me')
      .then(() => navigate('/', { replace: true }))
      .catch(() => undefined);
    const params = new URLSearchParams(location.search);
    const oauthError = params.get('oauth_error');
    if (oauthError) setError(t('第三方登录失败：{0}', { 0: oauthError }));
  }, [location.search, navigate]);

  const submit = async (values: { identifier: string; password: string; remember: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      await api.post('/api/v1/auth/login', values);
      navigate('/', { replace: true });
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : t('登录失败');
      setError(message);
      notification.error({ message: t('登录失败'), description: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 8,
          }}
        >
          <div className="install-brand">
            <span className="install-brand-mark">u</span>
            uiliuili
          </div>
          <AdminLanguageSwitcher />
        </div>
        <Title level={3} style={{ marginTop: 16 }}>
          {t('管理后台登录')}{' '}
        </Title>
        <Paragraph className="muted">{t('使用安装时创建的超级管理员账号登录。')}</Paragraph>
        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={submit} initialValues={{ remember: true }}>
          <Form.Item
            label={t('用户名或邮箱')}
            name="identifier"
            rules={[{ required: true, message: t('请输入用户名或邮箱') }]}
          >
            <Input prefix={<UserOutlined />} autoComplete="username" size="large" />
          </Form.Item>
          <Form.Item
            label={t('密码')}
            name="password"
            rules={[{ required: true, message: t('请输入密码') }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              autoComplete="current-password"
              size="large"
            />
          </Form.Item>
          <Form.Item name="remember" valuePropName="checked">
            <label>
              <input type="checkbox" style={{ marginRight: 8 }} />
              {t('记住我')}{' '}
            </label>
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={loading}>
            {t('登录')}{' '}
          </Button>
        </Form>
        {providers.length > 0 && (
          <>
            <Divider plain>{t('或使用第三方账号')}</Divider>
            <Space direction="vertical" className="w-full">
              {providers.includes('github') && (
                <Button
                  block
                  size="large"
                  icon={<GithubOutlined />}
                  href="/api/v1/auth/oauth/github"
                >
                  GitHub
                </Button>
              )}
              {providers.includes('google') && (
                <Button
                  block
                  size="large"
                  icon={<GoogleOutlined />}
                  href="/api/v1/auth/oauth/google"
                >
                  Google
                </Button>
              )}
              {providers.includes('oidc') && (
                <Button block size="large" href="/api/v1/auth/oauth/oidc">
                  {t('通用 OIDC')}{' '}
                </Button>
              )}
            </Space>
          </>
        )}
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Text type="secondary">
            <a href="/">{t('返回站点首页')}</a>
          </Text>
        </div>
      </div>
    </div>
  );
}
