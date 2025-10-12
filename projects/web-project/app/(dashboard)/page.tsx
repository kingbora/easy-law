'use client';

import { Typography } from 'antd';

const { Title, Paragraph } = Typography;

export default function DashboardHomePage() {
  return (
    <div>
      <Title level={3}>首页概览</Title>
      <Paragraph type="secondary">这里展示团队关键指标和快捷入口。</Paragraph>
    </div>
  );
}
