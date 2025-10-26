import { useEffect, useMemo, useState } from 'react';

import {
  Button,
  Col,
  DatePicker,
  Divider,
  Descriptions,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Radio,
  Row,
  Select,
  Tabs,
  Timeline,
  Typography
} from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import type { TrialStage } from '@/lib/cases-api';
import styles from './modal.module.scss';

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
const TIMELINE_NODE_TYPES = [
  { label: '申请确认劳务关系', value: 'apply_labor_confirmation' },
  { label: '收到确认劳务关系的裁决', value: 'receive_labor_confirmation_award' },
  { label: '申请工伤认定', value: 'apply_work_injury_certification' },
  { label: '收到工伤认定书', value: 'receive_work_injury_decision' },
  { label: '申请劳动能力等级鉴定', value: 'apply_work_ability_appraisal' },
  { label: '收到劳动能力等级鉴定书', value: 'receive_work_ability_conclusion' },
  { label: '申请工伤保险待遇裁决', value: 'apply_work_injury_benefit_award' },
  { label: '起诉立案', value: 'lawsuit_filed' },
  { label: '立案审核通过', value: 'filing_approved' },
  { label: '裁决时间', value: 'judgment_time' }
] as const;

const TRIAL_STAGE_LABEL_MAP: Record<TrialStage, string> = {
  first_instance: '一审',
  second_instance: '二审',
  retrial: '再审'
};

const TIMELINE_NODE_LABEL_MAP = TIMELINE_NODE_TYPES.reduce<Record<TimelineNodeType, string>>((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {} as Record<TimelineNodeType, string>);

type CaseTypeValue = (typeof CASE_TYPES)[number]['value'];
type CaseLevelValue = (typeof CASE_LEVELS)[number]['value'];

type CaseStatusValue = (typeof CASE_STATUS_OPTIONS)[number];
type TimelineNodeType = (typeof TIMELINE_NODE_TYPES)[number]['value'];

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

type TimelineNode = {
  nodeType?: TimelineNodeType;
  date?: Dayjs;
};

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

const formatTrialStage = (value?: TrialStage | null): string => {
  if (!value) {
    return '—';
  }
  return TRIAL_STAGE_LABEL_MAP[value] ?? '—';
};

export interface WorkInjuryCaseFormValues {
  basicInfo?: {
    caseType?: CaseTypeValue;
    caseLevel?: CaseLevelValue;
    provinceCity?: string;
    targetAmount?: number;
    feeStandard?: string;
    agencyFeeEstimate?: number;
    dataSource?: string;
    hasContract?: boolean;
    hasSocialSecurity?: boolean;
    entryDate?: Dayjs;
    injuryLocation?: string;
    injurySeverity?: string;
    injuryCause?: string;
    workInjuryCertified?: boolean;
    monthlySalary?: number;
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
    hearingTime?: Dayjs;
    hearingLocation?: string;
    tribunal?: string;
    judge?: string;
    caseNumber?: string;
    contactPhone?: string;
    trialStage?: TrialStage | null;
    hearingResult?: string;
    timeline?: TimelineNode[];
  };
  adminInfo?: {
    assignedLawyer?: string;
    assignedAssistant?: string;
    assignedTrialLawyer?: string;
    caseStatus?: CaseStatusValue;
    closedReason?: (typeof CASE_CLOSED_OPTIONS)[number];
    voidReason?: (typeof CASE_VOID_OPTIONS)[number];
    collections?: CollectionRecord[];
  };
}

interface WorkInjuryCaseModalProps {
  open: boolean;
  mode?: 'create' | 'view' | 'update';
  initialValues?: WorkInjuryCaseFormValues;
  allowEdit?: boolean;
  onRequestEdit?: () => void;
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
      timeline: []
    },
    adminInfo: {
      caseStatus: '未结案',
      collections: []
    }
  };
};

