import { CheckOutlined, CloseOutlined, DeleteOutlined, StopOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Select, Space, Table, Tag, Typography, notification } from 'antd';
import { useState } from 'react';
import { api } from '../api';
import type { AdminReport } from '../types';

const { Title, Text } = Typography;

const reasonLabels: Record<string, string> = {
  spam: '垃圾广告',
  abuse: '辱骂攻击',
  porn: '色情低俗',
  violence: '暴力血腥',
  copyright: '侵权',
  misinformation: '不实信息',
  other: '其他',
};

const targetLabels: Record<string, string> = {
  video: '视频',
  comment: '评论',
  danmaku: '弹幕',
  user: '用户',
};

export function ReportsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [status, setStatus] = useState<string | undefined>('open');
  const [targetType, setTargetType] = useState<string | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reports', page, limit, status, targetType],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (status) params.set('status', status);
      if (targetType) params.set('targetType', targetType);
      return api.get<{ items: AdminReport[]; total: number }>(`/api/v1/admin/reports?${params}`);
    },
  });

  const handle = async (id: string, action: string) => {
    try {
      await api.post(`/api/v1/admin/reports/${id}/handle`, { action });
      notification.success({ message: '举报已处理' });
      await queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
    } catch (error) {
      notification.error({ message: error instanceof Error ? error.message : '操作失败' });
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <Title level={3} style={{ margin: 0 }}>
          举报处理
        </Title>
        <Text className="muted">处理用户举报并执行内容操作</Text>
      </div>
      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Select
            placeholder="状态"
            allowClear
            style={{ width: 140 }}
            options={[
              { value: 'open', label: '待处理' },
              { value: 'resolved', label: '已处理' },
              { value: 'rejected', label: '已驳回' },
            ]}
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          />
          <Select
            placeholder="类型"
            allowClear
            style={{ width: 140 }}
            options={Object.entries(targetLabels).map(([value, label]) => ({ value, label }))}
            value={targetType}
            onChange={(value) => {
              setTargetType(value);
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
              title: '类型',
              dataIndex: 'targetType',
              width: 90,
              render: (value: string) => <Tag>{targetLabels[value] ?? value}</Tag>,
            },
            {
              title: '原因',
              dataIndex: 'reason',
              width: 120,
              render: (value: string) => reasonLabels[value] ?? value,
            },
            { title: '说明', dataIndex: 'detail' },
            { title: '举报人', dataIndex: 'reporter', width: 140 },
            {
              title: '状态',
              dataIndex: 'status',
              width: 100,
              render: (value: string) => (
                <Tag
                  color={value === 'open' ? 'orange' : value === 'resolved' ? 'green' : 'default'}
                >
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
              width: 250,
              render: (_value, record) =>
                record.status !== 'open' ? (
                  <Text type="secondary">已处理</Text>
                ) : (
                  <Space wrap>
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => void handle(record.id, 'delete')}
                    >
                      删除内容
                    </Button>
                    <Button
                      size="small"
                      icon={<StopOutlined />}
                      onClick={() => void handle(record.id, 'ban')}
                    >
                      封禁
                    </Button>
                    <Button
                      size="small"
                      icon={<CloseOutlined />}
                      onClick={() => void handle(record.id, 'restore')}
                    >
                      忽略
                    </Button>
                  </Space>
                ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
