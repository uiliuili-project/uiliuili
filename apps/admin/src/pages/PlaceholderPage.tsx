import { Card, Empty, Typography } from 'antd';

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <Card>
      <Typography.Title level={3}>{title}</Typography.Title>
      <Empty description="该模块正在建设中" />
    </Card>
  );
}
