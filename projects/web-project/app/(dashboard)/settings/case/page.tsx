'use client';

import {
  MinusCircleOutlined,
  PlusOutlined
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
  message
} from 'antd';
import type { TableProps } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError } from '@/lib/api-client';
import {
  createCaseType,
  deleteCaseType,
  fetchCaseTypes,
  updateCaseType,
  type CaseTypeItem,
  type CaseTypePayload
} from '@/lib/case-settings-api';
import { fetchCurrentUser } from '@/lib/users-api';

const { Title, Paragraph, Text } = Typography;

type CaseTypeFormValues = {
  name: string;
  description?: string | null;
  categories: Array<{
    id?: string;
    name: string;
    isSystem?: boolean;
  }>;
};

type CaseTypeModalProps = {
  open: boolean;
  title: string;
  loading: boolean;
  initialValues?: CaseTypeFormValues;
  disableName?: boolean;
  onSubmit: (values: CaseTypePayload) => Promise<void>;
  onCancel: () => void;
};

const ensureFormValues = (values?: CaseTypeFormValues): CaseTypeFormValues => ({
  name: values?.name ?? '',
  description: values?.description ?? '',
  categories: values?.categories ?? []
});

const normalizePayload = (values: CaseTypeFormValues): CaseTypePayload => ({
  name: values.name.trim(),
  description: values.description?.trim() ? values.description.trim() : null,
  categories: (values.categories ?? [])
    .map((category) => ({
      id: category.id,
      name: category.name.trim()
    }))
    .filter((category) => category.name.length > 0)
});

