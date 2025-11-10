'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { App, Button, Card, Form, Input, Popconfirm, Result, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';

import TeamMemberModal, {
  DEFAULT_INITIAL_PASSWORD,
  type TeamMemberModalDetail,
  type TeamMemberModalResult
} from '@/components/team/TeamMemberModal';
import { ApiError } from '@/lib/api-client';
import {
  createUser,
  deleteUser,
  updateUser,
  type UserRole
} from '@/lib/users-api';
import { useCurrentUser } from '@/lib/stores/session-store';
import {
  DEFAULT_TEAM_PAGINATION,
  mapUserToTeamMember,
  useTeamStore,
  type TeamFilters,
  type TeamMember
} from '@/lib/stores/team-store';
import { ROLE_LABEL_MAP, ROLE_COLOR_MAP, DEPARTMENT_LABEL_MAP, DEPARTMENT_COLOR_MAP } from '@/utils/constants';
import { useDashboardHeaderAction } from '../header-context';
import styles from './styles.module.scss';

type TeamMemberTreeNode = TeamMember & { children?: TeamMemberTreeNode[] };

type Filters = TeamFilters;

type ModalState =
  | { open: false }
  | { open: true; mode: 'create'; record?: undefined }
  | { open: true; mode: 'view' | 'edit'; record: TeamMember };


const ROLE_OPTIONS = (Object.entries(ROLE_LABEL_MAP) as Array<[UserRole, string]>).map(([value, label]) => ({
  value,
  label
}));

const TEAM_ACCESS_ROLES: readonly UserRole[] = ['super_admin', 'admin'];
const TEAM_ACCESS_ROLE_SET: ReadonlySet<UserRole> = new Set(TEAM_ACCESS_ROLES);
const ADMIN_MANAGEABLE_ROLES: readonly UserRole[] = ['sale', 'lawyer', 'administration', 'assistant'];
const ADMIN_MANAGEABLE_ROLE_SET: ReadonlySet<UserRole> = new Set(ADMIN_MANAGEABLE_ROLES);
const SUPERVISOR_ROLE_RULES: Partial<Record<UserRole, readonly UserRole[]>> = {
  administration: ['administration', 'admin'],
  sale: ['sale', 'admin'],
  lawyer: ['lawyer', 'admin'],
  assistant: ['lawyer', 'admin']
};

const MIN_PAGE_SIZE = 5;
const MAX_PAGE_SIZE = 40;
const ESTIMATED_ROW_HEIGHT = 56;
const RESERVED_VERTICAL_SPACE = 360;

