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
import { Avatar, Dropdown, Layout, Menu, Space, Spin, Tag, Typography, notification } from 'antd';
import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { AuthUser } from '../types';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/users', icon: <TeamOutlined />, label: '用户' },
  { key: '/videos', icon: <PlayCircleOutlined />, label: '视频' },
  { key: '/danmaku', icon: <MessageOutlined />, label: '弹幕' },
  { key: '/comments', icon: <CommentOutlined />, label: '评论' },
  { key: '/reports', icon: <FlagOutlined />, label: '举报' },
  { key: '/categories', icon: <AppstoreOutlined />, label: '分区' },
  { key: '/announcements', icon: <BellOutlined />, label: '公告' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' },
  { key: '/system', icon: <DatabaseOutlined />, label: '系统' },
  { key: '/audit', icon: <AuditOutlined />, label: '审计日志' },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
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

  return (
    <Layout className="admin-layout">
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} width={220}>
        <div className="admin-logo">
          <span className="install-brand-mark">u</span>
          {!collapsed && <span>uiliuili</span>}
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
          <Text strong>管理控制台</Text>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'site',
                  icon: <FileTextOutlined />,
                  label: '访问站点',
                  onClick: () => window.open('/', '_blank'),
                },
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: '退出登录',
                  onClick: logout,
                },
              ],
            }}
          >
            <Space style={{ cursor: 'pointer' }}>
              <Avatar src={user?.avatarUrl} icon={<UserOutlined />} />
              <span>{user?.displayName || user?.username}</span>
              {user?.roles.includes('SUPER_ADMIN') && <Tag color="magenta">超级管理员</Tag>}
            </Space>
          </Dropdown>
        </Header>
        <Content className="admin-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
