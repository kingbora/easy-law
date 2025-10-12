'use client';

import { Card, Typography } from 'antd';
import type { ReactNode } from 'react';

import styles from './AuthShell.module.scss';

const { Title, Paragraph } = Typography;

interface AuthShellProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export const AuthShell = ({ title, description, children }: AuthShellProps) => (
  <div className={styles.container}>
    <Card className={styles.card} bordered={false}>
      <Title level={3}>{title}</Title>
      {description ? <Paragraph type="secondary">{description}</Paragraph> : null}
      <div className={styles.content}>{children}</div>
    </Card>
  </div>
);
