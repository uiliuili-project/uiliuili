import { CheckOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  notification,
} from 'antd';
import { useState } from 'react';
import { api } from '../api';
import { useT } from '../i18n';

const { Title, Text } = Typography;

interface AdminArticle {
  id: string;
  title: string;
  summary: string;
  status: string;
  visibility: string;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  authorName: string;
  authorUsername: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  pending_review: 'orange',
  published: 'green',
  blocked: 'red',
  deleted: 'default',
};

export function ArticlesPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [status, setStatus] = useState<string | undefined>('pending_review');
  const [q, setQ] = useState('');
  const [target, setTarget] = useState<{
    article: AdminArticle;
    action: 'published' | 'blocked';
  } | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-articles', page, limit, status, q],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (status) params.set('status', status);
      if (q) params.set('q', q);
      return api.get<{ items: AdminArticle[]; total: number }>(`/api/v1/admin/articles?${params}`);
    },
  });

  const submit = async () => {
    if (!target) return;
    setSubmitting(true);
    try {
      await api.post(`/api/v1/admin/articles/${target.article.id}/moderate`, {
        status: target.action,
        note: note.trim() || undefined,
      });
      notification.success({
        message: target.action === 'published' ? t('专栏已通过') : t('专栏已下架'),
      });
      setTarget(null);
      setNote('');
      await queryClient.invalidateQueries({ queryKey: ['admin-articles'] });
    } catch (error) {
      notification.error({ message: error instanceof Error ? error.message : t('操作失败') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <Title level={3} style={{ margin: 0 }}>
          {t('专栏管理')}
        </Title>
        <Text className="muted">{t('审核创作者提交的长文专栏')}</Text>
      </div>

      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder={t('搜索专栏标题')}
            allowClear
            style={{ width: 260 }}
            onSearch={(value) => {
              setQ(value);
              setPage(1);
            }}
          />
          <Select
            style={{ width: 160 }}
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={[
              { value: 'pending_review', label: t('审核中') },
              { value: 'published', label: t('已发布') },
              { value: 'blocked', label: t('已下架') },
              { value: 'draft', label: t('草稿') },
              { value: 'deleted', label: t('已删除') },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => void refetch()}>
            {t('刷新')}
          </Button>
        </Space>

        <Table<AdminArticle>
          rowKey="id"
          loading={isLoading}
          dataSource={data?.items ?? []}
          pagination={{
            current: page,
            pageSize: limit,
            total: data?.total ?? 0,
            onChange: setPage,
            showSizeChanger: false,
          }}
          columns={[
            {
              title: t('专栏'),
              dataIndex: 'title',
              render: (_, row) => (
                <div style={{ maxWidth: 420 }}>
                  <a href={`/columns/${row.id}`} target="_blank" rel="noreferrer">
                    {row.title}
                  </a>
                  <div style={{ fontSize: 12, color: '#888' }}>{row.summary}</div>
                </div>
              ),
            },
            {
              title: t('作者'),
              dataIndex: 'authorName',
              width: 160,
              render: (_, row) => (
                <div>
                  <div>{row.authorName}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>@{row.authorUsername}</div>
                </div>
              ),
            },
            {
              title: t('状态'),
              dataIndex: 'status',
              width: 120,
              render: (value: string) => (
                <Tag color={STATUS_COLORS[value] ?? 'default'}>{value}</Tag>
              ),
            },
            {
              title: t('阅读'),
              dataIndex: 'viewCount',
              width: 90,
            },
            {
              title: t('提交时间'),
              dataIndex: 'createdAt',
              width: 170,
              render: (value: string) => new Date(value).toLocaleString(),
            },
            {
              title: t('操作'),
              width: 200,
              render: (_, row) => (
                <Space>
                  {row.status !== 'published' && (
                    <Button
                      size="small"
                      type="primary"
                      icon={<CheckOutlined />}
                      onClick={() => setTarget({ article: row, action: 'published' })}
                    >
                      {t('通过')}
                    </Button>
                  )}
                  {row.status !== 'blocked' && (
                    <Button
                      size="small"
                      danger
                      icon={<CloseOutlined />}
                      onClick={() => setTarget({ article: row, action: 'blocked' })}
                    >
                      {t('下架')}
                    </Button>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={Boolean(target)}
        title={target?.action === 'published' ? t('通过专栏') : t('下架专栏')}
        onCancel={() => {
          setTarget(null);
          setNote('');
        }}
        onOk={() => void submit()}
        confirmLoading={submitting}
        okText={t('确认')}
        cancelText={t('取消')}
      >
        <Input.TextArea
          rows={4}
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t('处理说明（可选，会通知作者）')}
        />
      </Modal>
    </div>
  );
}
