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
import { useT } from '../i18n';
import type { AdminJob, SystemInfo } from '../types';

const { Title, Text } = Typography;

export function SystemPage() {
  const t = useT();
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
    notification.success({ message: t('任务已重新排队') });
    await queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
  };

  const cancel = async (id: string) => {
    await api.post(`/api/v1/admin/jobs/${id}/cancel`);
    notification.success({ message: t('任务已取消') });
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
      notification.error({ message: error instanceof Error ? error.message : t('检查失败') });
    }
  };

  const reindex = async () => {
    await api.post('/api/v1/admin/search/reindex');
    notification.success({ message: t('重建索引任务已加入队列') });
  };

  const info = system.data;
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <Title level={3} style={{ margin: 0 }}>
          {t('系统状态')}{' '}
        </Title>
        <Text className="muted">{t('运行环境、队列与维护操作')}</Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title={t('运行环境')} loading={system.isLoading}>
            {info && (
              <Descriptions column={2} size="small">
                <Descriptions.Item label={t('版本')}>{info.version}</Descriptions.Item>
                <Descriptions.Item label="Node.js">{info.node}</Descriptions.Item>
                <Descriptions.Item label={t('数据库')} span={2}>
                  {info.database}
                </Descriptions.Item>
                <Descriptions.Item label="FFmpeg">
                  <Tag color={info.ffmpeg ? 'green' : 'red'}>
                    {info.ffmpeg ? t('可用') : t('不可用')}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label={t('存储')}>{info.storage}</Descriptions.Item>
                <Descriptions.Item label={t('搜索')}>{info.search}</Descriptions.Item>
                <Descriptions.Item label={t('缓存')}>{info.cache}</Descriptions.Item>
                <Descriptions.Item label={t('邮件')}>
                  <Tag color={info.mail ? 'green' : 'default'}>
                    {info.mail ? t('已配置') : t('未配置')}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label={t('运行时长')}>
                  {Math.floor(info.uptimeSeconds / 3600)} {t('小时')}{' '}
                </Descriptions.Item>
                <Descriptions.Item label={t('主机')} span={2}>
                  {info.hostname} · {info.platform}
                </Descriptions.Item>
              </Descriptions>
            )}
            <Space wrap style={{ marginTop: 16 }}>
              <Button icon={<CloudDownloadOutlined />} onClick={() => void checkUpdate()}>
                {t('检查更新')}{' '}
              </Button>
              <Button icon={<SyncOutlined />} onClick={() => void reindex()}>
                {t('重建搜索索引')}{' '}
              </Button>
              {updateInfo && (
                <Text>
                  {updateInfo.available
                    ? t('发现新版本 {0}', { 0: updateInfo.latest })
                    : t('当前 {0} 已是最新', { 0: updateInfo.current })}
                </Text>
              )}
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title={t('任务队列')} loading={system.isLoading}>
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
                <Text type="secondary">{t('队列空闲')}</Text>
              ))}
          </Card>
        </Col>
      </Row>

      <Card
        title={t('后台任务')}
        style={{ marginTop: 16 }}
        extra={
          <Space>
            <Select
              placeholder={t('状态')}
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
            { title: t('队列'), dataIndex: 'queue', width: 130 },
            {
              title: t('状态'),
              dataIndex: 'status',
              width: 110,
              render: (value: string) => (
                <Tag color={value === 'failed' ? 'red' : value === 'active' ? 'blue' : 'default'}>
                  {value}
                </Tag>
              ),
            },
            {
              title: t('进度'),
              dataIndex: 'progress',
              width: 90,
              render: (value: number) => `${value}%`,
            },
            {
              title: t('尝试'),
              width: 90,
              render: (_value, record) => `${record.attempts}/${record.maxAttempts}`,
            },
            {
              title: t('错误'),
              dataIndex: 'lastError',
              ellipsis: true,
              render: (value: string | null) => value ?? '',
            },
            {
              title: t('创建时间'),
              dataIndex: 'createdAt',
              width: 170,
              render: (value: string) => new Date(value).toLocaleString(),
            },
            {
              title: t('操作'),
              width: 140,
              render: (_value, record) => (
                <Space>
                  {['failed', 'cancelled'].includes(record.status) && (
                    <Button size="small" onClick={() => void retry(record.id)}>
                      {t('重试')}{' '}
                    </Button>
                  )}
                  {['created', 'retry'].includes(record.status) && (
                    <Button size="small" danger onClick={() => void cancel(record.id)}>
                      {t('取消')}{' '}
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
