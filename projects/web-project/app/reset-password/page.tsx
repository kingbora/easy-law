'use client';

import { LockOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, Typography, message } from 'antd';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { AuthShell } from '@/components/auth/AuthShell';
import { authClient } from '@/lib/auth-client';

const { Paragraph } = Typography;

type ResetFormValues = {
  password: string;
  confirmPassword: string;
};

const ResetPasswordPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const token = useMemo(() => searchParams.get('token') ?? '', [searchParams]);
  const redirectParam = useMemo(() => {
    const redirect = searchParams.get('redirect');
    return redirect && redirect.startsWith('/') ? redirect : undefined;
  }, [searchParams]);
  const loginHref = redirectParam ? `/login?redirect=${encodeURIComponent(redirectParam)}` : '/login';

  const handleFinish = async ({ password }: ResetFormValues) => {
    if (!token) {
      setErrorMessage('链接已失效或缺少有效的重置令牌。');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
  const result = await authClient.resetPassword({ token, newPassword: password });

      if (result.error) {
        setErrorMessage(result.error.message ?? '重置失败，请稍后再试');
        return;
      }

      message.success('密码重置成功');
      setSuccessMessage('密码已更新，现在可以使用新密码登录。');

      setTimeout(() => {
        router.push(loginHref);
      }, 1200);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '重置失败，请稍后再试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell title="重置密码" description="请设置新的登录密码">
      {!token ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="缺少重置令牌，请重新申请找回密码。"
        />
      ) : null}
      {errorMessage ? <Alert type="error" showIcon message={errorMessage} style={{ marginBottom: 16 }} /> : null}
      {successMessage ? <Alert type="success" showIcon message={successMessage} style={{ marginBottom: 16 }} /> : null}
      <Form<ResetFormValues>
        layout="vertical"
        onFinish={handleFinish}
        requiredMark={false}
        disabled={!token || isSubmitting}
      >
        <Form.Item
          label="新密码"
          name="password"
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 8, message: '密码至少 8 位' }
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="请输入新密码"
            autoComplete="new-password"
            size="large"
          />
        </Form.Item>
        <Form.Item
          label="确认密码"
          name="confirmPassword"
          dependencies={['password']}
          rules={[
            { required: true, message: '请再次输入新密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('两次输入的密码不一致'));
              }
            })
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="请再次输入新密码"
            autoComplete="new-password"
            size="large"
          />
        </Form.Item>
        <Button type="primary" htmlType="submit" size="large" block loading={isSubmitting}>
          重置密码
        </Button>
      </Form>
      <Paragraph style={{ marginTop: 16 }}>
  返回<Link href={loginHref}>登录</Link>
      </Paragraph>
    </AuthShell>
  );
};

export default ResetPasswordPage;
