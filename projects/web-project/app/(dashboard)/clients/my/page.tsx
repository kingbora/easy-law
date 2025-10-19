'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  List,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  message
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TablePaginationConfig } from 'antd/es/table/interface';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import ClientModal from '@/components/clients/ClientModal';
import { ApiError } from '@/lib/api-client';
import {
  createClient,
  deleteClient,
  fetchClientDetail,
  fetchClients,
  fetchClientRelatedCases,
  updateClient,
  type ClientDetail,
  type ClientListItem,
  type ClientPayload,
  type ClientSource,
  type ClientRelatedCase,
  type ClientStatus,
  type ClientType
} from '@/lib/clients-api';
import {
  CLIENT_SOURCE_LABELS,
  CLIENT_SOURCE_OPTIONS,
  CLIENT_STATUS_COLOR_MAP,
  CLIENT_STATUS_LABELS,
  CLIENT_STATUS_OPTIONS,
  CLIENT_TYPE_LABELS,
  CLIENT_TYPE_OPTIONS
} from '@/lib/clients-data';
import { CASE_STATUS_LABELS } from '@/lib/cases-constants';
import { searchMaintainers, type MaintainerResponse } from '@/lib/maintainers-api';

import { useDashboardHeaderAction } from '../../header-context';

interface Filters {
  name?: string;
  type?: ClientType;
  status?: ClientStatus;
  source?: ClientSource;
}

