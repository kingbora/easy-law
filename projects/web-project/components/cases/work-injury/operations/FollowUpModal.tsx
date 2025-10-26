import { useEffect } from 'react';

import { DatePicker, Form, Input, Modal, Select, message } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';

import type { CaseTimelineNode } from '@/lib/cases-api';

const TIMELINE_NODE_OPTIONS: Array<{ value: CaseTimelineNode; label: string }> = [
  { value: 'apply_labor_confirmation', label: '申请确认劳务关系' },
  { value: 'receive_labor_confirmation_award', label: '收到确认劳务关系裁决' },
  { value: 'apply_work_injury_certification', label: '申请工伤认定' },
  { value: 'receive_work_injury_decision', label: '收到工伤认定书' },
  { value: 'apply_work_ability_appraisal', label: '申请劳动能力鉴定' },
  { value: 'receive_work_ability_conclusion', label: '收到劳动能力鉴定结论' },
  { value: 'apply_work_injury_benefit_award', label: '申请工伤保险待遇裁决' },
  { value: 'lawsuit_filed', label: '起诉立案' },
  { value: 'filing_approved', label: '立案审核通过' },
  { value: 'judgment_time', label: '裁决时间' }
];

export interface FollowUpFormValues {
  nodeType?: CaseTimelineNode;
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
      nodeType: initialValues?.nodeType,
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
      if (!values.nodeType || !values.occurredOn) {
        message.error('请完善跟进节点和日期');
        return;
      }
      await onSubmit({
        nodeType: values.nodeType,
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
          label="跟进节点"
          name="nodeType"
          rules={[{ required: true, message: '请选择跟进节点' }]}
        >
          <Select
            placeholder="请选择跟进节点"
            options={TIMELINE_NODE_OPTIONS}
            optionFilterProp="label"
            showSearch
          />
        </Form.Item>
        <Form.Item
          label="发生日期"
          name="occurredOn"
          rules={[{ required: true, message: '请选择发生日期' }]}
        >
          <DatePicker style={{ width: '100%' }} placeholder="请选择发生日期" />
        </Form.Item>
        <Form.Item label="备注" name="note">
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
