import { useEffect } from 'react';

import { DatePicker, Form, Input, Modal, message } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';

export interface FollowUpFormValues {
  occurredOn?: Dayjs | null;
  note?: string | null;
}

interface FollowUpModalProps {
  open: boolean;
  initialValues?: FollowUpFormValues;
  confirmLoading?: boolean;
  onCancel: () => void;
  onSubmit?: (values: Required<FollowUpFormValues>) => Promise<void> | void;
}

export default function FollowUpModal({
  open,
  initialValues,
  confirmLoading = false,
  onCancel,
  onSubmit
}: FollowUpModalProps) {
  const [form] = Form.useForm<FollowUpFormValues>();

  useEffect(() => {
    if (!open) {
      form.resetFields();
      return;
    }

    const defaults: FollowUpFormValues = {
      occurredOn: initialValues?.occurredOn ?? dayjs(),
      note: initialValues?.note ?? null
    };

    form.setFieldsValue(defaults);
  }, [open, form, initialValues]);

  const handleOk = async () => {
    if (!onSubmit) {
      onCancel();
      return;
    }

    try {
      const values = await form.validateFields();
      if (!values.note || !values.occurredOn) {
        message.error('请输入框跟进备注和日期');
        return;
      }
      await onSubmit({
        occurredOn: values.occurredOn,
        note: values.note?.trim() ? values.note.trim() : null
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
      title="添加跟进备注"
      okText="保存"
      onCancel={() => {
        form.resetFields();
        onCancel();
      }}
      onOk={handleOk}
      confirmLoading={confirmLoading}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="发生日期"
          name="occurredOn"
          rules={[{ required: true, message: '请选择发生日期' }]}
        >
          <DatePicker style={{ width: '100%' }} placeholder="请选择发生日期" />
        </Form.Item>
        <Form.Item rules={[{ required: true, message: '请填写跟进备注' }]} label="备注" name="note">
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
