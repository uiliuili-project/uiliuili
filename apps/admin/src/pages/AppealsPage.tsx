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

interface AdminAppeal {
  id: string;
  videoId: string;
  videoTitle: string;
  videoStatus: string;
  videoCover: string | null;
  blockReason: string;
  reason: string;
  detail: string;
  status: string;
  handleNote: string;
  handledAt: string | null;
  createdAt: string;
  user: { username: string; displayName: string };
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'orange',
  accepted: 'green',
  rejected: 'red',
};

export function AppealsPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [status, setStatus] = useState<string | undefined>('pending');
  const [q, setQ] = useState('');
  const [target, setTarget] = useState<{
    appeal: AdminAppeal;
    action: 'accepted' | 'rejected';
  } | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-appeals', page, limit, status, q],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (status) params.set('status', status);
      if (q) params.set('q', q);
      return api.get<{ items: AdminAppeal[]; total: number }>(`/api/v1/admin/appeals?${params}`);
    },
  });

  const submit = async () => {
    if (!target) return;
    setSubmitting(true);
    try {
      await api.post(`/api/v1/admin/appeals/${target.appeal.id}/handle`, {
        status: target.action,
        note: note.trim() || undefined,
      });
      notification.success({
        message: target.action === 'accepted' ? t('申诉已通过') : t('申诉已驳回'),
      });
      setTarget(null);
      setNote('');
      await queryClient.invalidateQueries({ queryKey: ['admin-appeals'] });
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
          {t('审核申诉')}
        </Title>
        <Text className="muted">{t('处理创作者对下架稿件提交的申诉')}</Text>
      </div>

      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder={t('搜索稿件标题')}
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
              { value: 'pending', label: t('待处理') },
              { value: 'accepted', label: t('已通过') },
              { value: 'rejected', label: t('已驳回') },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => void refetch()}>
            {t('刷新')}
          </Button>
        </Space>

        <Table<AdminAppeal>
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
              title: t('稿件'),
              dataIndex: 'videoTitle',
              render: (_, row) => (
                <div>
                  <a href={`/video/${row.videoId}`} target="_blank" rel="noreferrer">
                    {row.videoTitle}
                  </a>
                  <div style={{ fontSize: 12, color: '#888' }}>
                    {t('状态')}：{row.videoStatus}
                    {row.blockReason ? ` · ${row.blockReason}` : ''}
                  </div>
                </div>
              ),
            },
            {
              title: t('提交人'),
              dataIndex: ['user', 'displayName'],
              render: (_, row) => (
                <div>
                  <div>{row.user.displayName}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>@{row.user.username}</div>
                </div>
              ),
            },
            {
              title: t('申诉理由'),
              dataIndex: 'reason',
              render: (_, row) => (
                <div style={{ maxWidth: 320 }}>
                  <Tag>{row.reason}</Tag>
                  <div
                    style={{ fontSize: 12, color: '#666', marginTop: 4, whiteSpace: 'pre-wrap' }}
                  >
                    {row.detail}
                  </div>
                </div>
              ),
            },
            {
              title: t('状态'),
              dataIndex: 'status',
              width: 110,
              render: (value: string) => (
                <Tag color={STATUS_COLORS[value] ?? 'default'}>{value}</Tag>
              ),
            },
            {
              title: t('提交时间'),
              dataIndex: 'createdAt',
              width: 170,
              render: (value: string) => new Date(value).toLocaleString(),
            },
            {
              title: t('操作'),
              width: 190,
              render: (_, row) =>
                row.status === 'pending' ? (
                  <Space>
                    <Button
                      size="small"
                      type="primary"
                      icon={<CheckOutlined />}
                      onClick={() => setTarget({ appeal: row, action: 'accepted' })}
                    >
                      {t('通过')}
                    </Button>
                    <Button
                      size="small"
                      danger
                      icon={<CloseOutlined />}
                      onClick={() => setTarget({ appeal: row, action: 'rejected' })}
                    >
                      {t('驳回')}
                    </Button>
                  </Space>
                ) : (
                  <div style={{ fontSize: 12, color: '#888' }}>
                    {row.handleNote || '—'}
                    {row.handledAt ? <div>{new Date(row.handledAt).toLocaleString()}</div> : null}
                  </div>
                ),
            },
          ]}
        />
      </Card>

      <Modal
        open={Boolean(target)}
        title={target?.action === 'accepted' ? t('通过申诉') : t('驳回申诉')}
        onCancel={() => {
          setTarget(null);
          setNote('');
        }}
        onOk={() => void submit()}
        confirmLoading={submitting}
        okText={t('确认')}
        cancelText={t('取消')}
      >
        {target?.action === 'accepted' && (
          <p style={{ marginTop: 0, color: '#666' }}>{t('通过后稿件会恢复为已发布状态。')}</p>
        )}
        <Input.TextArea
          rows={4}
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t('处理说明（可选，会通知创作者）')}
        />
      </Modal>
    </div>
  );
}
