'use client';

import { Typography } from 'antd';
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
    <div className={styles.card}>
      <Title level={3} className={styles.cardTitle}>{title}</Title>
      {description ? <Paragraph type="secondary">{description}</Paragraph> : null}
      <div className={styles.content}>{children}</div>
    </div>
  </div>
);
