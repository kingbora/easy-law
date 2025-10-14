'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button, Card, Form, Input, Popconfirm, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { PlusOutlined } from '@ant-design/icons';

import TeamMemberModal, {
  DEFAULT_INITIAL_PASSWORD,
  type TeamMemberModalDetail,
  type TeamMemberModalResult
} from '@/components/team/TeamMemberModal';
import { ApiError } from '@/lib/api-client';
import { createUser, deleteUser, fetchCurrentUser, fetchUsers, updateUser, type UserResponse, type UserRole } from '@/lib/users-api';

import { useDashboardHeaderAction } from '../header-context';

interface TeamMember {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  joinDate: string;
  image?: string | null;
  initialPassword?: string;
}

type Filters = {
  name?: string;
  role?: UserRole;
};

type ModalState =
  | { open: false }
  | { open: true; mode: 'create'; record?: undefined }
  | { open: true; mode: 'view' | 'edit'; record: TeamMember };

const ROLE_LABEL_MAP: Record<UserRole, string> = {
  master: '超级管理员',
  admin: '管理员',
  sale: '销售',
  lawyer: '律师',
  assistant: '助理'
};

const ROLE_COLOR_MAP: Record<UserRole, string> = {
  master: 'volcano',
  admin: 'geekblue',
  sale: 'purple',
  lawyer: 'green',
  assistant: 'blue'
};

const ROLE_OPTIONS = (Object.entries(ROLE_LABEL_MAP) as Array<[UserRole, string]>).map(([value, label]) => ({
  value,
  label
}));

function mapUserResponse(user: UserResponse, fallbackPassword?: string): TeamMember {
  return {
    id: user.id,
    name: user.name ?? '',
    role: user.role,
    email: user.email,
    joinDate: user.createdAt ? dayjs(user.createdAt).format('YYYY-MM-DD') : '',
    image: user.image,
    initialPassword: user.initialPassword ?? fallbackPassword
  };
}

