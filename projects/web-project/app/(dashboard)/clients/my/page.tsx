'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Button,
  Card,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
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
  updateClient,
  type ClientDetail,
  type ClientListItem,
  type ClientPayload,
  type ClientSource,
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
import { searchLawyers, type LawyerResponse } from '@/lib/lawyers-api';

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

interface LawyerOption {
  label: string;
  value: string;
}

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
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});
  const [lawyerOptions, setLawyerOptions] = useState<LawyerOption[]>([]);
  const [lawyerLoading, setLawyerLoading] = useState(false);

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

  const ensureLawyerOption = useCallback((lawyer: { id: string; name: string | null } | null | undefined) => {
    if (!lawyer?.id) {
      return;
    }
    setLawyerOptions((prev) => {
      if (prev.some((option) => option.value === lawyer.id)) {
        return prev;
      }
      const label = lawyer.name && lawyer.name.trim().length > 0 ? lawyer.name : '未命名律师';
      return [...prev, { value: lawyer.id, label }];
    });
  }, []);

  const fetchLawyerOptions = useCallback(async (keyword?: string) => {
    setLawyerLoading(true);
    try {
      const list = await searchLawyers(keyword);
      const fetched = list.map((lawyer: LawyerResponse) => ({
        value: lawyer.id,
        label: lawyer.name && lawyer.name.trim().length > 0 ? lawyer.name : lawyer.email ?? '未命名律师'
      }));
      setLawyerOptions((prev) => {
        const merged = new Map<string, LawyerOption>();
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
      const errorMessage = error instanceof ApiError ? error.message : '加载律师列表失败，请稍后重试';
      message.error(errorMessage);
    } finally {
      setLawyerLoading(false);
    }
  }, []);

  const handleSearchLawyers = useCallback(
    (keyword: string) => {
      void fetchLawyerOptions(keyword);
    },
    [fetchLawyerOptions]
  );

  const openCreateModal = useCallback(() => {
    setSelectedClient(null);
    setModalState({ open: true, mode: 'create' });
    void fetchLawyerOptions();
  }, [fetchLawyerOptions]);

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
        ensureLawyerOption(detail.responsibleLawyer);
        setModalState({ open: true, mode, clientId: id });
        void fetchLawyerOptions();
      } catch (error) {
        const errorMessage = error instanceof ApiError ? error.message : '获取客户详情失败，请稍后重试';
        message.error(errorMessage);
      } finally {
        hide();
      }
    },
    [ensureLawyerOption, fetchLawyerOptions]
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
          ensureLawyerOption(updated.responsibleLawyer);
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
    [closeModal, ensureLawyerOption, loadClients, modalState]
  );

  const handleDeleteClient = useCallback(
    async (id: string) => {
      setDeletingIds((prev) => ({ ...prev, [id]: true }));
      try {
        await deleteClient(id);
        message.success('客户已删除');
        if (modalState.open && modalState.clientId === id) {
          closeModal();
        }
        await loadClients();
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
    [closeModal, loadClients, modalState]
  );

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
        title: '负责律师',
        dataIndex: ['responsibleLawyer', 'name'],
        render: (_: unknown, record) => record.responsibleLawyer?.name ?? '未指定'
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
            <Popconfirm
              title="确认删除该客户？"
              description="删除后将无法恢复，请确认。"
              okText="删除"
              cancelText="取消"
              okType="danger"
              onConfirm={() => handleDeleteClient(record.id)}
            >
              <Button type="link" danger loading={Boolean(deletingIds[record.id])}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        )
      }
    ],
    [deletingIds, handleDeleteClient, handleEditClient, handleViewClient]
  );

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

      {modalState.open ? (
        <ClientModal
          open
          mode={modalState.mode}
          initialValues={selectedClient}
          onCancel={closeModal}
          onSubmit={handleSubmit}
          onModeChange={handleModeChange}
          confirmLoading={submitting}
          lawyerOptions={lawyerOptions}
          lawyerLoading={lawyerLoading}
          onSearchLawyers={handleSearchLawyers}
        />
      ) : null}
    </Space>
  );
}
