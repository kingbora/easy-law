'use client';

import { MailOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, Typography, message } from 'antd';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { authClient } from '@/lib/auth-client';
import { AuthShell } from '@/components/auth/AuthShell';

const { Paragraph } = Typography;

type ForgotFormValues = {
  email: string;
};

const ForgotPasswordPage = () => {
  const searchParams = useSearchParams();
  const redirectParam = useMemo(() => {
    const redirect = searchParams.get('redirect');
    return redirect && redirect.startsWith('/') ? redirect : undefined;
  }, [searchParams]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleFinish = async (values: ForgotFormValues) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await authClient.requestPasswordReset({
        email: values.email
      });

      if (result.error) {
        setErrorMessage(result.error.message ?? '请求失败，请稍后再试');
        return;
      }

      message.success('重置链接已发送至邮箱');
      setSuccessMessage('如果邮箱存在，我们已发送一封重置密码的邮件。');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '请求失败，请稍后再试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell title="忘记密码" description="填写邮箱来找回密码">
      {errorMessage ? <Alert type="error" showIcon message={errorMessage} style={{ marginBottom: 16 }} /> : null}
      {successMessage ? <Alert type="success" showIcon message={successMessage} style={{ marginBottom: 16 }} /> : null}
      <Form<ForgotFormValues> layout="vertical" onFinish={handleFinish} requiredMark={false}>
        <Form.Item
          label="邮箱"
          name="email"
          rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}
        >
          <Input prefix={<MailOutlined />} placeholder="邮箱" autoComplete="email" size="large" />
        </Form.Item>
        <Button type="primary" htmlType="submit" size="large" block loading={isSubmitting}>
          发送重置链接
        </Button>
      </Form>
      <Paragraph style={{ marginTop: 16 }}>
        想起密码了？<Link href={redirectParam ? `/login?redirect=${encodeURIComponent(redirectParam)}` : '/login'}>返回登录</Link>
      </Paragraph>
    </AuthShell>
  );
};

export default ForgotPasswordPage;