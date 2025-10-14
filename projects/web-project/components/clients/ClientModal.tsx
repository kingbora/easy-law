'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Button,
  Col,
  Descriptions,
  Divider,
  Form,
  Input,
  List,
  Modal,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  message
} from 'antd';
import { DownOutlined, EditOutlined, MinusCircleOutlined, PlusOutlined, UpOutlined } from '@ant-design/icons';

import type {
  ClientDetail,
  ClientGender,
  ClientPayload,
  ClientSource,
  ClientStatus,
  ClientType
} from '@/lib/clients-api';
import {
  CLIENT_GENDER_OPTIONS,
  CLIENT_GENDER_LABELS,
  CLIENT_SOURCE_LABELS,
  CLIENT_SOURCE_OPTIONS,
  CLIENT_STATUS_COLOR_MAP,
  CLIENT_STATUS_LABELS,
  CLIENT_STATUS_OPTIONS,
  CLIENT_TYPE_LABELS,
  CLIENT_TYPE_OPTIONS
} from '@/lib/clients-data';

const { Paragraph, Title } = Typography;

type ClientModalMode = 'create' | 'edit' | 'view';

interface LawyerOption {
  label: string;
  value: string;
}

interface ClientModalProps {
  open: boolean;
  mode: ClientModalMode;
  initialValues?: ClientDetail | null;
  lawyerOptions: LawyerOption[];
  lawyerLoading?: boolean;
  onCancel: () => void;
  onSubmit?: (payload: ClientPayload) => void;
  onModeChange?: (mode: Exclude<ClientModalMode, 'create'>) => void;
  onSearchLawyers?: (keyword: string) => void;
  confirmLoading?: boolean;
}

interface ClientFormValues {
  name: string;
  type: ClientType;
  status: ClientStatus;
  phone: string;
  email?: string;
  address?: string;
  source?: ClientSource;
  sourceRemark?: string;
  responsibleLawyerId: string;
  tags: string[];
  remark?: string;
  individualProfile?: {
    idCardNumber: string;
    gender?: ClientGender | null;
    occupation?: string;
  };
  companyProfile?: {
    unifiedCreditCode: string;
    companyType?: string;
    industry?: string;
    registeredCapital?: string;
    legalRepresentative?: string;
  };
  attachments: Array<{
    id?: string;
    filename: string;
    fileType?: string;
    fileUrl: string;
    description?: string;
  }>;
}

const DEFAULT_FORM_VALUES: ClientFormValues = {
  name: '',
  type: 'individual',
  status: 'potential',
  phone: '',
  email: '',
  address: '',
  source: undefined,
  sourceRemark: '',
  responsibleLawyerId: '',
  tags: [],
  remark: '',
  individualProfile: {
    idCardNumber: '',
    gender: undefined,
    occupation: ''
  },
  companyProfile: {
    unifiedCreditCode: '',
    companyType: '',
    industry: '',
    registeredCapital: '',
    legalRepresentative: ''
  },
  attachments: []
};

const normalizeDetailToForm = (detail: ClientDetail): ClientFormValues => {
  const base: ClientFormValues = {
    name: detail.name,
    type: detail.type,
    status: detail.status,
    phone: detail.phone,
    email: detail.email ?? '',
    address: detail.address ?? '',
    source: detail.source ?? undefined,
    sourceRemark: detail.sourceRemark ?? '',
    responsibleLawyerId: detail.responsibleLawyer?.id ?? '',
    tags: detail.tags ?? [],
    remark: detail.remark ?? '',
    individualProfile:
      detail.type === 'individual' && detail.individualProfile
        ? {
            idCardNumber: detail.individualProfile.idCardNumber,
            gender: detail.individualProfile.gender,
            occupation: detail.individualProfile.occupation ?? ''
          }
        : {
            idCardNumber: '',
            gender: undefined,
            occupation: ''
          },
    companyProfile:
      detail.type === 'company' && detail.companyProfile
        ? {
            unifiedCreditCode: detail.companyProfile.unifiedCreditCode,
            companyType: detail.companyProfile.companyType ?? '',
            industry: detail.companyProfile.industry ?? '',
            registeredCapital: detail.companyProfile.registeredCapital ?? '',
            legalRepresentative: detail.companyProfile.legalRepresentative ?? ''
          }
        : {
            unifiedCreditCode: '',
            companyType: '',
            industry: '',
            registeredCapital: '',
            legalRepresentative: ''
          },
    attachments: detail.attachments.map((attachment) => ({
      id: attachment.id,
      filename: attachment.filename,
      fileType: attachment.fileType ?? '',
      fileUrl: attachment.fileUrl,
      description: attachment.description ?? ''
    }))
  };

  return base;
};

