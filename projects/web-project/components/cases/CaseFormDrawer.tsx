'use client';

import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Collapse,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Space,
  Steps,
  Typography
} from 'antd';
import type { FormInstance } from 'antd';
import type { NamePath } from 'antd/es/form/interface';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';

import type { CaseDetail, CasePayload } from '@/lib/cases-api';
import { CASE_BILLING_METHOD_LABELS, CASE_BILLING_METHOD_OPTIONS, CASE_STATUS_OPTIONS } from '@/lib/cases-constants';
import type { CaseTypeItem } from '@/lib/case-settings-api';
import type { LawyerResponse } from '@/lib/lawyers-api';

const { Title, Text, Paragraph } = Typography;

type CaseFormLawyer = {
  lawyerId?: string;
  hourlyRate?: number | null;
};

type CaseFormValues = {
  name: string;
  clientId: string;
  caseTypeId: string;
  caseCategoryId: string;
  status: string;
  description?: string | null;
  court?: string | null;
  filingDate?: Dayjs | null;
  hearingDate?: Dayjs | null;
  evidenceDeadline?: Dayjs | null;
  appealDeadline?: Dayjs | null;
  disputedAmount?: number | null;
  materialsChecklist?: string | null;
  billingMethod: string;
  lawyerFeeTotal?: number | null;
  estimatedHours?: number | null;
  contingencyRate?: number | null;
  otherFeeBudget?: number | null;
  paymentPlan?: string | null;
  opponentName: string;
  opponentType: 'individual' | 'company';
  opponentIdNumber?: string | null;
  opponentLawyer?: string | null;
  thirdParty?: string | null;
  lawyers: CaseFormLawyer[];
  primaryLawyerId?: string;
};

export interface CaseFormDrawerProps {
  open: boolean;
  mode: 'create' | 'edit';
  submitting?: boolean;
  initialValues?: CaseDetail;
  caseTypes: CaseTypeItem[];
  clients: Array<{ id: string; name: string }>;
  lawyers: LawyerResponse[];
  onClose: () => void;
  onSubmit: (payload: CasePayload) => Promise<void>;
}

const toNumberOrNull = (value: string | null, fractionDigits = 2): number | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return Number(parsed.toFixed(fractionDigits));
};

const mapDetailToFormValues = (detail: CaseDetail | undefined): Partial<CaseFormValues> => {
  if (!detail) {
    return {};
  }
  return {
    name: detail.name,
    clientId: detail.client.id,
    caseTypeId: detail.caseType.id,
    caseCategoryId: detail.caseCategory.id,
    status: detail.status,
    description: detail.description ?? undefined,
    court: detail.court ?? undefined,
    filingDate: detail.filingDate ? dayjs(detail.filingDate) : undefined,
    hearingDate: detail.hearingDate ? dayjs(detail.hearingDate) : undefined,
    evidenceDeadline: detail.evidenceDeadline ? dayjs(detail.evidenceDeadline) : undefined,
    appealDeadline: detail.appealDeadline ? dayjs(detail.appealDeadline) : undefined,
    disputedAmount: toNumberOrNull(detail.disputedAmount),
    materialsChecklist: detail.materialsChecklist ?? undefined,
    billingMethod: detail.billingMethod,
    lawyerFeeTotal: toNumberOrNull(detail.billing.lawyerFeeTotal),
    estimatedHours: detail.billing.estimatedHours ?? undefined,
    contingencyRate: toNumberOrNull(detail.billing.contingencyRate, 2),
    otherFeeBudget: toNumberOrNull(detail.billing.otherFeeBudget),
    paymentPlan: detail.billing.paymentPlan ?? undefined,
    opponentName: detail.opponent.name,
    opponentType: detail.opponent.type,
    opponentIdNumber: detail.opponent.idNumber ?? undefined,
    opponentLawyer: detail.opponent.lawyer ?? undefined,
    thirdParty: detail.opponent.thirdParty ?? undefined,
    lawyers: detail.lawyers.map((lawyer) => ({
      lawyerId: lawyer.id,
      hourlyRate: toNumberOrNull(lawyer.hourlyRate)
    })),
    primaryLawyerId: detail.primaryLawyerId ?? detail.lawyers[0]?.id
  };
};

