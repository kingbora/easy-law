'use client';

import { Typography } from 'antd';

const { Title, Paragraph } = Typography;

export default function EmailVerificationPage() {
  return (
    <div>
      <Title level={3}>邮箱认证</Title>
      <Paragraph type="secondary">管理邮箱认证与验证状态。</Paragraph>
    </div>
  );
}
