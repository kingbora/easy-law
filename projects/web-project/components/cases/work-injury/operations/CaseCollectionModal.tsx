import { DatePicker, Form, InputNumber, Modal } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import type { FC } from 'react';
import { useEffect } from 'react';

export interface CaseCollectionFormValues {
  amount?: number | null;
  receivedAt?: Dayjs | null;
}

export interface CaseCollectionSubmitValues {
  amount: number;
  receivedAt: string;
}

interface CaseCollectionModalProps {
  open: boolean;
  confirmLoading?: boolean;
  onCancel: () => void;
  onSubmit: (values: CaseCollectionSubmitValues) => Promise<void> | void;
}

const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';

const CaseCollectionModal: FC<CaseCollectionModalProps> = ({
  open,
  confirmLoading,
  onCancel,
  onSubmit
}) => {
  const [form] = Form.useForm<CaseCollectionFormValues>();

  useEffect(() => {
    if (!open) {
      form.resetFields();
      return;
    }
    form.setFieldsValue({
      amount: null,
      receivedAt: dayjs()
    });
  }, [form, open]);

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const amountValue = values.amount;
      const dateValue = values.receivedAt;
      if (typeof amountValue !== 'number' || Number.isNaN(amountValue)) {
        throw new Error('missing_amount');
      }
      const receivedAt = dateValue ? dateValue.format(DEFAULT_DATE_FORMAT) : dayjs().format(DEFAULT_DATE_FORMAT);
      await onSubmit({
        amount: amountValue,
        receivedAt
      });
      form.resetFields();
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) {
        return;
      }
      if ((error as Error).message === 'missing_amount') {
        form.setFields([
          {
            name: 'amount',
            errors: ['请输入有效的回款金额']
          }
        ]);
        return;
      }
      throw error;
    }
  };

  return (
    <Modal
      destroyOnClose
      open={open}
      title="新增回款记录"
      okText="保存"
      cancelText="取消"
      onCancel={handleCancel}
      onOk={handleOk}
      confirmLoading={confirmLoading}
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          label="回款金额"
          name="amount"
          rules={[{ required: true, message: '请输入回款金额' }]}
        >
          <InputNumber
            min={0.01}
            precision={2}
            style={{ width: '100%' }}
            placeholder="请输入回款金额"
          />
        </Form.Item>
        <Form.Item
          label="回款日期"
          name="receivedAt"
          rules={[{ required: true, message: '请选择回款日期' }]}
        >
          <DatePicker style={{ width: '100%' }} format={DEFAULT_DATE_FORMAT} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CaseCollectionModal;
