import {
  CommentOutlined,
  DatabaseOutlined,
  FlagOutlined,
  PlayCircleOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Alert, Card, Col, Row, Skeleton, Statistic, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useT } from '../i18n';
import type { DashboardStats } from '../types';

const { Title, Paragraph, Text } = Typography;

export function DashboardPage() {
  const t = useT();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DashboardStats>('/api/v1/admin/dashboard')
      .then(setStats)
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : t('加载失败')),
      );
  }, []);

  if (error) {
    return (
      <Card>
        <Alert type="warning" showIcon message={t('仪表盘暂不可用')} description={error} />
        <Paragraph className="muted" style={{ marginTop: 16 }}>
          {t('如果这是刚安装完成的实例，请确认 API 已重启且 worker 正在运行。')}{' '}
        </Paragraph>
      </Card>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>
          {t('仪表盘')}{' '}
        </Title>
        <Text className="muted">{t('站点运行概览')}</Text>
      </div>
      {!stats ? (
        <Card>
          <Skeleton active />
        </Card>
      ) : (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <Card className="stat-card">
                <Statistic title={t('用户总数')} value={stats.users} prefix={<TeamOutlined />} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="stat-card">
                <Statistic
                  title={t('视频总数')}
                  value={stats.videos}
                  prefix={<PlayCircleOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="stat-card">
                <Statistic
                  title={t('今日弹幕')}
                  value={stats.danmakuToday}
                  prefix={<CommentOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="stat-card">
                <Statistic
                  title={t('待处理举报')}
                  value={stats.pendingReports}
                  prefix={<FlagOutlined />}
                />
              </Card>
            </Col>
          </Row>
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={12}>
              <Card title={t('系统状态')}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div>
                    {t('版本：')}
                    <Text code>{stats.system.version}</Text>
                  </div>
                  <div>
                    {t('数据库：')}
                    <Tag color="green">{stats.system.database}</Tag>
                  </div>
                  <div>
                    FFmpeg：
                    <Tag color={stats.system.ffmpeg ? 'green' : 'red'}>
                      {stats.system.ffmpeg ? t('可用') : t('不可用')}
                    </Tag>
                  </div>
                  <div>
                    {t('搜索：')}
                    <Tag>{stats.system.search}</Tag>
                  </div>
                  <div>
                    {t('缓存：')}
                    <Tag>{stats.system.cache}</Tag>
                  </div>
                  <div>
                    {t('存储占用：')} <Text>{formatBytes(stats.storageUsed)}</Text>
                  </div>
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title={t('队列')}>
                {Object.keys(stats.queue).length === 0 ? (
                  <Text className="muted">{t('暂无任务')}</Text>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {Object.entries(stats.queue).map(([name, count]) => (
                      <div key={name} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{name}</span>
                        <Tag>{count}</Tag>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Col>
          </Row>
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={12}>
              <Card title={t('最近注册')}>
                {stats.recentUsers.length === 0 ? (
                  <Text className="muted">{t('暂无用户')}</Text>
                ) : (
                  stats.recentUsers.map((user) => (
                    <div
                      key={user.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderBottom: '1px solid #f5f5f5',
                      }}
                    >
                      <span>
                        {user.displayName} <Text type="secondary">@{user.username}</Text>
                      </span>
                      <Text type="secondary">{new Date(user.createdAt).toLocaleDateString()}</Text>
                    </div>
                  ))
                )}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title={t('最近投稿')}>
                {stats.recentVideos.length === 0 ? (
                  <Text className="muted">{t('暂无投稿')}</Text>
                ) : (
                  stats.recentVideos.map((video) => (
                    <div
                      key={video.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '8px 0',
                        borderBottom: '1px solid #f5f5f5',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {video.title}
                      </span>
                      <Tag>{video.status}</Tag>
                    </div>
                  ))
                )}
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(1)} ${units[index]}`;
}
