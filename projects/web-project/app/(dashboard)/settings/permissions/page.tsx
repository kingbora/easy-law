'use client';

import {
  ReloadOutlined,
  SaveOutlined
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Empty,
  Result,
  Select,
  Space,
  Spin,
  Tag,
  Transfer,
  Typography,
  message
} from 'antd';
import type { TransferItem } from 'antd/es/transfer';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchPermissionsOverview,
  updateRolePermissions,
  type PermissionDefinition,
  type PermissionRoleInfo,
  type PermissionsOverviewResponse,
  type PermissionCategory
} from '@/lib/permissions-api';
import type { UserRole } from '@/lib/users-api';

const { Paragraph, Text } = Typography;

type RoleAssignments = Record<UserRole, string[]>;

type PermissionTransferItem = TransferItem & {
  key: string;
  title: string;
  description: string;
  category: PermissionCategory;
};

const ALL_ROLES: UserRole[] = ['master', 'admin', 'sale', 'lawyer', 'assistant'];

const cloneAssignments = (input: RoleAssignments): RoleAssignments =>
  Object.fromEntries(
    Object.entries(input).map(([role, codes]) => [role, [...codes]])
  ) as RoleAssignments;

const areAssignmentsEqual = (a: RoleAssignments, b: RoleAssignments): boolean => {
  for (const role of ALL_ROLES) {
    const listA = a[role] ?? [];
    const listB = b[role] ?? [];
    if (listA.length !== listB.length) {
      return false;
    }
    const sortedA = [...listA].sort();
    const sortedB = [...listB].sort();
    for (let i = 0; i < sortedA.length; i += 1) {
      if (sortedA[i] !== sortedB[i]) {
        return false;
      }
    }
  }
  return true;
};

const buildTransferData = (definitions: PermissionDefinition[]): PermissionTransferItem[] =>
  definitions.map((item) => ({
    key: item.code,
    title: item.name,
    description: item.description ?? '暂无描述',
    category: item.category
  }));

const formatCategoryTag = (category: PermissionCategory) =>
  category === 'menu' ? <Tag color="processing">菜单</Tag> : <Tag color="gold">操作</Tag>;

const roleOptionLabel = (role: PermissionRoleInfo) => `${role.label}（${role.editable ? '可配置' : '只读'}）`;

