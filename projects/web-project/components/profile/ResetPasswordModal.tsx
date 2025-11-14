'use client';

import { useEffect } from 'react';

import { Form, Input, Modal } from 'antd';

interface ResetPasswordModalProps {
  open: boolean;
  onCancel: () => void;
  onSubmit: (values: { currentPassword: string; newPassword: string }) => Promise<void> | void;
  confirmLoading?: boolean;
}

interface ResetPasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ResetPasswordModal({ open, onCancel, onSubmit, confirmLoading }: ResetPasswordModalProps) {
  const [form] = Form.useForm<ResetPasswordFormValues>();

  useEffect(() => {
    if (!open) {
      form.resetFields();
    }
  }, [form, open]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      await onSubmit({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword
      });
      form.resetFields();
    } catch (error) {
      // validation errors are handled by antd form
    }
  };

  return (
    <Modal
      open={open}
      title="重置密码"
      okText="确认"
      cancelText="取消"
      onCancel={onCancel}
      onOk={handleOk}
      destroyOnHidden
      maskClosable={false}
      confirmLoading={confirmLoading}
      className="scrollable-modal"
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="原密码"
          name="currentPassword"
          rules={[{ required: true, message: '请输入原密码' }]}
        >
          <Input.Password placeholder="请输入原密码" autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          label="新密码"
          name="newPassword"
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 8, message: '新密码至少需要 8 位字符' },
            {
              validator: (_, value) => {
                if (!value || value !== form.getFieldValue('currentPassword')) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('新密码不能与原密码相同'));
              }
            }
          ]}
        >
          <Input.Password placeholder="请输入新密码" autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          label="确认新密码"
          name="confirmPassword"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: '请再次输入新密码' },
            {
              validator: (_, value) => {
                const newPassword = form.getFieldValue('newPassword');
                if (!value || value === newPassword) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('两次输入的密码不一致'));
              }
            }
          ]}
        >
          <Input.Password placeholder="请再次输入新密码" autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
