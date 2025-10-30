import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
  Button,
  Col,
  DatePicker,
  Divider,
  Descriptions,
  Form,
  Input,
  message,
  Modal,
  Radio,
  Row,
  Select,
  Tabs,
  type TabsProps,
  Timeline,
  Typography
} from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import type { CaseHearingRecord, CaseTimelineRecord, TrialStage } from '@/lib/cases-api';
import styles from './modal.module.scss';
import { useSessionStore } from '@/lib/stores/session-store';
import type { UserRole } from '@/lib/users-api';

const { TextArea } = Input;

const CASE_TYPES = [
  { label: '工伤', value: 'work_injury' },
  { label: '人损', value: 'personal_injury' },
  { label: '其他', value: 'other' }
] as const;

const CASE_LEVELS = [
  { label: 'A', value: 'A' },
  { label: 'B', value: 'B' },
  { label: 'C', value: 'C' }
] as const;

const ENTITY_TYPES = [
  { label: '个人', value: 'personal' },
  { label: '单位', value: 'organization' }
] as const;

const YES_NO_RADIO = [
  { label: '有', value: true },
  { label: '无', value: false }
] as const;

const YES_NO_COOPERATION = [
  { label: '是', value: true },
  { label: '否', value: false }
] as const;

const CASE_STATUS_OPTIONS = ['未结案', '已结案', '废单'] as const;
const CASE_CLOSED_OPTIONS = ['调解', '判决', '撤诉', '和解'] as const;
const CASE_VOID_OPTIONS = ['退单', '跑单'] as const;

const TRIAL_STAGE_LABEL_MAP: Record<TrialStage, string> = {
  first_instance: '一审',
  second_instance: '二审',
  retrial: '再审'
};

type CaseTypeValue = (typeof CASE_TYPES)[number]['value'];
type CaseLevelValue = (typeof CASE_LEVELS)[number]['value'];

type CaseStatusValue = (typeof CASE_STATUS_OPTIONS)[number];

type CaseParty = {
  name?: string;
  entityType?: 'personal' | 'organization';
  idNumber?: string;
  phone?: string;
  address?: string;
  isDishonest?: boolean;
};

type CollectionRecord = {
  amount?: number;
  date?: Dayjs;
};

const CASE_COLLECTION_ALLOWED_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  'super_admin',
  'admin',
  'administration'
]);

