import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
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
import { useT } from '../i18n';
import type { AdminCategory } from '../types';

const { Title, Text } = Typography;

interface TagRow {
  id: string;
  name: string;
  slug: string;
  count: number;
}

export function CategoriesPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const categories = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => api.get<{ items: AdminCategory[] }>('/api/v1/admin/categories'),
  });
  const tags = useQuery({
    queryKey: ['admin-tags'],
    queryFn: () => api.get<{ items: TagRow[] }>('/api/v1/admin/tags'),
  });

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ sort: 0 });
  };

  const openEdit = (category: AdminCategory) => {
    setEditing(category);
    setCreating(false);
    form.setFieldsValue(category);
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editing) await api.patch(`/api/v1/admin/categories/${editing.id}`, values);
      else await api.post('/api/v1/admin/categories', values);
      notification.success({ message: t('分区已保存') });
      setEditing(null);
      setCreating(false);
      await queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    } catch (error) {
      if (error instanceof Error) notification.error({ message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (category: AdminCategory) => {
    if (!window.confirm(t('确定删除分区「{0}」吗？', { 0: category.name }))) return;
    try {
      await api.delete(`/api/v1/admin/categories/${category.id}`);
      await queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    } catch (error) {
      notification.error({
        message: error instanceof Error ? error.message : t('删除失败'),
      });
    }
  };

  const move = async (category: AdminCategory, direction: -1 | 1) => {
    const ordered = [...(categories.data?.items ?? [])].sort(
      (left, right) => left.sort - right.sort,
    );
    const index = ordered.findIndex((item) => item.id === category.id);
    const neighbour = ordered[index + direction];
    if (!neighbour) return;
    try {
      await Promise.all([
        api.patch(`/api/v1/admin/categories/${category.id}`, { sort: neighbour.sort }),
        api.patch(`/api/v1/admin/categories/${neighbour.id}`, { sort: category.sort }),
      ]);
      await queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    } catch (error) {
      notification.error({
        message: error instanceof Error ? error.message : t('排序失败'),
      });
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <Title level={3} style={{ margin: 0 }}>
          {t('分区与标签')}{' '}
        </Title>
        <Text className="muted">{t('管理站点内容分区和标签')}</Text>
      </div>
      <Card
        title={t('分区')}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {t('新建分区')}{' '}
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        <Table
          rowKey="id"
          loading={categories.isLoading}
          dataSource={categories.data?.items ?? []}
          pagination={false}
          columns={[
            { title: t('名称'), dataIndex: 'name' },
            { title: 'Slug', dataIndex: 'slug' },
            {
              title: t('图标'),
              dataIndex: 'icon',
              width: 100,
              render: (value: string) => value || '—',
            },
            {
              title: t('描述'),
              dataIndex: 'description',
              ellipsis: true,
              render: (value: string) => value || '—',
            },
            {
              title: t('可见'),
              dataIndex: 'visible',
              width: 90,
              render: (value: boolean) => (
                <Tag color={value ? 'green' : 'default'}>{value ? t('显示') : t('隐藏')}</Tag>
              ),
            },
            { title: t('排序'), dataIndex: 'sort', width: 100 },
            {
              title: t('操作'),
              width: 260,
              render: (_value, record) => (
                <Space>
                  <Button
                    size="small"
                    icon={<ArrowUpOutlined />}
                    aria-label={t('上移')}
                    onClick={() => void move(record, -1)}
                  />
                  <Button
                    size="small"
                    icon={<ArrowDownOutlined />}
                    aria-label={t('下移')}
                    onClick={() => void move(record, 1)}
                  />
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
                    {t('编辑')}{' '}
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
      <Card title={t('标签')}>
        <Table
          rowKey="id"
          loading={tags.isLoading}
          dataSource={tags.data?.items ?? []}
          pagination={{ pageSize: 20 }}
          columns={[
            { title: t('标签'), dataIndex: 'name' },
            { title: 'Slug', dataIndex: 'slug' },
            {
              title: t('使用次数'),
              dataIndex: 'count',
              width: 120,
              render: (value: number) => <Tag>{value}</Tag>,
            },
          ]}
        />
      </Card>

      <Modal
        title={editing ? t('编辑分区') : t('新建分区')}
        open={creating || Boolean(editing)}
        onCancel={() => {
          setCreating(false);
          setEditing(null);
        }}
        onOk={() => void save()}
        confirmLoading={saving}
        okText={t('保存')}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label={t('名称')}
            name="name"
            rules={[{ required: true, message: t('请输入名称') }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Slug"
            name="slug"
            rules={[
              { required: true, message: t('请输入 slug') },
              { pattern: /^[a-z0-9-]+$/, message: t('只能使用小写字母、数字和短横线') },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item label={t('排序')} name="sort">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label={t('图标')}
            name="icon"
            extra={t('可选，填写图标名称，例如 video、music、game。')}
          >
            <Input placeholder="video" allowClear />
          </Form.Item>
          <Form.Item label={t('描述')} name="description">
            <Input.TextArea rows={2} maxLength={300} showCount />
          </Form.Item>
          <Form.Item
            label={t('在分区与投稿页显示')}
            name="visible"
            valuePropName="checked"
            extra={t('隐藏后不影响已有视频，只是不再出现在公开分区列表。')}
          >
            <Switch defaultChecked />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
