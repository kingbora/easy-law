'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button, Descriptions, Input, Modal, Select, Space, Typography, message } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

export const DEFAULT_INITIAL_PASSWORD = 'a@000123';

export interface TeamMemberModalResult {
  name: string;
  role: string;
  email: string;
  password?: string;
}

export interface TeamMemberModalDetail extends TeamMemberModalResult {
  id?: string;
  joinDate?: string;
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

interface TeamMemberFormState {
  name: string;
  role: string;
  email: string;
  joinDate: string;
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
  const [formValues, setFormValues] = useState<TeamMemberFormState>({
    name: '',
    role: roles[0]?.value ?? '',
    email: '',
    joinDate: dayjs().format('YYYY-MM-DD')
  });

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
      return;
    }

    const baseRole = initialValues?.role ?? roles[0]?.value ?? '';
    const baseJoinDate =
      mode === 'create'
        ? dayjs().format('YYYY-MM-DD')
        : initialValues?.joinDate ?? '';

    setFormValues({
      name: initialValues?.name ?? '',
      role: baseRole,
      email: initialValues?.email ?? '',
      joinDate: baseJoinDate
    });
  }, [initialValues?.email, initialValues?.id, initialValues?.joinDate, initialValues?.name, initialValues?.role, mode, open, roles]);

  const handleSubmit = async () => {
    if (!onSubmit) {
      onCancel();
      return;
    }

    const { name, role, email } = formValues;

    if (!name.trim()) {
      message.error('请输入成员名称');
      return;
    }

    if (!role) {
      message.error('请选择角色类型');
      return;
    }

    if (!email.trim()) {
      message.error('请输入成员邮箱');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      message.error('请输入有效的邮箱地址');
      return;
    }

    const payload: TeamMemberModalResult = {
      name: name.trim(),
      role,
      email: email.trim(),
      password: mode === 'create' ? DEFAULT_INITIAL_PASSWORD : undefined
    };
    onSubmit(payload);
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
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <Descriptions column={1} bordered>
          <Descriptions.Item label="成员名称">
            {mode === 'view' ? (
              initialValues?.name ?? '-'
            ) : (
              <Input
                value={formValues.name}
                placeholder="请输入成员名称"
                onChange={(event) =>
                  setFormValues((prev) => ({
                    ...prev,
                    name: event.target.value
                  }))
                }
              />
            )}
          </Descriptions.Item>
          <Descriptions.Item label="角色类型">
            {mode === 'view' ? (
              initialValues?.roleLabel ??
              roles.find((option) => option.value === initialValues?.role)?.label ??
              initialValues?.role ??
              '-'
            ) : (
              <Select
                value={formValues.role}
                options={roles}
                placeholder="请选择角色类型"
                onChange={(value) =>
                  setFormValues((prev) => ({
                    ...prev,
                    role: value
                  }))
                }
              />
            )}
          </Descriptions.Item>
          <Descriptions.Item label="成员邮箱">
            {mode === 'view' ? (
              initialValues?.email ?? '-'
            ) : (
              <Input
                value={formValues.email}
                placeholder="请输入成员邮箱"
                onChange={(event) =>
                  setFormValues((prev) => ({
                    ...prev,
                    email: event.target.value
                  }))
                }
              />
            )}
          </Descriptions.Item>
          <Descriptions.Item label="加入时间">
            {mode === 'create'
              ? formValues.joinDate
              : mode === 'edit'
                ? initialValues?.joinDate ?? '-'
                : initialValues?.joinDate ?? '-'}
          </Descriptions.Item>
        </Descriptions>
        {(mode === 'view' && initialValues?.initialPassword) || mode === 'create' ? (
          <div>
            <Title level={5}>初始密码提示</Title>
            <Paragraph type="secondary">
              {mode === 'create' ? DEFAULT_INITIAL_PASSWORD : initialValues?.initialPassword}
            </Paragraph>
          </div>
        ) : null}
      </Space>
    </Modal>
  );
}
