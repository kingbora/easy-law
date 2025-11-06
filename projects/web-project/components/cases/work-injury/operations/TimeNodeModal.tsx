import { useCallback, useEffect, useMemo, useState } from 'react';

import { DatePicker, Form, Modal, Select, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';

import type { CaseTimeNodeRecord, CaseTimeNodeType } from '@/lib/cases-api';
import { CASE_TIME_NODE_DEFINITIONS } from '@/lib/case-time-nodes';

interface TimeNodeFormValues {
  nodeType?: CaseTimeNodeType;
  occurredOn?: Dayjs;
}

export interface TimeNodeModalProps {
  open: boolean;
  caseTitle?: string;
  confirmLoading?: boolean;
  nodeTypes?: CaseTimeNodeRecord[];
  onCancel: () => void;
  onSubmit: (values: { nodeType: CaseTimeNodeType; occurredOn: Dayjs }) => Promise<void> | void;
}

export default function TimeNodeModal({
  open,
  caseTitle,
  confirmLoading = false,
  nodeTypes,
  onCancel,
  onSubmit
}: TimeNodeModalProps) {
  const [form] = Form.useForm<TimeNodeFormValues>();
  const [okText, setOkText] = useState('新增');

  const resetForm = useCallback(() => {
    form.resetFields();
    void form.validateFields();
  }, [form]);

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open, resetForm]);

  const findNodeByType = useCallback(
    (type?: CaseTimeNodeType) => nodeTypes?.find(node => node.nodeType === type) ?? null,
    [nodeTypes]
  );

  const autofillOccurredOn = useCallback(
    (node: CaseTimeNodeRecord | null) => {
      if (!node?.occurredOn) {
        form.setFieldsValue({ occurredOn: undefined });
        return;
      }
      form.setFieldsValue({ occurredOn: dayjs(node.occurredOn) });
    },
    [form]
  );

  const handleNodeTypeChange = useCallback(
    (value: CaseTimeNodeType | undefined) => {
      form.setFieldsValue({ nodeType: value });
      const node = findNodeByType(value);
      if (node?.occurredOn) {
        setOkText('修改');
      } else {
        setOkText('新增');
      }
      autofillOccurredOn(node);
    },
    [autofillOccurredOn, findNodeByType, form]
  );

  const handleOk = async () => {
    const values = await form.validateFields();
    if (!values.nodeType || !values.occurredOn) {
      return;
    }
    await onSubmit({ nodeType: values.nodeType, occurredOn: values.occurredOn });
  };

  const options = useMemo(() => {
    return CASE_TIME_NODE_DEFINITIONS.map(definition => {
      const node = findNodeByType(definition.type);
      return {
        value: definition.type,
        label: definition.label,
        extra: node?.occurredOn ?? null
      };
    });
  }, [findNodeByType]);

  return (
    <Modal
      title="时间节点维护"
      open={open}
      onCancel={onCancel}
      onOk={() => void handleOk()}
      okText={okText}
      cancelText="取消"
      confirmLoading={confirmLoading}
      destroyOnHidden
    >
      {caseTitle ? (
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          当前案件：{caseTitle}
        </Typography.Paragraph>
      ) : null}
      <Form form={form} layout="vertical">
        <Form.Item<TimeNodeFormValues>
          label="时间节点"
          name="nodeType"
          rules={[{ required: true, message: '请选择时间节点' }]}
        >
          <Select
            placeholder="请选择时间节点"
            options={options}
            showSearch
            optionFilterProp="label"
            onChange={handleNodeTypeChange}
            optionRender={(option) => (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{option.data.label}</span>
                <span>{option.data.extra ?? ''}</span>
              </div>
            )}
          />
        </Form.Item>
        <Form.Item<TimeNodeFormValues>
          label="发生日期"
          name="occurredOn"
          rules={[{ required: true, message: '请选择发生日期' }]}
        >
          <DatePicker style={{ width: '100%' }} placeholder="请选择发生日期" format="YYYY-MM-DD" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
