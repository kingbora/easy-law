'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { Button, Descriptions, Input, Modal, Select, Space, Typography, message } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import type { UserRole, UserDepartment } from '@/lib/users-api';

export const DEFAULT_INITIAL_PASSWORD = 'a@000123';

export interface TeamMemberModalResult {
  name: string;
  role: UserRole;
  email: string;
  password?: string;
  gender?: 'male' | 'female' | null;
  department?: UserDepartment | null;
  supervisorId?: string | null;
}

export interface TeamMemberModalDetail extends TeamMemberModalResult {
  id?: string;
  joinDate?: string;
  initialPassword?: string;
  roleLabel?: string;
  supervisor?: { id: string; name: string | null } | null;
}

type TeamMemberModalMode = 'create' | 'edit' | 'view';

interface RoleOption {
  label: string;
  value: UserRole;
}

interface SupervisorOption {
  label: string;
  value: string;
  role?: UserRole;
}

interface DepartmentOption {
  label: string;
  value: UserDepartment;
}

interface TeamMemberModalProps {
  open: boolean;
  mode: TeamMemberModalMode;
  roles: RoleOption[];
  supervisors?: SupervisorOption[];
  departmentOptions?: DepartmentOption[];
  departmentEditable?: boolean;
  defaultDepartment?: UserDepartment | null;
  defaultSupervisorId?: string | null;
  getSupervisorOptions?: (params: {
    role: UserRole;
    department: UserDepartment | null;
    excludeUserId?: string | null;
  }) => SupervisorOption[];
  initialValues?: TeamMemberModalDetail;
  onCancel: () => void;
  onSubmit?: (values: TeamMemberModalResult) => void;
  onModeChange?: (mode: Exclude<TeamMemberModalMode, 'create'>) => void;
  confirmLoading?: boolean;
}

interface TeamMemberFormState {
  name: string;
  role: UserRole;
  email: string;
  joinDate: string;
  gender: 'male' | 'female' | null;
  department: UserDepartment | null;
  supervisorId: string | null;
}

const { Paragraph, Title } = Typography;

const GENDER_OPTIONS = [
  { label: '男', value: 'male' as const },
  { label: '女', value: 'female' as const }
];

const GENDER_LABEL_MAP: Record<'male' | 'female', string> = {
  male: '男',
  female: '女'
};

const DEPARTMENT_OPTIONS: DepartmentOption[] = [
  { label: '工伤部门', value: 'work_injury' },
  { label: '保险部门', value: 'insurance' }
];

const DEPARTMENT_LABEL_MAP: Record<UserDepartment, string> = {
  work_injury: '工伤部门',
  insurance: '保险部门'
};

