'use client';

import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, Typography, message } from 'antd';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { authClient } from '@/lib/auth-client';
import { AuthShell } from '@/components/auth/AuthShell';

const { Paragraph } = Typography;

type RegisterFormValues = {
  name: string;
  email: string;
  password: string;
};

const RegisterPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = useMemo(() => {
    const redirect = searchParams.get('redirect');
    return redirect && redirect.startsWith('/') ? redirect : undefined;
  }, [searchParams]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFinish = async (values: RegisterFormValues) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await authClient.signUp.email(values);
      if (result.error) {
        setErrorMessage(result.error.message ?? '注册失败，请稍后重试');
        return;
      }
      message.success('注册成功');
      router.push(redirectParam ?? '/');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '注册失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell title="注册" description="填写信息创建新账户">
      {errorMessage ? <Alert type="error" showIcon message={errorMessage} style={{ marginBottom: 16 }} /> : null}
      <Form<RegisterFormValues> layout="vertical" onFinish={handleFinish} requiredMark={false}>
        <Form.Item
          label="姓名"
          name="name"
          rules={[{ required: true, message: '请输入姓名' }]}
        >
          <Input prefix={<UserOutlined />} placeholder="姓名" autoComplete="name" size="large" />
        </Form.Item>
        <Form.Item
          label="邮箱"
          name="email"
          rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}
        >
          <Input prefix={<MailOutlined />} placeholder="邮箱" autoComplete="email" size="large" />
        </Form.Item>
        <Form.Item
          label="密码"
          name="password"
          rules={[{ required: true, message: '请输入密码' }, { min: 8, message: '密码至少 8 位' }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="密码"
            autoComplete="new-password"
            size="large"
          />
        </Form.Item>
        <Button type="primary" htmlType="submit" size="large" block loading={isSubmitting}>
          注册
        </Button>
      </Form>
      <Paragraph style={{ marginTop: 16 }}>
        已有账号？<Link href={redirectParam ? `/login?redirect=${encodeURIComponent(redirectParam)}` : '/login'}>返回登录</Link>
      </Paragraph>
    </AuthShell>
  );
};

export default RegisterPage;
