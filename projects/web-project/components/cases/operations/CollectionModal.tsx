import { useEffect } from 'react';

import { App, DatePicker, Form, InputNumber, Modal } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';

import { useWorkInjuryCaseOperationsStore } from './useCaseOperationsStore';

interface CollectionFormValues {
  amount?: number | null;
  receivedAt?: Dayjs | null;
}

export default function CollectionModal() {
  const { message } = App.useApp();
  const [form] = Form.useForm<CollectionFormValues>();
  const open = useWorkInjuryCaseOperationsStore((state) => state.activeOperation === 'collection');
  const defaults = useWorkInjuryCaseOperationsStore((state) => state.collectionDefaults);
  const submitting = useWorkInjuryCaseOperationsStore((state) => state.collectionSubmitting);
  const close = useWorkInjuryCaseOperationsStore((state) => state.closeCollectionModal);
  const submit = useWorkInjuryCaseOperationsStore((state) => state.submitCollection);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      return;
    }
    form.setFieldsValue({
      amount: defaults?.amount ?? null,
      receivedAt: defaults?.receivedAt ?? dayjs()
    });
  }, [open, form, defaults]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const amount = values.amount ?? null;
      const receivedAt = values.receivedAt ?? null;
      if (!amount || amount <= 0) {
        message.error('请输入有效的回款金额');
        return;
      }
      if (!receivedAt) {
        message.error('请选择回款日期');
        return;
      }
      await submit({ amount, receivedAt });
      const state = useWorkInjuryCaseOperationsStore.getState();
      if (state.activeOperation !== 'collection') {
        form.resetFields();
      }
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) {
        message.error('表单验证失败，请检查是否所有必填项都填写完成！');
      }
    }
  };

  return (
    <Modal
      centered
      destroyOnHidden
      open={open}
      title="新增回款记录"
      okText="保存"
      cancelText="取消"
      onCancel={() => {
        form.resetFields();
        close();
      }}
      onOk={handleOk}
      confirmLoading={submitting}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="回款金额"
          name="amount"
          rules={[{ required: true, message: '请输入回款金额' }]}
        >
          <InputNumber
            min={0}
            step={100}
            style={{ width: '100%' }}
            placeholder="请输入回款金额"
          />
        </Form.Item>
        <Form.Item
          label="回款日期"
          name="receivedAt"
          rules={[{ required: true, message: '请选择回款日期' }]}
        >
          <DatePicker style={{ width: '100%' }} placeholder="请选择回款日期" format="YYYY-MM-DD" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