export default function TeamManagementPage() {
  const { message } = App.useApp();
  const [modalState, setModalState] = useState<ModalState>({ open: false });
  const [submitting, setSubmitting] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});
  const [filterForm] = Form.useForm<Filters>();

  const currentUser = useCurrentUser();

  const members = useTeamStore((state) => state.members);
  const teamLoading = useTeamStore((state) => state.loading);
  const teamInitialized = useTeamStore((state) => state.initialized);
  const filters = useTeamStore((state) => state.filters);
  const pagination = useTeamStore((state) => state.pagination);
  const loadTeamMembers = useTeamStore((state) => state.loadMembers);
  const setTeamFilters = useTeamStore((state) => state.setFilters);
  const resetTeamFilters = useTeamStore((state) => state.resetFilters);
  const setTeamPagination = useTeamStore((state) => state.setPagination);
  const upsertTeamMember = useTeamStore((state) => state.upsertMember);
  const removeTeamMember = useTeamStore((state) => state.removeMember);

  useEffect(() => {
    if (teamInitialized) {
      return;
    }
    void loadTeamMembers().catch((error) => {
      const errorMessage = error instanceof ApiError ? error.message : '获取成员列表失败，请稍后重试';
      message.error(errorMessage);
    });
  }, [loadTeamMembers, message, teamInitialized]);

  useEffect(() => {
    filterForm.setFieldsValue({
      name: filters.name,
      role: filters.role
    });
  }, [filterForm, filters]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const availableHeight = Math.max(window.innerHeight - RESERVED_VERTICAL_SPACE, MIN_PAGE_SIZE * ESTIMATED_ROW_HEIGHT);
    const estimated = Math.floor(availableHeight / ESTIMATED_ROW_HEIGHT);
    const initialSize = Math.max(MIN_PAGE_SIZE, Math.min(MAX_PAGE_SIZE, estimated || DEFAULT_TEAM_PAGINATION.pageSize));
    const optionSet = new Set(pagination.pageSizeOptions ?? DEFAULT_TEAM_PAGINATION.pageSizeOptions);
    optionSet.add(String(initialSize));
    const pageSizeOptions = Array.from(optionSet)
      .map((value) => Number(value))
      .sort((a, b) => a - b)
      .map((value) => value.toString());

    const needsUpdate =
      pagination.pageSize !== initialSize ||
      pagination.defaultPageSize !== initialSize ||
      pagination.pageSizeOptions.length !== pageSizeOptions.length ||
      pagination.pageSizeOptions.some((value, index) => value !== pageSizeOptions[index]);

    if (!needsUpdate) {
      return;
    }

    setTeamPagination({
      current: 1,
      pageSize: initialSize,
      defaultPageSize: initialSize,
      pageSizeOptions
    });
  }, [pagination.defaultPageSize, pagination.pageSize, pagination.pageSizeOptions, setTeamPagination]);

  const viewableMembers = useMemo(() => {
    if (!currentUser) {
      return [];
    }
    if (currentUser.role === 'super_admin') {
      return members;
    }
    if (currentUser.role === 'admin') {
      if (!currentUser.department) {
        return [];
      }
      return members.filter(
        (member) => member.department === currentUser.department && ADMIN_MANAGEABLE_ROLE_SET.has(member.role)
      );
    }
    return [];
  }, [currentUser, members]);

  const matchesFilters = useCallback(
    (member: TeamMember) => {
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
    },
    [filters]
  );

  const treeMembers = useMemo<TeamMemberTreeNode[]>(() => {
    if (!viewableMembers.length) {
      return [];
    }

    const nodeMap = new Map<string, TeamMemberTreeNode>();

    viewableMembers.forEach((member) => {
      nodeMap.set(member.id, { ...member, children: [] });
    });

    const rootIds = new Set(nodeMap.keys());

    viewableMembers.forEach((member) => {
      if (!member.supervisorId) {
        return;
      }
      const parentNode = nodeMap.get(member.supervisorId);
      const currentNode = nodeMap.get(member.id);
      if (!parentNode || !currentNode) {
        return;
      }
      parentNode.children = parentNode.children ?? [];
      parentNode.children.push(currentNode);
      rootIds.delete(member.id);
    });

    const pruneNodes = (nodes: TeamMemberTreeNode[]): TeamMemberTreeNode[] => {
      return nodes.reduce<TeamMemberTreeNode[]>((acc, node) => {
        const childNodes = node.children ? pruneNodes(node.children) : [];
        const matched = matchesFilters(node);
        if (!matched && childNodes.length === 0) {
          return acc;
        }
        acc.push({
          ...node,
          children: childNodes.length ? childNodes : undefined
        });
        return acc;
      }, []);
    };

    const roots = Array.from(rootIds)
      .map((id) => nodeMap.get(id))
      .filter((node): node is TeamMemberTreeNode => Boolean(node));

    return pruneNodes(roots);
  }, [matchesFilters, viewableMembers]);

  const totalMemberCount = useMemo(() => {
    const countNodes = (nodes: TeamMemberTreeNode[]): number =>
      nodes.reduce((acc, node) => acc + 1 + (node.children ? countNodes(node.children) : 0), 0);
    return countNodes(treeMembers);
  }, [treeMembers]);

  const rootMemberCount = useMemo(() => treeMembers.length, [treeMembers]);

  const handleSearch = useCallback(
    (values: Filters) => {
      setTeamFilters({
        name: values.name?.trim() || undefined,
        role: values.role
      });
    },
    [setTeamFilters]
  );

  const handleReset = useCallback(() => {
    filterForm.resetFields();
    resetTeamFilters();
  }, [filterForm, resetTeamFilters]);

  useEffect(() => {
    const pageSize = pagination.pageSize || DEFAULT_TEAM_PAGINATION.pageSize;
    const totalPages = pageSize > 0 ? Math.ceil(rootMemberCount / pageSize) : 1;
    const nextCurrent = Math.min(pagination.current ?? 1, Math.max(totalPages, 1));

    if (pagination.total === rootMemberCount && nextCurrent === pagination.current) {
      return;
    }

    setTeamPagination({
      total: rootMemberCount,
      current: nextCurrent
    });
  }, [pagination, rootMemberCount, setTeamPagination]);

  const creatableRoleOptions = useMemo(() => {
    if (!currentUser) {
      return [];
    }
    if (currentUser.role === 'super_admin') {
      return ROLE_OPTIONS;
    }
    if (currentUser.role === 'admin') {
      return ROLE_OPTIONS.filter((option) => ADMIN_MANAGEABLE_ROLE_SET.has(option.value));
    }
    return [];
  }, [currentUser]);

  const modalRoleOptions = useMemo(() => {
    if (!modalState.open) {
      return ROLE_OPTIONS;
    }
    if (!currentUser) {
      return ROLE_OPTIONS;
    }
    if (modalState.mode === 'create') {
      return creatableRoleOptions;
    }
    if (currentUser.role === 'admin') {
      const recordRole = modalState.record?.role;
      return ROLE_OPTIONS.filter((option) => {
        if (option.value === recordRole) {
          return true;
        }
        return ADMIN_MANAGEABLE_ROLE_SET.has(option.value);
      });
    }
    return ROLE_OPTIONS;
  }, [creatableRoleOptions, currentUser, modalState]);

  const filterRoleOptions = useMemo(() => {
    if (!currentUser) {
      return ROLE_OPTIONS;
    }
    if (currentUser.role === 'super_admin') {
      return ROLE_OPTIONS;
    }
    if (currentUser.role === 'admin') {
      return ROLE_OPTIONS.filter((option) => ADMIN_MANAGEABLE_ROLE_SET.has(option.value));
    }
    return [];
  }, [currentUser]);

  const hasTeamAccess = currentUser ? TEAM_ACCESS_ROLE_SET.has(currentUser.role) : false;

  const openCreateModal = useCallback(() => {
    if (!hasTeamAccess) {
      message.error('您没有权限执行此操作');
      return;
    }
    if (!creatableRoleOptions.length) {
      message.error('暂无可创建的角色');
      return;
    }
    setModalState({ open: true, mode: 'create' });
  }, [creatableRoleOptions.length, hasTeamAccess, message]);

  const headerAction = useMemo(() => {
    if (!hasTeamAccess) {
      return null;
    }
    return (
      <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal} disabled={!creatableRoleOptions.length}>
        添加成员
      </Button>
    );
  }, [creatableRoleOptions.length, hasTeamAccess, openCreateModal]);

  useDashboardHeaderAction(headerAction);

  const canManageMember = useCallback(
    (member: TeamMember) => {
      if (!currentUser) {
        return false;
      }
      if (currentUser.role === 'super_admin') {
        return true;
      }
      if (currentUser.role === 'admin') {
        return (
          !!currentUser.department &&
          member.department === currentUser.department &&
          ADMIN_MANAGEABLE_ROLE_SET.has(member.role)
        );
      }
      return false;
    },
    [currentUser]
  );

  const defaultDepartmentForModal = currentUser?.role === 'admin' ? currentUser.department ?? null : null;

  const departmentOptionsForModal = useMemo(() => {
    if (currentUser?.role === 'admin' && currentUser.department) {
      return [
        {
          value: currentUser.department,
          label: DEPARTMENT_LABEL_MAP[currentUser.department]
        }
      ];
    }
    return undefined;
  }, [currentUser]);

  const supervisorOptionBuilder = useCallback(
    ({ role, department, excludeUserId }: { role: UserRole; department: TeamMember['department']; excludeUserId?: string | null }) => {
      if (!department) {
        return [];
      }

      const allowedRoles = SUPERVISOR_ROLE_RULES[role] ?? [];
      if (!allowedRoles.length) {
        return [];
      }

      return members
        .filter((member) => {
          if (excludeUserId && member.id === excludeUserId) {
            return false;
          }
          return member.department === department && allowedRoles.includes(member.role);
        })
        .map((member) => ({
          value: member.id,
          label: `${member.name}（${ROLE_LABEL_MAP[member.role]}）`,
          role: member.role
        }));
    },
    [members]
  );
  const defaultSupervisorIdForModal = currentUser?.role === 'admin' ? currentUser.id : null;

  const handlePaginationChange = useCallback(
    (page: number, pageSize?: number) => {
      setTeamPagination({
        current: page,
        pageSize: pageSize ?? pagination.pageSize
      });
    },
    [pagination.pageSize, setTeamPagination]
  );

  const handlePageSizeChange = useCallback(
    (current: number, size: number) => {
      const optionSet = new Set((pagination.pageSizeOptions ?? DEFAULT_TEAM_PAGINATION.pageSizeOptions).map(Number));
      optionSet.add(size);
      const pageSizeOptions = Array.from(optionSet)
        .sort((a, b) => a - b)
        .map((value) => value.toString());

      setTeamPagination({
        current,
        pageSize: size,
        pageSizeOptions
      });
    },
    [pagination.pageSizeOptions, setTeamPagination]
  );

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
      if (!currentUser) {
        message.error('未获取到当前用户信息，无法执行操作');
        return;
      }
      if (!hasTeamAccess) {
        message.error('您没有权限执行此操作');
        return;
      }

      const payload = {
        name: values.name.trim(),
        email: values.email.trim(),
        role: values.role,
        gender: values.gender ?? null,
        department: values.department ?? null,
        supervisorId: values.supervisorId ?? null,
      };

      if (currentUser.role === 'admin') {
        if (!currentUser.department) {
          message.error('管理员未分配部门，无法执行操作');
          return;
        }
        if (!ADMIN_MANAGEABLE_ROLE_SET.has(payload.role)) {
          message.error('管理员仅可管理本部门的销售、律师、行政和律助角色');
          return;
        }
        if (payload.department !== currentUser.department) {
          message.error('管理员仅可为本部门成员执行操作');
          return;
        }
      }

      setSubmitting(true);
      try {
        if (modalState.open && modalState.mode === 'edit' && modalState.record) {
          if (!canManageMember(modalState.record)) {
            message.error('您无权编辑该成员');
            return;
          }
          const updated = await updateUser(modalState.record.id, {
            ...payload,
            updaterId: currentUser.id
          });
          const nextMember = mapUserToTeamMember(updated, modalState.record.initialPassword);
          upsertTeamMember(nextMember);
          message.success('成员信息已更新');
        } else {
          const created = await createUser({
            ...payload,
            creatorId: currentUser.id
          });
          const nextMember = mapUserToTeamMember(created, DEFAULT_INITIAL_PASSWORD);
          upsertTeamMember(nextMember);
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
    [canManageMember, closeModal, currentUser, hasTeamAccess, message, modalState, upsertTeamMember]
  );

  const handleDeleteMember = useCallback(
    async (id: string) => {
      const targetMember = members.find((member) => member.id === id);
      if (!targetMember) {
        return;
      }
      if (!canManageMember(targetMember)) {
        message.error('您无权删除该成员');
        return;
      }

      setDeletingIds((prev) => ({ ...prev, [id]: true }));
      try {
        await deleteUser(id);
        removeTeamMember(id);
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
    [canManageMember, closeModal, members, message, modalState, removeTeamMember]
  );

  const columns = useMemo<ColumnsType<TeamMember>>(() => {
    const list: ColumnsType<TeamMember> = [
      {
        title: '',
        dataIndex: '__expander',
        key: '__expander',
        width: 48,
        align: 'center',
        render: () => null
      },
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
      }
    ];

    if (currentUser?.role === 'super_admin') {
      list.push({
        title: '所属部门',
        dataIndex: 'department',
        render: (department: TeamMember['department']) =>
          department ? (
            <Tag color={DEPARTMENT_COLOR_MAP[department]}>{DEPARTMENT_LABEL_MAP[department]}</Tag>
          ) : (
            '—'
          )
      });
    }

    list.push(
      {
        title: '加入时间',
        dataIndex: 'joinDate'
      },
      {
        title: '操作',
        key: 'actions',
        render: (_, record) => {
          const manageable = canManageMember(record);
          return (
            <Space size="small">
              <Button
                type="link"
                onClick={() => setModalState({ open: true, mode: 'edit', record })}
                disabled={!manageable}
              >
                编辑
              </Button>
              <Popconfirm
                title="确认删除此成员吗？"
                description="删除后将无法恢复，请确认。"
                okText="删除"
                cancelText="取消"
                okType="danger"
                disabled={!manageable}
                onConfirm={() => handleDeleteMember(record.id)}
              >
                <Button type="link" danger loading={Boolean(deletingIds[record.id])} disabled={!manageable}>
                  删除
                </Button>
              </Popconfirm>
            </Space>
          );
        }
      }
    );

    return list;
  }, [canManageMember, currentUser?.role, deletingIds, handleDeleteMember, handleViewMember]);
  const modalInitialValues = useMemo<TeamMemberModalDetail | undefined>(() => {
    if (!modalState.open || modalState.mode === 'create' || !modalState.record) {
      return undefined;
    }
    const { name, role, email, joinDate, gender, initialPassword, department, supervisor } = modalState.record;
    return {
      id: modalState.record.id,
      name,
      role,
      roleLabel: ROLE_LABEL_MAP[role],
      email,
      joinDate,
      gender,
      initialPassword,
      department,
      supervisor
    };
  }, [modalState]);

  const modalCanEdit =
    modalState.open && modalState.mode !== 'create' && modalState.record
      ? canManageMember(modalState.record)
      : true;

  if (!hasTeamAccess) {
    return <Result status="403" title="暂无权限" subTitle="您无权访问团队管理，请联系管理员。" />;
  }

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
              options={filterRoleOptions}
              disabled={!filterRoleOptions.length}
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
          dataSource={treeMembers}
          pagination={{
            ...pagination,
            className: styles.pagination,
            showTotal: (_, range) => `共 ${totalMemberCount} 人，当前显示第 ${range[0]}-${range[1]} 条`,
            onChange: handlePaginationChange,
            onShowSizeChange: handlePageSizeChange
          }}
          expandable={{
                defaultExpandAllRows: true,
                expandIconColumnIndex: 0,
              }}
          loading={teamLoading}
        />
      </Card>

      {modalState.open ? (
        <TeamMemberModal
          open
          mode={modalState.mode}
          roles={modalRoleOptions}
          departmentOptions={departmentOptionsForModal}
          departmentEditable={currentUser?.role !== 'admin'}
          defaultDepartment={defaultDepartmentForModal}
          defaultSupervisorId={defaultSupervisorIdForModal}
          getSupervisorOptions={supervisorOptionBuilder}
          initialValues={modalInitialValues}
          onCancel={closeModal}
          onSubmit={handleSubmit}
          onModeChange={modalCanEdit ? handleModeChange : undefined}
          confirmLoading={submitting}
        />
      ) : null}
    </Space>
  );
}
