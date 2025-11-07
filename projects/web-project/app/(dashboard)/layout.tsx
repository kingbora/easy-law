'use client';

import {
  CalendarOutlined,
  BookOutlined,
  FolderOpenOutlined,
  HomeOutlined,
  LockOutlined,
  LogoutOutlined,
  RightOutlined,
  TeamOutlined,
  UserOutlined
} from '@ant-design/icons';
import {
  Avatar,
  Breadcrumb,
  Button,
  ConfigProvider,
  Dropdown,
  Layout,
  Menu,
  Typography,
  message,
  type MenuProps
} from 'antd';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import zhCN from 'antd/locale/zh_CN';
import { authClient } from '@/lib/auth-client';
import ProfileModal from '@/components/profile/ProfileModal';
import ResetPasswordModal from '@/components/profile/ResetPasswordModal';
import ScheduleDrawer from '@/components/schedule/ScheduleDrawer';
import { ApiError } from '@/lib/api-client';
import { updateUser, type UserRole } from '@/lib/users-api';
import { useSessionStore } from '@/lib/stores/session-store';

import { DashboardHeaderActionProvider } from './header-context';
import styles from './layout.module.scss';
import Image from 'next/image';

const { Header, Sider, Content } = Layout;

const CASE_DEPARTMENTS = [
  { key: 'work_injury', label: '工伤' },
  { key: 'insurance', label: '保险' }
] as const;

const DEPARTMENT_LABEL_MAP: Record<'work_injury' | 'insurance', string> = {
  work_injury: '工伤部门',
  insurance: '保险部门'
};

const ROLE_LABEL_MAP: Record<UserRole, string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  administration: '行政',
  lawyer: '律师',
  assistant: '律助',
  sale: '销售'
};

const pathKeyMap: Record<string, string> = CASE_DEPARTMENTS.reduce(
  (acc, dept) => ({
    ...acc,
    '/cases/my': 'cases-my',
    [`/cases/${dept.key}`]: `cases-${dept.key}`,
  }),
  {
    '/': 'overview',
    '/team': 'team'
  } as Record<string, string>
);

const breadcrumbMap: Record<string, string[]> = CASE_DEPARTMENTS.reduce(
  (acc, dept) => {
    acc[`/cases/${dept.key}`] = ['案件管理', `${dept.label}案件`];
    acc[`/cases/my`] = ['案件管理', '案件操作'];
    return acc;
  },
  {
    '/team': ['团队管理'],
  } as Record<string, string[]>
);

interface DashboardLayoutProps {
  children: ReactNode;
}

const TEAM_PERMISSION_ROLES = ['super_admin', 'admin', 'administration', 'lawyer', 'assistant'] as const;

type TeamPermissionRole = (typeof TEAM_PERMISSION_ROLES)[number];

