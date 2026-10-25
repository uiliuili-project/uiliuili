import {
  AppstoreOutlined,
  AuditOutlined,
  BellOutlined,
  CommentOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  FlagOutlined,
  LogoutOutlined,
  MessageOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Dropdown, Layout, Menu, Result, Space, Spin, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { canAccessAdmin } from '../access';
import { api } from '../api';
import { AdminLanguageSwitcher, useT } from '../i18n';
import type { AuthUser } from '../types';
import { useSiteBrand } from '../useSiteBrand';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

export function AdminLayout() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const brand = useSiteBrand();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    api
      .get<{ user: AuthUser }>('/api/v1/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => navigate('/login', { replace: true }))
      .finally(() => setLoading(false));
  }, [navigate]);

  const logout = async () => {
    await api.post('/api/v1/auth/logout').catch(() => undefined);
    navigate('/login', { replace: true });
  };

  if (loading) {
    return (
      <div className="login-shell">
        <Spin size="large" />
      </div>
    );
  }

  if (!canAccessAdmin(user)) {
    return (
      <div className="login-shell">
        <Result
          status="403"
          title={t('无权限访问管理后台')}
          subTitle={t('请使用管理员账号登录。普通用户请前往创作中心。')}
          extra={[
            <Button
              key="studio"
              type="primary"
              onClick={() => {
                window.location.href = '/studio';
              }}
            >
              {t('前往创作中心')}
            </Button>,
            <Button
              key="site"
              onClick={() => {
                window.location.href = '/';
              }}
            >
              {t('返回站点首页')}
            </Button>,
          ]}
        />
      </div>
    );
  }

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: t('admin.dashboard') },
    { key: '/users', icon: <TeamOutlined />, label: t('admin.users') },
    { key: '/videos', icon: <PlayCircleOutlined />, label: t('admin.videos') },
    { key: '/danmaku', icon: <MessageOutlined />, label: t('admin.danmaku') },
    { key: '/comments', icon: <CommentOutlined />, label: t('admin.comments') },
    { key: '/reports', icon: <FlagOutlined />, label: t('admin.reports') },
    { key: '/categories', icon: <AppstoreOutlined />, label: t('admin.categories') },
    { key: '/announcements', icon: <BellOutlined />, label: t('admin.announcements') },
    { key: '/settings', icon: <SettingOutlined />, label: t('admin.settings') },
    { key: '/system', icon: <DatabaseOutlined />, label: t('admin.system') },
    { key: '/audit', icon: <AuditOutlined />, label: t('admin.audit') },
  ];

  return (
    <Layout className="admin-layout">
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} width={220}>
        <div className="admin-logo">
          {brand.logoUrl ? (
            <img src={brand.logoUrl} alt={brand.name} className="admin-logo-image" />
          ) : (
            <span className="install-brand-mark">u</span>
          )}
          {!collapsed && <span>{brand.name}</span>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname === '/' ? '/' : `/${location.pathname.split('/')[1]}`]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <Text strong>{t('admin.console')}</Text>
          <Space size="large">
            <AdminLanguageSwitcher />
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'studio',
                    icon: <AppstoreOutlined />,
                    label: t('前往创作中心'),
                    onClick: () => {
                      window.location.href = '/studio';
                    },
                  },
                  {
                    key: 'site',
                    icon: <FileTextOutlined />,
                    label: t('admin.visitSite'),
                    onClick: () => window.open('/', '_blank'),
                  },
                  {
                    key: 'logout',
                    icon: <LogoutOutlined />,
                    label: t('common.logout'),
                    onClick: logout,
                  },
                ],
              }}
            >
              <Space style={{ cursor: 'pointer' }}>
                <Avatar src={user?.avatarUrl} icon={<UserOutlined />} />
                <span>{user?.displayName || user?.username}</span>
                {user?.roles.includes('SUPER_ADMIN') ? (
                  <Tag color="magenta">{t('admin.superAdmin')}</Tag>
                ) : (
                  user?.group === 'ADMIN' && <Tag color="magenta">{t('管理员')}</Tag>
                )}
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content className="admin-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
