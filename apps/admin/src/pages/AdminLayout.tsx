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
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Dropdown, Layout, Menu, Result, Space, Spin, Tag, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { canAccessAdmin, consoleHome } from '../access';
import { api } from '../api';
import { AdminLanguageSwitcher, useT } from '../i18n';
import { can, canAny } from '../permissions';
import type { AuthUser } from '../types';
import { useSiteBrand } from '../useSiteBrand';
import { AdminUserContext } from '../user-context';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

interface MenuEntry {
  key: string;
  icon: React.ReactNode;
  label: string;
  permission?: string;
  anyOf?: string[];
}

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

  useEffect(() => {
    if (!user) return;
    // Ordinary accounts have no console at all; send them to the studio rather
    // than rendering an administrator shell they cannot use.
    if (!canAccessAdmin(user)) {
      window.location.replace('/studio');
      return;
    }
    if (location.pathname === '/' && !can(user, 'audit:read')) {
      navigate(consoleHome(user), { replace: true });
    }
  }, [location.pathname, navigate, user]);

  const logout = async () => {
    await api.post('/api/v1/auth/logout').catch(() => undefined);
    navigate('/login', { replace: true });
  };

  const menuItems = useMemo(
    () =>
      (
        [
          {
            key: '/review',
            icon: <SafetyCertificateOutlined />,
            label: t('admin.review'),
            anyOf: ['video:review', 'comment:manage', 'report:manage'],
          },
          {
            key: '/review/videos',
            icon: <PlayCircleOutlined />,
            label: t('admin.reviewVideos'),
            permission: 'video:review',
          },
          {
            key: '/review/comments',
            icon: <CommentOutlined />,
            label: t('admin.reviewComments'),
            permission: 'comment:manage',
          },
          {
            key: '/',
            icon: <DashboardOutlined />,
            label: t('admin.dashboard'),
            permission: 'audit:read',
          },
          {
            key: '/users',
            icon: <TeamOutlined />,
            label: t('admin.users'),
            permission: 'user:view',
          },
          {
            key: '/videos',
            icon: <PlayCircleOutlined />,
            label: t('admin.videos'),
            permission: 'video:feature',
          },
          {
            key: '/danmaku',
            icon: <MessageOutlined />,
            label: t('admin.danmaku'),
            permission: 'danmaku:manage',
          },
          {
            key: '/comments',
            icon: <CommentOutlined />,
            label: t('admin.comments'),
            permission: 'video:feature',
          },
          {
            key: '/reports',
            icon: <FlagOutlined />,
            label: t('admin.reports'),
            permission: 'report:manage',
          },
          {
            key: '/categories',
            icon: <AppstoreOutlined />,
            label: t('admin.categories'),
            permission: 'category:manage',
          },
          {
            key: '/announcements',
            icon: <BellOutlined />,
            label: t('admin.announcements'),
            permission: 'announcement:manage',
          },
          {
            key: '/settings',
            icon: <SettingOutlined />,
            label: t('admin.settings'),
            anyOf: [
              'settings:site',
              'settings:content',
              'settings:integration',
              'settings:security',
            ],
          },
          {
            key: '/system',
            icon: <DatabaseOutlined />,
            label: t('admin.system'),
            permission: 'system:view',
          },
          {
            key: '/audit',
            icon: <AuditOutlined />,
            label: t('admin.audit'),
            permission: 'audit:read',
          },
        ] as MenuEntry[]
      )
        .filter((item) =>
          item.permission
            ? can(user, item.permission)
            : item.anyOf
              ? canAny(user, item.anyOf)
              : true,
        )
        .map(({ permission: _permission, anyOf: _anyOf, ...item }) => item),
    [t, user],
  );

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
          subTitle={t('请使用审核员、管理员或站长账号登录。普通用户请前往创作中心。')}
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

  const selectedKey = location.pathname.startsWith('/review/')
    ? location.pathname
    : location.pathname === '/'
      ? '/'
      : `/${location.pathname.split('/')[1]}`;

  return (
    <AdminUserContext.Provider value={user}>
      <Layout className="admin-layout">
        <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} width={220}>
          <div className="admin-logo">
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt={brand.name} className="admin-logo-image" />
            ) : (
              <span className="install-brand-mark">萌</span>
            )}
            {!collapsed && <span>{brand.name}</span>}
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
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
            <Text strong>
              {user?.group === 'REVIEWER' ? t('admin.reviewConsole') : t('admin.console')}
            </Text>
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
                  {user?.group === 'OWNER' ? (
                    <Tag color="magenta">{t('admin.owner')}</Tag>
                  ) : user?.group === 'ADMIN' ? (
                    <Tag color="red">{t('admin.adminRole')}</Tag>
                  ) : user?.group === 'REVIEWER' ? (
                    <Tag color="blue">{t('admin.reviewer')}</Tag>
                  ) : null}
                </Space>
              </Dropdown>
            </Space>
          </Header>
          <Content className="admin-content">
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </AdminUserContext.Provider>
  );
}
