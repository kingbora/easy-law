import { useEffect, useMemo } from 'react';

import { Col, DatePicker, Form, Input, Modal, Row, Select, message } from 'antd';
import TextArea from 'antd/es/input/TextArea';
import type { Dayjs } from 'dayjs';
import type { TrialStage } from '@/lib/cases-api';

const TRIAL_STAGE_OPTIONS: Array<{ label: string; value: TrialStage }> = [
  { label: '一审', value: 'first_instance' },
  { label: '二审', value: 'second_instance' },
  { label: '再审', value: 'retrial' }
];

export interface HearingFormValues {
  trialLawyerId?: string | null;
  hearingTime?: Dayjs | null;
  hearingLocation?: string | null;
  tribunal?: string | null;
  judge?: string | null;
  caseNumber?: string | null;
  contactPhone?: string | null;
  trialStage?: TrialStage | null;
  hearingResult?: string | null;
}

interface HearingModalProps {
  open: boolean;
  initialValues?: HearingFormValues;
  confirmLoading?: boolean;
  onCancel: () => void;
  onSubmit?: (values: HearingFormValues) => Promise<void> | void;
  lawyerOptions?: Array<{ value: string; label: string }>;
  lawyerOptionsLoading?: boolean;
  disabledStages?: TrialStage[];
}

export default function HearingModal({
  open,
  initialValues,
  confirmLoading = false,
  onCancel,
  onSubmit,
  lawyerOptions = [],
  lawyerOptionsLoading = false,
  disabledStages = []
}: HearingModalProps) {
  const [form] = Form.useForm<HearingFormValues>();

  const stageOptions = useMemo(
    () =>
      TRIAL_STAGE_OPTIONS.map((option) => ({
        ...option,
        disabled: disabledStages.includes(option.value)
      })),
    [disabledStages]
  );

  useEffect(() => {
    if (!open) {
      form.resetFields();
      return;
    }

    form.setFieldsValue(initialValues ?? {});
  }, [open, form, initialValues]);

  const handleOk = async () => {
    if (!onSubmit) {
      onCancel();
      return;
    }

    try {
      const values = await form.validateFields();
      await onSubmit({
        trialLawyerId: values.trialLawyerId ?? null,
        hearingTime: values.hearingTime ?? null,
        hearingLocation: values.hearingLocation ?? null,
        tribunal: values.tribunal ?? null,
        judge: values.judge ?? null,
        caseNumber: values.caseNumber ?? null,
        contactPhone: values.contactPhone ?? null,
        trialStage: values.trialStage ?? null,
        hearingResult: values.hearingResult ?? null
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
      title="新增庭审信息"
      okText="保存"
      onCancel={() => {
        form.resetFields();
        onCancel();
      }}
      onOk={handleOk}
      confirmLoading={confirmLoading}
    >
      <Form form={form} layout="vertical">
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              label="开庭律师"
              name="trialLawyerId"
              rules={[{ required: true, message: '请选择开庭律师' }]}
            >
              <Select
                allowClear
                placeholder="请选择开庭律师"
                options={lawyerOptions}
                loading={lawyerOptionsLoading}
                optionFilterProp="label"
                showSearch
              />
            </Form.Item>
          </Col>
          <Col span={12}>
          <Form.Item rules={[{required: true, message: '请选择审理阶段'}]} label="审理阶段" name="trialStage">
          <Select
            allowClear
            options={stageOptions}
            placeholder="请选择审理阶段"
          />
        </Form.Item>
          </Col>
          <Col span={12}>
          <Form.Item label="庭审时间" name="hearingTime">
          <DatePicker
            showTime
            style={{ width: '100%' }}
            format="YYYY-MM-DD HH:mm"
            placeholder="请选择庭审时间"
          />
        </Form.Item>
          </Col>
          <Col span={12}>
          <Form.Item label="法院" name="hearingLocation">
          <Input placeholder="请输入法院" />
        </Form.Item>
          </Col>
        <Col span={12}>
        <Form.Item label="判庭" name="tribunal">
          <Input placeholder="请输入判庭" />
        </Form.Item>
        </Col>
        <Col span={12}>
        <Form.Item label="主审法官" name="judge">
          <Input placeholder="请输入主审法官" />
        </Form.Item>
        </Col>
        
        <Col span={12}>
        <Form.Item label="联系电话" name="contactPhone">
          <Input placeholder="请输入联系电话" />
        </Form.Item>
        </Col>
        <Col span={24}>
        <Form.Item label="案号" name="caseNumber">
          <Input placeholder="请输入案号" />
        </Form.Item>
        </Col>
        <Col span={24}>
        <Form.Item label="庭审结果" name="hearingResult">
          <TextArea rows={3} placeholder="请输入庭审结果" />
        </Form.Item>
        </Col>
        </Row>
      </Form>
    </Modal>
  );
}
