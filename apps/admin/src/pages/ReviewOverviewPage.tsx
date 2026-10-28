import {
  CheckCircleOutlined,
  CommentOutlined,
  ExclamationCircleOutlined,
  FlagOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Col, Row, Space, Statistic, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useT } from '../i18n';

const { Title, Text } = Typography;

interface ReviewSummary {
  pendingVideos: number;
  openReports: number;
  hiddenComments: number;
  todayActions: number;
  overdueVideos: number;
}

export function ReviewOverviewPage() {
  const t = useT();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['review-summary'],
    queryFn: () => api.get<ReviewSummary>('/api/v1/review/summary'),
    refetchInterval: 30_000,
  });

  return (
    <Space direction="vertical" size="large" className="w-full">
      <div>
        <Title level={3} style={{ margin: 0 }}>
          {t('审核概览')}
        </Title>
        <Text className="muted">{t('集中处理待审视频、评论与举报。')}</Text>
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={isLoading}>
            <Statistic
              title={t('待审视频')}
              value={data?.pendingVideos ?? 0}
              prefix={<PlayCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={isLoading}>
            <Statistic
              title={t('待处理举报')}
              value={data?.openReports ?? 0}
              prefix={<FlagOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={isLoading}>
            <Statistic
              title={t('已隐藏评论')}
              value={data?.hiddenComments ?? 0}
              prefix={<CommentOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={isLoading}>
            <Statistic
              title={t('今日审核操作')}
              value={data?.todayActions ?? 0}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>
      <Card>
        <Space direction="vertical" size="middle">
          <Space align="center">
            <ExclamationCircleOutlined style={{ color: '#faad14' }} />
            <Text>
              {t('超过 24 小时未处理的待审视频：{0} 个', { 0: data?.overdueVideos ?? 0 })}
            </Text>
          </Space>
          <Space wrap>
            <Button type="primary" onClick={() => navigate('/review/videos')}>
              {t('进入视频审核')}
            </Button>
            <Button onClick={() => navigate('/review/comments')}>{t('进入评论审核')}</Button>
            <Button onClick={() => navigate('/reports')}>{t('处理举报')}</Button>
          </Space>
        </Space>
      </Card>
    </Space>
  );
}
