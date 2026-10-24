import { CloudDownloadOutlined, ReloadOutlined, SyncOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Col,
  Descriptions,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  notification,
} from 'antd';
import { useState } from 'react';
import { api } from '../api';
import type { AdminJob, SystemInfo } from '../types';

const { Title, Text } = Typography;

export function SystemPage() {
  const queryClient = useQueryClient();
  const [jobPage, setJobPage] = useState(1);
  const [jobStatus, setJobStatus] = useState<string | undefined>();
  const [updateInfo, setUpdateInfo] = useState<{
    available: boolean;
    current: string;
    latest: string | null;
    url?: string;
  } | null>(null);

  const system = useQuery({
    queryKey: ['admin-system'],
    queryFn: () => api.get<SystemInfo>('/api/v1/admin/system'),
    refetchInterval: 15_000,
  });
  const jobs = useQuery({
    queryKey: ['admin-jobs', jobPage, jobStatus],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(jobPage), limit: '20' });
      if (jobStatus) params.set('status', jobStatus);
      return api.get<{ items: AdminJob[]; total: number }>(`/api/v1/admin/jobs?${params}`);
    },
  });

  const retry = async (id: string) => {
    await api.post(`/api/v1/admin/jobs/${id}/retry`);
    notification.success({ message: '任务已重新排队' });
    await queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
  };

  const cancel = async (id: string) => {
    await api.post(`/api/v1/admin/jobs/${id}/cancel`);
    notification.success({ message: '任务已取消' });
    await queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
  };

  const checkUpdate = async () => {
    try {
      const result = await api.get<{
        available: boolean;
        current: string;
        latest: string | null;
        url?: string;
      }>('/api/v1/admin/system/update');
      setUpdateInfo(result);
    } catch (error) {
      notification.error({ message: error instanceof Error ? error.message : '检查失败' });
    }
  };

  const reindex = async () => {
    await api.post('/api/v1/admin/search/reindex');
    notification.success({ message: '重建索引任务已加入队列' });
  };

  const info = system.data;
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <Title level={3} style={{ margin: 0 }}>
          系统状态
        </Title>
        <Text className="muted">运行环境、队列与维护操作</Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="运行环境" loading={system.isLoading}>
            {info && (
              <Descriptions column={2} size="small">
                <Descriptions.Item label="版本">{info.version}</Descriptions.Item>
                <Descriptions.Item label="Node.js">{info.node}</Descriptions.Item>
                <Descriptions.Item label="数据库" span={2}>
                  {info.database}
                </Descriptions.Item>
                <Descriptions.Item label="FFmpeg">
                  <Tag color={info.ffmpeg ? 'green' : 'red'}>{info.ffmpeg ? '可用' : '不可用'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="存储">{info.storage}</Descriptions.Item>
                <Descriptions.Item label="搜索">{info.search}</Descriptions.Item>
                <Descriptions.Item label="缓存">{info.cache}</Descriptions.Item>
                <Descriptions.Item label="邮件">
                  <Tag color={info.mail ? 'green' : 'default'}>
                    {info.mail ? '已配置' : '未配置'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="运行时长">
                  {Math.floor(info.uptimeSeconds / 3600)} 小时
                </Descriptions.Item>
                <Descriptions.Item label="主机" span={2}>
                  {info.hostname} · {info.platform}
                </Descriptions.Item>
              </Descriptions>
            )}
            <Space wrap style={{ marginTop: 16 }}>
              <Button icon={<CloudDownloadOutlined />} onClick={() => void checkUpdate()}>
                检查更新
              </Button>
              <Button icon={<SyncOutlined />} onClick={() => void reindex()}>
                重建搜索索引
              </Button>
              {updateInfo && (
                <Text>
                  {updateInfo.available
                    ? `发现新版本 ${updateInfo.latest}`
                    : `当前 ${updateInfo.current} 已是最新`}
                </Text>
              )}
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="任务队列" loading={system.isLoading}>
            {info &&
              (Object.keys(info.queue).length > 0 ? (
                <Space wrap>
                  {Object.entries(info.queue).map(([status, count]) => (
                    <Tag key={status}>
                      {status}: {count}
                    </Tag>
                  ))}
                </Space>
              ) : (
                <Text type="secondary">队列空闲</Text>
              ))}
          </Card>
        </Col>
      </Row>

      <Card
        title="后台任务"
        style={{ marginTop: 16 }}
        extra={
          <Space>
            <Select
              placeholder="状态"
              allowClear
              style={{ width: 140 }}
              options={['created', 'retry', 'active', 'completed', 'failed', 'cancelled'].map(
                (value) => ({ value, label: value }),
              )}
              value={jobStatus}
              onChange={(value) => {
                setJobStatus(value);
                setJobPage(1);
              }}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => void queryClient.invalidateQueries({ queryKey: ['admin-jobs'] })}
            />
          </Space>
        }
      >
        <Table
          rowKey="id"
          loading={jobs.isLoading}
          dataSource={jobs.data?.items ?? []}
          scroll={{ x: 900 }}
          pagination={{
            current: jobPage,
            pageSize: 20,
            total: jobs.data?.total ?? 0,
            onChange: setJobPage,
          }}
          columns={[
            { title: '队列', dataIndex: 'queue', width: 130 },
            {
              title: '状态',
              dataIndex: 'status',
              width: 110,
              render: (value: string) => (
                <Tag color={value === 'failed' ? 'red' : value === 'active' ? 'blue' : 'default'}>
                  {value}
                </Tag>
              ),
            },
            {
              title: '进度',
              dataIndex: 'progress',
              width: 90,
              render: (value: number) => `${value}%`,
            },
            {
              title: '尝试',
              width: 90,
              render: (_value, record) => `${record.attempts}/${record.maxAttempts}`,
            },
            {
              title: '错误',
              dataIndex: 'lastError',
              ellipsis: true,
              render: (value: string | null) => value ?? '',
            },
            {
              title: '创建时间',
              dataIndex: 'createdAt',
              width: 170,
              render: (value: string) => new Date(value).toLocaleString(),
            },
            {
              title: '操作',
              width: 140,
              render: (_value, record) => (
                <Space>
                  {['failed', 'cancelled'].includes(record.status) && (
                    <Button size="small" onClick={() => void retry(record.id)}>
                      重试
                    </Button>
                  )}
                  {['created', 'retry'].includes(record.status) && (
                    <Button size="small" danger onClick={() => void cancel(record.id)}>
                      取消
                    </Button>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
