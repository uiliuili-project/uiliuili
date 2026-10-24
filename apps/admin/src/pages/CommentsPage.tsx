import { DeleteOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input, Select, Space, Table, Tag, Typography, notification } from 'antd';
import { useState } from 'react';
import { api } from '../api';
import type { AdminComment } from '../types';

const { Title, Text } = Typography;

export function CommentsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-comments', page, limit, q, status],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q) params.set('q', q);
      if (status) params.set('status', status);
      return api.get<{ items: AdminComment[]; total: number }>(`/api/v1/admin/comments?${params}`);
    },
  });

  const moderate = async (id: string, action: string) => {
    try {
      await api.post(`/api/v1/admin/comments/${id}/moderate`, { action });
      notification.success({ message: '评论状态已更新' });
      await queryClient.invalidateQueries({ queryKey: ['admin-comments'] });
    } catch (error) {
      notification.error({ message: error instanceof Error ? error.message : '操作失败' });
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <Title level={3} style={{ margin: 0 }}>
          评论管理
        </Title>
        <Text className="muted">审核与管理视频评论</Text>
      </div>
      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="搜索评论内容"
            allowClear
            style={{ width: 280 }}
            onSearch={(value) => {
              setQ(value);
              setPage(1);
            }}
          />
          <Select
            placeholder="状态"
            allowClear
            style={{ width: 150 }}
            options={[
              { value: 'visible', label: '正常' },
              { value: 'hidden', label: '已隐藏' },
              { value: 'deleted', label: '已删除' },
            ]}
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          />
        </Space>
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={data?.items ?? []}
          scroll={{ x: 900 }}
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
              title: '评论',
              dataIndex: 'content',
              render: (value: string) => <span style={{ whiteSpace: 'pre-wrap' }}>{value}</span>,
            },
            {
              title: '视频',
              dataIndex: 'videoTitle',
              render: (value: string, record) => (
                <a href={`/video/${record.videoId}`} target="_blank" rel="noreferrer">
                  {value}
                </a>
              ),
            },
            { title: '用户', dataIndex: 'username', width: 140 },
            { title: '点赞', dataIndex: 'likeCount', width: 80 },
            {
              title: '状态',
              dataIndex: 'status',
              width: 100,
              render: (value: string) => (
                <Tag color={value === 'visible' ? 'green' : value === 'hidden' ? 'orange' : 'red'}>
                  {value}
                </Tag>
              ),
            },
            {
              title: '时间',
              dataIndex: 'createdAt',
              width: 170,
              render: (value: string) => new Date(value).toLocaleString(),
            },
            {
              title: '操作',
              width: 190,
              render: (_value, record) => (
                <Space>
                  {record.status !== 'visible' && (
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => void moderate(record.id, 'restore')}
                    />
                  )}
                  {record.status === 'visible' && (
                    <Button
                      size="small"
                      icon={<EyeInvisibleOutlined />}
                      onClick={() => void moderate(record.id, 'hide')}
                    />
                  )}
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => void moderate(record.id, 'delete')}
                  />
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