const CaseTypeModal = ({ open, title, loading, initialValues, disableName, onSubmit, onCancel }: CaseTypeModalProps) => {
  const [form] = Form.useForm<CaseTypeFormValues>();

  const isSystemCategory = (value: unknown) => value === true || value === 'true';

  useEffect(() => {
    if (open) {
      form.setFieldsValue(ensureFormValues(initialValues));
    } else {
      form.resetFields();
    }
  }, [open, initialValues, form]);

  const handleFinish = async (values: CaseTypeFormValues) => {
    await onSubmit(normalizePayload(values));
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  const renderCategories = () => (
    <Form.List name="categories">
      {(fields, { add, remove }) => {
        const currentValues = (form.getFieldValue('categories') ?? []) as CaseTypeFormValues['categories'];

        const handleRemove = (fieldName: number, index: number) => {
          const category = currentValues[index];
          if (isSystemCategory(category?.isSystem)) {
            message.warning(`系统内置分类「${category?.name ?? ''}」不可删除`);
            return;
          }
          remove(fieldName);
        };

        return (
          <>
            {fields.length === 0 && (
              <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                暂无案由分类，您可以点击下方按钮添加。
              </Paragraph>
            )}
            {fields.map((field, index) => {
              const category = currentValues[index];
              const isSystem = isSystemCategory(category?.isSystem);

              return (
                <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                  <Form.Item
                    style={{ marginBottom: 0, flex: 1 }}
                    name={[field.name, 'name']}
                    rules={[{ required: true, message: '请填写案由分类名称' }]}
                  >
                    <Input placeholder="请输入案由分类名称" disabled={isSystem} />
                  </Form.Item>
                  <Form.Item name={[field.name, 'id']} hidden>
                    <Input type="hidden" />
                  </Form.Item>
                  <Form.Item name={[field.name, 'isSystem']} hidden initialValue={category?.isSystem ?? false}>
                    <Input type="hidden" />
                  </Form.Item>
                  {!isSystem && (
                    <Button
                      type="text"
                      danger
                      icon={<MinusCircleOutlined />}
                      onClick={() => handleRemove(field.name, index)}
                    />
                  )}
                </Space>
              );
            })}
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => add({ name: '', isSystem: false })}
              block
            >
              添加案由分类
            </Button>
            <Text type="secondary">系统内置分类不可删除或重命名。</Text>
          </>
        );
      }}
    </Form.List>
  );

  return (
    <Modal
      open={open}
      title={title}
      onCancel={handleCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText="保存"
      cancelText="取消"
      destroyOnClose
      width={640}
      maskClosable={false}
    >
      <Form<CaseTypeFormValues> layout="vertical" form={form} onFinish={handleFinish} initialValues={ensureFormValues(initialValues)}>
        <Form.Item
          label="案件类型名称"
          name="name"
          rules={[{ required: true, message: '请填写案件类型名称' }]}
        >
          <Input placeholder="例如：民事诉讼" disabled={disableName} />
        </Form.Item>
        <Form.Item label="案件类型描述" name="description">
          <Input.TextArea rows={3} placeholder="用于团队成员了解案件类型的说明" />
        </Form.Item>
        <Form.Item label="案由分类">
          {renderCategories()}
        </Form.Item>
      </Form>
    </Modal>
  );
};

const mapToFormValues = (item: CaseTypeItem): CaseTypeFormValues => ({
  name: item.name,
  description: item.description,
  categories: item.categories.map((category) => ({
    id: category.id,
    name: category.name,
    isSystem: category.isSystem
  }))
});

export default function CaseSettingsPage() {
  const [caseTypes, setCaseTypes] = useState<CaseTypeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CaseTypeItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [permissionLoaded, setPermissionLoaded] = useState(false);

  const loadPermissions = useCallback(async () => {
    try {
      const user = await fetchCurrentUser();
      setCanManage(user.permissions.includes('action.case_settings.manage'));
    } catch (error) {
      // ignore, backend will enforce permissions
    } finally {
      setPermissionLoaded(true);
    }
  }, []);

  const loadCaseTypes = useCallback(async () => {
    setFetching(true);
    try {
      const data = await fetchCaseTypes();
      setCaseTypes(data);
    } catch (error) {
      const messageText = error instanceof ApiError ? error.message : '获取案件设置失败，请稍后重试';
      message.error(messageText);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    void loadPermissions();
    void loadCaseTypes();
  }, [loadPermissions, loadCaseTypes]);

  const handleCreateClick = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);

  const handleEdit = useCallback((record: CaseTypeItem) => {
    setEditing(record);
    setModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    setEditing(null);
  }, []);

  const handleSubmit = useCallback(async (values: CaseTypePayload) => {
    setSubmitting(true);
    try {
      if (editing) {
        await updateCaseType(editing.id, values);
        message.success('案件类型已更新');
      } else {
        await createCaseType(values);
        message.success('案件类型已创建');
      }
      setModalOpen(false);
      setEditing(null);
      await loadCaseTypes();
    } catch (error) {
      const messageText = error instanceof ApiError ? error.message : '保存失败，请稍后重试';
      message.error(messageText);
    } finally {
      setSubmitting(false);
    }
  }, [editing, loadCaseTypes]);

  const handleDelete = useCallback(async (record: CaseTypeItem) => {
    setLoading(true);
    try {
      await deleteCaseType(record.id);
      message.success('案件类型已删除');
      await loadCaseTypes();
    } catch (error) {
      const messageText = error instanceof ApiError ? error.message : '删除失败，请稍后重试';
      message.error(messageText);
    } finally {
      setLoading(false);
    }
  }, [loadCaseTypes]);

  const columns = useMemo<TableProps<CaseTypeItem>['columns']>(() => {
    return [
      {
        title: '案件类型',
        dataIndex: 'name',
        key: 'name',
        render: (value: string, record) => (
          <Space direction="vertical">
            <Text strong>{value}</Text>
            {record.description ? <Text type="secondary">{record.description}</Text> : null}
            {record.isSystem ? <Tag color="blue">系统内置</Tag> : null}
          </Space>
        )
      },
      {
        title: '案由分类',
        key: 'categories',
        render: (_, record) => (
          <Space wrap>
            {record.categories.length === 0 ? (
              <Text type="secondary">暂无案由分类</Text>
            ) : (
              record.categories.map((category) => (
                <Tag key={category.id} color={category.isSystem ? 'blue' : 'default'}>
                  {category.name}
                </Tag>
              ))
            )}
          </Space>
        )
      },
      {
        title: '操作',
        key: 'actions',
        render: (_, record) => (
          <Space>
            <Button type="link" onClick={() => handleEdit(record)} disabled={!canManage}>
              编辑
            </Button>
            <Popconfirm
              title="确认删除该案件类型吗？"
              description="删除后该案件类型及其案由分类将不可用。"
              onConfirm={() => handleDelete(record)}
              okButtonProps={{ danger: true }}
              disabled={!canManage || record.isSystem}
            >
              <Button type="link" danger disabled={!canManage || record.isSystem}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        )
      }
    ];
  }, [canManage, handleEdit, handleDelete]);

  return (
    <div>
      <Title level={3}>案件设置</Title>
      <Paragraph type="secondary">
        管理案件类型与案由分类，确保平台中的案件信息符合团队业务需求。
      </Paragraph>
      {!permissionLoaded && <Alert message="正在检测权限，请稍候..." type="info" showIcon style={{ marginBottom: 16 }} />}
      {permissionLoaded && !canManage && (
        <Alert
          message="您没有案件设置管理权限"
          description="可以查看当前配置，如需调整请联系管理员。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateClick} disabled={!canManage}>
          新增案件类型
        </Button>
        <Button onClick={() => loadCaseTypes()} loading={fetching || loading}>
          刷新
        </Button>
      </Space>
      <Table<CaseTypeItem>
        columns={columns}
        dataSource={caseTypes}
        loading={fetching || loading}
        rowKey="id"
        pagination={false}
      />
      <CaseTypeModal
        open={modalOpen}
        title={editing ? '编辑案件类型' : '新增案件类型'}
        loading={submitting}
        initialValues={editing ? mapToFormValues(editing) : undefined}
        disableName={!!editing?.isSystem}
        onSubmit={handleSubmit}
        onCancel={handleModalClose}
      />
    </div>
  );
}
