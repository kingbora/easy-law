import { useCallback, useEffect, useMemo, useState } from 'react';

import { Form, Modal, Select, Spin, Typography, message } from 'antd';

import {
  fetchAssignableStaff,
  type AssignableStaffResponse
} from '@/lib/cases-api';
import type { UserDepartment } from '@/lib/users-api';

export interface AssignStaffFormValues {
  assignedLawyerId?: string | null;
  assignedAssistantId?: string | null;
}

interface AssignStaffModalProps {
  open: boolean;
  caseDepartment?: UserDepartment | null;
  initialValues?: AssignStaffFormValues;
  confirmLoading?: boolean;
  onCancel: () => void;
  onSubmit?: (values: AssignStaffFormValues) => Promise<void> | void;
}

const formatStaffLabel = (member: AssignableStaffResponse['lawyers'][number]): string => {
  if (!member.name) {
    return '未命名成员';
  }
  return member.name;
};

export default function AssignStaffModal({
  open,
  caseDepartment,
  initialValues,
  confirmLoading = false,
  onCancel,
  onSubmit
}: AssignStaffModalProps) {
  const [form] = Form.useForm<AssignStaffFormValues>();
  const [loading, setLoading] = useState(false);
  const [assignableStaff, setAssignableStaff] = useState<AssignableStaffResponse | null>(null);

  const loadAssignableStaff = useCallback(async () => {
    if (!open) {
      return;
    }
    setLoading(true);
    try {
      const response = await fetchAssignableStaff(
        caseDepartment ? { department: caseDepartment } : undefined
      );
      setAssignableStaff(response);
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : '获取可分配成员失败，请稍后重试'
      );
      setAssignableStaff({ lawyers: [], assistants: [] });
    } finally {
      setLoading(false);
    }
  }, [caseDepartment, open]);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setAssignableStaff(null);
      return;
    }
    form.setFieldsValue(initialValues ?? {});
    void loadAssignableStaff();
  }, [open, form, initialValues, loadAssignableStaff]);

  const lawyerOptions = useMemo(
    () =>
      (assignableStaff?.lawyers ?? []).map((member) => ({
        value: member.id,
        label: formatStaffLabel(member)
      })),
    [assignableStaff?.lawyers]
  );

  const assistantOptions = useMemo(
    () =>
      (assignableStaff?.assistants ?? []).map((member) => ({
        value: member.id,
        label: formatStaffLabel(member)
      })),
    [assignableStaff?.assistants]
  );

  const handleOk = async () => {
    if (!onSubmit) {
      onCancel();
      return;
    }

    try {
      const values = await form.validateFields();
      await onSubmit({
        assignedLawyerId: values.assignedLawyerId ?? null,
        assignedAssistantId: values.assignedAssistantId ?? null
      });
      form.resetFields();
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) {
        message.error('表单验证失败，请检查是否所有必填项都填写完成！');
      }
    }
  };

  return (
    <Modal
      centered
      destroyOnClose
      open={open}
      title="案件人员分配"
      okText="保存"
      onCancel={() => {
        form.resetFields();
        onCancel();
      }}
      onOk={handleOk}
      confirmLoading={confirmLoading}
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px 0' }}>
          <Spin />
        </div>
      ) : (
        <Form form={form} layout="vertical">
          <Typography.Paragraph type="secondary">
            可分配成员列表根据您的角色和部门自动过滤。
          </Typography.Paragraph>
          <Form.Item rules={[{ required: true, message: '请选择承办律师'}]} label="承办律师" name="assignedLawyerId">
            <Select
              allowClear
              placeholder="请选择承办律师"
              options={lawyerOptions}
              optionFilterProp="label"
              showSearch
            />
          </Form.Item>
          <Form.Item label="律师助理" name="assignedAssistantId">
            <Select
              allowClear
              placeholder="请选择律师助理"
              options={assistantOptions}
              optionFilterProp="label"
              showSearch
            />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
