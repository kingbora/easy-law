'use client';

import { useEffect, useMemo } from 'react';

import { Button, Descriptions, Form, Input, Modal, Select, Space, Typography } from 'antd';
import { EditOutlined } from '@ant-design/icons';

export const DEFAULT_INITIAL_PASSWORD = 'a@000123';

export interface TeamMemberModalResult {
  name: string;
  role: string;
  email: string;
  password?: string;
}

export interface TeamMemberModalDetail extends TeamMemberModalResult {
  joinDate?: string;
  status?: string;
  initialPassword?: string;
  roleLabel?: string;
}

type TeamMemberModalMode = 'create' | 'edit' | 'view';

interface RoleOption {
  label: string;
  value: string;
}

interface TeamMemberModalProps {
  open: boolean;
  mode: TeamMemberModalMode;
  roles: RoleOption[];
  initialValues?: TeamMemberModalDetail;
  onCancel: () => void;
  onSubmit?: (values: TeamMemberModalResult) => void;
  onModeChange?: (mode: Exclude<TeamMemberModalMode, 'create'>) => void;
  confirmLoading?: boolean;
}

interface TeamMemberFormValues {
  name: string;
  role: string;
  email: string;
  password?: string;
}

const { Paragraph, Title } = Typography;

export default function TeamMemberModal({
  open,
  mode,
  roles,
  initialValues,
  onCancel,
  onSubmit,
  onModeChange,
  confirmLoading
}: TeamMemberModalProps) {
  const [form] = Form.useForm<TeamMemberFormValues>();

  const title = useMemo(() => {
    if (mode === 'create') {
      return '新增成员';
    }
    if (mode === 'edit') {
      return `编辑成员${initialValues?.name ? ` - ${initialValues.name}` : ''}`;
    }
    return `成员详情${initialValues?.name ? ` - ${initialValues.name}` : ''}`;
  }, [initialValues?.name, mode]);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      return;
    }

    if (mode === 'view') {
      return;
    }

    form.setFieldsValue({
      name: initialValues?.name ?? '',
      role: initialValues?.role ?? roles[0]?.value ?? '',
      email: initialValues?.email ?? '',
      password: mode === 'create' ? DEFAULT_INITIAL_PASSWORD : undefined
    });
  }, [form, initialValues, mode, open, roles]);

  const handleSubmit = async () => {
    if (!onSubmit) {
      onCancel();
      return;
    }

    try {
      const values = await form.validateFields();
      const payload: TeamMemberModalResult = {
        name: values.name,
        role: values.role,
        email: values.email,
        password: mode === 'create' ? DEFAULT_INITIAL_PASSWORD : undefined
      };
      onSubmit(payload);
    } catch (error) {
      // validation errors handled by antd form
    }
  };

  const footer = mode === 'view'
    ? [
        <Button key="close" onClick={onCancel}>
          关闭
        </Button>,
        <Button key="edit" type="primary" icon={<EditOutlined />} onClick={() => onModeChange?.('edit')}>
          编辑成员
        </Button>
      ]
    : [
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="submit" type="primary" loading={confirmLoading} onClick={handleSubmit}>
          {mode === 'create' ? '创建' : '保存'}
        </Button>
      ];

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onCancel}
      footer={footer}
      maskClosable={false}
      destroyOnClose
      width={560}
    >
      {mode === 'view' ? (
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
          <Descriptions column={1} bordered>
            <Descriptions.Item label="成员名称">{initialValues?.name ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="角色类型">
              {initialValues?.roleLabel ?? roles.find((option) => option.value === initialValues?.role)?.label ?? initialValues?.role ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="成员邮箱">{initialValues?.email ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="加入时间">{initialValues?.joinDate ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="成员状态">{initialValues?.status ?? '在职'}</Descriptions.Item>
          </Descriptions>
          {initialValues?.initialPassword ? (
            <div>
              <Title level={5}>初始密码提示</Title>
              <Paragraph type="secondary">{initialValues.initialPassword}</Paragraph>
            </div>
          ) : null}
        </Space>
      ) : (
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            label="成员名称"
            name="name"
            rules={[{ required: true, message: '请输入成员名称' }]}
          >
            <Input placeholder="请输入成员名称" />
          </Form.Item>
          <Form.Item
            label="角色类型"
            name="role"
            rules={[{ required: true, message: '请选择角色类型' }]}
          >
            <Select
              placeholder="请选择角色类型"
              options={roles}
            />
          </Form.Item>
          <Form.Item
            label="成员邮箱"
            name="email"
            rules={[
              { required: true, message: '请输入成员邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input placeholder="请输入成员邮箱" />
          </Form.Item>
          {mode === 'create' ? (
            <Form.Item label="初始密码" name="password" initialValue={DEFAULT_INITIAL_PASSWORD}>
              <Input disabled />
            </Form.Item>
          ) : null}
        </Form>
      )}
    </Modal>
  );
}
