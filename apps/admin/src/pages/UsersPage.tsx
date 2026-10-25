import { EditOutlined, StopOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
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
import type { AdminUser } from '../types';

const { Title, Text } = Typography;

const roleOptions = ['USER', 'UPLOADER', 'REVIEWER', 'ADMIN', 'SUPER_ADMIN'].map((value) => ({
  value,
  label: value,
}));

export function UsersPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [q, setQ] = useState('');
  const [role, setRole] = useState<string | undefined>();
  const [banned, setBanned] = useState<boolean | undefined>();
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, limit, q, role, banned],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q) params.set('q', q);
      if (role) params.set('role', role);
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
      await api.patch(`/api/v1/admin/users/${editing.id}`, values);
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

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <Title level={3} style={{ margin: 0 }}>
          {t('用户管理')}{' '}
        </Title>
        <Text className="muted">{t('管理账号角色、封禁与禁言')}</Text>
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
            placeholder={t('角色')}
            allowClear
            style={{ width: 150 }}
            options={roleOptions}
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
          scroll={{ x: 900 }}
          columns={[
            {
              title: t('用户'),
              dataIndex: 'username',
              render: (_value, record) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{record.displayName}</div>
                  <Text type="secondary">@{record.username}</Text>
                </div>
              ),
            },
            { title: t('邮箱'), dataIndex: 'email' },
            {
              title: t('角色'),
              dataIndex: 'roles',
              render: (roles: string[]) => (
                <Space wrap>
                  {roles.map((item) => (
                    <Tag key={item} color={item === 'SUPER_ADMIN' ? 'magenta' : undefined}>
                      {item}
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
              width: 180,
              render: (_value, record) => (
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
                    {t('编辑')}{' '}
                  </Button>
                  <Button
                    size="small"
                    danger
                    icon={<StopOutlined />}
                    onClick={() => void mute(record)}
                  >
                    {t('禁言')}{' '}
                  </Button>
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
          <Form.Item label={t('角色')} name="role" rules={[{ required: true }]}>
            <Select options={roleOptions} />
          </Form.Item>
          <Form.Item label={t('等级')} name="level">
            <InputNumber min={0} max={6} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={t('封禁账号')} name="banned" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
