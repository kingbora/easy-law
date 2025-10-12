'use client';

import { Typography } from 'antd';

const { Title, Paragraph } = Typography;

export default function ProfilePage() {
  return (
    <div>
      <Title level={3}>个人资料</Title>
      <Paragraph type="secondary">在这里更新您的基本信息。</Paragraph>
    </div>
  );
}