function isTeamPermissionRole(role: UserRole): role is TeamPermissionRole {
  return (TEAM_PERMISSION_ROLES as readonly string[]).includes(role);
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sessionUser = useSessionStore((state) => state.user);
  const sessionInitialized = useSessionStore((state) => state.initialized);
  const sessionLoading = useSessionStore((state) => state.loading);
  const refreshSession = useSessionStore((state) => state.refresh);
  const updateSessionUser = useSessionStore((state) => state.updateUser);
  const clearSession = useSessionStore((state) => state.clear);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [headerAction, setHeaderAction] = useState<ReactNode | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [siderCollapsed, setSiderCollapsed] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  
  useEffect(() => {
    if (sessionInitialized || sessionLoading) {
      return;
    }

    void refreshSession();
  }, [refreshSession, sessionInitialized, sessionLoading]);

  const selectedKeys = useMemo(() => {
    const key = pathKeyMap[pathname] ?? null;
    return key ? [key] : [];
  }, [pathname]);

  const menuItems: MenuProps['items'] = useMemo(() => {
    const items: MenuProps['items'] = [];

    items.push({
      key: 'overview',
      icon: <HomeOutlined />,
      label: <Link href="/">首页概览</Link>
    });

    const role = sessionUser?.role ?? null;

    items.push(
      {
        key: 'cases',
        icon: <BookOutlined />,
        label: '案件管理',
        children: role === 'super_admin' ? (
          CASE_DEPARTMENTS.map((dept) => ({
          key: `cases-${dept.key}`,
          icon: <FolderOpenOutlined />,
          label: (
            <Link href={`/cases/${dept.key}`}>
              {dept.label}案件
            </Link>
          )
        }))
        ) : [{
          key: `cases-my`,
          icon: <FolderOpenOutlined />,
          label: (
            <Link href={`/cases/my`}>
              {role === 'admin' ? '所有' : '我的'}案件
            </Link>
          )
        }]
      },
    );

    if (
      role &&
      isTeamPermissionRole(role) &&
      authClient.admin.checkRolePermission({
        role,
        permissions: {
          team: ['list']
        }
      })
    ) {
      items.push({
        key: 'team',
        icon: <TeamOutlined />,
        label: <Link href="/team">团队管理</Link>
      });
    }

    return items;
  }, [sessionUser?.role]);

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

  const handleDropdownClick: MenuProps['onClick'] = async ({ key }) => {
    if (key === 'profile-info') {
      setProfileModalOpen(true);
      return;
    }
    if (key === 'password-reset') {
      setPasswordModalOpen(true);
      return;
    }
    if (key === 'signout') {
      setIsSigningOut(true);
      try {
        const result = await authClient.signOut();
        if (result.error) {
          message.error(result.error.message ?? '退出失败，请刷新页面再试试');
          return;
        }
        clearSession();
        message.success('已退出登录');
        router.push('/login');
      } catch (error) {
        message.error(error instanceof Error ? error.message : '退出失败，请刷新页面再试试');
      } finally {
        setIsSigningOut(false);
      }
    }
  };

  const handlePasswordSubmit = useCallback(
    async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
      setPasswordSaving(true);
      try {
        const result = await authClient.changePassword({
          currentPassword,
          newPassword
        });

        if (result.error) {
          message.error(result.error.message ?? '重置密码失败，请稍后重试');
          return;
        }

        message.success('密码已重置');
        setPasswordModalOpen(false);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : '重置密码失败，请稍后重试';
        message.error(errorMessage);
      } finally {
        setPasswordSaving(false);
      }
    },
    []
  );

  const uploadAvatar = useCallback(async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/profile/avatar', {
      method: 'POST',
      body: formData
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch (error) {
      // ignore and fallback below
    }

    if (!response.ok) {
      const messageText =
        payload && typeof payload === 'object' && payload !== null && 'message' in payload
          ? String((payload as { message?: unknown }).message ?? '上传头像失败')
          : '上传头像失败';
      throw new Error(messageText);
    }

    if (!payload || typeof payload !== 'object' || payload === null || typeof (payload as { path?: unknown }).path !== 'string') {
      throw new Error('上传头像失败');
    }

    return (payload as { path: string }).path;
  }, []);

  const handleProfileSubmit = useCallback(
    async ({ name, email, gender, avatarFile }: {
      name: string;
      email: string;
      gender: 'male' | 'female';
      avatarFile?: File | null;
    }) => {
      if (!sessionUser?.id) {
        message.error('未获取到用户信息');
        return;
      }

      setProfileSaving(true);
      try {
        let imagePath: string | null | undefined = undefined;
        if (avatarFile) {
          imagePath = await uploadAvatar(avatarFile);
        }

        const payload = {
          name,
          email,
          gender,
          image: imagePath
        } satisfies {
          name: string;
          email: string;
          gender: 'male' | 'female';
          image: string | null | undefined;
        };

        const updated = await updateUser(sessionUser.id, payload);
        updateSessionUser({
          name: updated.name ?? name,
          email: updated.email ?? email,
          gender: updated.gender ?? gender,
          image:
            imagePath !== undefined
              ? updated.image ?? imagePath ?? null
              : updated.image ?? sessionUser.image ?? null
        });

        message.success('个人资料已更新');
        setProfileModalOpen(false);
      } catch (error) {
        const errorMessage =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message || '更新个人资料失败，请稍后重试'
              : '更新个人资料失败，请稍后重试';
        message.error(errorMessage);
      } finally {
        setProfileSaving(false);
      }
    },
    [sessionUser?.id, sessionUser?.image, updateSessionUser, uploadAvatar]
  );

  const userMenu: MenuProps['items'] = useMemo(() => {
    return [
      {
        key: 'profile-info',
        label: (
          <div style={{ maxWidth: 240 }}>
            <Typography.Text strong style={{ display: 'block' }}>
              {sessionUser?.name ?? sessionUser?.email ?? '未设置昵称'}
            </Typography.Text>
            {
        sessionUser?.role !== 'super_admin' && (
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
            部门：{sessionUser?.department ? DEPARTMENT_LABEL_MAP[sessionUser.department] : '未分配部门'}
          </Typography.Text>
        )
      }
            <Typography.Text type="secondary" style={{ display: 'block', marginTop: 2 }}>
              角色：{sessionUser ? ROLE_LABEL_MAP[sessionUser.role] : '未知角色'}
            </Typography.Text>
          </div>
        )
      },
      { type: 'divider' },
      {
        key: 'password-reset',
        label: '重置密码',
        icon: <LockOutlined />
      },
      { type: 'divider' },
      {
        key: 'signout',
        label: '退出登录',
        icon: <LogoutOutlined />,
        disabled: isSigningOut
      }
    ];
  }, [isSigningOut, sessionUser]);

  const avatar = sessionUser?.image ? (
    <Avatar src={sessionUser.image} size={36} className={styles.avatarButton} />
  ) : (
    <Avatar size={36} icon={<UserOutlined />} className={styles.avatarButton} />
  );

  return (
    <ConfigProvider 
      locale={zhCN}
      theme={{
      components: {
        Layout: {
          headerBg: '#ffffff',
          headerPadding: '0 24px',
          siderBg: '#ffffff',
          bodyBg: '#f5f5f5',
          triggerBg: '#ffffff',
          triggerColor: '#1677ff',
          lightSiderBg: '#ffffff',
          lightTriggerBg: '#ffffff',
          lightTriggerColor: '#1677ff'
        }
      }
    }}>
      <DashboardHeaderActionProvider setAction={setHeaderAction}>
        <Layout className={styles.layout} hasSider>
          <Sider
            width={220}
            className={styles.sidebar}
            breakpoint="lg"
            collapsedWidth={64}
            theme="light"
            onCollapse={(collapsed) => setSiderCollapsed(collapsed)}
            onBreakpoint={(broken) => setSiderCollapsed(broken)}
        >
            <div className={styles.logo}>
              <Image
                priority
                src={siderCollapsed ? '/images/logo-icon.png' : '/images/logo.jpg'}
                width={siderCollapsed ? 32 : 120}
                height={siderCollapsed ? 32 : 50}
                alt="simple law"
            />
            </div>
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
                {headerAction}
                <Button
                  shape="circle"
                  className={styles.calendarButton}
                  onClick={() => setScheduleOpen(true)}
              >
                  <CalendarOutlined />
                </Button>
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
        <ProfileModal
          open={profileModalOpen}
          initialValues={{
            name: sessionUser?.name,
            email: sessionUser?.email,
            image: sessionUser?.image ?? null,
            gender: sessionUser?.gender ?? null
          }}
          onCancel={() => setProfileModalOpen(false)}
          onSubmit={handleProfileSubmit}
          confirmLoading={profileSaving}
        />
        <ResetPasswordModal
          open={passwordModalOpen}
          onCancel={() => setPasswordModalOpen(false)}
          onSubmit={handlePasswordSubmit}
          confirmLoading={passwordSaving}
        />
        <ScheduleDrawer open={scheduleOpen} onClose={() => setScheduleOpen(false)} />
      </DashboardHeaderActionProvider>
    </ConfigProvider>
  );
}
