import {
  DeleteOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Input,
  Popconfirm,
  Segmented,
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

interface ReviewComment {
  id: string;
  content: string;
  videoId: string;
  videoTitle: string;
  username: string;
  status: string;
  likeCount: number;
  createdAt: string;
}

export function ReviewCommentsPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('reported');

  const { data, isLoading } = useQuery({
    queryKey: ['review-comments', page, limit, q, filter],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        filter,
      });
      if (q) params.set('q', q);
      return api.get<{ items: ReviewComment[]; total: number }>(
        `/api/v1/review/comments?${params}`,
      );
    },
  });

  const act = async (id: string, action: 'hide' | 'restore' | 'delete') => {
    try {
      await api.post(`/api/v1/review/comments/${id}/action`, { action });
      notification.success({ message: t('操作成功') });
      await queryClient.invalidateQueries({ queryKey: ['review-comments'] });
      await queryClient.invalidateQueries({ queryKey: ['review-summary'] });
    } catch (error) {
      notification.error({ message: error instanceof Error ? error.message : t('操作失败') });
    }
  };

  return (
    <Space direction="vertical" size="large" className="w-full">
      <div>
        <Title level={3} style={{ margin: 0 }}>
          {t('评论审核')}
        </Title>
        <Text className="muted">{t('处理被举报的评论，或恢复、删除已隐藏的评论。')}</Text>
      </div>
      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Segmented
            value={filter}
            onChange={(value) => {
              setFilter(String(value));
              setPage(1);
            }}
            options={[
              { value: 'reported', label: t('被举报') },
              { value: 'hidden', label: t('已隐藏') },
              { value: 'all', label: t('全部') },
            ]}
          />
          <Input.Search
            allowClear
            placeholder={t('搜索评论内容')}
            style={{ width: 240 }}
            onSearch={(value) => {
              setQ(value);
              setPage(1);
            }}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void queryClient.invalidateQueries({ queryKey: ['review-comments'] })}
          >
            {t('刷新')}
          </Button>
        </Space>
        <Table<ReviewComment>
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
              title: t('评论'),
              dataIndex: 'content',
              render: (value: string, row) => (
                <Space direction="vertical" size={0}>
                  <Text>{value}</Text>
                  <Text className="muted" style={{ fontSize: 12 }}>
                    @{row.username} · {row.videoTitle}
                  </Text>
                </Space>
              ),
            },
            {
              title: t('状态'),
              dataIndex: 'status',
              width: 110,
              render: (value: string) => (
                <Tag color={value === 'hidden' ? 'orange' : value === 'deleted' ? 'red' : 'green'}>
                  {value}
                </Tag>
              ),
            },
            {
              title: t('时间'),
              dataIndex: 'createdAt',
              width: 180,
              render: (value: string) => new Date(value).toLocaleString(),
            },
            {
              title: t('操作'),
              width: 220,
              render: (_: unknown, row) => (
                <Space>
                  {row.status === 'visible' ? (
                    <Button
                      size="small"
                      icon={<EyeInvisibleOutlined />}
                      onClick={() => void act(row.id, 'hide')}
                    >
                      {t('隐藏')}
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => void act(row.id, 'restore')}
                    >
                      {t('恢复')}
                    </Button>
                  )}
                  <Popconfirm
                    title={t('确认删除该评论？')}
                    onConfirm={() => void act(row.id, 'delete')}
                  >
                    <Button danger size="small" icon={<DeleteOutlined />}>
                      {t('删除')}
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
