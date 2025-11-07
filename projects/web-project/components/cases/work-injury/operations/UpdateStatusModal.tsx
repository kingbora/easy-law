import { useEffect } from 'react';

import { Form, Modal, Select, message } from 'antd';

import {
	useWorkInjuryCaseOperationsStore,
	type CaseStatusUpdatePayload
} from './useCaseOperationsStore';
import { CASE_STATUS_LABEL_MAP, type CaseStatus } from '@/lib/cases-api';

export type UpdateStatusFormValues = CaseStatusUpdatePayload;

const CASE_STATUS_OPTIONS: CaseStatus[] = ['open', 'closed', 'void'];
const CLOSED_REASON_OPTIONS = ['调解', '判决', '撤诉', '和解'] as const;
const VOID_REASON_OPTIONS = ['退单', '跑单'] as const;

export default function UpdateStatusModal() {
	const [form] = Form.useForm<UpdateStatusFormValues>();
	const open = useWorkInjuryCaseOperationsStore((state) => state.activeOperation === 'status');
	const defaults = useWorkInjuryCaseOperationsStore((state) => state.statusDefaults);
	const submitting = useWorkInjuryCaseOperationsStore((state) => state.statusSubmitting);
	const close = useWorkInjuryCaseOperationsStore((state) => state.closeStatusModal);
	const submit = useWorkInjuryCaseOperationsStore((state) => state.submitStatusUpdate);
	const selectedStatus = Form.useWatch('caseStatus', form);

	useEffect(() => {
		if (!open) {
			form.resetFields();
			return;
		}
		form.setFieldsValue({
			caseStatus: defaults?.caseStatus ?? 'open',
			closedReason: defaults?.closedReason ?? null,
			voidReason: defaults?.voidReason ?? null
		});
	}, [open, form, defaults]);

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
		try {
			const values = await form.validateFields();
			if (values.caseStatus === 'closed' && !values.closedReason) {
				message.error('请选择结案方式');
				return;
			}
			if (values.caseStatus === 'void' && !values.voidReason) {
				message.error('请选择废单原因');
				return;
			}
			await submit({
				caseStatus: values.caseStatus,
				closedReason: values.caseStatus === 'closed' ? values.closedReason ?? null : null,
				voidReason: values.caseStatus === 'void' ? values.voidReason ?? null : null
			});
			const state = useWorkInjuryCaseOperationsStore.getState();
			if (state.activeOperation !== 'status') {
				form.resetFields();
			}
		} catch (error) {
			if ((error as { errorFields?: unknown[] })?.errorFields) {
				message.error('请完善状态信息后再提交');
			}
		}
	};

	return (
  <Modal
    centered
    destroyOnHidden
    open={open}
    title="更新案件状态"
    okText="保存"
    cancelText="取消"
    onCancel={() => {
				form.resetFields();
				close();
			}}
    onOk={handleOk}
    confirmLoading={submitting}
		>
    <Form form={form} layout="vertical" onValuesChange={handleValuesChange}>
      <Form.Item
        label="案件状态"
        name="caseStatus"
        rules={[{ required: true, message: '请选择案件状态' }]}
				>
        <Select
          options={CASE_STATUS_OPTIONS.map((value) => ({
							label: CASE_STATUS_LABEL_MAP[value] ?? value,
							value
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