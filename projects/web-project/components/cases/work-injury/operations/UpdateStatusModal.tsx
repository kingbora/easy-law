import { useEffect } from 'react';

import { Form, Modal, Select, message } from 'antd';
import { CASE_STATUS_LABEL_MAP as CASE_STATUS_LABELS, type CaseStatus } from '@/lib/cases-api';

export type ClosedReason = '调解' | '判决' | '撤诉' | '和解';
export type VoidReason = '退单' | '跑单';

export interface UpdateStatusFormValues {
  caseStatus: CaseStatus;
  closedReason?: ClosedReason | null;
  voidReason?: VoidReason | null;
}

interface UpdateStatusModalProps {
  open: boolean;
  initialValues?: UpdateStatusFormValues;
  confirmLoading?: boolean;
  onCancel: () => void;
  onSubmit?: (values: UpdateStatusFormValues) => Promise<void> | void;
}

const CASE_STATUS_OPTIONS: CaseStatus[] = ['open', 'closed', 'void'];
const CLOSED_REASON_OPTIONS: ClosedReason[] = ['调解', '判决', '撤诉', '和解'];
const VOID_REASON_OPTIONS: VoidReason[] = ['退单', '跑单'];

export default function UpdateStatusModal({
  open,
  initialValues,
  confirmLoading = false,
  onCancel,
  onSubmit
}: UpdateStatusModalProps) {
  const [form] = Form.useForm<UpdateStatusFormValues>();
  const selectedStatus = Form.useWatch('caseStatus', form);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      return;
    }
    form.setFieldsValue({
  caseStatus: initialValues?.caseStatus ?? 'open',
      closedReason: initialValues?.closedReason ?? null,
      voidReason: initialValues?.voidReason ?? null
    });
  }, [form, initialValues, open]);

  const handleValuesChange = (changedValues: Partial<UpdateStatusFormValues>) => {
    if (!('caseStatus' in changedValues)) {
      return;
    }
    const status = changedValues.caseStatus;
    if (status !== 'closed') {
      form.setFieldsValue({ closedReason: null });
    }
    if (status !== 'void') {
      form.setFieldsValue({ voidReason: null });
    }
  };

  const handleOk = async () => {
    if (!onSubmit) {
      onCancel();
      return;
    }

    try {
      const values = await form.validateFields();
      await onSubmit({
        caseStatus: values.caseStatus,
        closedReason: values.caseStatus === 'closed' ? (values.closedReason ?? null) : null,
        voidReason: values.caseStatus === 'void' ? (values.voidReason ?? null) : null
      });
      form.resetFields();
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) {
        message.error('请完善状态信息后再提交');
      }
    }
  };

  return (
    <Modal
      centered
      destroyOnClose
      open={open}
      title="更新案件状态"
      okText="保存"
      cancelText="取消"
      onCancel={() => {
        form.resetFields();
        onCancel();
      }}
      onOk={handleOk}
      confirmLoading={confirmLoading}
    >
      <Form form={form} layout="vertical" onValuesChange={handleValuesChange}>
        <Form.Item
          label="案件状态"
          name="caseStatus"
          rules={[{ required: true, message: '请选择案件状态' }]}
        >
          <Select
            options={CASE_STATUS_OPTIONS.map((value) => ({
              value,
              label: CASE_STATUS_LABELS[value]
            }))}
            placeholder="请选择案件状态"
          />
        </Form.Item>
        {selectedStatus === 'closed' ? (
          <Form.Item
            label="结案方式"
            name="closedReason"
            rules={[{ required: true, message: '请选择结案方式' }]}
          >
            <Select
              options={CLOSED_REASON_OPTIONS.map((value) => ({ label: value, value }))}
              placeholder="请选择结案方式"
            />
          </Form.Item>
        ) : null}
        {selectedStatus === 'void' ? (
          <Form.Item
            label="废单原因"
            name="voidReason"
            rules={[{ required: true, message: '请选择废单原因' }]}
          >
            <Select
              options={VOID_REASON_OPTIONS.map((value) => ({ label: value, value }))}
              placeholder="请选择废单原因"
            />
          </Form.Item>
        ) : null}
      </Form>
    </Modal>
  );
}
