import { EditOutlined, LinkOutlined, StarOutlined } from '@ant-design/icons';
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
import type { AdminVideo } from '../types';

const { Title, Text } = Typography;

const statusOptions = [
  'draft',
  'uploading',
  'processing',
  'ready',
  'pending_review',
  'published',
  'blocked',
  'failed',
  'deleted',
].map((value) => ({ value, label: value }));

const statusColor: Record<string, string> = {
  published: 'green',
  pending_review: 'orange',
  processing: 'blue',
  uploading: 'blue',
  ready: 'cyan',
  blocked: 'red',
  failed: 'red',
  deleted: 'default',
  draft: 'default',
};

export function VideosPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string | undefined>();
  const [restricted, setRestricted] = useState<boolean | undefined>();
  const [editing, setEditing] = useState<AdminVideo | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const isRestricted = Form.useWatch('restricted', form) as boolean | undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['admin-videos', page, limit, q, status, restricted],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q) params.set('q', q);
      if (status) params.set('status', status);
      if (restricted !== undefined) params.set('restricted', String(restricted));
      return api.get<{ items: AdminVideo[]; total: number }>(`/api/v1/admin/videos?${params}`);
    },
  });

  const regionOptions = useQuery({
    queryKey: ['region-options'],
    queryFn: () =>
      api.get<{ items: Array<{ code: string; name: string; nameEn: string }> }>(
        '/api/v1/region/options',
      ),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const regionSelectOptions = (regionOptions.data?.items ?? []).map((item) => ({
    value: item.code,
    label: `${item.name} (${item.code})`,
  }));

  const openEdit = (video: AdminVideo) => {
    setEditing(video);
    form.setFieldsValue({
      status: video.status,
      featured: video.featured,
      recommendWeight: video.recommendWeight,
      blockReason: '',
      restricted: video.restricted,
      regionMode: video.regionMode,
      regionCodes: video.regionCodes,
      regionDenyBehavior: video.regionDenyBehavior,
      regionDenyMessage: video.regionDenyMessage,
    });
  };

  const save = async () => {
    if (!editing) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      await api.patch(`/api/v1/admin/videos/${editing.id}`, values);
      notification.success({ message: t('视频已更新') });
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ['admin-videos'] });
    } catch (error) {
      if (error instanceof Error) notification.error({ message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const toggleFeatured = async (video: AdminVideo) => {
    try {
      await api.patch(`/api/v1/admin/videos/${video.id}`, { featured: !video.featured });
      await queryClient.invalidateQueries({ queryKey: ['admin-videos'] });
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
          {t('视频管理')}{' '}
        </Title>
        <Text className="muted">{t('审核、下架、推荐加权')}</Text>
      </div>
      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder={t('搜索视频标题')}
            allowClear
            style={{ width: 280 }}
            onSearch={(value) => {
              setQ(value);
              setPage(1);
            }}
          />
          <Select
            placeholder={t('状态')}
            allowClear
            style={{ width: 160 }}
            options={statusOptions}
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          />
          <Select
            placeholder={t('内容级别')}
            allowClear
            style={{ width: 160 }}
            options={[
              { value: 'false', label: t('普通内容') },
              { value: 'true', label: t('限制级内容') },
            ]}
            value={restricted === undefined ? undefined : String(restricted)}
            onChange={(value) => {
              setRestricted(value === undefined ? undefined : value === 'true');
              setPage(1);
            }}
          />
        </Space>
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={data?.items ?? []}
          scroll={{ x: 1100 }}
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
          columns={[
            {
              title: t('视频'),
              dataIndex: 'title',
              render: (value: string, record) => (
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {value}
                    {record.restricted && (
                      <Tag color="orange" style={{ marginLeft: 8 }}>
                        {t('限制级')}
                      </Tag>
                    )}
                  </div>
                  <Text type="secondary">@{record.uploader?.username ?? 'unknown'}</Text>
                </div>
              ),
            },
            {
              title: t('状态'),
              dataIndex: 'status',
              width: 130,
              render: (value: string) => <Tag color={statusColor[value]}>{value}</Tag>,
            },
            {
              title: t('推荐'),
              dataIndex: 'featured',
              width: 100,
              render: (value: boolean, record) => (
                <Button
                  type={value ? 'primary' : 'default'}
                  size="small"
                  icon={<StarOutlined />}
                  onClick={() => void toggleFeatured(record)}
                />
              ),
            },
            {
              title: t('权重'),
              dataIndex: 'recommendWeight',
              width: 80,
            },
            {
              title: t('数据'),
              width: 220,
              render: (_value, record) => (
                <Text type="secondary">
                  {record.views} {t('播放 ·')} {record.likes} {t('赞 ·')} {record.danmaku}{' '}
                  {t('弹幕')}{' '}
                </Text>
              ),
            },
            {
              title: t('创建时间'),
              dataIndex: 'createdAt',
              width: 180,
              render: (value: string) => new Date(value).toLocaleString(),
            },
            {
              title: t('操作'),
              width: 190,
              render: (_value, record) => (
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
                    {t('编辑')}{' '}
                  </Button>
                  <Button
                    size="small"
                    icon={<LinkOutlined />}
                    href={`/video/${record.id}`}
                    target="_blank"
                  />
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={t('编辑视频 · {0}', { 0: editing?.title ?? '' })}
        open={Boolean(editing)}
        onCancel={() => setEditing(null)}
        onOk={() => void save()}
        confirmLoading={saving}
        okText={t('保存')}
      >
        <Form form={form} layout="vertical">
          <Form.Item label={t('状态')} name="status">
            <Select options={statusOptions} />
          </Form.Item>
          <Form.Item label={t('推荐')} name="featured" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label={t('推荐权重')} name="recommendWeight">
            <InputNumber min={-100} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label={t('限制级内容')}
            name="restricted"
            valuePropName="checked"
            extra={t('限制级内容只能在无限制地区发布和播放，地区清单由站点设置统一管理。')}
          >
            <Switch />
          </Form.Item>
          <Form.Item
            label={t('地区限制')}
            name="regionMode"
            extra={
              isRestricted
                ? t('限制级内容会自动使用站点“限制级内容不可发布的地区”清单。')
                : t('普通内容也可以禁止在指定国家播放。')
            }
          >
            <Select
              disabled={Boolean(isRestricted)}
              options={[
                { value: 'inherit', label: t('不额外限制') },
                { value: 'block', label: t('禁止在指定国家播放') },
              ]}
            />
          </Form.Item>
          <Form.Item label={t('禁止播放的国家')} name="regionCodes">
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              disabled={Boolean(isRestricted)}
              options={regionSelectOptions}
              placeholder={t('搜索国家或地区代码')}
            />
          </Form.Item>
          <Form.Item
            label={t('拒绝方式')}
            name="regionDenyBehavior"
            extra={t('“跟随站点默认”使用站点设置中的拒绝方式。')}
          >
            <Select
              options={[
                { value: 'default', label: t('跟随站点默认') },
                { value: 'message', label: t('说明地区限制') },
                { value: 'not_found', label: t('显示视频不存在') },
              ]}
            />
          </Form.Item>
          <Form.Item label={t('拒绝提示文案')} name="regionDenyMessage">
            <Input.TextArea rows={2} maxLength={200} placeholder={t('留空则使用站点默认文案')} />
          </Form.Item>
          <Form.Item label={t('下架原因')} name="blockReason">
            <Input.TextArea rows={3} placeholder={t('仅下架时需要填写')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
