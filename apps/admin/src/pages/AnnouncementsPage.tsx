import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  notification,
} from 'antd';
import { useState } from 'react';
import { api } from '../api';

const { Title, Text } = Typography;

interface Announcement {
  id: string;
  title: string;
  content: string;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

export function AnnouncementsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const query = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: () => api.get<{ items: Announcement[] }>('/api/v1/admin/announcements'),
  });

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ active: true });
  };

  const openEdit = (item: Announcement) => {
    setCreating(false);
    setEditing(item);
    form.setFieldsValue(item);
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editing) await api.patch(`/api/v1/admin/announcements/${editing.id}`, values);
      else await api.post('/api/v1/admin/announcements', values);
      notification.success({ message: '公告已保存' });
      setCreating(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
    } catch (error) {
      if (error instanceof Error) notification.error({ message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: Announcement) => {
    if (!window.confirm(`确定删除公告「${item.title}」吗？`)) return;
    await api.delete(`/api/v1/admin/announcements/${item.id}`);
    await queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
  };

  return (
    <div>
      <Card
        title={
          <Title level={3} style={{ margin: 0 }}>
            公告管理
          </Title>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建公告
          </Button>
        }
      >
        <Table
          rowKey="id"
          loading={query.isLoading}
          dataSource={query.data?.items ?? []}
          pagination={false}
          columns={[
            { title: '标题', dataIndex: 'title' },
            {
              title: '状态',
              dataIndex: 'active',
              width: 100,
              render: (value: boolean) => (
                <Tag color={value ? 'green' : 'default'}>{value ? '启用' : '停用'}</Tag>
              ),
            },
            {
              title: '创建时间',
              dataIndex: 'createdAt',
              width: 180,
              render: (value: string) => new Date(value).toLocaleString(),
            },
            {
              title: '操作',
              width: 180,
              render: (_value, record) => (
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
                    编辑
                  </Button>
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => void remove(record)}
                  />
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editing ? '编辑公告' : '新建公告'}
        open={creating || Boolean(editing)}
        onCancel={() => {
          setCreating(false);
          setEditing(null);
        }}
        onOk={() => void save()}
        confirmLoading={saving}
        okText="保存"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="标题" name="title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="内容" name="content" rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item label="启用" name="active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