const buildPayload = (values: ClientFormValues): ClientPayload => {
  const base: ClientPayload = {
    name: values.name.trim(),
    type: values.type,
    phone: values.phone.trim(),
    email: values.email && values.email.trim().length > 0 ? values.email.trim() : undefined,
    address: values.address && values.address.trim().length > 0 ? values.address.trim() : undefined,
    source: values.source ?? null,
    sourceRemark:
      values.sourceRemark && values.sourceRemark.trim().length > 0
        ? values.sourceRemark.trim()
        : undefined,
    status: values.status,
    responsibleLawyerId: values.responsibleLawyerId,
    tags: values.tags.length > 0 ? values.tags : undefined,
    remark: values.remark ? values.remark.trim() || null : null
  };

  if (values.type === 'individual') {
    const profile = values.individualProfile;
    base.individualProfile = {
      idCardNumber: profile?.idCardNumber.trim() ?? '',
      gender: profile?.gender ?? null,
      occupation: profile?.occupation && profile.occupation.trim().length > 0 ? profile.occupation.trim() : undefined
    };
  } else if (values.type === 'company') {
    const profile = values.companyProfile;
    base.companyProfile = {
      unifiedCreditCode: profile?.unifiedCreditCode.trim() ?? '',
      companyType:
        profile?.companyType && profile.companyType.trim().length > 0 ? profile.companyType.trim() : undefined,
      industry: profile?.industry && profile.industry.trim().length > 0 ? profile.industry.trim() : undefined,
      registeredCapital:
        profile?.registeredCapital && profile.registeredCapital.trim().length > 0
          ? profile.registeredCapital.trim()
          : undefined,
      legalRepresentative:
        profile?.legalRepresentative && profile.legalRepresentative.trim().length > 0
          ? profile.legalRepresentative.trim()
          : undefined
    };
  }

  const attachments = values.attachments
    .map((item) => ({
      filename: item.filename.trim(),
      fileUrl: item.fileUrl.trim(),
      fileType: item.fileType ? item.fileType.trim() || null : null,
      description: item.description && item.description.trim().length > 0 ? item.description.trim() : undefined
    }))
    .filter((item) => item.filename && item.fileUrl);

  if (attachments.length > 0) {
    base.attachments = attachments;
  }

  return base;
};

