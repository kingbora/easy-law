"use client";

import { useEffect } from "react";

import { Button, Form, Input, Modal, Select, Space, Spin, Switch, Tabs, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";

import type { CaseClientDetail, UpdateCaseClientPayload } from "@/lib/clients-api";
import { CASE_STATUS_COLOR_MAP, CASE_STATUS_LABEL_MAP, CASE_TYPE_LABEL_MAP, DEPARTMENT_LABEL_MAP } from "@/utils/constants";

const ENTITY_TYPE_OPTIONS = [
  { value: "personal", label: "自然人" },
  { value: "organization", label: "机构" }
];

interface RelatedCaseRecord {
  caseId: string;
  caseType: CaseClientDetail["caseType"];
  caseStatus: CaseClientDetail["caseStatus"];
  department: CaseClientDetail["department"];
  assignedSaleName: string | null;
  assignedLawyerName: string | null;
  assignedAssistantName: string | null;
}

interface ClientDetailFormValues {
  name: string;
  entityType: "personal" | "organization" | null;
  phone?: string | null;
  idNumber?: string | null;
  address?: string | null;
  isDishonest: boolean;
}

export interface ClientDetailModalProps {
  open: boolean;
  client: CaseClientDetail | null;
  loading: boolean;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (payload: UpdateCaseClientPayload) => Promise<void> | void;
}

export function ClientDetailModal({
  open,
  client,
  loading,
  saving,
  onCancel,
  onSubmit
}: ClientDetailModalProps) {
  const [form] = Form.useForm<ClientDetailFormValues>();
  const router = useRouter();

  useEffect(() => {
    if (!open) {
      form.resetFields();
      return;
    }

    if (client) {
      form.setFieldsValue({
        name: client.name,
        entityType: client.entityType,
        phone: client.phone,
        idNumber: client.idNumber,
        address: client.address,
        isDishonest: client.isDishonest
      });
    } else {
      form.resetFields();
    }
  }, [client, form, open]);

  const handleFinish = async (values: ClientDetailFormValues) => {
    const payload: UpdateCaseClientPayload = {
      name: values.name,
      entityType: values.entityType ?? null,
      phone: values.phone?.trim() ? values.phone.trim() : null,
      idNumber: values.idNumber?.trim() ? values.idNumber.trim() : null,
      address: values.address?.trim() ? values.address.trim() : null,
      isDishonest: values.isDishonest
    } satisfies UpdateCaseClientPayload;

    await onSubmit(payload);
  };

  const handleViewCase = (caseId: string) => {
    if (!caseId) {
      return;
    }
    onCancel();
    router.push(`/cases/my?caseId=${caseId}`);
  };

  const relatedCases: RelatedCaseRecord[] = client
    ? [
        {
          caseId: client.caseId,
          caseType: client.caseType,
          caseStatus: client.caseStatus,
          department: client.department,
          assignedSaleName: client.assignedSaleName,
          assignedLawyerName: client.assignedLawyerName,
          assignedAssistantName: client.assignedAssistantName
        }
      ]
    : [];

  const relatedCaseColumns: ColumnsType<RelatedCaseRecord> = [
    {
      title: "案件类型",
      dataIndex: "caseType",
      key: "caseType",
      render: (value: CaseClientDetail["caseType"]) => CASE_TYPE_LABEL_MAP[value] ?? value
    },
    {
      title: "案件状态",
      dataIndex: "caseStatus",
      key: "caseStatus",
      render: (value: CaseClientDetail["caseStatus"]) => (
        <Tag color={value ? CASE_STATUS_COLOR_MAP[value] : "default"}>
          {value ? CASE_STATUS_LABEL_MAP[value] : "状态未知"}
        </Tag>
      )
    },
    {
      title: "所属部门",
      dataIndex: "department",
      key: "department",
      render: (value: CaseClientDetail["department"]) =>
        value ? DEPARTMENT_LABEL_MAP[value] : "未设置"
    },
    {
      title: "负责团队",
      dataIndex: "assignedLawyerName",
      key: "team",
      render: (_: unknown, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text type="secondary">
            律师：{record.assignedLawyerName ?? "未分配"}
          </Typography.Text>
          <Typography.Text type="secondary">
            助理：{record.assignedAssistantName ?? "未分配"}
          </Typography.Text>
          <Typography.Text type="secondary">
            销售：{record.assignedSaleName ?? "未分配"}
          </Typography.Text>
        </Space>
      )
    },
    {
      title: "操作",
      key: "action",
      render: (_: unknown, record) => (
        <Button type="link" onClick={() => handleViewCase(record.caseId)}>
          查看
        </Button>
      )
    }
  ];

  const renderMeta = client ? (
    <Space direction="vertical" size={4}>
      <Typography.Text type="secondary">
        案件类型：{CASE_TYPE_LABEL_MAP[client.caseType]} · {client.caseLevel} 级
      </Typography.Text>
      <Typography.Text type="secondary">
        案件状态：
        <Tag color={client.caseStatus ? CASE_STATUS_COLOR_MAP[client.caseStatus] : "default"}>
          {client.caseStatus ? CASE_STATUS_LABEL_MAP[client.caseStatus] : "状态未知"}
        </Tag>
      </Typography.Text>
      <Typography.Text type="secondary">
        所属部门：{client.department ? DEPARTMENT_LABEL_MAP[client.department] : "未设置"}
      </Typography.Text>
      <Typography.Text type="secondary">
        负责团队：律师 {client.assignedLawyerName ?? "未分配"} / 助理 {client.assignedAssistantName ?? "未分配"} / 销售 {client.assignedSaleName ?? "未分配"}
      </Typography.Text>
    </Space>
  ) : null;

  return (
    <Modal
      open={open}
      title={client ? `编辑客户：${client.name}` : "客户详情"}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={saving}
      destroyOnClose
      maskClosable={!saving}
      okText="保存"
      cancelText="取消"
    >
      <Spin spinning={loading}>
        <Tabs
          tabPosition="left"
          defaultActiveKey="basic"
          items={[
            {
              key: "basic",
              label: "基本信息",
              children: (
                <Space direction="vertical" size={16} style={{ width: "100%" }}>
                  {renderMeta}
                  <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleFinish}
                    disabled={loading}
                    preserve={false}
                  >
                    <Form.Item
                      label="客户名称"
                      name="name"
                      rules={[{ required: true, message: "请输入客户名称" }]}
                    >
                      <Input placeholder="请输入客户名称" allowClear />
                    </Form.Item>
                    <Form.Item label="客户类型" name="entityType">
                      <Select allowClear placeholder="请选择客户类型" options={ENTITY_TYPE_OPTIONS} />
                    </Form.Item>
                    <Form.Item label="联系电话" name="phone">
                      <Input placeholder="请输入联系电话" allowClear />
                    </Form.Item>
                    <Form.Item label="证件号码" name="idNumber">
                      <Input placeholder="请输入证件号码" allowClear />
                    </Form.Item>
                    <Form.Item label="联系地址" name="address">
                      <Input.TextArea placeholder="请输入联系地址" rows={3} allowClear />
                    </Form.Item>
                    <Form.Item label="是否失信人员" name="isDishonest" valuePropName="checked">
                      <Switch checkedChildren="是" unCheckedChildren="否" />
                    </Form.Item>
                  </Form>
                </Space>
              )
            },
            {
              key: "cases",
              label: "相关案件",
              children: (
                <Table<RelatedCaseRecord>
                  rowKey={(record) => record.caseId}
                  columns={relatedCaseColumns}
                  dataSource={relatedCases}
                  pagination={false}
                  locale={{ emptyText: client ? "暂无相关案件" : "请先选择客户" }}
                />
              )
            }
          ]}
        />
      </Spin>
    </Modal>
  );
}
