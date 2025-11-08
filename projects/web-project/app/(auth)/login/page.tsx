'use client';

import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { Alert, App, Button, Form, Input, Typography } from 'antd';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';

import { authClient } from '@/lib/auth-client';
import { AuthShell } from '@/components/auth/AuthShell';
import { useSessionStore } from '@/lib/stores/session-store';

const { Paragraph } = Typography;

type LoginFormValues = {
  email: string;
  password: string;
};

const LoginPageContent = () => {
  const { message } = App.useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = useMemo(() => {
    const redirect = searchParams.get('redirect');
    return redirect && redirect.startsWith('/') ? redirect : undefined;
  }, [searchParams]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFinish = async (values: LoginFormValues) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await authClient.signIn.email(values);
      if (result.error) {
        setErrorMessage(result.error.message ?? '登录失败，请稍后重试');
        return;
      }
      useSessionStore.getState().clear();
      message.success('登录成功');
      router.replace(redirectParam ?? '/');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '登录失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell title="账号登录">
      {errorMessage ? <Alert type="error" showIcon message={errorMessage} style={{ marginBottom: 16 }} /> : null}
      <Form<LoginFormValues> layout="vertical" onFinish={handleFinish} requiredMark={false}>
        <Form.Item
          label="邮箱"
          name="email"
          rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}
        >
          <Input prefix={<MailOutlined />} placeholder="test@qq.com" autoComplete="email" size="large" />
        </Form.Item>
        <Form.Item
          label="密码"
          name="password"
          rules={[{ required: true, message: '请输入密码' }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="密码"
            autoComplete="current-password"
            size="large"
          />
        </Form.Item>
        <Button type="primary" htmlType="submit" size="large" block loading={isSubmitting}>
          登录
        </Button>
      </Form>
      <Paragraph type="secondary" style={{ marginTop: 16, textAlign: 'center' }}>
        如需开通账号，请联系系统管理员。
      </Paragraph>
    </AuthShell>
  );
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
