'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  Button,
  DatePicker,
  Descriptions,
  Form,
  Input,
  List,
  Modal,
  Select,
  Space,
  Typography,
  Upload
} from 'antd';
import { DownloadOutlined, EditOutlined, UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import dayjs from 'dayjs';

export interface CaseAttachment {
  uid: string;
  name: string;
  url?: string;
}

export interface CaseModalResult {
  caseNumber: string;
  type: string;
  clientName: string;
  party: string;
  lawyer: string;
  stage: string;
  urgency: string;
  acceptedAt: string;
  description: string;
  attachments: CaseAttachment[];
}

type CaseModalMode = 'create' | 'edit' | 'view';

interface CaseModalProps {
  open: boolean;
  mode: CaseModalMode;
  caseStages: string[];
  caseTypes: string[];
  urgencyOptions: string[];
  initialValues?: Partial<CaseModalResult>;
  onCancel: () => void;
  onSubmit?: (values: CaseModalResult) => void;
  onModeChange?: (mode: CaseModalMode) => void;
  confirmLoading?: boolean;
}

interface CaseFormValues {
  caseNumber: string;
  type: string;
  clientName: string;
  party: string;
  lawyer: string;
  stage: string;
  urgency: string;
  acceptedAt?: dayjs.Dayjs;
  description: string;
}

export default function CaseModal({
  open,
  mode,
  caseStages,
  caseTypes,
  urgencyOptions,
  initialValues,
  onCancel,
  onSubmit,
  onModeChange,
  confirmLoading
}: CaseModalProps) {
  const [form] = Form.useForm<CaseFormValues>();
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const title = useMemo(() => {
    if (mode === 'create') {
      return '新增案件';
    }
    if (mode === 'edit') {
      return `编辑案件${initialValues?.caseNumber ? ` - ${initialValues.caseNumber}` : ''}`;
    }
    return `案件详情${initialValues?.caseNumber ? ` - ${initialValues.caseNumber}` : ''}`;
  }, [initialValues?.caseNumber, mode]);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setFileList([]);
      return;
    }

    if (mode === 'view') {
      setFileList(
        (initialValues?.attachments ?? []).map((file) => ({
          uid: file.uid,
          name: file.name,
          status: 'done',
          url: file.url
        }))
      );
      return;
    }

    form.setFieldsValue({
      caseNumber: initialValues?.caseNumber ?? '',
      type: initialValues?.type ?? caseTypes[0] ?? '',
      clientName: initialValues?.clientName ?? '',
      party: initialValues?.party ?? '',
      lawyer: initialValues?.lawyer ?? '',
      stage: initialValues?.stage ?? caseStages[0] ?? '',
      urgency: initialValues?.urgency ?? urgencyOptions[0] ?? '',
      acceptedAt: initialValues?.acceptedAt ? dayjs(initialValues.acceptedAt) : undefined,
      description: initialValues?.description ?? ''
    });
    setFileList(
      (initialValues?.attachments ?? []).map((file) => ({
        uid: file.uid,
        name: file.name,
        status: 'done',
        url: file.url
      }))
    );
  }, [open, mode, initialValues, form, caseStages, caseTypes, urgencyOptions]);

  const handleSubmit = async () => {
    if (!onSubmit) {
      onCancel();
      return;
    }
    try {
      const values = await form.validateFields();
      const payload: CaseModalResult = {
        caseNumber: values.caseNumber,
        type: values.type,
        clientName: values.clientName,
        party: values.party,
        lawyer: values.lawyer,
        stage: values.stage,
        urgency: values.urgency,
        acceptedAt: values.acceptedAt ? values.acceptedAt.format('YYYY-MM-DD') : '',
        description: values.description,
        attachments: fileList.map((file) => ({
          uid: file.uid,
          name: file.name,
          url: file.url
        }))
      };
      onSubmit(payload);
    } catch (error) {
      // validation errors are handled by the form
    }
  };

  const footer = mode === 'view'
    ? [
        <Button key="close" onClick={onCancel}>
          关闭
        </Button>,
        <Button key="edit" type="primary" icon={<EditOutlined />} onClick={() => onModeChange?.('edit')}>
          编辑案件
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

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onCancel}
      footer={footer}
      maskClosable={false}
      destroyOnClose
      width={760}
    >
      {mode === 'view' ? (
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
          <Descriptions column={2} bordered labelStyle={{ width: 120 }}>
            <Descriptions.Item label="案号">{initialValues?.caseNumber ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="案件类型">{initialValues?.type ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="委托人">{initialValues?.clientName ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="当事人">{initialValues?.party ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="承办律师">{initialValues?.lawyer ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="案件进度">{initialValues?.stage ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="紧急程度">{initialValues?.urgency ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="受理时间">{initialValues?.acceptedAt ?? '-'}</Descriptions.Item>
          </Descriptions>
          <div>
            <Typography.Title level={5}>案件描述</Typography.Title>
            <Typography.Paragraph>
              {initialValues?.description?.trim() ? initialValues.description : '暂无描述'}
            </Typography.Paragraph>
          </div>
          <div>
            <Typography.Title level={5}>材料补充清单</Typography.Title>
            <List
              dataSource={initialValues?.attachments ?? []}
              locale={{ emptyText: '暂无附件' }}
              renderItem={(item) => (
                <List.Item key={item.uid}>
                  <Button
                    type="link"
                    icon={<DownloadOutlined />}
                    href={item.url ?? '#'}
                    download={item.name}
                  >
                    {item.name}
                  </Button>
                </List.Item>
              )}
            />
          </div>
        </Space>
      ) : (
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            label="案号"
            name="caseNumber"
            rules={[{ required: true, message: '请输入案号' }]}
          >
            <Input placeholder="请输入案号" />
          </Form.Item>
          <Form.Item
            label="案件类型"
            name="type"
            rules={[{ required: true, message: '请选择案件类型' }]}
          >
            <Select options={caseTypes.map((value) => ({ label: value, value }))} placeholder="请选择案件类型" />
          </Form.Item>
          <Form.Item
            label="委托人"
            name="clientName"
            rules={[{ required: true, message: '请输入委托人' }]}
          >
            <Input placeholder="请输入委托人" />
          </Form.Item>
          <Form.Item
            label="当事人"
            name="party"
            rules={[{ required: true, message: '请输入当事人' }]}
          >
            <Input placeholder="请输入当事人" />
          </Form.Item>
          <Form.Item
            label="承办律师"
            name="lawyer"
            rules={[{ required: true, message: '请输入承办律师' }]}
          >
            <Input placeholder="请输入承办律师" />
          </Form.Item>
          <Form.Item
            label="案件进度"
            name="stage"
            rules={[{ required: true, message: '请选择案件进度' }]}
          >
            <Select options={caseStages.map((value) => ({ label: value, value }))} placeholder="请选择案件进度" />
          </Form.Item>
          <Form.Item
            label="紧急程度"
            name="urgency"
            rules={[{ required: true, message: '请选择紧急程度' }]}
          >
            <Select options={urgencyOptions.map((value) => ({ label: value, value }))} placeholder="请选择紧急程度" />
          </Form.Item>
          <Form.Item
            label="受理时间"
            name="acceptedAt"
            rules={[{ required: true, message: '请选择受理时间' }]}
          >
            <DatePicker style={{ width: '100%' }} placeholder="请选择受理时间" />
          </Form.Item>
          <Form.Item
            label="案件描述"
            name="description"
            rules={[{ required: true, message: '请输入案件描述' }]}
          >
            <Input.TextArea rows={4} placeholder="请填写案件描述" />
          </Form.Item>
          <Form.Item label="材料补充清单">
            <Upload
              multiple
              fileList={fileList}
              beforeUpload={() => false}
              onChange={({ fileList: newList }) => setFileList(newList)}
              onRemove={(file) => {
                setFileList((prev) => prev.filter((item) => item.uid !== file.uid));
              }}
            >
              <Button icon={<UploadOutlined />}>上传文件</Button>
            </Upload>
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
