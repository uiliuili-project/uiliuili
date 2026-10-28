import { CheckOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Image,
  Input,
  Modal,
  Popconfirm,
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

const { Title, Text, Paragraph } = Typography;

interface ReviewVideo {
  id: string;
  title: string;
  status: string;
  coverUrl: string | null;
  durationSeconds: number | null;
  createdAt: string;
  uploaderName: string;
  uploaderUsername: string;
  blockReason: string | null;
}

const statusColor: Record<string, string> = {
  pending_review: 'orange',
  published: 'green',
  blocked: 'red',
};

export function ReviewVideosPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('pending_review');
  const [rejecting, setRejecting] = useState<ReviewVideo | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['review-videos', page, limit, q, status],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), status });
      if (q) params.set('q', q);
      return api.get<{ items: ReviewVideo[]; total: number }>(`/api/v1/review/videos?${params}`);
    },
  });

  const decide = async (id: string, action: 'approve' | 'reject', why?: string) => {
    setBusy(true);
    try {
      await api.post(`/api/v1/review/videos/${id}/decision`, { action, reason: why });
      notification.success({ message: action === 'approve' ? t('已通过审核') : t('已驳回') });
      setRejecting(null);
      setReason('');
      await queryClient.invalidateQueries({ queryKey: ['review-videos'] });
      await queryClient.invalidateQueries({ queryKey: ['review-summary'] });
    } catch (error) {
      notification.error({ message: error instanceof Error ? error.message : t('操作失败') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Space direction="vertical" size="large" className="w-full">
      <div>
        <Title level={3} style={{ margin: 0 }}>
          {t('视频审核')}
        </Title>
        <Text className="muted">{t('通过后将立即公开发布；驳回需要填写原因并通知投稿人。')}</Text>
      </div>
      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input.Search
            allowClear
            placeholder={t('搜索标题')}
            style={{ width: 240 }}
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
              { value: 'pending_review', label: t('待审核') },
              { value: 'published', label: t('已发布') },
              { value: 'blocked', label: t('已驳回') },
              { value: 'all', label: t('全部') },
            ]}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void queryClient.invalidateQueries({ queryKey: ['review-videos'] })}
          >
            {t('刷新')}
          </Button>
        </Space>
        <Table<ReviewVideo>
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
          columns={[
            {
              title: t('封面'),
              dataIndex: 'coverUrl',
              width: 120,
              render: (value: string | null) =>
                value ? (
                  <Image src={value} width={96} height={54} style={{ objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 96, height: 54, background: '#f5f5f5' }} />
                ),
            },
            {
              title: t('标题'),
              dataIndex: 'title',
              render: (value: string, row) => (
                <Space direction="vertical" size={0}>
                  <Text strong>{value}</Text>
                  <Text className="muted" style={{ fontSize: 12 }}>
                    {row.uploaderName} @{row.uploaderUsername}
                  </Text>
                </Space>
              ),
            },
            {
              title: t('状态'),
              dataIndex: 'status',
              width: 120,
              render: (value: string) => <Tag color={statusColor[value]}>{value}</Tag>,
            },
            {
              title: t('提交时间'),
              dataIndex: 'createdAt',
              width: 180,
              render: (value: string) => new Date(value).toLocaleString(),
            },
            {
              title: t('操作'),
              width: 210,
              render: (_: unknown, row) =>
                row.status === 'pending_review' ? (
                  <Space>
                    <Popconfirm
                      title={t('确认通过该视频？')}
                      onConfirm={() => void decide(row.id, 'approve')}
                    >
                      <Button type="primary" size="small" icon={<CheckOutlined />} loading={busy}>
                        {t('通过')}
                      </Button>
                    </Popconfirm>
                    <Button
                      danger
                      size="small"
                      icon={<CloseOutlined />}
                      onClick={() => {
                        setRejecting(row);
                        setReason('');
                      }}
                    >
                      {t('驳回')}
                    </Button>
                  </Space>
                ) : (
                  <Text className="muted">{row.blockReason ?? '-'}</Text>
                ),
            },
          ]}
        />
      </Card>
      <Modal
        open={Boolean(rejecting)}
        title={t('驳回视频')}
        okText={t('确认驳回')}
        okButtonProps={{ danger: true, loading: busy, disabled: !reason.trim() }}
        onOk={() => rejecting && void decide(rejecting.id, 'reject', reason)}
        onCancel={() => setRejecting(null)}
      >
        <Space direction="vertical" className="w-full">
          <Paragraph>{rejecting?.title}</Paragraph>
          <Input.TextArea
            rows={4}
            maxLength={500}
            showCount
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t('请说明驳回原因，投稿人会收到通知。')}
          />
        </Space>
      </Modal>
    </Space>
  );
}
