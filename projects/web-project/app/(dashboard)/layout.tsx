'use client';

import {
  BellOutlined,
  BookOutlined,
  ContactsOutlined,
  FolderOpenOutlined,
  HomeOutlined,
  LogoutOutlined,
  PlusOutlined,
  RightOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserOutlined
} from '@ant-design/icons';
import { Avatar, Badge, Breadcrumb, Button, Dropdown, Layout, Menu, message, type MenuProps } from 'antd';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { authClient } from '@/lib/auth-client';

import styles from './layout.module.scss';

const { Header, Sider, Content } = Layout;

const pathKeyMap: Record<string, string> = {
  '/': 'overview',
  '/cases/my': 'cases-my',
  '/clients/my': 'clients-my',
  '/team': 'team'
};

const breadcrumbMap: Record<string, string[]> = {
  '/cases/my': ['案件管理', '我的案件'],
  '/clients/my': ['客户管理', '我的客户'],
  '/team': ['团队管理'],
  '/profile': ['个人资料'],
  '/settings/email': ['邮箱认证']
};

interface SessionUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
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
          setUser(sessionUser);
        }
      })
      .catch(() => {
        /* noop */
      });

    return () => {
      mounted = false;
    };
  }, []);

  const selectedKeys = useMemo(() => {
    const key = pathKeyMap[pathname] ?? null;
    return key ? [key] : [];
  }, [pathname]);

  const menuItems: MenuProps['items'] = useMemo(
    () => [
      {
        key: 'overview',
        icon: <HomeOutlined />,
        label: <Link href="/">首页概览</Link>
      },
      {
        key: 'cases',
        icon: <BookOutlined />,
        label: '案件管理',
        children: [
          {
            key: 'cases-my',
            icon: <FolderOpenOutlined />,
            label: <Link href="/cases/my">我的案件</Link>
          }
        ]
      },
      {
        key: 'clients',
        icon: <ContactsOutlined />,
        label: '客户管理',
        children: [
          {
            key: 'clients-my',
            icon: <SolutionOutlined />,
            label: <Link href="/clients/my">我的客户</Link>
          }
        ]
      },
      {
        key: 'team',
        icon: <TeamOutlined />,
        label: <Link href="/team">团队管理</Link>
      }
    ],
    []
  );

  const breadcrumbItems = useMemo(() => {
    const segments = breadcrumbMap[pathname] ?? [];

    return [
      {
        key: 'dashboard-home',
        title:
          pathname === '/' ? null : (
            <Link href="/">
              <HomeOutlined />
            </Link>
          )
      },
      ...segments.map((title, index) => ({
        title,
        key: `${pathname}-crumb-${index}`
      }))
    ];
  }, [pathname]);

  const actionButton = useMemo(() => {
    if (pathname === '/cases/my') {
      return (
        <Button icon={<PlusOutlined />} type="primary" onClick={() => {}}>
          新增案件
        </Button>
      );
    }
    if (pathname === '/clients/my') {
      return (
        <Button icon={<PlusOutlined />} type="primary" onClick={() => {}}>
          新增客户
        </Button>
      );
    }
    return null;
  }, [pathname]);

  const handleDropdownClick: MenuProps['onClick'] = async ({ key }) => {
    if (key === 'profile') {
      router.push('/profile');
      return;
    }
    if (key === 'email') {
      router.push('/settings/email');
      return;
    }
    if (key === 'signout') {
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
    }
  };

  const userMenu: MenuProps['items'] = [
    {
      key: 'profile',
      label: '个人资料'
    },
    {
      key: 'email',
      label: '邮箱认证'
    },
    { type: 'divider' },
    {
      key: 'signout',
      label: '退出登录',
      icon: <LogoutOutlined />,
      disabled: isSigningOut
    }
  ];

  const avatarInitial = useMemo(() => {
    const source = user?.name ?? user?.email ?? '';
    return source ? source.trim().charAt(0).toUpperCase() : null;
  }, [user]);

  const avatar = user?.image ? (
    <Avatar src={user.image} size={36} className={styles.avatarButton} />
  ) : avatarInitial ? (
    <Avatar size={36} className={styles.avatarButton}>
      {avatarInitial}
    </Avatar>
  ) : (
    <Avatar size={36} icon={<UserOutlined />} className={styles.avatarButton} />
  );

  return (
    <Layout className={styles.layout} hasSider>
      <Sider width={220} className={styles.sidebar} breakpoint="lg" collapsedWidth={64} theme="light">
        <div className={styles.logo}>Easy Law</div>
        <Menu
          mode="inline"
          items={menuItems}
          selectedKeys={selectedKeys}
          defaultOpenKeys={['cases', 'clients']}
        />
      </Sider>
      <Layout>
        <Header className={styles.header}>
          <Breadcrumb className={styles.breadcrumb} items={breadcrumbItems} separator={<RightOutlined />} />
          <div className={styles.headerRight}>
            {actionButton}
            <Badge dot>
                <Button
                  type='text'
                  shape='circle'
                  icon={<BellOutlined />}
                />
              </Badge>
            <Dropdown
              menu={{ items: userMenu, onClick: handleDropdownClick }}
              trigger={['click']}
              placement="bottomRight"
            >
              {avatar}
            </Dropdown>
          </div>
        </Header>
        <Content className={styles.content}>{children}</Content>
      </Layout>
    </Layout>
  );
}
