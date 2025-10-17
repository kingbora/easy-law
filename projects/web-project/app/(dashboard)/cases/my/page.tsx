'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Form, Popconfirm, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';

import CaseDetailDrawer from '@/components/cases/CaseDetailDrawer';
import CaseFormDrawer from '@/components/cases/CaseFormDrawer';
import { ApiError } from '@/lib/api-client';
import type { CaseDetail, CaseListItem, CasePayload, CaseStatus } from '@/lib/cases-api';
import { createCase, deleteCase, fetchCases, fetchCaseDetail, updateCase } from '@/lib/cases-api';
import { CASE_BILLING_METHOD_LABELS, CASE_STATUS_LABELS, CASE_STATUS_OPTIONS } from '@/lib/cases-constants';
import { fetchCaseTypes, type CaseTypeItem } from '@/lib/case-settings-api';
import { fetchClients } from '@/lib/clients-api';
import type { LawyerResponse } from '@/lib/lawyers-api';
import { searchLawyers } from '@/lib/lawyers-api';
import { fetchCurrentUser } from '@/lib/users-api';
import { useDashboardHeaderAction } from '../../header-context';

type Filters = {
  clientId?: string;
  caseTypeId?: string;
  caseCategoryId?: string;
  lawyerId?: string;
  status?: CaseStatus;
};

const DEFAULT_PAGE_SIZE = 10;

const STATUS_COLOR_MAP: Record<CaseStatus, string> = {
  consultation: 'default',
  entrusted: 'processing',
  in_progress: 'blue',
  closed: 'success',
  terminated: 'error'
};

const BILLING_COLOR = 'purple';