export default function WorkInjuryCaseModal({
  open,
  mode = 'create',
  initialValues,
  allowEdit = false,
  onRequestEdit,
  onCancel,
  onSubmit,
  confirmLoading
}: WorkInjuryCaseModalProps) {
  const [form] = Form.useForm<WorkInjuryCaseFormValues>();
  const [activeViewTab, setActiveViewTab] = useState<'basic' | 'personnel' | 'hearing' | 'assignment'>('basic');
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
      form.resetFields();
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) {
        message.error('表单验证失败，请检查是否所有必填项都填写完成！');
      }
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  const viewFooter = [
    <Button key="close" onClick={handleCancel}>
      关闭
    </Button>,
    ...(allowEdit && onRequestEdit
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
                  {...restField}
                  name={[name, 'name']}
                  label="姓名/名称"
                  rules={[{ required: true, message: '请输入姓名或名称' }]}
                >
                  <Input placeholder="请输入姓名或名称" />
                </Form.Item>
              </Col>
              
              <Col span={8}>
                <Form.Item 
                {...restField} 
                name={[name, 'idNumber']} 
                label="证件/社会统一代码"
                rules={[{required: field === 'claimants', message: '请输入证件号码或统一社会信用代码'}]}
                >
                  <Input placeholder="请输入证件号码或统一社会信用代码" />
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
                rules={[{ required: field === 'claimants', message: '请输入地址'}]}
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
            <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入标的额" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="收费标准" name={['basicInfo', 'feeStandard']}>
            <Input placeholder="请输入收费标准" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="代理费估值" name={['basicInfo', 'agencyFeeEstimate']}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入代理费估值" />
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
            <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入当时月薪" />
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
      <Descriptions bordered size="small" column={3} className={styles.descriptions}>
        <Descriptions.Item label="案件类型">{formatOptionLabel(CASE_TYPE_LABEL_MAP, info.caseType ?? null)}</Descriptions.Item>
        <Descriptions.Item label="案件级别">{formatOptionLabel(CASE_LEVEL_LABEL_MAP, info.caseLevel ?? null)}</Descriptions.Item>
        <Descriptions.Item label="省份/城市">{formatText(info.provinceCity)}</Descriptions.Item>
        <Descriptions.Item label="标的额">{formatCurrency(info.targetAmount)}</Descriptions.Item>
        <Descriptions.Item label="收费标准">{formatText(info.feeStandard)}</Descriptions.Item>
        <Descriptions.Item label="代理费估值">{formatCurrency(info.agencyFeeEstimate)}</Descriptions.Item>
        <Descriptions.Item label="数据来源">{formatText(info.dataSource)}</Descriptions.Item>
        <Descriptions.Item label="入职时间">{formatDate(info.entryDate ?? null)}</Descriptions.Item>
        <Descriptions.Item label="受伤地点">{formatText(info.injuryLocation)}</Descriptions.Item>
        <Descriptions.Item label="受伤程度">{formatText(info.injurySeverity)}</Descriptions.Item>
        <Descriptions.Item label="受伤原因">{formatText(info.injuryCause)}</Descriptions.Item>
        <Descriptions.Item label="工伤认定">{formatBoolean(info.workInjuryCertified ?? null, '有', '无')}</Descriptions.Item>
        <Descriptions.Item label="劳动能力等级鉴定/人损等级">{formatText(info.appraisalLevel)}</Descriptions.Item>
        <Descriptions.Item label="劳动能力/人损等级预估">{formatText(info.appraisalEstimate)}</Descriptions.Item>
        <Descriptions.Item label="当时月薪">{formatCurrency(info.monthlySalary)}</Descriptions.Item>
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
          column={3}
          title={`${title}${list.length > 1 ? index + 1 : ''}`}
          className={styles.descriptions}
        >
          <Descriptions.Item label="类型">{formatOptionLabel(ENTITY_TYPE_LABEL_MAP, party.entityType ?? null)}</Descriptions.Item>
          <Descriptions.Item label="姓名/名称" span={2}>{formatText(party.name)}</Descriptions.Item>
          <Descriptions.Item label="证件/统一社会信用代码" span={2}>{formatText(party.idNumber)}</Descriptions.Item>
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
    const timelineNodes = lawyerInfo.timeline ?? [];

    const timelineItems = timelineNodes.map((node, index) => ({
      key: `${node.nodeType ?? 'node'}-${index}`,
      children: (
        <div>
          <Typography.Text strong>
            {node.nodeType ? TIMELINE_NODE_LABEL_MAP[node.nodeType as TimelineNodeType] ?? node.nodeType : '节点'}
          </Typography.Text>
          <div>{formatDate(node.date ?? null)}</div>
        </div>
      )
    }));

    return (
      <div className={styles.sectionList}>
        <Descriptions bordered size="small" column={2} className={styles.descriptions}>
          <Descriptions.Item label="庭审时间" span={2}>
            {formatDate(lawyerInfo.hearingTime ?? null, 'YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label="庭审地点">{formatText(lawyerInfo.hearingLocation)}</Descriptions.Item>
          <Descriptions.Item label="庭审庭次">{formatText(lawyerInfo.tribunal)}</Descriptions.Item>
          <Descriptions.Item label="主审法官">{formatText(lawyerInfo.judge)}</Descriptions.Item>
          <Descriptions.Item label="案号">{formatText(lawyerInfo.caseNumber)}</Descriptions.Item>
          <Descriptions.Item label="联系电话">{formatText(lawyerInfo.contactPhone)}</Descriptions.Item>
          <Descriptions.Item label="审理阶段">{formatTrialStage(lawyerInfo.trialStage ?? null)}</Descriptions.Item>
          <Descriptions.Item label="庭审结果" span={2}>{formatText(lawyerInfo.hearingResult)}</Descriptions.Item>
        </Descriptions>
        <Divider dashed>办案进度</Divider>
        {timelineItems.length ? (
          <Timeline items={timelineItems} />
        ) : (
          <Typography.Text type="secondary" className={styles.emptyHint}>
            暂无办案进度
          </Typography.Text>
        )}
      </div>
    );
  };

  const renderAssignmentDisplay = (values: WorkInjuryCaseFormValues) => {
    const adminInfo = values.adminInfo ?? {};
    const collections = adminInfo.collections ?? [];

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
          <Descriptions.Item label="案件状态">{formatText(adminInfo.caseStatus)}</Descriptions.Item>
          <Descriptions.Item label="结案原因">{formatText(adminInfo.closedReason)}</Descriptions.Item>
          <Descriptions.Item label="退单原因">{formatText(adminInfo.voidReason)}</Descriptions.Item>
          <Descriptions.Item label="代理律师">{formatText(adminInfo.assignedLawyer)}</Descriptions.Item>
          <Descriptions.Item label="执行律师">{formatText(adminInfo.assignedTrialLawyer)}</Descriptions.Item>
          <Descriptions.Item label="律师助理">{formatText(adminInfo.assignedAssistant)}</Descriptions.Item>
        </Descriptions>
        <Divider dashed>回款记录</Divider>
        {collectionItems.length ? (
          <Timeline items={collectionItems} />
        ) : (
          <Typography.Text type="secondary" className={styles.emptyHint}>
            暂无回款记录
          </Typography.Text>
        )}
      </div>
    );
  };

  const viewTabItems = useMemo(
    () => [
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
      {
        key: 'hearing',
        label: '庭审信息',
        children: renderHearingDisplay(displayValues)
      },
      {
        key: 'assignment',
        label: '分配信息',
        children: renderAssignmentDisplay(displayValues)
      }
    ],
    [displayValues]
  );

  const handleViewTabChange = (key: string) => {
    if (key === 'basic' || key === 'personnel' || key === 'hearing' || key === 'assignment') {
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