export default function PermissionsManagementPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<PermissionsOverviewResponse | null>(null);
  const [assignments, setAssignments] = useState<RoleAssignments>({
    master: [],
    admin: [],
    sale: [],
    lawyer: [],
    assistant: []
  });
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const initialAssignmentsRef = useRef<RoleAssignments | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPermissionsOverview();
      setOverview(data);
      setAssignments(cloneAssignments(data.assignments));
      initialAssignmentsRef.current = cloneAssignments(data.assignments);

      setSelectedRole((prev) => {
        if (prev && data.roles.some((role) => role.role === prev)) {
          return prev;
        }
        return data.roles[0]?.role ?? null;
      });
    } catch (err) {
      const messageText = err instanceof Error ? err.message : '加载权限数据失败，请稍后重试';
      setError(messageText);
      setOverview(null);
      setSelectedRole(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const transferData = useMemo(() => (overview ? buildTransferData(overview.permissions) : []), [overview]);

  const isDirty = useMemo(() => {
    if (!initialAssignmentsRef.current) {
      return false;
    }
    return !areAssignmentsEqual(assignments, initialAssignmentsRef.current);
  }, [assignments]);

  const handleRoleChange = useCallback((value: UserRole) => {
    setSelectedRole(value);
  }, []);

  const handleTransferChange = useCallback(
    (role: UserRole, nextTargetKeys: string[]) => {
      setAssignments((prev) => ({
        ...prev,
        [role]: [...nextTargetKeys]
      }));
    },
    []
  );

  const handleReset = useCallback(() => {
    if (initialAssignmentsRef.current) {
      setAssignments(cloneAssignments(initialAssignmentsRef.current));
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!overview) {
      return;
    }

    const editableRoles = overview.roles.filter((role) => role.editable);

    setSaving(true);
    try {
      await updateRolePermissions({
        assignments: editableRoles.map((role) => ({
          role: role.role,
          permissions: [...(assignments[role.role] ?? [])]
        }))
      });
      message.success('权限配置已保存');
      await loadOverview();
    } catch (err) {
      const messageText = err instanceof Error ? err.message : '保存失败，请稍后重试';
      message.error(messageText);
    } finally {
      setSaving(false);
    }
  }, [overview, assignments, loadOverview]);

  const handleRefresh = useCallback(() => {
    void loadOverview();
  }, [loadOverview]);

  const actionButtons: ReactNode = (
    <Space>
      <Button icon={<ReloadOutlined />} onClick={handleRefresh} disabled={loading || saving}>
        刷新数据
      </Button>
      <Button onClick={handleReset} disabled={!isDirty || loading || saving}>
        撤销修改
      </Button>
      <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving} disabled={!isDirty || loading}>
        保存配置
      </Button>
    </Space>
  );

  const selectedRoleInfo = selectedRole && overview ? overview.roles.find((role) => role.role === selectedRole) : null;
  const targetKeys = selectedRole ? assignments[selectedRole] ?? [] : [];

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="操作提示"
        description="左侧列表表示未分配权限，右侧列表表示该角色已拥有的权限。可搜索权限名称或描述，并一次性调整多个角色后统一保存。"
      />

      {error && !loading ? (
        <Result
          status="error"
          title="权限数据加载失败"
          subTitle={error}
          extra={[
            <Button key="retry" type="primary" onClick={handleRefresh}>
              重新加载
            </Button>
          ]}
        />
      ) : (
        <Spin spinning={loading} tip="正在获取权限数据...">
          {overview ? (
            <Card bordered>
              <Space direction="vertical" size={20} style={{ width: '100%' }}>
                <Space wrap>
                  <Text strong>选择角色：</Text>
                  <Select<UserRole>
                    value={selectedRole ?? undefined}
                    placeholder="请选择角色"
                    style={{ minWidth: 220 }}
                    onChange={handleRoleChange}
                    options={overview.roles.map((role) => ({
                      value: role.role,
                      label: roleOptionLabel(role)
                    }))}
                  />
                  {selectedRoleInfo && !selectedRoleInfo.editable ? (
                    <Tag color="blue">该角色为只读，无法修改权限</Tag>
                  ) : null}
                </Space>

                {selectedRoleInfo ? (
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Paragraph style={{ marginBottom: 0 }}>
                      <Text strong>角色说明：</Text> {selectedRoleInfo.description ?? '暂未设置描述'}
                    </Paragraph>
                    <Transfer<PermissionTransferItem>
                      dataSource={transferData}
                      titles={[
                        <span key="left">未分配</span>,
                        <span key="right">已分配</span>
                      ]}
                      showSearch
                      listStyle={{ width: '100%', minWidth: 280, height: 360 }}
                      targetKeys={targetKeys}
                      onChange={(nextTarget) =>
                        handleTransferChange(
                          selectedRoleInfo.role,
                          nextTarget.map(String)
                        )
                      }
                      render={(item) => (
                        <Space direction="vertical" size={0} style={{ width: '100%' }}>
                          <Space size={8} align="baseline">
                            <Text>{item.title}</Text>
                            {formatCategoryTag(item.category)}
                          </Space>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {item.description}
                          </Text>
                        </Space>
                      )}
                      disabled={!selectedRoleInfo.editable}
                      filterOption={(input, item) =>
                        (item?.title ?? '')
                          .toLowerCase()
                          .includes(input.toLowerCase()) ||
                        (item?.description ?? '')
                          .toLowerCase()
                          .includes(input.toLowerCase())
                      }
                    />
                  </Space>
                ) : (
                  <Empty description="未找到可配置的角色" />
                )}
              </Space>
            </Card>
          ) : null}
        </Spin>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{actionButtons}</div>
    </Space>
  );
}