export default function TeamManagementPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>({});
  const [modalState, setModalState] = useState<ModalState>({ open: false });
  const [submitting, setSubmitting] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [filterForm] = Form.useForm<Filters>();

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchUsers();
      setMembers(list.map((item) => mapUserResponse(item)));
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : '获取成员列表失败，请稍后重试';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    let mounted = true;

    const loadCurrentRole = async () => {
      try {
        const me = await fetchCurrentUser();
        if (!mounted) {
          return;
        }
        setCurrentUserRole(me.role);
      } catch (error) {
        // ignore
      }
    };

    void loadCurrentRole();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      if (filters.name) {
        const keyword = filters.name.toLowerCase();
        if (!member.name.toLowerCase().includes(keyword)) {
          return false;
        }
      }
      if (filters.role && member.role !== filters.role) {
        return false;
      }
      return true;
    });
  }, [filters, members]);

  const handleSearch = useCallback((values: Filters) => {
    setFilters({
      name: values.name?.trim() || undefined,
      role: values.role
    });
  }, []);

  const handleReset = useCallback(() => {
    filterForm.resetFields();
    setFilters({});
  }, [filterForm]);

  const openCreateModal = useCallback(() => {
    setModalState({ open: true, mode: 'create' });
  }, []);

  const creatableRoleOptions = useMemo(() => {
    if (currentUserRole === 'admin') {
      return ROLE_OPTIONS.filter((option) => option.value !== 'master' && option.value !== 'admin');
    }
    return ROLE_OPTIONS;
  }, [currentUserRole]);

  const modalRoleOptions = useMemo(() => {
    if (!modalState.open) {
      return ROLE_OPTIONS;
    }
    if (modalState.mode === 'create') {
      return creatableRoleOptions;
    }
    return ROLE_OPTIONS;
  }, [creatableRoleOptions, modalState]);

  const headerAction = useMemo(
    () => (
      <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
        添加成员
      </Button>
    ),
    [openCreateModal]
  );

  useDashboardHeaderAction(headerAction);

  const handleViewMember = useCallback((record: TeamMember) => {
    setModalState({ open: true, mode: 'view', record });
  }, []);

  const closeModal = useCallback(() => {
    setModalState({ open: false });
    setSubmitting(false);
  }, []);

  const handleModeChange = useCallback((mode: 'view' | 'edit') => {
    setModalState((prev) => {
      if (!prev.open || prev.mode === 'create' || !prev.record) {
        return prev;
      }
      return { open: true, mode, record: prev.record };
    });
  }, []);

  const handleSubmit = useCallback(
    async (values: TeamMemberModalResult) => {
      setSubmitting(true);
      try {
        const payload = {
          name: values.name.trim(),
          email: values.email.trim(),
          role: values.role as UserRole
        };

        if (
          modalState.open &&
          modalState.mode === 'create' &&
          currentUserRole === 'admin' &&
          (payload.role === 'master' || payload.role === 'admin')
        ) {
          message.error('管理员无法创建超级管理员或管理员角色');
          return;
        }

        if (modalState.open && modalState.mode === 'edit' && modalState.record) {
          const updated = await updateUser(modalState.record.id, payload);
          const nextMember = mapUserResponse(updated, modalState.record.initialPassword);
          setMembers((prev) =>
            prev.map((member) => (member.id === nextMember.id ? { ...member, ...nextMember } : member))
          );
          message.success('成员信息已更新');
        } else {
          const created = await createUser(payload);
          const nextMember = mapUserResponse(created, DEFAULT_INITIAL_PASSWORD);
          setMembers((prev) => [nextMember, ...prev]);
          message.success(`新增成员成功，初始密码为 ${created.initialPassword ?? DEFAULT_INITIAL_PASSWORD}`);
        }
        closeModal();
      } catch (error) {
        const errorMessage = error instanceof ApiError ? error.message : '操作失败，请稍后重试';
        message.error(errorMessage);
      } finally {
        setSubmitting(false);
      }
    },
    [closeModal, currentUserRole, modalState]
  );

  const handleDeleteMember = useCallback(
    async (id: string) => {
      setDeletingIds((prev) => ({ ...prev, [id]: true }));
      try {
        await deleteUser(id);
        setMembers((prev) => prev.filter((member) => member.id !== id));
        if (modalState.open && modalState.mode !== 'create' && modalState.record?.id === id) {
          closeModal();
        }
        message.success('成员已删除');
      } catch (error) {
        const errorMessage = error instanceof ApiError ? error.message : '删除失败，请稍后重试';
        message.error(errorMessage);
      } finally {
        setDeletingIds((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    [closeModal, modalState]
  );

  const columns = useMemo<ColumnsType<TeamMember>>(
    () => [
      {
        title: '成员名称',
        dataIndex: 'name',
        render: (name: string, record) => (
          <Button type="link" onClick={() => handleViewMember(record)}>
            {name}
          </Button>
        )
      },
      {
        title: '角色类型',
        dataIndex: 'role',
        render: (role: UserRole) => <Tag color={ROLE_COLOR_MAP[role]}>{ROLE_LABEL_MAP[role]}</Tag>
      },
      {
        title: '成员邮箱',
        dataIndex: 'email'
      },
      {
        title: '加入时间',
        dataIndex: 'joinDate'
      },
      {
        title: '操作',
        key: 'actions',
        render: (_, record) => (
          <Popconfirm
            title="确认删除该成员？"
            description="删除后将无法恢复，请确认。"
            okText="删除"
            cancelText="取消"
            okType="danger"
            onConfirm={() => handleDeleteMember(record.id)}
            okButtonProps={{ loading: Boolean(deletingIds[record.id]) }}
          >
            <Button type="link" danger loading={Boolean(deletingIds[record.id])}>
              删除
            </Button>
          </Popconfirm>
        )
      }
    ],
    [deletingIds, handleDeleteMember, handleViewMember]
  );

  const modalInitialValues = useMemo<TeamMemberModalDetail | undefined>(() => {
    if (!modalState.open || modalState.mode === 'create' || !modalState.record) {
      return undefined;
    }
    const { name, role, email, joinDate, initialPassword } = modalState.record;
    return {
      id: modalState.record.id,
      name,
      role,
      roleLabel: ROLE_LABEL_MAP[role],
      email,
      joinDate,
      initialPassword
    };
  }, [modalState]);

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Card>
        <Form<Filters>
          form={filterForm}
          layout="inline"
          onFinish={handleSearch}
          style={{ rowGap: 16 }}
        >
          <Form.Item label="成员名称" name="name">
            <Input allowClear placeholder="请输入成员姓名" style={{ width: 220 }} />
          </Form.Item>
          <Form.Item label="角色类型" name="role">
            <Select
              allowClear
              placeholder="请选择角色类型"
              style={{ width: 220 }}
              options={ROLE_OPTIONS}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                搜索
              </Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<TeamMember>
          rowKey="id"
          columns={columns}
          dataSource={filteredMembers}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          loading={loading}
        />
      </Card>

      {modalState.open ? (
        <TeamMemberModal
          open
          mode={modalState.mode}
          roles={modalRoleOptions}
          initialValues={modalInitialValues}
          onCancel={closeModal}
          onSubmit={handleSubmit}
          onModeChange={handleModeChange}
          confirmLoading={submitting}
        />
      ) : null}
    </Space>
  );
}
