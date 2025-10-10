'use client';

import { Card, Typography } from 'antd';

import styles from './page.module.scss';

const { Title, Paragraph } = Typography;

export default function HomePage() {
  return (
    <main className={styles.container}>
      <Card className={styles.card} bordered={false}>
        <Title level={3}>Hello, Easy Law 👋</Title>
        <Paragraph>
          快速开始构建你的法律服务产品，这里是一个使用 Next.js、Ant Design 和 TypeScript 的最简示例。
        </Paragraph>
      </Card>
    </main>
  );
}
