'use client';

import { InboxOutlined, MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Collapse,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  message,
  Radio,
  Select,
  Space,
  Steps,
  Typography,
  Upload
} from 'antd';
import type { FormInstance } from 'antd';
import type { NamePath } from 'antd/es/form/interface';
import type { UploadChangeParam } from 'antd/es/upload';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import dayjs, { type Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { CaseDetail, CaseMaterialUploadItem, CasePayload } from '@/lib/cases-api';
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

type CaseUploadFile = UploadFile & {
  existingId?: string;
  base64Data?: string;
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
  const [materialFiles, setMaterialFiles] = useState<CaseUploadFile[]>([]);

  const fileToDataUrl = useCallback((file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) ?? '');
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }, []);

  const handleMaterialsChange: UploadProps<CaseUploadFile>['onChange'] = useCallback(
    async ({ fileList }: UploadChangeParam<CaseUploadFile>) => {
      const nextList = (fileList ?? []) as CaseUploadFile[];
      const processed = await Promise.all(
        nextList.map(async (item) => {
          if (item.originFileObj && !item.base64Data) {
            try {
              const dataUrl = await fileToDataUrl(item.originFileObj as File);
              const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
              return {
                ...item,
                status: 'done' as const,
                thumbUrl: dataUrl,
                url: dataUrl,
                base64Data: base64
              } satisfies CaseUploadFile;
            } catch (error) {
              message.error(`文件 ${item.name} 读取失败，请重试`);
              return null;
            }
          }
          return item;
        })
      );

      const filtered = processed.filter((item): item is CaseUploadFile => item !== null);
      setMaterialFiles(filtered);
    },
    [fileToDataUrl]
  );

  const handleMaterialPreview = useCallback((file: CaseUploadFile) => {
    const previewUrl = file.url ?? file.thumbUrl;
    if (previewUrl) {
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const handleMaterialDownload = useCallback((file: CaseUploadFile) => {
    const targetUrl = file.url ?? file.thumbUrl;
    if (targetUrl) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const caseTypeIdWatch = Form.useWatch('caseTypeId', form);
  const caseTypeId = caseTypeIdWatch ?? form.getFieldValue('caseTypeId');
  const lawyersValue = Form.useWatch('lawyers', form);
  const billingMethod = Form.useWatch('billingMethod', form);
  const opponentTypeValue = Form.useWatch('opponentType', form);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setCurrentStep(0);
      setMaterialFiles([]);
      return;
    }
    setCurrentStep(0);
    if (mode === 'edit' && initialValues) {
      form.setFieldsValue(mapDetailToFormValues(initialValues));
      setMaterialFiles(
        (initialValues.materials ?? []).map((item) => ({
          uid: item.id,
          name: item.filename,
          status: 'done' as const,
          url: item.downloadUrl,
          type: item.fileType ?? undefined,
          size: item.fileSize ?? undefined,
          existingId: item.id
        }))
      );
    } else {
      const baseValues: Partial<CaseFormValues> = {
        status: CASE_STATUS_OPTIONS[0]?.value ?? 'consultation',
        billingMethod: CASE_BILLING_METHOD_OPTIONS[0]?.value ?? 'fixed_fee',
        opponentType: 'company',
        lawyers: []
      };

      if (!form.getFieldValue('caseTypeId') && caseTypes.length > 0) {
        baseValues.caseTypeId = caseTypes[0]?.id;
        const defaultCategories = caseTypes[0]?.categories ?? [];
        if (defaultCategories.length > 0) {
          baseValues.caseCategoryId = defaultCategories[0]?.id;
        }
      }

      form.setFieldsValue(baseValues);
      setMaterialFiles([]);
    }
  }, [open, mode, initialValues, form, caseTypes]);

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

    if (!caseTypeId) {
      if (mode === 'create') {
        form.setFieldsValue({ caseCategoryId: undefined });
      }
      return;
    }

    const selectedType = caseTypes.find((item) => item.id === caseTypeId);
    if (!selectedType) {
      if (caseTypes.length === 0) {
        return;
      }
      form.setFieldsValue({ caseCategoryId: undefined });
      return;
    }

    const currentCategoryId = form.getFieldValue('caseCategoryId');
    if (currentCategoryId && !selectedType.categories.some((category) => category.id === currentCategoryId)) {
      form.setFieldsValue({ caseCategoryId: undefined });
    }
  }, [caseTypeId, caseTypes, form, open, mode]);

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

    if (materialFiles.length > 0) {
      const materialsPayload = materialFiles
        .map((file) => {
          if (file.existingId && !file.base64Data) {
            return { id: file.existingId } as CaseMaterialUploadItem;
          }
          if (file.base64Data) {
            const rawSize =
              (typeof file.size === 'number' ? file.size : undefined) ?? file.originFileObj?.size ?? null;
            return {
              filename: file.name,
              fileType: file.type ?? file.originFileObj?.type ?? null,
              fileSize: rawSize !== null && rawSize !== undefined ? Math.trunc(rawSize) : null,
              base64Data: file.base64Data
            } satisfies CaseMaterialUploadItem;
          }
          return null;
        })
        .filter((item): item is CaseMaterialUploadItem => item !== null);

      payload.materials = materialsPayload;
    } else if (mode === 'edit') {
      payload.materials = [];
    }

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

  const opponentIdLabel = opponentTypeValue === 'individual' ? '身份证号码' : '统一社会信用代码';
  const opponentIdPlaceholder =
    opponentTypeValue === 'individual' ? '请填写身份证号码' : '请填写统一社会信用代码';

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
              <Space size={16} style={{ width: '100%' }} wrap>
                <Form.Item
                  label="案件名称"
                  name="name"
                  style={{ flex: 1, minWidth: 280 }}
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
                <Form.Item
                  label="客户"
                  name="clientId"
                  style={{ flex: 1, minWidth: 280 }}
                  rules={[{ required: true, message: '请选择客户' }]}
                >
                  <Select
                    placeholder="请选择客户"
                    showSearch
                    optionFilterProp="label"
                    options={clientOptions}
                  />
                </Form.Item>
              </Space>
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
                <Title level={5}>负责律师（可选）</Title>
                <Text type="secondary">可按需添加参与律师，默认第一位律师为主办律师，可在下方调整。</Text>
                <Form.List
                  name="lawyers"
                  rules={[
                    {
                      validator: async (_, value) => {
                        const list = Array.isArray(value) ? value : [];
                        const entries = list.filter((item) => item && item.lawyerId);
                        const ids = entries.map((item: CaseFormLawyer) => item.lawyerId);
                        const unique = new Set(ids);
                        if (unique.size !== ids.length) {
                          return Promise.reject(new Error('负责律师不可重复'));
                        }
                        return Promise.resolve();
                      }
                    }
                  ]}
                >
                  {(fields, { add, remove }) => {
                    if (fields.length === 0) {
                      return (
                        <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({})} block>
                          添加负责律师
                        </Button>
                      );
                    }
                    return (
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        {fields.map((field) => {
                          const currentLawyerId = form.getFieldValue(['lawyers', field.name, 'lawyerId']);
                          const options = lawyerOptions.map((option) => ({
                            ...option,
                            disabled:
                              !!option.value && selectedLawyerIds.includes(option.value) && option.value !== currentLawyerId
                          }));
                          const fieldIndex = field.name as number;
                          return (
                            <Space
                              key={field.key}
                              align="center"
                              style={{ display: 'flex', width: '100%' }}
                            >
                              <Button
                                type="text"
                                icon={<PlusOutlined />}
                                onClick={() => add({}, fieldIndex + 1)}
                                aria-label="在此位置新增律师"
                              />
                              <Form.Item
                                name={[field.name, 'lawyerId']}
                                style={{ flex: 1, marginBottom: 0 }}
                                rules={[{ required: true, message: '请选择负责律师' }]}
                              >
                                <Select
                                  placeholder="请选择律师"
                                  showSearch
                                  optionFilterProp="label"
                                  options={options}
                                />
                              </Form.Item>
                              <Button
                                type="text"
                                danger
                                icon={<MinusCircleOutlined />}
                                onClick={() => remove(field.name)}
                                aria-label="移除律师"
                              />
                            </Space>
                          );
                        })}
                      </Space>
                    );
                  }}
                </Form.List>

                <Form.Item
                  label="主办律师"
                  name="primaryLawyerId"
                  rules={[
                    {
                      validator: (_, value) => {
                        if (selectedLawyerIds.length === 0) {
                          return Promise.resolve();
                        }
                        if (!value) {
                          return Promise.reject(new Error('请指定主办律师'));
                        }
                        return Promise.resolve();
                      }
                    }
                  ]}
                  style={{ marginTop: 16 }}
                >
                  <Radio.Group>
                    <Space direction="vertical">
                      {selectedLawyerIds.length === 0 ? (
                        <Text type="secondary">暂未选择负责律师，可在后续补充。</Text>
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
                      <Form.Item label="材料补充文件">
                        <Upload.Dragger
                          multiple
                          fileList={materialFiles}
                          beforeUpload={() => false}
                          onChange={handleMaterialsChange}
                          onPreview={handleMaterialPreview}
                          onDownload={handleMaterialDownload}
                          showUploadList={{ showDownloadIcon: true }}
                        >
                          <div style={{ fontSize: 32, color: '#1677ff' }}>
                            <InboxOutlined />
                          </div>
                          <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
                          <p className="ant-upload-hint">支持多文件上传，单个文件建议不超过10MB</p>
                        </Upload.Dragger>
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
              <Form.Item noStyle shouldUpdate={(prev, next) => prev.billingMethod !== next.billingMethod}>
                {({ getFieldValue }) => {
                  const method = getFieldValue('billingMethod');
                  const showFixed = method === 'fixed_fee' || method === 'hybrid';
                  const showHourly = method === 'hourly' || method === 'hybrid';
                  const showContingency = method === 'contingency' || method === 'hybrid';
                  return (
                    <Space size={16} style={{ width: '100%' }} wrap>
                      <Form.Item
                        label="收费方式"
                        name="billingMethod"
                        style={{ flex: 1, minWidth: 240 }}
                        rules={[{ required: true, message: '请选择收费方式' }]}
                      >
                        <Select
                          placeholder="请选择收费方式"
                          options={CASE_BILLING_METHOD_OPTIONS}
                          optionFilterProp="label"
                        />
                      </Form.Item>

                      {showFixed && (
                        <Form.Item
                          label="律师费总额（元）"
                          name="lawyerFeeTotal"
                          style={{ flex: 1, minWidth: 240 }}
                          rules={[
                            ({ getFieldValue: get }) => ({
                              validator(_, value) {
                                const currentMethod = get('billingMethod');
                                if (currentMethod === 'fixed_fee' && (value === undefined || value === null)) {
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
                      )}

                      {showHourly && (
                        <Form.Item
                          label="预计小时数"
                          name="estimatedHours"
                          style={{ flex: 1, minWidth: 240 }}
                          rules={[
                            ({ getFieldValue: get }) => ({
                              validator(_, value) {
                                const currentMethod = get('billingMethod');
                                if (currentMethod === 'hourly') {
                                  if (value === undefined || value === null || value === '') {
                                    return Promise.reject(new Error('请填写预计小时数'));
                                  }
                                }
                                if (value !== undefined && value !== null && value < 0) {
                                  return Promise.reject(new Error('预计小时数需大于等于0'));
                                }
                                return Promise.resolve();
                              }
                            })
                          ]}
                        >
                          <InputNumber style={{ width: '100%' }} min={0} precision={0} placeholder="请输入预计小时数" />
                        </Form.Item>
                      )}

                      {showContingency && (
                        <Form.Item
                          label="风险代理比例 (%)"
                          name="contingencyRate"
                          style={{ flex: 1, minWidth: 240 }}
                          rules={[
                            ({ getFieldValue: get }) => ({
                              validator(_, value) {
                                const currentMethod = get('billingMethod');
                                if (currentMethod === 'contingency') {
                                  if (value === undefined || value === null) {
                                    return Promise.reject(new Error('请填写风险代理比例'));
                                  }
                                }
                                if (value !== undefined && value !== null) {
                                  if (value <= 0 || value > 100) {
                                    return Promise.reject(new Error('风险代理比例需在0-100之间'));
                                  }
                                }
                                return Promise.resolve();
                              }
                            })
                          ]}
                        >
                          <InputNumber style={{ width: '100%' }} min={0} max={100} precision={2} placeholder="请输入比例，例如30" />
                        </Form.Item>
                      )}

                      <Form.Item label="其他费用预算（元）" name="otherFeeBudget" style={{ flex: 1, minWidth: 240 }}>
                        <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="请输入预算" />
                      </Form.Item>
                    </Space>
                  );
                }}
              </Form.Item>

              <Form.Item noStyle shouldUpdate={(prev, next) => prev.billingMethod !== next.billingMethod}>
                {({ getFieldValue }) => {
                  const method = getFieldValue('billingMethod');
                  const showHourlySection = method === 'hourly' || method === 'hybrid';
                  if (!showHourlySection) {
                    return null;
                  }
                  return (
                    <Form.List name="lawyers">
                      {(fields) => (
                        <Space direction="vertical" size={12} style={{ width: '100%' }}>
                          <Title level={5}>律师小时费率</Title>
                          <Text type="secondary">请为每位负责律师配置费率，作为计费依据。</Text>
                          {fields.length === 0 && <Text>请先在上一步添加负责律师。</Text>}
                          {fields.map((field) => {
                            const lawyerId = form.getFieldValue(['lawyers', field.name, 'lawyerId']);
                            if (!lawyerId) {
                              return null;
                            }
                            return (
                              <Space key={field.key} align="baseline" style={{ width: '100%', flexWrap: 'wrap', gap: 12 }}>
                                <Text style={{ flex: 1, minWidth: 200 }}>{lawyerOptionMap.get(lawyerId) ?? '未命名律师'}</Text>
                                <Form.Item
                                  label="小时费率"
                                  name={[field.name, 'hourlyRate']}
                                  style={{ marginBottom: 0 }}
                                  rules={[
                                    ({ getFieldValue: get }) => ({
                                      validator(_, value) {
                                        const currentMethod = get('billingMethod');
                                        if (currentMethod === 'hourly' || currentMethod === 'hybrid') {
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
                  );
                }}
              </Form.Item>

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
                <Input placeholder="请输入对方当事人名称或姓名" />
              </Form.Item>
              <Space size={16} style={{ width: '100%' }} wrap>
                <Form.Item
                  label="对方当事人类型"
                  name="opponentType"
                  style={{ flex: 1, minWidth: 240 }}
                  rules={[{ required: true, message: '请选择对方当事人类型' }]}
                >
                  <Select
                    placeholder="请选择对方当事人类型"
                    options={[
                      { label: '企业', value: 'company' },
                      { label: '自然人', value: 'individual' }
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  label={opponentIdLabel}
                  name="opponentIdNumber"
                  style={{ flex: 1, minWidth: 240 }}
                >
                  <Input placeholder={opponentIdPlaceholder} />
                </Form.Item>
              </Space>
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