const ensurePrimaryLawyer = (form: FormInstance<CaseFormValues>) => {
  const lawyers = (form.getFieldValue('lawyers') ?? []) as CaseFormLawyer[];
  const availableIds = lawyers
    .map((item) => item?.lawyerId)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  const currentPrimary = form.getFieldValue('primaryLawyerId');
  if (availableIds.length === 0) {
    if (currentPrimary) {
      form.setFieldsValue({ primaryLawyerId: undefined });
    }
    return;
  }
  if (!currentPrimary || !availableIds.includes(currentPrimary)) {
    form.setFieldsValue({ primaryLawyerId: availableIds[0] });
  }
};

export default function CaseFormDrawer({
  open,
  mode,
  submitting,
  initialValues,
  caseTypes,
  clients,
  lawyers,
  onClose,
  onSubmit
}: CaseFormDrawerProps) {
  const [form] = Form.useForm<CaseFormValues>();
  const [currentStep, setCurrentStep] = useState(0);

  const caseTypeId = Form.useWatch('caseTypeId', form);
  const lawyersValue = Form.useWatch('lawyers', form);
  const billingMethod = Form.useWatch('billingMethod', form);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setCurrentStep(0);
      return;
    }
    setCurrentStep(0);
    if (mode === 'edit' && initialValues) {
      form.setFieldsValue(mapDetailToFormValues(initialValues));
    } else {
      form.setFieldsValue({
        status: CASE_STATUS_OPTIONS[0]?.value ?? 'consultation',
        billingMethod: CASE_BILLING_METHOD_OPTIONS[0]?.value ?? 'fixed_fee',
        opponentType: 'company',
        lawyers: [{}]
      });
    }
  }, [open, mode, initialValues, form]);

  useEffect(() => {
    if (!open) {
      return;
    }
    ensurePrimaryLawyer(form);
  }, [lawyersValue, form, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const selectedType = caseTypes.find((item) => item.id === caseTypeId);
    if (!selectedType) {
      form.setFieldsValue({ caseCategoryId: undefined });
      return;
    }
    const currentCategoryId = form.getFieldValue('caseCategoryId');
    if (!selectedType.categories.some((category) => category.id === currentCategoryId)) {
      form.setFieldsValue({ caseCategoryId: undefined });
    }
  }, [caseTypeId, caseTypes, form, open]);

  const clientOptions = useMemo(
    () => clients.map((client) => ({ label: client.name, value: client.id })),
    [clients]
  );

  const lawyerOptions = useMemo(
    () =>
      lawyers.map((lawyer) => ({
        label: lawyer.name ?? lawyer.email ?? '未命名律师',
        value: lawyer.id
      })),
    [lawyers]
  );

  const lawyerOptionMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of lawyerOptions) {
      map.set(option.value, option.label as string);
    }
    return map;
  }, [lawyerOptions]);

  const selectedLawyerIds = useMemo(() => {
    if (!Array.isArray(lawyersValue)) {
      return [] as string[];
    }
    return (lawyersValue as CaseFormLawyer[])
      .map((item) => item?.lawyerId)
      .filter((value): value is string => typeof value === 'string' && value.length > 0);
  }, [lawyersValue]);

  const selectedCaseType = useMemo(() => caseTypes.find((item) => item.id === caseTypeId), [caseTypes, caseTypeId]);
  const categoryOptions = selectedCaseType
    ? selectedCaseType.categories.map((category) => ({ label: category.name, value: category.id }))
    : [];

  const steps = [
    { title: '案件信息', description: '填写基础信息和负责律师' },
    { title: '收费方式', description: '配置收费方案与预算' },
    { title: '对方当事人', description: '录入对方信息' }
  ];

  const stepFields: NamePath[][] = [
    ['name', 'clientId', 'caseTypeId', 'caseCategoryId', 'status', 'lawyers', 'primaryLawyerId'],
    ['billingMethod', 'lawyers', 'lawyerFeeTotal', 'estimatedHours', 'contingencyRate', 'otherFeeBudget', 'paymentPlan'],
    ['opponentName', 'opponentType']
  ];

  const handleNext = async () => {
    const fields = stepFields[currentStep];
    await form.validateFields(fields);
    setCurrentStep((prev) => prev + 1);
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const closeDrawer = () => {
    onClose();
  };

  const handleSubmit = async () => {
    await form.validateFields();
    const values = form.getFieldsValue(true);
    const lawyersList = (values.lawyers ?? []) as CaseFormLawyer[];
    const filteredLawyers = lawyersList
      .filter((item) => item && item.lawyerId)
      .map((item) => ({
        lawyerId: item.lawyerId!,
        hourlyRate:
          item.hourlyRate !== undefined && item.hourlyRate !== null
            ? item.hourlyRate.toFixed(2)
            : null,
        isPrimary: item.lawyerId === values.primaryLawyerId
      }));

    const payload: CasePayload = {
      name: values.name.trim(),
      clientId: values.clientId,
      caseTypeId: values.caseTypeId,
      caseCategoryId: values.caseCategoryId,
      status: values.status,
      description: values.description?.trim() || null,
      court: values.court?.trim() || null,
      filingDate: values.filingDate ? values.filingDate.format('YYYY-MM-DD') : null,
      hearingDate: values.hearingDate ? values.hearingDate.format('YYYY-MM-DD') : null,
      evidenceDeadline: values.evidenceDeadline ? values.evidenceDeadline.format('YYYY-MM-DD') : null,
      appealDeadline: values.appealDeadline ? values.appealDeadline.format('YYYY-MM-DD') : null,
      disputedAmount:
        values.disputedAmount !== undefined && values.disputedAmount !== null
          ? values.disputedAmount.toFixed(2)
          : null,
      materialsChecklist: values.materialsChecklist?.trim() || null,
      billingMethod: values.billingMethod,
      lawyerFeeTotal:
        values.lawyerFeeTotal !== undefined && values.lawyerFeeTotal !== null
          ? values.lawyerFeeTotal.toFixed(2)
          : null,
      estimatedHours:
        values.estimatedHours !== undefined && values.estimatedHours !== null
          ? Math.trunc(values.estimatedHours)
          : null,
      contingencyRate:
        values.contingencyRate !== undefined && values.contingencyRate !== null
          ? values.contingencyRate.toFixed(2)
          : null,
      otherFeeBudget:
        values.otherFeeBudget !== undefined && values.otherFeeBudget !== null
          ? values.otherFeeBudget.toFixed(2)
          : null,
      paymentPlan: values.paymentPlan?.trim() || null,
      opponentName: values.opponentName.trim(),
      opponentType: values.opponentType,
      opponentIdNumber: values.opponentIdNumber?.trim() || null,
      opponentLawyer: values.opponentLawyer?.trim() || null,
      thirdParty: values.thirdParty?.trim() || null,
      lawyers: filteredLawyers
    };

    await onSubmit(payload);
  };

  const footer = (
    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
      <Button onClick={closeDrawer}>取消</Button>
      <Space>
        {currentStep > 0 && (
          <Button onClick={handlePrev} disabled={submitting}>
            上一步
          </Button>
        )}
        {currentStep < steps.length - 1 ? (
          <Button type="primary" onClick={handleNext} disabled={submitting}>
            下一步
          </Button>
        ) : (
          <Button type="primary" onClick={handleSubmit} loading={submitting}>
            {mode === 'create' ? '创建案件' : '保存修改'}
          </Button>
        )}
      </Space>
    </Space>
  );

  return (
    <Drawer
      open={open}
      onClose={closeDrawer}
      width={864}
      destroyOnClose
      maskClosable={false}
      title={mode === 'create' ? '新增案件' : '编辑案件'}
      footer={footer}
    >
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <Steps current={currentStep} items={steps} responsive />
        <Form<CaseFormValues> layout="vertical" form={form} initialValues={{}}>
          {currentStep === 0 && (
            <Space direction="vertical" size={24} style={{ width: '100%' }}>
              <Title level={5}>基本信息</Title>
              <Form.Item
                label="案件名称"
                name="name"
                rules={[
                  { required: true, message: '请填写案件名称' },
                  {
                    validator: (_, value) => {
                      if (!value) {
                        return Promise.resolve();
                      }
                      return value.trim().length >= 4
                        ? Promise.resolve()
                        : Promise.reject(new Error('请按照“客户简称+对方简称+案由”填写，长度需大于4个字符'));
                    }
                  }
                ]}
              >
                <Input placeholder="例如：华泰集团 vs 张三 合同纠纷" />
              </Form.Item>
              <Form.Item label="客户" name="clientId" rules={[{ required: true, message: '请选择客户' }]}>
                <Select
                  placeholder="请选择客户"
                  showSearch
                  optionFilterProp="label"
                  options={clientOptions}
                />
              </Form.Item>
              <Space size={16} style={{ width: '100%' }} wrap>
                <Form.Item
                  label="案件类型"
                  name="caseTypeId"
                  style={{ flex: 1, minWidth: 260 }}
                  rules={[{ required: true, message: '请选择案件类型' }]}
                >
                  <Select
                    placeholder="请选择案件类型"
                    options={caseTypes.map((type) => ({ label: type.name, value: type.id }))}
                  />
                </Form.Item>
                <Form.Item
                  label="案由"
                  name="caseCategoryId"
                  style={{ flex: 1, minWidth: 260 }}
                  rules={[{ required: true, message: '请选择案由' }]}
                >
                  <Select
                    placeholder={caseTypeId ? '请选择案由' : '请先选择案件类型'}
                    disabled={!caseTypeId}
                    options={categoryOptions}
                  />
                </Form.Item>
                <Form.Item
                  label="案件状态"
                  name="status"
                  style={{ flex: 1, minWidth: 260 }}
                  rules={[{ required: true, message: '请选择案件状态' }]}
                >
                  <Select options={CASE_STATUS_OPTIONS} placeholder="请选择案件状态" />
                </Form.Item>
              </Space>

              <div>
                <Title level={5}>负责律师</Title>
                <Text type="secondary">请选择参与本案的律师，并指定主办律师。</Text>
                <Form.List
                  name="lawyers"
                  rules={[
                    {
                      validator: async (_, value) => {
                        const list = Array.isArray(value) ? value : [];
                        const entries = list.filter((item) => item && item.lawyerId);
                        if (entries.length === 0) {
                          throw new Error('请至少添加一位负责律师');
                        }
                        const ids = entries.map((item: CaseFormLawyer) => item.lawyerId);
                        const unique = new Set(ids);
                        if (unique.size !== ids.length) {
                          throw new Error('负责律师不可重复');
                        }
                      }
                    }
                  ]}
                >
                  {(fields, { add, remove }) => (
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      {fields.map((field) => {
                        const currentLawyerId = form.getFieldValue(['lawyers', field.name, 'lawyerId']);
                        const options = lawyerOptions.map((option) => ({
                          ...option,
                          disabled:
                            !!option.value && selectedLawyerIds.includes(option.value) && option.value !== currentLawyerId
                        }));
                        return (
                          <Space
                            key={field.key}
                            align="baseline"
                            style={{ display: 'flex', width: '100%' }}
                          >
                            <Form.Item
                              name={[field.name, 'lawyerId']}
                              style={{ flex: 1 }}
                              rules={[{ required: true, message: '请选择负责律师' }]}
                            >
                              <Select
                                placeholder="请选择律师"
                                showSearch
                                optionFilterProp="label"
                                options={options}
                              />
                            </Form.Item>
                            {fields.length > 1 && (
                              <Button
                                type="text"
                                danger
                                icon={<MinusCircleOutlined />}
                                onClick={() => remove(field.name)}
                                aria-label="移除律师"
                              />
                            )}
                          </Space>
                        );
                      })}
                      <Button
                        type="dashed"
                        icon={<PlusOutlined />}
                        onClick={() => add({})}
                        block
                      >
                        添加负责律师
                      </Button>
                    </Space>
                  )}
                </Form.List>

                <Form.Item
                  label="主办律师"
                  name="primaryLawyerId"
                  rules={[{ required: true, message: '请指定主办律师' }]}
                  style={{ marginTop: 16 }}
                >
                  <Radio.Group>
                    <Space direction="vertical">
                      {selectedLawyerIds.length === 0 ? (
                        <Text type="secondary">请先选择负责律师</Text>
                      ) : (
                        selectedLawyerIds.map((lawyerId) => (
                          <Radio key={lawyerId} value={lawyerId}>
                            {lawyerOptionMap.get(lawyerId) ?? '未命名律师'}
                          </Radio>
                        ))
                      )}
                    </Space>
                  </Radio.Group>
                </Form.Item>
              </div>

              <Collapse bordered={false} items={[
                {
                  key: 'supplement',
                  label: '补充信息（可选）',
                  children: (
                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                      <Form.Item label="案件描述" name="description">
                        <Input.TextArea rows={4} placeholder="请详细描述案件背景、关键事实等信息" />
                      </Form.Item>
                      <Form.Item label="受理法院/机构" name="court">
                        <Input placeholder="请输入受理法院或机构" />
                      </Form.Item>
                      <Space size={16} style={{ width: '100%' }} wrap>
                        <Form.Item label="立案日期" name="filingDate" style={{ flex: 1, minWidth: 240 }}>
                          <DatePicker style={{ width: '100%' }} placeholder="选择日期" />
                        </Form.Item>
                        <Form.Item label="开庭日期" name="hearingDate" style={{ flex: 1, minWidth: 240 }}>
                          <DatePicker style={{ width: '100%' }} placeholder="选择日期" />
                        </Form.Item>
                        <Form.Item label="举证截止日" name="evidenceDeadline" style={{ flex: 1, minWidth: 240 }}>
                          <DatePicker style={{ width: '100%' }} placeholder="选择日期" />
                        </Form.Item>
                        <Form.Item label="上诉截止日" name="appealDeadline" style={{ flex: 1, minWidth: 240 }}>
                          <DatePicker style={{ width: '100%' }} placeholder="选择日期" />
                        </Form.Item>
                      </Space>
                      <Form.Item label="标的额（元）" name="disputedAmount">
                        <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="请输入争议金额" />
                      </Form.Item>
                      <Form.Item label="材料补充清单" name="materialsChecklist">
                        <Input.TextArea rows={3} placeholder="列举需要补充或已补充的材料" />
                      </Form.Item>
                    </Space>
                  )
                }
              ]} />
            </Space>
          )}

          {currentStep === 1 && (
            <Space direction="vertical" size={24} style={{ width: '100%' }}>
              <Title level={5}>收费方式</Title>
              <Form.Item label="收费方式" name="billingMethod" rules={[{ required: true, message: '请选择收费方式' }]}
              >
                <Radio.Group>
                  <Space direction="vertical">
                    {CASE_BILLING_METHOD_OPTIONS.map((option) => (
                      <Radio key={option.value} value={option.value}>
                        {option.label}
                      </Radio>
                    ))}
                  </Space>
                </Radio.Group>
              </Form.Item>

              <Space size={16} style={{ width: '100%' }} wrap>
                <Form.Item
                  label="律师费总额（元）"
                  name="lawyerFeeTotal"
                  style={{ flex: 1, minWidth: 240 }}
                  rules={[
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const method = getFieldValue('billingMethod');
                        if ((method === 'fixed_fee' || method === 'contingency') && (value === undefined || value === null)) {
                          return Promise.reject(new Error('请填写律师费总额'));
                        }
                        if (value !== undefined && value !== null && value <= 0) {
                          return Promise.reject(new Error('律师费总额需大于0'));
                        }
                        return Promise.resolve();
                      }
                    })
                  ]}
                >
                  <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="请输入律师费总额" />
                </Form.Item>
                <Form.Item
                  label="预计小时数"
                  name="estimatedHours"
                  style={{ flex: 1, minWidth: 240 }}
                  rules={[
                    {
                      validator: (_, value) => {
                        if (value === undefined || value === null || value === '') {
                          return Promise.resolve();
                        }
                        return value >= 0 ? Promise.resolve() : Promise.reject(new Error('预计小时数需大于等于0'));
                      }
                    }
                  ]}
                >
                  <InputNumber style={{ width: '100%' }} min={0} precision={0} placeholder="请输入预计小时数" />
                </Form.Item>
                <Form.Item
                  label="风险代理比例 (%)"
                  name="contingencyRate"
                  style={{ flex: 1, minWidth: 240 }}
                  rules={[
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const method = getFieldValue('billingMethod');
                        if (method === 'contingency') {
                          if (value === undefined || value === null) {
                            return Promise.reject(new Error('请填写风险代理比例'));
                          }
                          if (value <= 0 || value > 100) {
                            return Promise.reject(new Error('风险代理比例需在0-100之间'));
                          }
                        }
                        if (value !== undefined && value !== null && (value < 0 || value > 100)) {
                          return Promise.reject(new Error('风险代理比例需在0-100之间'));
                        }
                        return Promise.resolve();
                      }
                    })
                  ]}
                >
                  <InputNumber style={{ width: '100%' }} min={0} max={100} precision={2} placeholder="请输入比例，例如30" />
                </Form.Item>
                <Form.Item label="其他费用预算（元）" name="otherFeeBudget" style={{ flex: 1, minWidth: 240 }}>
                  <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="请输入预算" />
                </Form.Item>
              </Space>

              <Form.List name="lawyers">
                {(fields) => (
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Title level={5}>律师小时费率</Title>
                    <Text type="secondary">当收费方式为按小时或混合收费时，需为每位律师配置费率。</Text>
                    {fields.length === 0 && <Text>请先在上一步添加负责律师。</Text>}
                    {fields.map((field) => {
                      const lawyerId = form.getFieldValue(['lawyers', field.name, 'lawyerId']);
                      if (!lawyerId) {
                        return null;
                      }
                      return (
                        <Space key={field.key} align="baseline" style={{ width: '100%' }}>
                          <Text style={{ flex: 1 }}>{lawyerOptionMap.get(lawyerId) ?? '未命名律师'}</Text>
                          <Form.Item
                            label="小时费率"
                            name={[field.name, 'hourlyRate']}
                            style={{ marginBottom: 0 }}
                            rules={[
                              ({ getFieldValue }) => ({
                                validator(_, value) {
                                  const method = getFieldValue('billingMethod');
                                  if ((method === 'hourly' || method === 'hybrid')) {
                                    if (value === undefined || value === null) {
                                      return Promise.reject(new Error('请输入小时费率'));
                                    }
                                    if (value <= 0) {
                                      return Promise.reject(new Error('小时费率需大于0'));
                                    }
                                  }
                                  if (value !== undefined && value !== null && value < 0) {
                                    return Promise.reject(new Error('小时费率需大于0'));
                                  }
                                  return Promise.resolve();
                                }
                              })
                            ]}
                          >
                            <InputNumber style={{ width: 200 }} min={0} precision={2} addonAfter="元/小时" />
                          </Form.Item>
                        </Space>
                      );
                    })}
                  </Space>
                )}
              </Form.List>

              <Form.Item label="付款计划" name="paymentPlan">
                <Input.TextArea rows={3} placeholder="可填写预计付款节点、分期安排等" />
              </Form.Item>
              <Paragraph type="secondary">
                当前收费方式：{CASE_BILLING_METHOD_LABELS[billingMethod as keyof typeof CASE_BILLING_METHOD_LABELS] ?? '—'}
              </Paragraph>
            </Space>
          )}

          {currentStep === 2 && (
            <Space direction="vertical" size={24} style={{ width: '100%' }}>
              <Title level={5}>对方当事人信息</Title>
              <Form.Item
                label="对方当事人"
                name="opponentName"
                rules={[{ required: true, message: '请填写对方当事人名称或姓名' }]}
              >
                <Input placeholder="请输入对方当事人" />
              </Form.Item>
              <Form.Item
                label="当事人类型"
                name="opponentType"
                rules={[{ required: true, message: '请选择对方当事人类型' }]}
              >
                <Radio.Group>
                  <Space>
                    <Radio value="company">企业</Radio>
                    <Radio value="individual">自然人</Radio>
                  </Space>
                </Radio.Group>
              </Form.Item>
              <Form.Item label="对方证件号码" name="opponentIdNumber">
                <Input placeholder="企业填写统一信用代码，自然人填写身份证号码" />
              </Form.Item>
              <Form.Item label="对方代理律师" name="opponentLawyer">
                <Input placeholder="请输入对方律所及律师姓名" />
              </Form.Item>
              <Form.Item label="第三人" name="thirdParty">
                <Input placeholder="如有第三人请填写相关信息" />
              </Form.Item>
            </Space>
          )}
        </Form>
      </Space>
    </Drawer>
  );
}
