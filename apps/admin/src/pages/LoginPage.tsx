import { GithubOutlined, GoogleOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Divider, Form, Input, Space, Typography, notification } from 'antd';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiError, api } from '../api';
import type { AuthUser } from '../types';

const { Title, Paragraph, Text } = Typography;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
    if (oauthError) setError(`第三方登录失败：${oauthError}`);
  }, [location.search, navigate]);

  const submit = async (values: { identifier: string; password: string; remember: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      await api.post('/api/v1/auth/login', values);
      navigate('/', { replace: true });
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : '登录失败';
      setError(message);
      notification.error({ message: '登录失败', description: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="install-brand" style={{ marginBottom: 8 }}>
          <span className="install-brand-mark">u</span>
          uiliuili
        </div>
        <Title level={3} style={{ marginTop: 16 }}>
          管理后台登录
        </Title>
        <Paragraph className="muted">使用安装时创建的超级管理员账号登录。</Paragraph>
        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={submit} initialValues={{ remember: true }}>
          <Form.Item
            label="用户名或邮箱"
            name="identifier"
            rules={[{ required: true, message: '请输入用户名或邮箱' }]}
          >
            <Input prefix={<UserOutlined />} autoComplete="username" size="large" />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
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
              记住我
            </label>
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={loading}>
            登录
          </Button>
        </Form>
        {providers.length > 0 && (
          <>
            <Divider plain>或使用第三方账号</Divider>
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
                  通用 OIDC
                </Button>
              )}
            </Space>
          </>
        )}
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Text type="secondary">
            <a href="/">返回站点首页</a>
          </Text>
        </div>
      </div>
    </div>
  );
}
