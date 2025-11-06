import { useEffect } from 'react';

import { DatePicker, Form, Input, Modal, message } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';

import { useWorkInjuryCaseOperationsStore } from './useCaseOperationsStore';

export interface FollowUpFormValues {
  occurredOn?: Dayjs | null;
  note?: string | null;
}

export default function FollowUpModal() {
  const [form] = Form.useForm<FollowUpFormValues>();
  const open = useWorkInjuryCaseOperationsStore((state) => state.activeOperation === 'followUp');
  const defaults = useWorkInjuryCaseOperationsStore((state) => state.followUpDefaults);
  const submitting = useWorkInjuryCaseOperationsStore((state) => state.followUpSubmitting);
  const close = useWorkInjuryCaseOperationsStore((state) => state.closeFollowUpModal);
  const submit = useWorkInjuryCaseOperationsStore((state) => state.submitFollowUp);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      return;
    }

    const nextDefaults: FollowUpFormValues = {
      occurredOn: defaults?.occurredOn ?? dayjs(),
      note: defaults?.note ?? null
    };

    form.setFieldsValue(nextDefaults);
  }, [open, form, defaults]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (!values.occurredOn || !values.note?.trim()) {
        message.error('请输入跟进备注和日期');
        return;
      }
      await submit({
        occurredOn: values.occurredOn,
        note: values.note.trim()
      });
      const state = useWorkInjuryCaseOperationsStore.getState();
      if (state.activeOperation !== 'followUp') {
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
      title="添加跟进备注"
      okText="保存"
      onCancel={() => {
        form.resetFields();
        close();
      }}
      onOk={handleOk}
      confirmLoading={submitting}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="发生日期"
          name="occurredOn"
          rules={[{ required: true, message: '请选择发生日期' }]}
        >
          <DatePicker style={{ width: '100%' }} placeholder="请选择发生日期" />
        </Form.Item>
        <Form.Item 
        label="备注" 
        name="note"
        rules={[{ required: true, message: '请填写跟进备注' }]}
        >
          <Input.TextArea
            rows={4}
            placeholder="请填写跟进备注"
            maxLength={500}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}