export default function ClientModal({
  open,
  mode,
  initialValues,
  lawyerOptions,
  lawyerLoading,
  onCancel,
  onSubmit,
  onModeChange,
  onSearchLawyers,
  confirmLoading
}: ClientModalProps) {
  const [form] = Form.useForm<ClientFormValues>();
  const [showOptional, setShowOptional] = useState(false);

  const currentType = Form.useWatch('type', form);

  const handleToggleOptional = useCallback(() => {
    setShowOptional((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setShowOptional(false);
      return;
    }

    if (initialValues) {
      form.setFieldsValue(normalizeDetailToForm(initialValues));
      const hasOptionalData = Boolean(
        initialValues.email ||
          initialValues.address ||
          initialValues.source ||
          initialValues.sourceRemark ||
          (initialValues.tags && initialValues.tags.length > 0) ||
          initialValues.remark ||
          (initialValues.attachments && initialValues.attachments.length > 0)
      );
      setShowOptional(hasOptionalData);
    } else {
      form.setFieldsValue(DEFAULT_FORM_VALUES);
      setShowOptional(false);
    }
  }, [form, initialValues, open]);

  const handleSubmit = async () => {
    if (!onSubmit) {
      onCancel();
      return;
    }

    try {
      const values = await form.validateFields();
      if (!values.responsibleLawyerId) {
        message.error('请选择负责律师');
        return;
      }
      if (values.type === 'individual' && !values.individualProfile?.idCardNumber?.trim()) {
        message.error('请填写自然人客户的身份证号');
        return;
      }
      if (values.type === 'company' && !values.companyProfile?.unifiedCreditCode?.trim()) {
        message.error('请填写企业客户的统一社会信用代码');
        return;
      }
      const payload = buildPayload(values);
      onSubmit(payload);
    } catch (error) {
      // validation errors are handled by antd form
    }
  };

  const title = useMemo(() => {
    if (mode === 'create') {
      return '新增客户';
    }
    if (mode === 'edit') {
      return `编辑客户${initialValues?.name ? ` - ${initialValues.name}` : ''}`;
    }
    return `客户详情${initialValues?.name ? ` - ${initialValues.name}` : ''}`;
  }, [initialValues?.name, mode]);

  const footer = mode === 'view'
    ? [
        <Button key="close" onClick={onCancel}>
          关闭
        </Button>,
        <Button key="edit" type="primary" icon={<EditOutlined />} onClick={() => onModeChange?.('edit')}>
          编辑客户
        </Button>
      ]
    : [
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="submit" type="primary" loading={confirmLoading} onClick={handleSubmit}>
          {mode === 'create' ? '创建' : '保存'}
        </Button>
      ];

  if (mode === 'view' && initialValues) {
    const responsibleLawyerName = initialValues.responsibleLawyer?.name ?? '未指定';
    return (
      <Modal
        open={open}
        title={title}
        onCancel={onCancel}
        footer={footer}
        width={720}
        destroyOnClose
      >
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
          <Descriptions column={2} bordered>
            <Descriptions.Item label="客户名称">{initialValues.name}</Descriptions.Item>
            <Descriptions.Item label="客户类型">{CLIENT_TYPE_LABELS[initialValues.type]}</Descriptions.Item>
            <Descriptions.Item label="客户状态">{
              <Tag color={CLIENT_STATUS_COLOR_MAP[initialValues.status]}>
                {CLIENT_STATUS_LABELS[initialValues.status]}
              </Tag>
            }</Descriptions.Item>
            <Descriptions.Item label="联系电话">{initialValues.phone}</Descriptions.Item>
            <Descriptions.Item label="联系邮箱">{initialValues.email ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="联系地址" span={2}>
              {initialValues.address ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="客户来源">
              {initialValues.source ? CLIENT_SOURCE_LABELS[initialValues.source] : '未填写'}
            </Descriptions.Item>
            <Descriptions.Item label="来源说明">{initialValues.sourceRemark ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="负责律师">{responsibleLawyerName}</Descriptions.Item>
            <Descriptions.Item label="标签">
              {initialValues.tags.length > 0 ? initialValues.tags.map((tag) => <Tag key={tag}>{tag}</Tag>) : '无'}
            </Descriptions.Item>
          </Descriptions>

          {initialValues.type === 'individual' && initialValues.individualProfile ? (
            <Descriptions title="自然人客户信息" column={2} bordered>
              <Descriptions.Item label="身份证号" span={2}>
                {initialValues.individualProfile.idCardNumber}
              </Descriptions.Item>
              <Descriptions.Item label="性别">
                {initialValues.individualProfile.gender
                  ? CLIENT_GENDER_LABELS[initialValues.individualProfile.gender]
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="职业">{initialValues.individualProfile.occupation ?? '-'}</Descriptions.Item>
            </Descriptions>
          ) : null}

          {initialValues.type === 'company' && initialValues.companyProfile ? (
            <Descriptions title="企业客户信息" column={2} bordered>
              <Descriptions.Item label="统一社会信用代码" span={2}>
                {initialValues.companyProfile.unifiedCreditCode}
              </Descriptions.Item>
              <Descriptions.Item label="企业类型">{initialValues.companyProfile.companyType ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="所属行业">{initialValues.companyProfile.industry ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="注册资本">{initialValues.companyProfile.registeredCapital ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="法定代表人">{initialValues.companyProfile.legalRepresentative ?? '-'}</Descriptions.Item>
            </Descriptions>
          ) : null}

          <div>
            <Title level={5}>备注信息</Title>
            <Paragraph type="secondary">{initialValues.remark ?? '暂无备注'}</Paragraph>
          </div>

          <div>
            <Title level={5}>附件列表</Title>
            {initialValues.attachments.length > 0 ? (
              <List
                bordered
                dataSource={initialValues.attachments}
                renderItem={(item) => (
                  <List.Item key={item.id}>
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <Space split={<Divider type="vertical" />} wrap>
                        <span>{item.filename}</span>
                        {item.fileType ? <Tag>{item.fileType}</Tag> : null}
                        <a href={item.fileUrl} target="_blank" rel="noopener noreferrer">
                          查看附件
                        </a>
                      </Space>
                      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                        {item.description ?? '无描述'}
                      </Paragraph>
                    </Space>
                  </List.Item>
                )}
              />
            ) : (
              <Paragraph type="secondary">暂无附件</Paragraph>
            )}
          </div>
        </Space>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onCancel}
      footer={footer}
      width={860}
      destroyOnClose
      maskClosable={false}
    >
      <Form<ClientFormValues>
        layout="vertical"
        form={form}
        initialValues={DEFAULT_FORM_VALUES}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="客户名称"
              name="name"
              rules={[{ required: true, message: '请输入客户名称' }]}
            >
              <Input placeholder="请输入客户名称" maxLength={60} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="客户类型"
              name="type"
              rules={[{ required: true, message: '请选择客户类型' }]}
            >
              <Select options={CLIENT_TYPE_OPTIONS} placeholder="请选择客户类型" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="客户状态"
              name="status"
              rules={[{ required: true, message: '请选择客户状态' }]}
            >
              <Select options={CLIENT_STATUS_OPTIONS} placeholder="请选择客户状态" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="联系电话"
              name="phone"
              rules={[{ required: true, message: '请输入联系电话' }]}
            >
              <Input placeholder="请输入联系电话" maxLength={20} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="负责律师"
              name="responsibleLawyerId"
              rules={[{ required: true, message: '请选择负责律师' }]}
            >
              <Select
                showSearch
                placeholder="请输入律师姓名检索"
                filterOption={false}
                options={lawyerOptions}
                onSearch={onSearchLawyers}
                loading={lawyerLoading}
              />
            </Form.Item>
          </Col>
        </Row>

        {currentType === 'individual' ? (
          <>
            <Divider orientation="left">自然人客户信息</Divider>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="身份证号"
                  name={['individualProfile', 'idCardNumber']}
                  rules={[{ required: true, message: '请输入身份证号' }]}
                >
                  <Input placeholder="请输入身份证号" maxLength={30} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="性别" name={['individualProfile', 'gender']}>
                  <Select
                    allowClear
                    options={CLIENT_GENDER_OPTIONS}
                    placeholder="请选择性别"
                  />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="职业信息" name={['individualProfile', 'occupation']}>
                  <Input placeholder="请输入职业信息" maxLength={60} />
                </Form.Item>
              </Col>
            </Row>
          </>
        ) : null}

        {currentType === 'company' ? (
          <>
            <Divider orientation="left">企业客户信息</Divider>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="统一社会信用代码"
                  name={['companyProfile', 'unifiedCreditCode']}
                  rules={[{ required: true, message: '请输入统一社会信用代码' }]}
                >
                  <Input placeholder="请输入统一社会信用代码" maxLength={30} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="企业类型" name={['companyProfile', 'companyType']}>
                  <Input placeholder="请输入企业类型" maxLength={60} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="所属行业" name={['companyProfile', 'industry']}>
                  <Input placeholder="请输入所属行业" maxLength={60} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="注册资本" name={['companyProfile', 'registeredCapital']}>
                  <Input placeholder="请输入注册资本" maxLength={30} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="法定代表人" name={['companyProfile', 'legalRepresentative']}>
                  <Input placeholder="请输入法定代表人" maxLength={60} />
                </Form.Item>
              </Col>
            </Row>
          </>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <Button
            type="link"
            icon={showOptional ? <UpOutlined /> : <DownOutlined />}
            onClick={handleToggleOptional}
          >
            {showOptional ? '收起可选信息' : '展开更多可选信息'}
          </Button>
        </div>

        {showOptional ? (
          <>
            <Divider orientation="left">可选信息</Divider>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="联系邮箱" name="email">
                  <Input placeholder="请输入联系邮箱" maxLength={100} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="联系地址" name="address">
                  <Input placeholder="请输入联系地址" maxLength={120} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="客户来源" name="source">
                  <Select
                    allowClear
                    options={CLIENT_SOURCE_OPTIONS}
                    placeholder="请选择客户来源"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="来源说明" name="sourceRemark">
                  <Input placeholder="来源补充说明" maxLength={120} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="客户标签" name="tags">
              <Select
                mode="tags"
                placeholder="输入标签后回车添加"
                tokenSeparators={[',', ' ']}
              />
            </Form.Item>

            <Form.Item label="备注信息" name="remark">
              <Input.TextArea rows={3} placeholder="记录客户备注信息" maxLength={500} showCount />
            </Form.Item>

            <Divider orientation="left">附件信息</Divider>
            <Form.List name="attachments">
              {(fields, { add, remove }) => (
                <Space direction="vertical" style={{ width: '100%' }} size={16}>
                  {fields.map((field) => (
                    <Space key={field.key} direction="vertical" style={{ width: '100%' }}>
                      <Row gutter={16} align="middle">
                        <Col span={10}>
                          <Form.Item
                            label="文件名称"
                            name={[field.name, 'filename']}
                          >
                            <Input placeholder="请输入文件名" maxLength={80} />
                          </Form.Item>
                        </Col>
                        <Col span={10}>
                          <Form.Item
                            label="文件链接"
                            name={[field.name, 'fileUrl']}
                          >
                            <Input placeholder="请输入访问链接" />
                          </Form.Item>
                        </Col>
                        <Col span={4}>
                          <Button
                            icon={<MinusCircleOutlined />}
                            danger
                            type="text"
                            onClick={() => remove(field.name)}
                          >
                            移除
                          </Button>
                        </Col>
                      </Row>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item
                            label="文件类型"
                            name={[field.name, 'fileType']}
                          >
                            <Input placeholder="如合同、证据等" maxLength={40} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label="描述信息"
                            name={[field.name, 'description']}
                          >
                            <Input placeholder="请输入描述" maxLength={120} />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Divider />
                    </Space>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()} block>
                    添加附件
                  </Button>
                </Space>
              )}
            </Form.List>
          </>
        ) : null}
      </Form>
    </Modal>
  );
}
