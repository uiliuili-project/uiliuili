import { CrownOutlined, EditOutlined, StopOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  notification,
} from 'antd';
import { useState } from 'react';
import { api } from '../api';
import { useT } from '../i18n';
import { can } from '../permissions';
import type { AdminUser } from '../types';
import { useAdminUser } from '../user-context';

const { Title, Text } = Typography;

const assignableRoles = ['USER', 'UPLOADER', 'REVIEWER', 'ADMIN'].map((value) => ({
  value,
  label: value,
}));

const groupColors: Record<string, string> = {
  USER: 'default',
  CREATOR: 'blue',
  REVIEWER: 'cyan',
  ADMIN: 'red',
  OWNER: 'magenta',
};

const groupLabels: Record<string, string> = {
  USER: '普通用户',
  CREATOR: '创作者',
  REVIEWER: '审核员',
  ADMIN: '管理员',
  OWNER: '站长',
};

const roleLabels: Record<string, string> = {
  USER: '普通用户',
  UPLOADER: '创作者',
  REVIEWER: '审核员',
  ADMIN: '管理员',
  SUPER_ADMIN: '站长',
};

export function UsersPage() {
  const t = useT();
  const actor = useAdminUser();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [q, setQ] = useState('');
  const [role, setRole] = useState<string | undefined>();
  const [group, setGroup] = useState<string | undefined>();
  const [banned, setBanned] = useState<boolean | undefined>();
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [transferring, setTransferring] = useState<AdminUser | null>(null);
  const [transferPassword, setTransferPassword] = useState('');
  const [form] = Form.useForm();

  const canAssignRole = can(actor, 'user:assign_role');
  const canTransfer = can(actor, 'owner:transfer');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, limit, q, role, group, banned],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q) params.set('q', q);
      if (role) params.set('role', role);
      if (group) params.set('group', group);
      if (banned !== undefined) params.set('banned', String(banned));
      return api.get<{ items: AdminUser[]; total: number }>(`/api/v1/admin/users?${params}`);
    },
  });

  const openEdit = (user: AdminUser) => {
    setEditing(user);
    form.setFieldsValue({
      role: user.roles[0] ?? 'USER',
      level: user.level,
      banned: user.banned,
    });
  };

  const save = async () => {
    if (!editing) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload: Record<string, unknown> = {
        level: values.level,
        banned: values.banned,
      };
      if (canAssignRole) payload.role = values.role;
      await api.patch(`/api/v1/admin/users/${editing.id}`, payload);
      notification.success({ message: t('用户已更新') });
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (error) {
      if (error instanceof Error) notification.error({ message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const mute = async (user: AdminUser) => {
    try {
      await api.patch(`/api/v1/admin/users/${user.id}`, {
        mutedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      notification.success({ message: t('已禁言 24 小时') });
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (error) {
      notification.error({
        message: error instanceof Error ? error.message : t('操作失败'),
      });
    }
  };

  const transfer = async () => {
    if (!transferring) return;
    try {
      setSaving(true);
      await api.post('/api/v1/admin/owner/transfer', {
        userId: transferring.id,
        password: transferPassword || undefined,
      });
      notification.success({ message: t('站长身份已转移') });
      setTransferring(null);
      setTransferPassword('');
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (error) {
      notification.error({
        message: error instanceof Error ? error.message : t('操作失败'),
      });
    } finally {
      setSaving(false);
    }
  };

  const editable = (record: AdminUser) => {
    if (record.group === 'OWNER') return false;
    if (record.group === 'ADMIN' && actor?.group !== 'OWNER') return false;
    return record.id !== actor?.id;
  };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <Title level={3} style={{ margin: 0 }}>
          {t('用户管理')}{' '}
        </Title>
        <Text className="muted">
          {canAssignRole
            ? t('管理用户组、角色、封禁与禁言，并可转移站长身份')
            : t('查看账号状态，执行封禁与禁言')}
        </Text>
      </div>
      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder={t('搜索用户名、邮箱或昵称')}
            allowClear
            style={{ width: 280 }}
            onSearch={(value) => {
              setQ(value);
              setPage(1);
            }}
          />
          <Select
            placeholder={t('用户组')}
            allowClear
            style={{ width: 140 }}
            options={Object.entries(groupLabels).map(([value, label]) => ({
              value,
              label: t(label),
            }))}
            value={group}
            onChange={(value) => {
              setGroup(value);
              setPage(1);
            }}
          />
          <Select
            placeholder={t('角色')}
            allowClear
            style={{ width: 150 }}
            options={Object.entries(roleLabels).map(([value, label]) => ({
              value,
              label: t(label),
            }))}
            value={role}
            onChange={(value) => {
              setRole(value);
              setPage(1);
            }}
          />
          <Select
            placeholder={t('状态')}
            allowClear
            style={{ width: 130 }}
            options={[
              { value: 'false', label: t('正常') },
              { value: 'true', label: t('已封禁') },
            ]}
            value={banned === undefined ? undefined : String(banned)}
            onChange={(value) => {
              setBanned(value === undefined ? undefined : value === 'true');
              setPage(1);
            }}
          />
        </Space>
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={data?.items ?? []}
          pagination={{
            current: page,
            pageSize: limit,
            total: data?.total ?? 0,
            showSizeChanger: true,
            onChange: (nextPage, nextLimit) => {
              setPage(nextPage);
              setLimit(nextLimit);
            },
          }}
          scroll={{ x: 1000 }}
          columns={[
            {
              title: t('用户'),
              dataIndex: 'username',
              render: (_value, record) => (
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {record.displayName}
                    {record.group === 'OWNER' && (
                      <CrownOutlined style={{ color: '#eb2f96', marginLeft: 6 }} />
                    )}
                  </div>
                  <Text type="secondary">@{record.username}</Text>
                </div>
              ),
            },
            { title: t('邮箱'), dataIndex: 'email' },
            {
              title: t('用户组'),
              dataIndex: 'group',
              width: 110,
              render: (value: string) => (
                <Tag color={groupColors[value]}>{t(groupLabels[value] ?? value)}</Tag>
              ),
            },
            {
              title: t('角色'),
              dataIndex: 'roles',
              render: (roles: string[]) => (
                <Space wrap>
                  {roles.map((item) => (
                    <Tag key={item} color={item === 'SUPER_ADMIN' ? 'magenta' : undefined}>
                      {t(roleLabels[item] ?? item)}
                    </Tag>
                  ))}
                </Space>
              ),
            },
            { title: t('等级'), dataIndex: 'level', width: 80 },
            { title: t('硬币'), dataIndex: 'coinBalance', width: 80 },
            {
              title: t('状态'),
              dataIndex: 'banned',
              width: 100,
              render: (value: boolean, record) =>
                value ? (
                  <Tag color="red">{t('已封禁')}</Tag>
                ) : record.mutedUntil ? (
                  <Tag color="orange">{t('禁言中')}</Tag>
                ) : (
                  <Tag color="green">{t('正常')}</Tag>
                ),
            },
            {
              title: t('注册时间'),
              dataIndex: 'createdAt',
              width: 180,
              render: (value: string) => new Date(value).toLocaleString(),
            },
            {
              title: t('操作'),
              width: 260,
              render: (_value, record) => (
                <Space wrap>
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    disabled={!editable(record)}
                    onClick={() => openEdit(record)}
                  >
                    {t('编辑')}
                  </Button>
                  <Button
                    size="small"
                    danger
                    icon={<StopOutlined />}
                    disabled={!editable(record)}
                    onClick={() => void mute(record)}
                  >
                    {t('禁言')}
                  </Button>
                  {canTransfer && record.group !== 'OWNER' && (
                    <Button
                      size="small"
                      icon={<CrownOutlined />}
                      onClick={() => {
                        setTransferring(record);
                        setTransferPassword('');
                      }}
                    >
                      {t('设为站长')}
                    </Button>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={t('编辑用户 · {0}', { 0: editing?.username ?? '' })}
        open={Boolean(editing)}
        onCancel={() => setEditing(null)}
        onOk={() => void save()}
        confirmLoading={saving}
        okText={t('保存')}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label={t('角色')}
            name="role"
            rules={[{ required: true }]}
            extra={
              canAssignRole
                ? t('用户组会根据角色自动同步；站长身份请使用“设为站长”')
                : t('只有站长可以修改角色')
            }
          >
            <Select options={assignableRoles} disabled={!canAssignRole} />
          </Form.Item>
          <Form.Item label={t('等级')} name="level">
            <InputNumber min={0} max={6} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={t('封禁账号')} name="banned" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('转移站长身份')}
        open={Boolean(transferring)}
        onCancel={() => setTransferring(null)}
        onOk={() => void transfer()}
        confirmLoading={saving}
        okText={t('确认转移')}
        okButtonProps={{ danger: true }}
      >
        <Space direction="vertical" className="w-full">
          <Text>
            {t('确定把站长身份转移给 {0} 吗？你将降为管理员。', {
              0: transferring?.displayName ?? '',
            })}
          </Text>
          <Input.Password
            value={transferPassword}
            onChange={(event) => setTransferPassword(event.target.value)}
            placeholder={t('当前站长密码（可选，用于二次确认）')}
            autoComplete="current-password"
          />
        </Space>
      </Modal>
    </div>
  );
}