const CASE_TYPE_LABEL_MAP = CASE_TYPES.reduce<Record<CaseTypeValue, string>>((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {} as Record<CaseTypeValue, string>);

const CASE_LEVEL_LABEL_MAP = CASE_LEVELS.reduce<Record<CaseLevelValue, string>>((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {} as Record<CaseLevelValue, string>);

const ENTITY_TYPE_LABEL_MAP = ENTITY_TYPES.reduce<Record<'personal' | 'organization', string>>((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {} as Record<'personal' | 'organization', string>);

const formatOptionLabel = <T extends string>(map: Record<T, string>, value?: T | null): string => {
  if (value === undefined || value === null) {
    return '—';
  }
  return map[value] ?? '—';
};

const formatBoolean = (value?: boolean | null, trueLabel = '是', falseLabel = '否'): string => {
  if (value === undefined || value === null) {
    return '—';
  }
  return value ? trueLabel : falseLabel;
};

const formatText = (value?: string | null): string => {
  if (value === undefined || value === null) {
    return '—';
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '—';
};

const formatNumber = (value?: number | null): string => {
  if (value === undefined || value === null) {
    return '—';
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '—';
  }
  return numeric.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
};

const formatDate = (value?: Dayjs | string | null, formatPattern = 'YYYY-MM-DD'): string => {
  if (!value) {
    return '—';
  }
  if (dayjs.isDayjs(value)) {
    return value.format(formatPattern);
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format(formatPattern) : String(value);
};

const formatCurrency = (value?: number | null): string => {
  const numberText = formatNumber(value);
  return numberText === '—' ? numberText : `¥${numberText}`;
};

export interface WorkInjuryCaseFormValues {
  basicInfo?: {
    caseType?: CaseTypeValue;
    caseLevel?: CaseLevelValue;
    provinceCity?: string;
    targetAmount?: string;
    feeStandard?: string;
    agencyFeeEstimate?: string;
    dataSource?: string;
    hasContract?: boolean;
    hasSocialSecurity?: boolean;
    entryDate?: Dayjs;
    injuryLocation?: string;
    injurySeverity?: string;
    injuryCause?: string;
    workInjuryCertified?: boolean;
    monthlySalary?: string;
    appraisalLevel?: string;
    existingEvidence?: string;
    appraisalEstimate?: string;
    customerCooperative?: boolean;
    witnessCooperative?: boolean;
    remark?: string;
  };
  parties?: {
    claimants?: CaseParty[];
    respondents?: CaseParty[];
  };
  lawyerInfo?: {
    trialLawyerId?: string;
    trialLawyerName?: string;
    hearingTime?: Dayjs;
    hearingLocation?: string;
    tribunal?: string;
    judge?: string;
    caseNumber?: string;
    contactPhone?: string;
    trialStage?: TrialStage | null;
    hearingResult?: string;
    hearingRecords?: CaseHearingRecord[];
  };
  adminInfo?: {
    assignedLawyer?: string;
    assignedLawyerName?: string;
    assignedAssistant?: string;
    assignedAssistantName?: string;
    assignedSaleId?: string;
    assignedSaleName?: string;
    caseStatus?: CaseStatusValue;
    closedReason?: (typeof CASE_CLOSED_OPTIONS)[number];
    voidReason?: (typeof CASE_VOID_OPTIONS)[number];
    collections?: CollectionRecord[];
  };
  timeline?: CaseTimelineRecord[];
}

interface WorkInjuryCaseModalProps {
  open: boolean;
  mode?: 'create' | 'view' | 'update';
  initialValues?: WorkInjuryCaseFormValues;
  allowEdit?: boolean;
  onRequestEdit?: () => void;
  onRequestView?: () => void;
  onCancel: () => void;
  onSubmit?: (values: WorkInjuryCaseFormValues) => Promise<void> | void;
  confirmLoading?: boolean;
}
const buildInitialValues = (): WorkInjuryCaseFormValues => {

  return {
    basicInfo: {
      caseType: 'work_injury',
      caseLevel: 'A',
      // hasContract: true,
      // hasSocialSecurity: false,
      // workInjuryCertified: false,
      // customerCooperative: true,
      // witnessCooperative: true
    },
    parties: {
      claimants: [{}],
      respondents: []
    },
    lawyerInfo: {
      hearingRecords: []
    },
    adminInfo: {
      caseStatus: '未结案',
      collections: []
    },
    timeline: []
  };
};

export default function WorkInjuryCaseModal({
  open,
  mode = 'create',
  initialValues,
  allowEdit = false,
  onRequestEdit,
  onRequestView,
  onCancel,
  onSubmit,
  confirmLoading
}: WorkInjuryCaseModalProps) {
  const sessionUser = useSessionStore(state => state.user);
  const [form] = Form.useForm<WorkInjuryCaseFormValues>();
  const [activeViewTab, setActiveViewTab] = useState<'basic' | 'personnel' | 'hearing' | 'assignment' | 'followUp'>('basic');
  const isViewMode = mode === 'view';
  const isUpdateMode = mode === 'update';
  const isEditable = !isViewMode;
  const okText = isEditable ? (isUpdateMode ? '更新' : '保存') : undefined;

  const editableInitialValues = useMemo(() => {
    if (mode === 'create') {
      return buildInitialValues();
    }
    return initialValues ?? buildInitialValues();
  }, [mode, initialValues]);

  const displayValues = useMemo(() => initialValues ?? editableInitialValues, [initialValues, editableInitialValues]);

  useEffect(() => {
    if (open && isEditable) {
      form.setFieldsValue(editableInitialValues);
    } else if (!open) {
      form.resetFields();
    }
  }, [open, form, editableInitialValues, isEditable]);

  useEffect(() => {
    if (open && isViewMode) {
      setActiveViewTab('basic');
    }
  }, [open, isViewMode]);

  const handleOk = async () => {
    if (!isEditable) {
      onCancel();
      return;
    }
    try {
      const values = await form.validateFields();
      if (onSubmit) {
        await onSubmit(values);
      }
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) {
        message.error('表单验证失败，请检查是否所有必填项都填写完成！');
      }
    }
  };

  const handleCancel = () => {
    if (isEditable) {
      onRequestView?.();
    } else {
      form.resetFields();
      onCancel();
    }
  };

  const canShowEditButton = Boolean(
    allowEdit &&
      onRequestEdit &&
      sessionUser &&
      !['lawyer', 'assistant'].includes(sessionUser.role)
  );

  const canShowCollectionSection = Boolean(
    sessionUser &&
    CASE_COLLECTION_ALLOWED_ROLES.has(sessionUser.role)
  );

  const viewFooter = [
    <Button key="close" onClick={handleCancel}>
      关闭
    </Button>,
    ...(canShowEditButton
      ? [
          <Button key="edit" type="primary" onClick={onRequestEdit}>
            编辑案件
          </Button>
        ]
      : [])
  ];

  const renderPartyList = (field: 'claimants' | 'respondents', title: string) => (
    <Form.List
      name={['parties', field]}
      rules={[
        {
          validator: async (_, value) => {
            if (field === 'claimants' && (!value || value.length === 0)) {
              return Promise.reject(new Error(`请至少添加一位${title}`));
            }
            return Promise.resolve();
          }
        }
      ]}
    >
      {(fields, { add, remove }) => (
        <>
          {fields.map(({ key, name, ...restField }) => (
            <Row gutter={12} key={key} align="middle">
              <Col span={8}>
                <Form.Item
                  {...restField}
                  name={[name, 'entityType']}
                  label="类型"
                  rules={[{ required: true, message: '请选择类型' }]}
                >
                  <Select options={[...ENTITY_TYPES]} placeholder="请选择" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  noStyle
                  shouldUpdate={(prev, curr) =>
                    prev?.parties?.[field]?.[name]?.entityType !==
                    curr?.parties?.[field]?.[name]?.entityType
                  }
                >
                  {() => {
                    const entityType = form.getFieldValue([
                      'parties',
                      field,
                      name,
                      'entityType'
                    ]) as 'personal' | 'organization' | undefined;
                    const isOrganization = entityType === 'organization';
                    const nameLabel = isOrganization ? '名称' : '姓名';
                    return (
                      <Form.Item
                        {...restField}
                        name={[name, 'name']}
                        label={nameLabel}
                        rules={[{ required: true, message: `请输入${nameLabel}` }]}
                      >
                        <Input placeholder={`请输入${nameLabel}`} />
                      </Form.Item>
                    );
                  }}
                </Form.Item>
              </Col>
              
              <Col span={8}>
                <Form.Item
                  noStyle
                  shouldUpdate={(prev, curr) =>
                    prev?.parties?.[field]?.[name]?.entityType !==
                    curr?.parties?.[field]?.[name]?.entityType
                  }
                >
                  {() => {
                    const entityType = form.getFieldValue([
                      'parties',
                      field,
                      name,
                      'entityType'
                    ]) as 'personal' | 'organization' | undefined;
                    const isOrganization = entityType === 'organization';
                    const idLabel = isOrganization ? '统一信用代码' : '身份证';
                    const idRules = field === 'claimants'
                      ? [{ required: true, message: `请输入${idLabel}` }]
                      : [];
                    return (
                      <Form.Item
                        {...restField}
                        name={[name, 'idNumber']}
                        label={idLabel}
                        rules={idRules}
                      >
                        <Input placeholder={`请输入${idLabel}`} />
                      </Form.Item>
                    );
                  }}
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item 
                {...restField}
                 name={[name, 'phone']} 
                 label="电话"
                 rules={[{required: field === 'claimants', message: '请输入联系电话'}]}
                 >
                  <Input placeholder="请输入联系电话" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item 
                {...restField} 
                name={[name, 'address']} 
                label="地址"
                >
                  <Input placeholder="请输入地址" />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item
                  {...restField}
                  name={[name, 'isDishonest']}
                  label="是否失信"
                  rules={[{ required: true, message: '请选择是否失信' }]}
                  initialValue={false}
                >
                  <Radio.Group options={[...YES_NO_COOPERATION]} optionType="button" buttonStyle="solid" />
                </Form.Item>
              </Col>
              <Col span={4}>
                {fields.length > 1 ? (
                  <Button type="text" icon={<MinusCircleOutlined />} onClick={() => remove(name)}>
                    删除
                  </Button>
                ) : null}
              </Col>
            </Row>
          ))}
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            block
            onClick={() => add({ entityType: 'personal', isDishonest: false })}
          >
            添加{title}
          </Button>
        </>
      )}
    </Form.List>
  );

  const basicInfoPane = (
    <>
      <Row gutter={16}>
        <Col span={8}>
          <Form.Item
            label="案件类型"
            name={['basicInfo', 'caseType']}
            rules={[{ required: true, message: '请选择案件类型' }]}
          >
            <Select options={[...CASE_TYPES]} placeholder="请选择案件类型" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            label="案件级别"
            name={['basicInfo', 'caseLevel']}
            rules={[{ required: true, message: '请选择案件级别' }]}
          >
            <Select options={[...CASE_LEVELS]} placeholder="请选择案件级别" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            label="案件省份/城市"
            name={['basicInfo', 'provinceCity']}
            rules={[{ required: true, message: '请输入案件省份/城市' }]}
          >
            <Input placeholder="请输入省份/城市" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            label="标的额"
            name={['basicInfo', 'targetAmount']}
          >
            <Input style={{ width: '100%' }} placeholder="请输入标的额" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="收费标准" name={['basicInfo', 'feeStandard']}>
            <Input placeholder="请输入收费标准" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="代理费估值" name={['basicInfo', 'agencyFeeEstimate']}>
            <Input style={{ width: '100%' }} placeholder="请输入代理费估值" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            label="数据来源"
            name={['basicInfo', 'dataSource']}
            rules={[{ required: true, message: '请输入数据来源' }]}
          >
            <Input placeholder="请输入数据来源" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="入职时间" name={['basicInfo', 'entryDate']}>
            <DatePicker style={{ width: '100%' }} placeholder="请选择入职时间" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="受伤地点" name={['basicInfo', 'injuryLocation']}>
            <Input placeholder="请输入受伤地点" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="受伤程度" name={['basicInfo', 'injurySeverity']}>
            <Input placeholder="请输入受伤程度" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="受伤原因" name={['basicInfo', 'injuryCause']}>
            <Input placeholder="请输入受伤原因" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            label="工伤认定"
            name={['basicInfo', 'workInjuryCertified']}
            rules={[{ required: false, message: '请选择工伤认定情况' }]}
          >
            <Radio.Group options={[...YES_NO_RADIO]} optionType="button" buttonStyle="solid" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="劳动能力等级鉴定/人损等级" name={['basicInfo', 'appraisalLevel']}>
            <Input placeholder="请输入鉴定等级或填写无" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="劳动能力/人损等级预估" name={['basicInfo', 'appraisalEstimate']}>
            <Input placeholder="请输入预估等级" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="当时月薪" name={['basicInfo', 'monthlySalary']}>
            <Input style={{ width: '100%' }} placeholder="请输入当时月薪" />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item
            label="是否配合提交材料"
            name={['basicInfo', 'customerCooperative']}
            rules={[{ required: false, message: '请选择是否能配合提交材料' }]}
          >
            <Radio.Group options={[...YES_NO_COOPERATION]} optionType="button" buttonStyle="solid" />
          </Form.Item>
        </Col>
        <Col span={5}>
          <Form.Item
            label="有无合同"
            name={['basicInfo', 'hasContract']}
            rules={[{ required: false, message: '请选择是否有合同' }]}
          >
            <Radio.Group options={[...YES_NO_RADIO]} optionType="button" buttonStyle="solid" />
          </Form.Item>
        </Col>
        <Col span={5}>
          <Form.Item
            label="有无社保"
            name={['basicInfo', 'hasSocialSecurity']}
            rules={[{ required: false, message: '请选择是否有社保' }]}
          >
            <Radio.Group options={[...YES_NO_RADIO]} optionType="button" buttonStyle="solid" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            label="证人是否配合出庭"
            name={['basicInfo', 'witnessCooperative']}
            rules={[{ required: false, message: '请选择证人是否能配合出庭' }]}
          >
            <Radio.Group options={[...YES_NO_COOPERATION]} optionType="button" buttonStyle="solid" />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item label="已知证据" name={['basicInfo', 'existingEvidence']}>
            <TextArea rows={3} placeholder="请描述已掌握的证据" />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item label="备注" name={['basicInfo', 'remark']}>
            <TextArea rows={3} placeholder="可补充其他情况" />
          </Form.Item>
        </Col>
      </Row>
    </>
  );

  const personnelPane = (
    <>
      <Typography.Title level={5}>当事人</Typography.Title>
      {renderPartyList('claimants', '当事人')}
      <Divider dashed />
      <Typography.Title level={5}>对方当事人</Typography.Title>
      {renderPartyList('respondents', '对方当事人')}
    </>
  );

  const renderBasicInfoDisplay = (values: WorkInjuryCaseFormValues) => {
    const info = values.basicInfo ?? {};
    return (
      <Descriptions bordered size="small" column={2} className={styles.descriptions}>
        <Descriptions.Item label="案件类型">{formatOptionLabel(CASE_TYPE_LABEL_MAP, info.caseType ?? null)}</Descriptions.Item>
        <Descriptions.Item label="案件级别">{formatOptionLabel(CASE_LEVEL_LABEL_MAP, info.caseLevel ?? null)}</Descriptions.Item>
        <Descriptions.Item label="省份/城市">{formatText(info.provinceCity)}</Descriptions.Item>
        <Descriptions.Item label="标的额">{formatText(info.targetAmount)}</Descriptions.Item>
        <Descriptions.Item label="收费标准">{formatText(info.feeStandard)}</Descriptions.Item>
        <Descriptions.Item label="代理费估值">{formatText(info.agencyFeeEstimate)}</Descriptions.Item>
        <Descriptions.Item label="数据来源">{formatText(info.dataSource)}</Descriptions.Item>
        <Descriptions.Item label="入职时间">{formatDate(info.entryDate ?? null)}</Descriptions.Item>
        <Descriptions.Item label="受伤地点">{formatText(info.injuryLocation)}</Descriptions.Item>
        <Descriptions.Item label="受伤程度">{formatText(info.injurySeverity)}</Descriptions.Item>
        <Descriptions.Item label="受伤原因" span={3}>{formatText(info.injuryCause)}</Descriptions.Item>
        <Descriptions.Item label="工伤认定">{formatBoolean(info.workInjuryCertified ?? null, '有', '无')}</Descriptions.Item>
        <Descriptions.Item label="劳动能力等级鉴定/人损等级">{formatText(info.appraisalLevel)}</Descriptions.Item>
        <Descriptions.Item label="劳动能力/人损等级预估">{formatText(info.appraisalEstimate)}</Descriptions.Item>
        <Descriptions.Item label="当时月薪">{formatText(info.monthlySalary)}</Descriptions.Item>
        <Descriptions.Item label="是否配合提交材料">{formatBoolean(info.customerCooperative ?? null, '是', '否')}</Descriptions.Item>
        <Descriptions.Item label="有无合同">{formatBoolean(info.hasContract ?? null, '有', '无')}</Descriptions.Item>
        <Descriptions.Item label="有无社保">{formatBoolean(info.hasSocialSecurity ?? null, '有', '无')}</Descriptions.Item>
        <Descriptions.Item label="证人是否配合出庭">{formatBoolean(info.witnessCooperative ?? null, '是', '否')}</Descriptions.Item>
        <Descriptions.Item label="已知证据" span={3}>{formatText(info.existingEvidence)}</Descriptions.Item>
        <Descriptions.Item label="备注" span={3}>{formatText(info.remark)}</Descriptions.Item>
      </Descriptions>
    );
  };

  const renderPartyDisplay = (values: WorkInjuryCaseFormValues) => {
    const parties = values.parties ?? {};
    const renderPartyGroup = (list: CaseParty[] | undefined, title: string) => {
      if (!list || list.length === 0) {
        return (
          <Typography.Text type="secondary" className={styles.emptyHint}>
            暂无{title}
          </Typography.Text>
        );
      }
      return list.map((party, index) => (
        <Descriptions
          key={`${title}-${index}`}
          bordered
          size="small"
          column={2}
          className={styles.descriptions}
        >
          <Descriptions.Item label="类型">{formatOptionLabel(ENTITY_TYPE_LABEL_MAP, party.entityType ?? null)}</Descriptions.Item>
          <Descriptions.Item label={party.entityType === 'personal' ? '姓名' : '名称'}>{formatText(party.name)}</Descriptions.Item>
          <Descriptions.Item label={party.entityType === 'personal' ? '身份证' : '社会统一信用代码'}>{formatText(party.idNumber)}</Descriptions.Item>
          <Descriptions.Item label="电话">{formatText(party.phone)}</Descriptions.Item>
          <Descriptions.Item label="地址" span={3}>{formatText(party.address)}</Descriptions.Item>
          <Descriptions.Item label="是否失信">{formatBoolean(party.isDishonest ?? null, '是', '否')}</Descriptions.Item>
        </Descriptions>
      ));
    };

    return (
      <div className={styles.sectionList}>
        <Typography.Title level={5}>当事人</Typography.Title>
        {renderPartyGroup(parties.claimants, '当事人')}
        <Divider dashed />
        <Typography.Title level={5}>对方当事人</Typography.Title>
        {renderPartyGroup(parties.respondents, '对方当事人')}
      </div>
    );
  };

  const renderHearingDisplay = (values: WorkInjuryCaseFormValues) => {
    const lawyerInfo = values.lawyerInfo ?? {};
    const hearingRecords = lawyerInfo.hearingRecords ?? [];
    const shouldShowStageTitle = hearingRecords.length > 1;

    const renderHearingSection = (record: CaseHearingRecord, index: number) => {
      const stageLabel = record.trialStage ? TRIAL_STAGE_LABEL_MAP[record.trialStage] ?? record.trialStage : null;
    const sectionTitle = stageLabel ?? `庭审信息${index + 1}`;

    const items: ReactNode[] = [];

      if (!shouldShowStageTitle && stageLabel) {
        items.push(
          <Descriptions.Item key="trialStage" label="审理阶段">
            {stageLabel}
          </Descriptions.Item>
        );
      }

      if (record.hearingTime) {
        items.push(
          <Descriptions.Item key="hearingTime" label="庭审时间">
            {formatDate(record.hearingTime, 'YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
        );
      }

      if (record.hearingLocation && record.hearingLocation.trim()) {
        items.push(
          <Descriptions.Item key="hearingLocation" label="庭审地点">
            {formatText(record.hearingLocation)}
          </Descriptions.Item>
        );
      }

      if (record.tribunal && record.tribunal.trim()) {
        items.push(
          <Descriptions.Item key="tribunal" label="判庭">
            {formatText(record.tribunal)}
          </Descriptions.Item>
        );
      }

      if (record.judge && record.judge.trim()) {
        items.push(
          <Descriptions.Item key="judge" label="主审法官">
            {formatText(record.judge)}
          </Descriptions.Item>
        );
      }

      if (record.contactPhone && record.contactPhone.trim()) {
        items.push(
          <Descriptions.Item key="contactPhone" label="联系电话">
            {formatText(record.contactPhone)}
          </Descriptions.Item>
        );
      }

      if (record.caseNumber && record.caseNumber.trim()) {
        items.push(
          <Descriptions.Item key="caseNumber" label="案号" span={2}>
            {formatText(record.caseNumber)}
          </Descriptions.Item>
        );
      }

      if (record.hearingResult && record.hearingResult.trim()) {
        items.push(
          <Descriptions.Item key="hearingResult" label="庭审结果" span={2}>
            <Typography.Paragraph style={{ marginBottom: 0 }}>{record.hearingResult}</Typography.Paragraph>
          </Descriptions.Item>
        );
      }

      if (items.length === 0) {
        items.push(
          <Descriptions.Item key="empty" label="庭审信息" span={2}>
            <Typography.Text type="secondary">暂无详细信息</Typography.Text>
          </Descriptions.Item>
        );
      }

      return (
        <div key={record.id ?? `hearing-${index}`}>
          {shouldShowStageTitle ? (
            <Typography.Title level={5}>{sectionTitle}</Typography.Title>
          ) : null}
          <Descriptions bordered size="small" column={2} className={styles.descriptions}>
            {items}
          </Descriptions>
        </div>
      );
    };

    return (
      <div className={styles.sectionList}>
        {hearingRecords.length ? (
          hearingRecords.map(renderHearingSection)
        ) : (
          <Typography.Text type="secondary" className={styles.emptyHint}>
            暂无庭审信息
          </Typography.Text>
        )}
      </div>
    );
  };

  const renderAssignmentDisplay = (values: WorkInjuryCaseFormValues) => {
    const adminInfo = values.adminInfo ?? {};
    const collections = adminInfo.collections ?? [];
    const assignedLawyerDisplay =
      adminInfo.assignedLawyerName ?? adminInfo.assignedLawyer ?? values.lawyerInfo?.trialLawyerName ?? null;
    const assignedAssistantDisplay =
      adminInfo.assignedAssistantName ?? adminInfo.assignedAssistant ?? null;
    const salesDisplay = adminInfo.assignedSaleName ?? adminInfo.assignedSaleId ?? null;

    const collectionItems = collections.map((item, index) => ({
      key: `collection-${index}`,
      color: 'blue',
      children: (
        <div>
          <Typography.Text strong>{formatDate(item.date ?? null)}</Typography.Text>
          <div>回款金额：{formatCurrency(item.amount ?? null)}</div>
        </div>
      )
    }));

    return (
      <div className={styles.sectionList}>
        <Descriptions bordered size="small" column={2} className={styles.descriptions}>
          <Descriptions.Item label="承办律师">{formatText(assignedLawyerDisplay)}</Descriptions.Item>
          <Descriptions.Item label="律师助理">{formatText(assignedAssistantDisplay)}</Descriptions.Item>
          <Descriptions.Item label="销售人员">{formatText(salesDisplay)}</Descriptions.Item>
          <Descriptions.Item label="案件状态">{formatText(adminInfo.caseStatus)}</Descriptions.Item>
          <Descriptions.Item label="结案原因">{formatText(adminInfo.closedReason)}</Descriptions.Item>
          <Descriptions.Item label="退单原因">{formatText(adminInfo.voidReason)}</Descriptions.Item>
        </Descriptions>
        {
          canShowCollectionSection ? 
          <>
          <Divider dashed>回款记录</Divider>
        {collectionItems.length ? (
          <Timeline items={collectionItems} />
        ) : (
          <Typography.Text type="secondary" className={styles.emptyHint}>
            暂无回款记录
          </Typography.Text>
        )}
          </> : null
        }
      </div>
    );
  };

  const renderFollowUpDisplay = (values: WorkInjuryCaseFormValues) => {
    const timeline = values.timeline ?? [];

    if (timeline.length === 0) {
      return (
        <Typography.Text type="secondary" className={styles.emptyHint}>
          暂无跟进记录
        </Typography.Text>
      );
    }

    const sortedTimeline = [...timeline].sort((a, b) => {
      const aTime = a.occurredOn ? dayjs(a.occurredOn).valueOf() : 0;
      const bTime = b.occurredOn ? dayjs(b.occurredOn).valueOf() : 0;
      return bTime - aTime;
    });

    return (
      <div className={styles.sectionList}>
        {sortedTimeline.map((item, index) => {
          const entryKey = item.id ?? `follow-up-${index}`;
          const followerDisplay = item.followerName ?? item.followerId ?? null;
          return (
            <div key={entryKey}>
              <Descriptions bordered size="small" column={2} className={styles.descriptions}>
                <Descriptions.Item label="时间">
                  {formatDate(item.occurredOn ?? null)}
                </Descriptions.Item>
                <Descriptions.Item label="跟进人">
                  {formatText(followerDisplay)}
                </Descriptions.Item>
                <Descriptions.Item label="内容" span={2}>
                  <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                    {formatText(item.note)}
                  </Typography.Paragraph>
                </Descriptions.Item>
              </Descriptions>
              {index < sortedTimeline.length - 1 ? <Divider dashed /> : null}
            </div>
          );
        })}
      </div>
    );
  };

  type TabItem = NonNullable<TabsProps['items']>[number];
  const baseTabItems: Array<TabItem | null> = [
    {
      key: 'basic',
      label: '基本信息',
      children: renderBasicInfoDisplay(displayValues)
    },
    {
      key: 'personnel',
      label: '人员信息',
      children: renderPartyDisplay(displayValues)
    },
    sessionUser?.role !== 'sale'
      ? {
          key: 'hearing',
          label: '庭审信息',
          children: renderHearingDisplay(displayValues)
        }
      : null,
    {
      key: 'assignment',
      label: '分配信息',
      children: renderAssignmentDisplay(displayValues)
    },
    {
      key: 'followUp',
      label: '跟进信息',
      children: renderFollowUpDisplay(displayValues)
    }
  ];
  const viewTabItems: TabItem[] = baseTabItems.filter((item): item is TabItem => item !== null);

  const handleViewTabChange = (key: string) => {
    if (key === 'basic' || key === 'personnel' || key === 'hearing' || key === 'assignment' || key === 'followUp') {
      setActiveViewTab(key);
    }
  };

  const modalTitle = mode === 'create' ? '新增案件' : mode === 'update' ? '编辑案件' : '案件详情';

  return (
    <Modal
      open={open}
      title={modalTitle}
      width={1000}
      maskClosable={false}
      destroyOnClose
      onCancel={handleCancel}
      onOk={handleOk}
      confirmLoading={isEditable ? confirmLoading : false}
      okText={okText}
      cancelText={isEditable ? '取消' : undefined}
      footer={isEditable ? undefined : viewFooter}
      styles={{
        body: {
          height: 'calc(100vh - 300px)',
          padding: 0,
          overflowY: 'auto',
          overflowX: 'hidden'
        }
      }}
    >
      <Form form={form} layout="vertical" className={styles.form}>
        {isEditable ? (
          <div className={styles.modalContent}>
            <Divider>基本信息</Divider>
            {basicInfoPane}
            <Divider>人员信息</Divider>
            {personnelPane}
          </div>
        ) : (
          <div className={styles.viewContainer}>
            <Tabs
              activeKey={activeViewTab}
              onChange={handleViewTabChange}
              tabPosition="left"
              items={viewTabItems}
              className={styles.viewTabs}
            />
          </div>
        )}
      </Form>
    </Modal>
  );
}