export default function TeamMemberModal({
  open,
  mode,
  roles,
  supervisors = [],
  departmentOptions,
  departmentEditable = true,
  defaultDepartment = null,
  defaultSupervisorId = null,
  getSupervisorOptions,
  initialValues,
  onCancel,
  onSubmit,
  onModeChange,
  confirmLoading
}: TeamMemberModalProps) {
  const effectiveDepartmentOptions = (departmentOptions && departmentOptions.length > 0
    ? departmentOptions
    : DEPARTMENT_OPTIONS);
  const singleDepartmentValue = useMemo(
    () => (effectiveDepartmentOptions.length === 1 ? effectiveDepartmentOptions[0].value : null),
    [effectiveDepartmentOptions]
  );
  const fallbackRole = (roles[0]?.value ?? 'assistant') as UserRole;
  const [formValues, setFormValues] = useState<TeamMemberFormState>({
    name: '',
    role: fallbackRole,
    email: '',
    joinDate: dayjs().format('YYYY-MM-DD'),
    gender: null,
    department: defaultDepartment ?? singleDepartmentValue,
    supervisorId: null
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

    const baseRole = (initialValues?.role ?? roles[0]?.value ?? 'assistant') as UserRole;
    const baseJoinDate =
      mode === 'create'
        ? dayjs().format('YYYY-MM-DD')
        : initialValues?.joinDate ?? '';
    const baseDepartment =
      initialValues?.department ??
      (mode === 'create'
        ? defaultDepartment ?? singleDepartmentValue
        : initialValues?.department ?? null);

    setFormValues({
      name: initialValues?.name ?? '',
      role: baseRole,
      email: initialValues?.email ?? '',
      joinDate: baseJoinDate,
      gender: initialValues?.gender ?? null,
      department: baseDepartment ?? null,
      supervisorId: initialValues?.supervisor?.id ?? null
    });
  }, [
    defaultDepartment,
    initialValues?.department,
    initialValues?.email,
    initialValues?.gender,
    initialValues?.id,
    initialValues?.joinDate,
    initialValues?.name,
    initialValues?.role,
    initialValues?.supervisor?.id,
    mode,
    open,
    roles,
    singleDepartmentValue
  ]);

  const isSuperAdminSelection = formValues.role === 'super_admin';
  const departmentDisabled = isSuperAdminSelection || !departmentEditable;
  const supervisorDisabled = isSuperAdminSelection || formValues.role === 'admin';
  const requiresSupervisor = !supervisorDisabled;
  const departmentPlaceholder = departmentDisabled
    ? isSuperAdminSelection
      ? '无需选择'
      : '不可更改所属部门'
    : '请选择所属部门';

  const availableSupervisorOptions = useMemo(() => {
    const excludeUserId = initialValues?.id ?? null;
    const baseOptions = getSupervisorOptions
      ? getSupervisorOptions({
          role: formValues.role,
          department: formValues.department,
          excludeUserId
        })
      : supervisors.filter((option) => option.value !== (initialValues?.id ?? ''));
    const filtered = baseOptions.filter((option) => option.value !== (initialValues?.id ?? ''));
    const merged = (() => {
      if (initialValues?.supervisor?.id) {
        const exists = filtered.some((option) => option.value === initialValues.supervisor!.id);
        if (!exists) {
          return [
            ...filtered,
            {
              value: initialValues.supervisor.id,
              label: initialValues.supervisor.name ?? '未命名律师'
            }
          ];
        }
      }
      return filtered;
    })();
    const rolePriority = (role?: UserRole) => {
      if (role === 'admin') {
        return 0;
      }
      if (role === 'super_admin') {
        return 1;
      }
      return 2;
    };
    return [...merged].sort((a, b) => {
      const priorityDiff = rolePriority(a.role) - rolePriority(b.role);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return a.label.localeCompare(b.label, 'zh-Hans-CN');
    });
  }, [
    formValues.department,
    formValues.role,
    getSupervisorOptions,
    initialValues?.id,
    initialValues?.supervisor,
    supervisors
  ]);

  useEffect(() => {
    if (mode !== 'create' || supervisorDisabled) {
      return;
    }
    setFormValues((prev) => {
      const options = availableSupervisorOptions;
      const currentExists = prev.supervisorId
        ? options.some((option) => option.value === prev.supervisorId)
        : false;
      if (currentExists) {
        return prev;
      }
      const canUseDefault = defaultSupervisorId
        ? options.some((option) => option.value === defaultSupervisorId)
        : false;
      if (canUseDefault && prev.supervisorId !== defaultSupervisorId) {
        return {
          ...prev,
          supervisorId: defaultSupervisorId!
        };
      }
      if (!canUseDefault && prev.supervisorId !== null) {
        return {
          ...prev,
          supervisorId: null
        };
      }
      return prev;
    });
  }, [availableSupervisorOptions, defaultSupervisorId, mode, supervisorDisabled]);

  useEffect(() => {
    if (mode === 'create' || supervisorDisabled) {
      return;
    }
    setFormValues((prev) => {
      if (!prev.supervisorId) {
        return prev;
      }
      const exists = availableSupervisorOptions.some((option) => option.value === prev.supervisorId);
      if (exists) {
        return prev;
      }
      return {
        ...prev,
        supervisorId: null
      };
    });
  }, [availableSupervisorOptions, mode, supervisorDisabled]);

  const handleSubmit = async () => {
    if (!onSubmit) {
      onCancel();
      return;
    }

    const { name, role, email, gender, department, supervisorId } = formValues;

    const requiresDepartment = formValues.role !== 'super_admin';

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

    if (requiresDepartment && !department) {
      message.error('请选择所属部门');
      return;
    }

    if (requiresSupervisor && !supervisorId) {
      message.error('请选择直属上级');
      return;
    }

    const payload: TeamMemberModalResult = {
      name: name.trim(),
      role,
      email: email.trim(),
      password: mode === 'create' ? DEFAULT_INITIAL_PASSWORD : undefined,
      gender,
      department: requiresDepartment ? department ?? null : null,
      supervisorId: supervisorDisabled ? null : supervisorId ?? null
    };
    onSubmit(payload);
  };

  const viewFooter: ReactNode[] = [
    <Button key="close" onClick={onCancel}>
      关闭
    </Button>
  ];

  if (onModeChange) {
    viewFooter.push(
      <Button key="edit" type="primary" icon={<EditOutlined />} onClick={() => onModeChange('edit')}>
        编辑成员
      </Button>
    );
  }

  const footer = mode === 'view'
    ? viewFooter
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
      destroyOnHidden
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
          <Descriptions.Item label="性别">
            {mode === 'view' ? (
              initialValues?.gender ? GENDER_LABEL_MAP[initialValues.gender] : '-'
            ) : (
              <Select
                allowClear
                value={formValues.gender ?? undefined}
                options={GENDER_OPTIONS}
                placeholder="请选择性别"
                onChange={(value) =>
                  setFormValues((prev) => ({
                    ...prev,
                    gender: (value ?? null) as 'male' | 'female' | null
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
              <Select<UserRole>
                value={formValues.role}
                options={roles}
                placeholder="请选择角色类型"
                onChange={(value) =>
                  setFormValues((prev) => ({
                    ...prev,
                    role: value,
                    department: value === 'super_admin' ? null : prev.department,
                    supervisorId: value === 'super_admin' || value === 'admin' ? null : prev.supervisorId
                  }))
                }
              />
            )}
          </Descriptions.Item>
          <Descriptions.Item label="所属部门">
            {mode === 'view' ? (
              initialValues?.department ? DEPARTMENT_LABEL_MAP[initialValues.department] : '—'
            ) : (
              <Select
                allowClear={!departmentDisabled}
                disabled={departmentDisabled}
                value={formValues.department ?? undefined}
                options={effectiveDepartmentOptions}
                placeholder={departmentPlaceholder}
                onChange={(value) =>
                  setFormValues((prev) => ({
                    ...prev,
                    department: (value ?? null) as UserDepartment | null
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
          <Descriptions.Item label="直属上级">
            {mode === 'view' ? (
              initialValues?.supervisor?.name ?? '—'
            ) : (
              <Select
                allowClear={!requiresSupervisor}
                showSearch={!supervisorDisabled}
                optionFilterProp="label"
                disabled={supervisorDisabled}
                options={availableSupervisorOptions}
                value={formValues.supervisorId ?? undefined}
                placeholder={supervisorDisabled ? '无需选择' : requiresSupervisor ? '请选择直属上级' : '请选择直属上级（可选）'}
                filterOption={(input, option) =>
                  (option?.label as string | undefined)?.toLowerCase().includes(input.toLowerCase()) ?? false
                }
                onChange={(value) =>
                  setFormValues((prev) => ({
                    ...prev,
                    supervisorId: (value ?? null) as string | null
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
