import { DeleteOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input, Select, Space, Table, Tag, Typography, notification } from 'antd';
import { useState } from 'react';
import { api } from '../api';
import { useT } from '../i18n';
import type { AdminDanmaku } from '../types';

const { Title, Text } = Typography;

export function DanmakuPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-danmaku', page, limit, q, status],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q) params.set('q', q);
      if (status) params.set('status', status);
      return api.get<{ items: AdminDanmaku[]; total: number }>(`/api/v1/admin/danmaku?${params}`);
    },
  });

  const moderate = async (id: string, action: string) => {
    try {
      await api.post(`/api/v1/admin/danmaku/${id}/moderate`, { action });
      notification.success({ message: t('弹幕状态已更新') });
      await queryClient.invalidateQueries({ queryKey: ['admin-danmaku'] });
    } catch (error) {
      notification.error({ message: error instanceof Error ? error.message : t('操作失败') });
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <Title level={3} style={{ margin: 0 }}>
          {t('弹幕管理')}{' '}
        </Title>
        <Text className="muted">{t('审核与处理违规弹幕')}</Text>
      </div>
      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder={t('搜索弹幕内容')}
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
            style={{ width: 150 }}
            options={[
              { value: 'visible', label: t('正常') },
              { value: 'hidden', label: t('已隐藏') },
              { value: 'deleted', label: t('已删除') },
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
              title: t('内容'),
              dataIndex: 'content',
              render: (value: string) => <span>{value}</span>,
            },
            {
              title: t('视频'),
              dataIndex: 'videoTitle',
              render: (value: string, record) => (
                <a href={`/video/${record.videoId}`} target="_blank" rel="noreferrer">
                  {value}
                </a>
              ),
            },
            { title: t('发送者'), dataIndex: 'username', width: 140 },
            {
              title: t('时间点'),
              dataIndex: 'progressMs',
              width: 100,
              render: (value: number) => `${Math.floor(value / 1000)}s`,
            },
            {
              title: t('状态'),
              dataIndex: 'status',
              width: 100,
              render: (value: string) => (
                <Tag color={value === 'visible' ? 'green' : value === 'hidden' ? 'orange' : 'red'}>
                  {value}
                </Tag>
              ),
            },
            {
              title: t('发送时间'),
              dataIndex: 'createdAt',
              width: 170,
              render: (value: string) => new Date(value).toLocaleString(),
            },
            {
              title: t('操作'),
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
