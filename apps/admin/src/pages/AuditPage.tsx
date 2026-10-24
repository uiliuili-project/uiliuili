import { useQuery } from '@tanstack/react-query';
import { Card, Input, Space, Table, Tag, Typography } from 'antd';
import { useState } from 'react';
import { api } from '../api';
import type { AuditLog } from '../types';

const { Title, Text } = Typography;

export function AuditPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [q, setQ] = useState('');

  const query = useQuery({
    queryKey: ['admin-audit', page, limit, q],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q) params.set('q', q);
      return api.get<{ items: AuditLog[]; total: number }>(`/api/v1/admin/audit?${params}`);
    },
  });

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <Title level={3} style={{ margin: 0 }}>
          审计日志
        </Title>
        <Text className="muted">管理员操作记录</Text>
      </div>
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="搜索操作类型"
            allowClear
            style={{ width: 260 }}
            onSearch={(value) => {
              setQ(value);
              setPage(1);
            }}
          />
        </Space>
        <Table
          rowKey="id"
          loading={query.isLoading}
          dataSource={query.data?.items ?? []}
          scroll={{ x: 800 }}
          pagination={{
            current: page,
            pageSize: limit,
            total: query.data?.total ?? 0,
            showSizeChanger: true,
            onChange: (nextPage, nextLimit) => {
              setPage(nextPage);
              setLimit(nextLimit);
            },
          }}
          columns={[
            { title: '操作', dataIndex: 'action', render: (value: string) => <Tag>{value}</Tag> },
            { title: '目标类型', dataIndex: 'targetType', width: 130 },
            { title: '目标 ID', dataIndex: 'targetId', width: 220, ellipsis: true },
            { title: '操作者', dataIndex: 'actor', width: 140 },
            { title: 'IP 哈希', dataIndex: 'ipHash', width: 180, ellipsis: true },
            {
              title: '时间',
              dataIndex: 'createdAt',
              width: 180,
              render: (value: string) => new Date(value).toLocaleString(),
            },
          ]}
        />
      </Card>
    </div>
  );
}