interface TableRecord extends ClientListItem {
  createdAtText: string;
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create'; clientId?: undefined }
  | { open: true; mode: 'view' | 'edit'; clientId: string };

interface MaintainerOption {
  label: string;
  value: string;
}

type DeleteModalState = {
  open: boolean;
  clientId: string | null;
  clientName: string;
  loading: boolean;
  relatedCases: ClientRelatedCase[] | null;
  deleting: boolean;
};

const createInitialDeleteModalState = (): DeleteModalState => ({
  open: false,
  clientId: null,
  clientName: '',
  loading: false,
  relatedCases: null,
  deleting: false
});

const formatDateTime = (value: string | null) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-');

export default function MyClientsPage() {
  const [filterForm] = Form.useForm<Filters>();
  const [filters, setFilters] = useState<Filters>({});
  const [tableData, setTableData] = useState<TableRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; total: number }>(
    { page: 1, pageSize: 10, total: 0 }
  );
  const [modalState, setModalState] = useState<ModalState>({ open: false });
  const [selectedClient, setSelectedClient] = useState<ClientDetail | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteModalState, setDeleteModalState] = useState<DeleteModalState>(createInitialDeleteModalState);
  const [maintainerOptions, setMaintainerOptions] = useState<MaintainerOption[]>([]);
  const [maintainerLoading, setMaintainerLoading] = useState(false);

  const resetDeleteModalState = useCallback(() => {
    setDeleteModalState(createInitialDeleteModalState());
  }, []);

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchClients({
        page: pagination.page,
        pageSize: pagination.pageSize,
        name: filters.name,
        type: filters.type,
        status: filters.status,
        source: filters.source
      });

      const mapped: TableRecord[] = response.items.map((item) => ({
        ...item,
        createdAtText: formatDateTime(item.createdAt)
      }));

      setTableData(mapped);
      setPagination((prev) => ({ ...prev, total: response.pagination.total }));
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : '加载客户列表失败，请稍后重试';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [filters.name, filters.source, filters.status, filters.type, pagination.page, pagination.pageSize]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const ensureMaintainerOption = useCallback((maintainer: { id: string; name: string | null } | null | undefined) => {
    if (!maintainer?.id) {
      return;
    }
    setMaintainerOptions((prev) => {
      if (prev.some((option) => option.value === maintainer.id)) {
        return prev;
      }
      const label = maintainer.name && maintainer.name.trim().length > 0 ? maintainer.name : '未命名维护人';
      return [...prev, { value: maintainer.id, label }];
    });
  }, []);

  const fetchMaintainerOptions = useCallback(async (keyword?: string) => {
    setMaintainerLoading(true);
    try {
      const list = await searchMaintainers(keyword);
      const fetched = list.map((maintainer: MaintainerResponse) => ({
        value: maintainer.id,
        label:
          maintainer.name && maintainer.name.trim().length > 0
            ? maintainer.name
            : maintainer.email ?? '未命名维护人'
      }));
      setMaintainerOptions((prev) => {
        const merged = new Map<string, MaintainerOption>();
        fetched.forEach((option) => {
          merged.set(option.value, option);
        });
        prev.forEach((option) => {
          if (!merged.has(option.value)) {
            merged.set(option.value, option);
          }
        });
        return Array.from(merged.values());
      });
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : '加载维护人列表失败，请稍后重试';
      message.error(errorMessage);
    } finally {
      setMaintainerLoading(false);
    }
  }, []);

  const handleSearchMaintainers = useCallback(
    (keyword: string) => {
      void fetchMaintainerOptions(keyword);
    },
    [fetchMaintainerOptions]
  );

  const openCreateModal = useCallback(() => {
    setSelectedClient(null);
    setModalState({ open: true, mode: 'create' });
    void fetchMaintainerOptions();
  }, [fetchMaintainerOptions]);

  const closeModal = useCallback(() => {
    setModalState({ open: false });
    setSelectedClient(null);
  }, []);

  const openClientModal = useCallback(
    async (id: string, mode: 'view' | 'edit') => {
      const hide = message.loading('正在加载客户详情...', 0);
      try {
        const detail = await fetchClientDetail(id);
        setSelectedClient(detail);
        ensureMaintainerOption(detail.maintainer);
        setModalState({ open: true, mode, clientId: id });
        void fetchMaintainerOptions();
      } catch (error) {
        const errorMessage = error instanceof ApiError ? error.message : '获取客户详情失败，请稍后重试';
        message.error(errorMessage);
      } finally {
        hide();
      }
    },
    [ensureMaintainerOption, fetchMaintainerOptions]
  );

  const handleModeChange = useCallback(
    (nextMode: 'view' | 'edit') => {
      setModalState((prev) => {
        if (!prev.open || !('clientId' in prev) || !prev.clientId) {
          return prev;
        }
        return { open: true, mode: nextMode, clientId: prev.clientId };
      });
    },
    []
  );

  const handleSubmit = useCallback(
    async (payload: ClientPayload) => {
      setSubmitting(true);
      try {
        if (modalState.open && modalState.mode === 'edit' && modalState.clientId) {
          const updated = await updateClient(modalState.clientId, payload);
          message.success('客户信息已更新');
          setSelectedClient(updated);
          ensureMaintainerOption(updated.maintainer);
          setModalState({ open: true, mode: 'view', clientId: updated.id });
          await loadClients();
        } else {
          await createClient(payload);
          message.success('新增客户成功');
          await loadClients();
          closeModal();
        }
      } catch (error) {
        const errorMessage = error instanceof ApiError ? error.message : '操作失败，请稍后重试';
        message.error(errorMessage);
      } finally {
        setSubmitting(false);
      }
    },
    [closeModal, ensureMaintainerOption, loadClients, modalState]
  );

  const openDeleteClientModal = useCallback(
    (record: TableRecord) => {
      setDeleteModalState({
        open: true,
        clientId: record.id,
        clientName: record.name,
        loading: true,
        relatedCases: null,
        deleting: false
      });

      void (async () => {
        try {
          const response = await fetchClientRelatedCases(record.id);
          setDeleteModalState((prev) => {
            if (!prev.open || prev.clientId !== record.id) {
              return prev;
            }
            return {
              ...prev,
              loading: false,
              relatedCases: response.cases
            };
          });
        } catch (error) {
          const errorMessage = error instanceof ApiError ? error.message : '检测关联案件失败，请稍后重试';
          message.error(errorMessage);
          resetDeleteModalState();
        }
      })();
    },
    [resetDeleteModalState]
  );

  const handleDeleteClient = useCallback(async () => {
    if (!deleteModalState.clientId) {
      return;
    }

    setDeleteModalState((prev) => ({ ...prev, deleting: true }));
    const targetId = deleteModalState.clientId;
    try {
      await deleteClient(targetId);
      message.success('客户已删除');

      setModalState((prev) => {
        if (!prev.open || !('clientId' in prev) || !prev.clientId) {
          return prev;
        }
        if (prev.clientId === targetId) {
          return { open: false };
        }
        return prev;
      });
      setSelectedClient((prev) => (prev && prev.id === targetId ? null : prev));

      resetDeleteModalState();
      await loadClients();
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : '删除失败，请稍后重试';
      message.error(errorMessage);
      setDeleteModalState((prev) => ({ ...prev, deleting: false }));
    }
  }, [deleteModalState.clientId, loadClients, resetDeleteModalState]);

  const handleTableChange = useCallback((nextPagination: TablePaginationConfig) => {
    setPagination((prev) => ({
      page: nextPagination.current ?? prev.page,
      pageSize: nextPagination.pageSize ?? prev.pageSize,
      total: prev.total
    }));
  }, []);

  const handleSearch = useCallback(
    (values: Filters) => {
      setFilters({
        name: values.name?.trim() || undefined,
        type: values.type,
        status: values.status,
        source: values.source
      });
      setPagination((prev) => ({ ...prev, page: 1 }));
    },
    []
  );

  const handleReset = useCallback(() => {
    filterForm.resetFields();
    setFilters({});
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [filterForm]);

  const headerAction = useMemo(
    () => (
      <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
        新增客户
      </Button>
    ),
    [openCreateModal]
  );

  useDashboardHeaderAction(headerAction);

  const handleViewClient = useCallback(
    (id: string) => {
      void openClientModal(id, 'view');
    },
    [openClientModal]
  );

  const handleEditClient = useCallback(
    (id: string) => {
      void openClientModal(id, 'edit');
    },
    [openClientModal]
  );

  const deleteCheckingClientId = deleteModalState.open && deleteModalState.loading ? deleteModalState.clientId : null;
  const deleteInProgress = deleteModalState.deleting;

  const columns = useMemo<ColumnsType<TableRecord>>(
    () => [
      {
        title: '客户名称',
        dataIndex: 'name',
        render: (value: string, record) => (
          <Button type="link" onClick={() => handleViewClient(record.id)}>
            {value}
          </Button>
        )
      },
      {
        title: '客户类型',
        dataIndex: 'type',
        render: (type: ClientType) => CLIENT_TYPE_LABELS[type]
      },
      {
        title: '维护人',
        dataIndex: ['maintainer', 'name'],
        render: (_: unknown, record) => record.maintainer?.name ?? '未指定'
      },
      {
        title: '联系电话',
        dataIndex: 'phone'
      },
      {
        title: '客户状态',
        dataIndex: 'status',
        render: (status: ClientStatus) => (
          <Tag color={CLIENT_STATUS_COLOR_MAP[status]}>{CLIENT_STATUS_LABELS[status]}</Tag>
        )
      },
      {
        title: '客户来源',
        dataIndex: 'source',
        render: (source: ClientSource | null) => (source ? CLIENT_SOURCE_LABELS[source] : '未填写')
      },
      {
        title: '标签',
        dataIndex: 'tags',
        render: (tags: string[]) =>
          tags && tags.length > 0 ? (
            <Space size={[4, 4]} wrap>
              {tags.slice(0, 3).map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
              {tags.length > 3 ? <Tag>+{tags.length - 3}</Tag> : null}
            </Space>
          ) : (
            <span>-</span>
          )
      },
      {
        title: '创建时间',
        dataIndex: 'createdAtText'
      },
      {
        title: '操作',
        key: 'actions',
        render: (_, record) => (
          <Space>
            <Tooltip title="编辑客户信息">
              <Button type="link" onClick={() => handleEditClient(record.id)}>
                编辑
              </Button>
            </Tooltip>
            <Tooltip title="删除前将自动检测关联案件">
              <Button
                type="link"
                danger
                onClick={() => openDeleteClientModal(record)}
                loading={deleteCheckingClientId === record.id}
                disabled={deleteInProgress}
              >
                删除
              </Button>
            </Tooltip>
          </Space>
        )
      }
    ],
    [
      deleteCheckingClientId,
      deleteInProgress,
      handleEditClient,
      handleViewClient,
      openDeleteClientModal
    ]
  );

  const deleteModalHasCases = (deleteModalState.relatedCases?.length ?? 0) > 0;
  const deleteModalFooter = deleteModalState.loading
    ? null
    : deleteModalHasCases
      ? [
          <Button key="acknowledge" type="primary" onClick={resetDeleteModalState} disabled={deleteModalState.deleting}>
            我知道了
          </Button>
        ]
      : [
          <Button key="cancel" onClick={resetDeleteModalState} disabled={deleteModalState.deleting}>
            取消
          </Button>,
          <Button
            key="confirm"
            type="primary"
            danger
            loading={deleteModalState.deleting}
            onClick={handleDeleteClient}
          >
            删除
          </Button>
        ];

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Card>
        <Form<Filters>
          layout="inline"
          form={filterForm}
          onFinish={handleSearch}
          style={{ rowGap: 16 }}
        >
          <Form.Item label="客户名称" name="name">
            <Input allowClear placeholder="请输入客户名称" style={{ width: 220 }} />
          </Form.Item>
          <Form.Item label="客户类型" name="type">
            <Select allowClear options={CLIENT_TYPE_OPTIONS} placeholder="请选择客户类型" style={{ width: 220 }} />
          </Form.Item>
          <Form.Item label="客户状态" name="status">
            <Select allowClear options={CLIENT_STATUS_OPTIONS} placeholder="请选择客户状态" style={{ width: 220 }} />
          </Form.Item>
          <Form.Item label="客户来源" name="source">
            <Select allowClear options={CLIENT_SOURCE_OPTIONS} placeholder="请选择客户来源" style={{ width: 220 }} />
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
        <Table<TableRecord>
          rowKey="id"
          columns={columns}
          dataSource={tableData}
          loading={loading}
          pagination={{
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条数据`
          }}
          onChange={handleTableChange}
        />
      </Card>

      <Modal
        title={deleteModalState.clientName ? `删除客户：${deleteModalState.clientName}` : '删除客户'}
        open={deleteModalState.open}
        onCancel={() => {
          if (deleteModalState.deleting) {
            return;
          }
          resetDeleteModalState();
        }}
        footer={deleteModalFooter}
        maskClosable={!deleteModalState.deleting && !deleteModalState.loading}
        closable={!deleteModalState.deleting}
        destroyOnClose
      >
        {deleteModalState.loading ? (
          <Space align="center" size={16}>
            <Spin />
            <span>案件关联检索中，请稍后...</span>
          </Space>
        ) : deleteModalHasCases ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              type="warning"
              showIcon
              message="检测到关联案件"
              description="仅当关联案件全部删除后，才能删除该客户。"
            />
            <List
              size="small"
              dataSource={deleteModalState.relatedCases ?? []}
              style={{ maxHeight: 260, overflowY: 'auto' }}
              renderItem={(item) => (
                <List.Item key={item.id}>
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <strong>{item.name}</strong>
                    <span>案由：{item.caseTypeName} / {item.caseCategoryName}</span>
                    <span>案件状态：{CASE_STATUS_LABELS[item.status]}</span>
                  </Space>
                </List.Item>
              )}
            />
          </Space>
        ) : (
          <Alert
            type="warning"
            showIcon
            message="确认删除该客户？"
            description="删除后将无法恢复，请谨慎操作。"
          />
        )}
      </Modal>

      {modalState.open ? (
        <ClientModal
          open
          mode={modalState.mode}
          initialValues={selectedClient}
          onCancel={closeModal}
          onSubmit={handleSubmit}
          onModeChange={handleModeChange}
          confirmLoading={submitting}
          maintainerOptions={maintainerOptions}
          maintainerLoading={maintainerLoading}
          onSearchMaintainers={handleSearchMaintainers}
        />
      ) : null}
    </Space>
  );
}