export default function MyCasesPage() {
  const [casesData, setCasesData] = useState<CaseListItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0 });
  const [filters, setFilters] = useState<Filters>({});
  const [tableLoading, setTableLoading] = useState(false);

  const [caseTypes, setCaseTypes] = useState<CaseTypeItem[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [lawyers, setLawyers] = useState<LawyerResponse[]>([]);

  const [filtersForm] = Form.useForm<Filters>();

  const [permissionLoaded, setPermissionLoaded] = useState(false);
  const [canManage, setCanManage] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [formState, setFormState] = useState<{ open: boolean; mode: 'create' | 'edit'; detail: CaseDetail | null }>({
    open: false,
    mode: 'create',
    detail: null
  });
  const [submitting, setSubmitting] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});

  const loadCases = useCallback(
    async (page: number, pageSize: number, activeFilters: Filters) => {
      setTableLoading(true);
      try {
        const response = await fetchCases({
          page,
          pageSize,
          clientId: activeFilters.clientId,
          caseTypeId: activeFilters.caseTypeId,
          caseCategoryId: activeFilters.caseCategoryId,
          lawyerId: activeFilters.lawyerId,
          status: activeFilters.status
        });
        setCasesData(response.items);
        setPagination({
          page: response.pagination.page,
          pageSize: response.pagination.pageSize,
          total: response.pagination.total
        });
      } catch (error) {
        const messageText = error instanceof ApiError ? error.message : '获取案件列表失败，请稍后重试';
        message.error(messageText);
      } finally {
        setTableLoading(false);
      }
    },
    []
  );

  const loadPermissions = useCallback(async () => {
    try {
      const currentUser = await fetchCurrentUser();
      setCanManage(currentUser.permissions.includes('action.cases.manage'));
    } catch {
      // ignore, backend will enforce permissions
    } finally {
      setPermissionLoaded(true);
    }
  }, []);

  const loadMeta = useCallback(async () => {
    try {
      const [typeData, clientData, lawyerData] = await Promise.all([
        fetchCaseTypes(),
        fetchClients({ page: 1, pageSize: 100 }),
        searchLawyers()
      ]);
      setCaseTypes(typeData);
      setClients(clientData.items.map((item) => ({ id: item.id, name: item.name })));
      setLawyers(lawyerData);
    } catch (error) {
      const messageText = error instanceof ApiError ? error.message : '加载基础数据失败，请稍后重试';
      message.error(messageText);
    }
  }, []);

  useEffect(() => {
    void loadPermissions();
    void loadMeta();
    void loadCases(1, DEFAULT_PAGE_SIZE, {});
  }, [loadPermissions, loadMeta, loadCases]);

  const clientOptions = useMemo(
    () => clients.map((client) => ({ label: client.name, value: client.id })),
    [clients]
  );

  const caseTypeOptions = useMemo(
    () => caseTypes.map((type) => ({ label: type.name, value: type.id })),
    [caseTypes]
  );

  const filterCaseTypeId = Form.useWatch('caseTypeId', filtersForm);

  const caseCategoryOptions = useMemo(() => {
    if (filterCaseTypeId) {
      const type = caseTypes.find((item) => item.id === filterCaseTypeId);
      return type
        ? type.categories.map((category) => ({ label: category.name, value: category.id }))
        : [];
    }
    return caseTypes.flatMap((type) =>
      type.categories.map((category) => ({
        label: `${type.name} · ${category.name}`,
        value: category.id
      }))
    );
  }, [caseTypes, filterCaseTypeId]);

  const selectableLawyers = useMemo(
    () => lawyers.filter((lawyer) => lawyer.role === 'lawyer' || lawyer.role === 'assistant'),
    [lawyers]
  );

  const lawyerOptions = useMemo(
    () =>
      selectableLawyers.map((lawyer) => ({
        label: lawyer.name ?? lawyer.email ?? '未命名律师',
        value: lawyer.id
      })),
    [selectableLawyers]
  );

  const handleFilterChange = useCallback(
    (_: unknown, allValues: Filters) => {
      const nextFilters = { ...allValues };
      if (nextFilters.caseTypeId) {
        const selectedType = caseTypes.find((type) => type.id === nextFilters.caseTypeId);
        if (
          nextFilters.caseCategoryId &&
          selectedType &&
          !selectedType.categories.some((category) => category.id === nextFilters.caseCategoryId)
        ) {
          filtersForm.setFieldsValue({ caseCategoryId: undefined });
          nextFilters.caseCategoryId = undefined;
        }
      }
      setFilters(nextFilters);
      setPagination((prev) => ({ ...prev, page: 1 }));
      void loadCases(1, pagination.pageSize, nextFilters);
    },
    [caseTypes, filtersForm, loadCases, pagination.pageSize]
  );

  const handleResetFilters = useCallback(() => {
    filtersForm.resetFields();
    setFilters({});
    setPagination((prev) => ({ ...prev, page: 1 }));
    void loadCases(1, pagination.pageSize, {});
  }, [filtersForm, loadCases, pagination.pageSize]);

  const handleTableChange = useCallback(
    (pageInfo: { current?: number; pageSize?: number }) => {
      const nextPage = pageInfo.current ?? 1;
      const nextPageSize = pageInfo.pageSize ?? pagination.pageSize;
      setPagination((prev) => ({ ...prev, page: nextPage, pageSize: nextPageSize }));
      void loadCases(nextPage, nextPageSize, filters);
    },
    [filters, loadCases, pagination.pageSize]
  );

  const handleSearch = useCallback(() => {
    void loadCases(pagination.page, pagination.pageSize, filters);
  }, [filters, loadCases, pagination.page, pagination.pageSize]);

  const handleViewCase = useCallback(
    async (record: CaseListItem) => {
      setDetailLoading(true);
      try {
        const detailData = await fetchCaseDetail(record.id);
        setDetail(detailData);
        setDetailOpen(true);
      } catch (error) {
        const messageText = error instanceof ApiError ? error.message : '获取案件详情失败，请稍后重试';
        message.error(messageText);
      } finally {
        setDetailLoading(false);
      }
    },
    []
  );

  const openCreateDrawer = useCallback(() => {
    setFormState({ open: true, mode: 'create', detail: null });
  }, []);

  const handleEditCase = useCallback(
    async (caseId: string) => {
      setDetailLoading(true);
      try {
        const detailData = await fetchCaseDetail(caseId);
        setFormState({ open: true, mode: 'edit', detail: detailData });
        setDetail(detailData);
        setDetailOpen(false);
      } catch (error) {
        const messageText = error instanceof ApiError ? error.message : '加载案件信息失败，请稍后重试';
        message.error(messageText);
      } finally {
        setDetailLoading(false);
      }
    },
    []
  );

  const handleEditFromDetail = useCallback(
    (detailData: CaseDetail) => {
      if (!canManage) {
        message.warning('您没有编辑权限');
        return;
      }
      void handleEditCase(detailData.id);
    },
    [canManage, handleEditCase]
  );

  const closeFormDrawer = useCallback(() => {
    setFormState({ open: false, mode: 'create', detail: null });
  }, []);

  const handleSubmit = useCallback(
    async (payload: CasePayload) => {
      setSubmitting(true);
      try {
        if (formState.mode === 'edit' && formState.detail) {
          const updated = await updateCase(formState.detail.id, payload);
          message.success('案件信息已更新');
          setFormState({ open: false, mode: 'create', detail: null });
          await loadCases(pagination.page, pagination.pageSize, filters);
          setDetail((prev) => (prev && prev.id === updated.id ? updated : prev));
        } else {
          await createCase(payload);
          message.success('案件已创建');
          setFormState({ open: false, mode: 'create', detail: null });
          setPagination((prev) => ({ ...prev, page: 1 }));
          await loadCases(1, pagination.pageSize, filters);
        }
      } catch (error) {
        const messageText = error instanceof ApiError ? error.message : '保存失败，请稍后重试';
        message.error(messageText);
      } finally {
        setSubmitting(false);
      }
    },
    [filters, formState.detail, formState.mode, loadCases, pagination.page, pagination.pageSize]
  );

  const handleDeleteCase = useCallback(
    async (caseId: string) => {
      if (!canManage) {
        message.warning('您没有删除权限');
        return;
      }

      setDeletingIds((prev) => ({ ...prev, [caseId]: true }));
      try {
        await deleteCase(caseId);
        message.success('案件已删除');
        if (detail?.id === caseId) {
          setDetail(null);
          setDetailOpen(false);
        }

        const nextPage = casesData.length === 1 && pagination.page > 1 ? pagination.page - 1 : pagination.page;
        await loadCases(nextPage, pagination.pageSize, filters);
      } catch (error) {
        const messageText = error instanceof ApiError ? error.message : '删除失败，请稍后重试';
        message.error(messageText);
      } finally {
        setDeletingIds((prev) => {
          const next = { ...prev };
          delete next[caseId];
          return next;
        });
      }
    },
    [canManage, casesData, detail, filters, loadCases, pagination.page, pagination.pageSize]
  );

  const columns = useMemo<ColumnsType<CaseListItem>>(
    () => [
      {
        title: '案件名称',
        dataIndex: 'name',
        fixed: 'left',
        width: 240,
        render: (_: string, record) => (
          <Button type="link" onClick={() => handleViewCase(record)}>
            {record.name}
          </Button>
        )
      },
      {
        title: '客户',
        dataIndex: ['client', 'name'],
        width: 180
      },
      {
        title: '案由',
        key: 'caseCategory',
        render: (_, record) => `${record.caseType.name} / ${record.caseCategory.name}`,
        width: 240
      },
      {
        title: '负责律师',
        key: 'lawyers',
        render: (_, record) =>
          record.lawyers.length === 0 ? (
            <Tag>未分配</Tag>
          ) : (
            <Space size={[8, 8]} wrap>
              {record.lawyers.map((lawyer) => (
                <Tag color={lawyer.isPrimary ? 'blue' : 'default'} key={lawyer.id}>
                  {lawyer.name ?? lawyer.email ?? '未命名律师'}
                  {lawyer.isPrimary ? '（主办）' : ''}
                </Tag>
              ))}
            </Space>
          ),
        width: 260
      },
      {
        title: '案件状态',
        dataIndex: 'status',
        width: 140,
        render: (status: CaseStatus) => (
          <Tag color={STATUS_COLOR_MAP[status]}>{CASE_STATUS_LABELS[status]}</Tag>
        )
      },
      {
        title: '收费方式',
        dataIndex: 'billingMethod',
        width: 160,
        render: (billingMethod: string) => (
          <Tag color={BILLING_COLOR}>
            {CASE_BILLING_METHOD_LABELS[billingMethod as keyof typeof CASE_BILLING_METHOD_LABELS]}
          </Tag>
        )
      },
      {
        title: '操作',
        key: 'actions',
        fixed: 'right',
        width: 100,
        render: (_, record) =>
          canManage ? (
            <Popconfirm
              title="确认删除该案件？"
              description="删除后将无法恢复，请谨慎操作。"
              okText="删除"
              okType="danger"
              cancelText="取消"
              okButtonProps={{ loading: Boolean(deletingIds[record.id]) }}
              onConfirm={() => handleDeleteCase(record.id)}
            >
              <Button type="link" danger loading={Boolean(deletingIds[record.id])}>
                删除
              </Button>
            </Popconfirm>
          ) : (
            <Button type="link" disabled>
              删除
            </Button>
          )
      }
    ],
    [canManage, deletingIds, handleDeleteCase, handleViewCase]
  );

  const headerAction = useMemo(
    () => (
      <Button type="primary" icon={<PlusOutlined />} onClick={openCreateDrawer} disabled={!canManage}>
        新增案件
      </Button>
    ),
    [canManage, openCreateDrawer]
  );

  useDashboardHeaderAction(headerAction);

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      {!permissionLoaded && (
        <Alert message="正在检测权限，请稍候..." type="info" showIcon style={{ marginBottom: 16 }} />
      )}
      {permissionLoaded && !canManage && (
        <Alert
          message="您拥有案件查看权限"
          description="如需创建或编辑案件，请联系管理员授予权限。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Card>
        <Form layout="inline" form={filtersForm} onValuesChange={handleFilterChange} style={{ rowGap: 16 }}>
          <Form.Item label="客户" name="clientId">
            <Select
              allowClear
              placeholder="选择客户"
              showSearch
              optionFilterProp="label"
              options={clientOptions}
              style={{ minWidth: 220 }}
            />
          </Form.Item>
          <Form.Item label="案件类型" name="caseTypeId">
            <Select
              allowClear
              placeholder="选择案件类型"
              options={caseTypeOptions}
              style={{ minWidth: 220 }}
            />
          </Form.Item>
          <Form.Item label="案由" name="caseCategoryId">
            <Select
              allowClear
              placeholder={filterCaseTypeId ? '选择案由' : '不限案由'}
              options={caseCategoryOptions}
              style={{ minWidth: 240 }}
            />
          </Form.Item>
          <Form.Item label="负责律师" name="lawyerId">
            <Select
              allowClear
              placeholder="选择负责律师"
              showSearch
              optionFilterProp="label"
              options={lawyerOptions}
              style={{ minWidth: 220 }}
            />
          </Form.Item>
          <Form.Item label="案件状态" name="status">
            <Select allowClear placeholder="选择状态" options={CASE_STATUS_OPTIONS} style={{ minWidth: 200 }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" onClick={handleSearch} loading={tableLoading}>
                搜索
              </Button>
              <Button onClick={handleResetFilters}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<CaseListItem>
          rowKey="id"
          columns={columns}
          dataSource={casesData}
          loading={tableLoading}
          scroll={{ x: 1200 }}
          pagination={{
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true
          }}
          onChange={(pager) => handleTableChange({ current: pager.current, pageSize: pager.pageSize })}
        />
      </Card>

      <CaseFormDrawer
        open={formState.open}
        mode={formState.mode}
        submitting={submitting}
        initialValues={formState.detail ?? undefined}
        caseTypes={caseTypes}
        clients={clients}
        lawyers={selectableLawyers}
        onClose={closeFormDrawer}
        onSubmit={handleSubmit}
      />

      <CaseDetailDrawer
        open={detailOpen}
        loading={detailLoading}
        caseDetail={detail}
        onClose={() => setDetailOpen(false)}
        onEdit={canManage ? handleEditFromDetail : undefined}
      />
    </Space>
  );
}
