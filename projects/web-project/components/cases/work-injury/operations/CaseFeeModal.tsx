import { Form, Input, Modal, Skeleton, Typography } from 'antd';
import type { FC } from 'react';
import { useEffect } from 'react';

import type { CaseRecord } from '@/lib/cases-api';

export interface CaseFeeFormValues {
  salesCommission?: string | null;
  handlingFee?: string | null;
}

interface CaseFeeModalProps {
  open: boolean;
  loading: boolean;
  submitting: boolean;
  caseRecord: CaseRecord | null;
  onClose: () => void;
  onSubmit: (values: { salesCommission: string | null; handlingFee: string | null }) => Promise<void> | void;
}

const CaseFeeModal: FC<CaseFeeModalProps> = ({
  open,
  loading,
  submitting,
  caseRecord,
  onClose,
  onSubmit
}) => {
  const [form] = Form.useForm<CaseFeeFormValues>();

  useEffect(() => {
    if (!open) {
      form.resetFields();
      return;
    }

    if (caseRecord) {
      form.setFieldsValue({
        salesCommission: caseRecord.salesCommission ?? '',
        handlingFee: caseRecord.handlingFee ?? ''
      });
    }
  }, [caseRecord, form, open]);

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const normalize = (value?: string | null) => {
        if (typeof value !== 'string') {
          return null;
        }
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
      };
      await onSubmit({
        salesCommission: normalize(values.salesCommission ?? null),
        handlingFee: normalize(values.handlingFee ?? null)
      });
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) {
        return;
      }
      throw error;
    }
  };

  const salesName = caseRecord?.assignedSaleName ?? '未分配';
  const lawyerNames = [caseRecord?.assignedLawyerName, caseRecord?.assignedAssistantName]
    .filter((name): name is string => Boolean(name && name.trim().length > 0))
    .join(' / ');
  const teamLabel = lawyerNames.length > 0 ? lawyerNames : '未分配';

  return (
    <Modal
      destroyOnClose
      width={420}
      title="费用明细"
      open={open}
      okText="保存"
      cancelText="取消"
      onCancel={handleClose}
      onOk={handleSubmit}
      confirmLoading={submitting}
      okButtonProps={{ disabled: loading || !caseRecord }}
    >
      {loading || !caseRecord ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <Form layout="vertical" form={form} disabled={submitting}>
          <Form.Item label="销售">
            <Typography.Text type="secondary">{salesName}</Typography.Text>
          </Form.Item>
          <Form.Item label="提成" name="salesCommission">
            <Input placeholder="请输入销售提成" allowClear />
          </Form.Item>
          <Form.Item label="律师/律助">
            <Typography.Text type="secondary">{teamLabel}</Typography.Text>
          </Form.Item>
          <Form.Item label="办案费用" name="handlingFee">
            <Input placeholder="请输入办案费用" allowClear />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
};

export default CaseFeeModal;
