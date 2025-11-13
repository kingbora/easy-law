'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import dayjs from 'dayjs';
import { App, Button, Card, Form, Input, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';

import {
  fetchClientDetail,
  fetchClients,
  updateClientDetail,
  type CaseClientDetail,
  type CaseClientRecord,
  type ClientListQuery,
  type UpdateCaseClientPayload
} from '@/lib/clients-api';
import { useSessionStore } from '@/lib/stores/session-store';
import { useDashboardHeaderAction } from '../header-context';
import { ClientDetailModal } from '@/components/clients/ClientDetailModal';
import { type CaseStatus, type UserDepartment, DEPARTMENT_LABEL_MAP, CASE_STATUS_LABEL_MAP } from '@easy-law/shared-types';

type Filters = {
  search?: string;
  department?: UserDepartment | null;
};

const DEFAULT_PAGE_SIZE = 10;

const CASE_TYPE_LABEL_MAP = {
  work_injury: '工伤',
  personal_injury: '人损',
  other: '其他'
} as const;

const CASE_STATUS_COLOR_MAP: Record<CaseStatus, string> = {
  open: 'blue',
  closed: 'green',
  void: 'default'
};

const ENTITY_TYPE_LABEL_MAP = {
  personal: '自然人',
  organization: '机构'
} as const;

const ENTITY_TYPE_COLOR_MAP = {
  personal: 'geekblue',
  organization: 'purple'
} as const;

const DEPARTMENT_OPTIONS = (Object.entries(DEPARTMENT_LABEL_MAP) as Array<[UserDepartment, string]>).map(
  ([value, label]) => ({
    value,
    label
  })
);

const buildInitialPagination = (): TablePaginationConfig => ({
  current: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  pageSizeOptions: ['10', '20', '30', '50']
});

export default function MyClientsPage() {
  const { message } = App.useApp();
  const currentUser = useSessionStore((state) => state.user);
  const [filters, setFilters] = useState<Filters>({});
  const filtersRef = useRef<Filters>({});
  const [filterForm] = Form.useForm<Filters>();
  const [clients, setClients] = useState<CaseClientRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<TablePaginationConfig>(buildInitialPagination);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientDetail, setClientDetail] = useState<CaseClientDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const headerAction = useMemo(() => null, []);
  useDashboardHeaderAction(headerAction);

  const loadClients = useCallback(
    async (page = 1, pageSize = DEFAULT_PAGE_SIZE, overrideFilters?: Filters) => {
      setLoading(true);
      try {
        const appliedFilters = overrideFilters ?? filtersRef.current;
        const query: ClientListQuery = {
          page,
          pageSize,
          search: appliedFilters.search,
          department: isSuperAdmin ? appliedFilters.department ?? undefined : undefined
        };
        const response = await fetchClients(query);

        setClients(response.data);
        setPagination((prev) => {
          const optionSet = new Set(prev.pageSizeOptions ?? ['10', '20', '30', '50']);
          optionSet.add(String(response.pagination.pageSize));

          return {
            ...prev,
            current: response.pagination.page,
            pageSize: response.pagination.pageSize,
            total: response.pagination.total,
            pageSizeOptions: Array.from(optionSet)
              .map((value) => Number(value))
              .sort((a, b) => a - b)
              .map((value) => value.toString()),
            showQuickJumper: prev.showQuickJumper ?? true,
            showSizeChanger: prev.showSizeChanger ?? true
          } satisfies TablePaginationConfig;
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '获取我的客户失败，请稍后重试';
        message.error(errorMessage);
      } finally {
        setLoading(false);
      }
  },
  [isSuperAdmin, message]
  );

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const handleTableChange = useCallback(
    (nextPagination: TablePaginationConfig) => {
      const nextPage = nextPagination.current ?? 1;
      const nextSize = nextPagination.pageSize ?? DEFAULT_PAGE_SIZE;
      void loadClients(nextPage, nextSize);
    },
    [loadClients]
  );

  const handleFilterSubmit = useCallback(
    (values: Filters) => {
      const trimmedSearch = values.search?.trim();
      const nextFilters: Filters = {
        search: trimmedSearch && trimmedSearch.length > 0 ? trimmedSearch : undefined
      };
      if (isSuperAdmin) {
        nextFilters.department = values.department ?? undefined;
      }
      filtersRef.current = nextFilters;
      setFilters(nextFilters);
      void loadClients(1, pagination.pageSize ?? DEFAULT_PAGE_SIZE, nextFilters);
    },
    [isSuperAdmin, loadClients, pagination.pageSize]
  );

  const handleFilterReset = useCallback(() => {
    filterForm.resetFields();
    filtersRef.current = {};
    setFilters({});
    void loadClients(1, pagination.pageSize ?? DEFAULT_PAGE_SIZE, {});
  }, [filterForm, loadClients, pagination.pageSize]);

  const handleOpenClientModal = useCallback((clientId: string) => {
    setSelectedClientId(clientId);
    setClientDetail(null);
    setDetailModalOpen(true);
  }, []);

  const handleCloseClientModal = useCallback(() => {
    setDetailModalOpen(false);
    setSelectedClientId(null);
    setClientDetail(null);
    setDetailLoading(false);
    setDetailSaving(false);
  }, []);

  useEffect(() => {
    if (!detailModalOpen || !selectedClientId) {
      return;
    }

    let cancelled = false;

    setDetailLoading(true);
    setClientDetail(null);

    void (async () => {
      try {
        const detail = await fetchClientDetail(selectedClientId);
        if (!cancelled) {
          setClientDetail(detail);
        }
      } catch (error) {
        if (!cancelled) {
          const errorMessage = error instanceof Error ? error.message : '加载客户详情失败，请稍后重试';
          message.error(errorMessage);
          handleCloseClientModal();
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [detailModalOpen, handleCloseClientModal, message, selectedClientId]);

  const handleClientSave = useCallback(
    async (payload: UpdateCaseClientPayload) => {
      if (!selectedClientId) {
        message.error('未找到客户信息');
        return;
      }

      setDetailSaving(true);
      try {
        const updated = await updateClientDetail(selectedClientId, payload);
        setClientDetail(updated);
        setClients((prev) =>
          prev.map((item) =>
            item.id === updated.id
              ? {
                  ...item,
                  name: updated.name,
                  entityType: updated.entityType,
                  phone: updated.phone,
                  idNumber: updated.idNumber,
                  caseStatus: updated.caseStatus,
                  assignedSaleName: updated.assignedSaleName,
                  assignedLawyerName: updated.assignedLawyerName,
                  assignedAssistantName: updated.assignedAssistantName,
                  updatedAt: updated.updatedAt
                }
              : item
          )
        );
        message.success('客户信息已更新');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '保存客户信息失败，请稍后重试';
        message.error(errorMessage);
      } finally {
        setDetailSaving(false);
      }
    },
    [message, selectedClientId]
  );

  const hasFilters = useMemo(() => {
    if (isSuperAdmin) {
      return Boolean(filters.search || filters.department);
    }
    return Boolean(filters.search);
  }, [filters, isSuperAdmin]);

  const columns = useMemo<ColumnsType<CaseClientRecord>>(() => {
    return ([
      {
        title: '客户名称',
        dataIndex: 'name',
        key: 'name',
        render: (value: string, record) => (
          <Space size={8} direction="vertical">
            <Typography.Link
              onClick={() => handleOpenClientModal(record.id)}
              style={{ fontSize: 16 }}
            >
              {value}
            </Typography.Link>
            {record.entityType ? (
              <Tag color={ENTITY_TYPE_COLOR_MAP[record.entityType] ?? 'default'}>
                {ENTITY_TYPE_LABEL_MAP[record.entityType] ?? record.entityType}
              </Tag>
            ) : null}
          </Space>
        )
      },
      {
        title: '联系方式',
        dataIndex: 'phone',
        key: 'phone',
        render: (_: unknown, record) => (
          <Space direction="vertical" size={4}>
            <Typography.Text>{record.phone ?? '未填写'}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              证件号：{record.idNumber ?? '未填写'}
            </Typography.Text>
          </Space>
        )
      },
      {
        title: '案件信息',
        dataIndex: 'caseType',
        key: 'case-info',
        render: (_: unknown, record) => (
          <Space direction="vertical" size={4}>
            <Typography.Text>
              {CASE_TYPE_LABEL_MAP[record.caseType]} · {record.caseLevel} 级
            </Typography.Text>
            <Tag color={record.caseStatus ? CASE_STATUS_COLOR_MAP[record.caseStatus] : 'default'}>
              {record.caseStatus ? CASE_STATUS_LABEL_MAP[record.caseStatus] : '状态未知'}
            </Tag>
          </Space>
        )
      },
      {
        title: '负责团队',
        dataIndex: 'assignedLawyerName',
        key: 'team',
        render: (_: unknown, record) => (
          <Space direction="vertical" size={4}>
            <Typography.Text type="secondary">
              律师：{record.assignedLawyerName ?? '未分配'}
            </Typography.Text>
            <Typography.Text type="secondary">
              助理：{record.assignedAssistantName ?? '未分配'}
            </Typography.Text>
            <Typography.Text type="secondary">
              销售：{record.assignedSaleName ?? '未分配'}
            </Typography.Text>
          </Space>
        )
      },
      isSuperAdmin ? {
        title: '所属部门',
        dataIndex: 'department',
        key: 'department',
        render: (value: UserDepartment | null) =>
          value ? <Tag color={value === 'work_injury' ? 'geekblue' : 'gold'}>{DEPARTMENT_LABEL_MAP[value]}</Tag> : '未设置'
      } : null,
      {
        title: '更新时间',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        render: (value: string) => dayjs(value).isValid() ? dayjs(value).format('YYYY-MM-DD HH:mm') : '未知'
      }
    ] as ColumnsType<CaseClientRecord>).filter(Boolean) as ColumnsType<CaseClientRecord>;
  }, [handleOpenClientModal, isSuperAdmin]);

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Card>
        <Form form={filterForm} layout="inline" onFinish={handleFilterSubmit} style={{ rowGap: 16 }}>
          <Form.Item label="关键词" name="search">
            <Input allowClear placeholder="输入客户姓名、电话或证件号" style={{ minWidth: 220 }} />
          </Form.Item>
          {isSuperAdmin ? (
            <Form.Item label="部门" name="department">
              <Select
                allowClear
                placeholder="全部部门"
                options={DEPARTMENT_OPTIONS}
                style={{ minWidth: 160 }}
              />
            </Form.Item>
          ) : null}
          <Form.Item>
            <Button type="primary" htmlType="submit">
              搜索
            </Button>
          </Form.Item>
          <Form.Item>
            <Button onClick={handleFilterReset} disabled={!hasFilters}>
              重置
            </Button>
          </Form.Item>
        </Form>
      </Card>
      <Card styles={{ body: { padding: 0 } }} title={<Typography.Text strong>我的客户</Typography.Text>}>
        <Table<CaseClientRecord>
          rowKey={(record) => record.id}
          dataSource={clients}
          columns={columns}
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
        />
      </Card>
      <ClientDetailModal
        open={detailModalOpen}
        client={clientDetail}
        loading={detailLoading}
        saving={detailSaving}
        onCancel={handleCloseClientModal}
        onSubmit={handleClientSave}
      />
    </Space>
  );
}
