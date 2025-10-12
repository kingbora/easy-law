'use client';

import { Button, Card, Space, Typography, message } from 'antd';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { authClient } from '@/lib/auth-client';

import styles from './page.module.scss';

const { Title, Paragraph, Text } = Typography;

type SessionUser = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    let mounted = true;

    authClient
      .getSession()
      .then((result) => {
        if (!mounted || result.error) {
          return;
        }
        const sessionUser = result.data?.user as SessionUser | undefined;
        if (sessionUser) {
          setUser({
            name: sessionUser.name ?? null,
            email: sessionUser.email ?? null,
            role: 'role' in sessionUser ? (sessionUser as { role?: string | null }).role ?? null : null
          });
        }
      })
      .catch(() => {
        /* ignore */
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        message.error(result.error.message ?? '退出失败，请稍后重试');
        return;
      }
      message.success('已退出登录');
      router.push('/login');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '退出失败，请稍后重试');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <main className={styles.container}>
      <Card className={styles.card} bordered={false}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Title level={3}>欢迎来到 Easy Law 👋</Title>
          <Paragraph>
            快速开始构建你的法律服务产品，这里是一个使用 Next.js、Ant Design 和 TypeScript 的最简示例。
          </Paragraph>
          {user ? (
            <Space direction="vertical" size={4}>
              <Paragraph style={{ marginBottom: 0 }}>
                当前登录用户：<Text strong>{user.name ?? '未命名用户'}</Text>
                {user.email ? <Text type="secondary">（{user.email}）</Text> : null}
              </Paragraph>
              {user.role ? (
                <Text type="secondary">角色：{user.role}</Text>
              ) : null}
            </Space>
          ) : null}
          <Button type="default" onClick={handleSignOut} loading={isSigningOut}>
            退出登录
          </Button>
        </Space>
      </Card>
    </main>
  );
}
