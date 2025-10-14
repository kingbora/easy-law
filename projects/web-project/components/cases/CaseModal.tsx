'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  Button,
  DatePicker,
  Descriptions,
  Input,
  List,
  Modal,
  Select,
  Space,
  Typography,
  Upload,
  message
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

interface CaseFormState {
  caseNumber: string;
  type: string;
  clientName: string;
  party: string;
  lawyer: string;
  stage: string;
  urgency: string;
  acceptedAt: dayjs.Dayjs | null;
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
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [formValues, setFormValues] = useState<CaseFormState>({
    caseNumber: '',
    type: caseTypes[0] ?? '',
    clientName: '',
    party: '',
    lawyer: '',
    stage: caseStages[0] ?? '',
    urgency: urgencyOptions[0] ?? '',
    acceptedAt: null,
    description: ''
  });

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
      setFileList([]);
      return;
    }

    const nextState: CaseFormState = {
      caseNumber: initialValues?.caseNumber ?? '',
      type: initialValues?.type ?? caseTypes[0] ?? '',
      clientName: initialValues?.clientName ?? '',
      party: initialValues?.party ?? '',
      lawyer: initialValues?.lawyer ?? '',
      stage: initialValues?.stage ?? caseStages[0] ?? '',
      urgency: initialValues?.urgency ?? urgencyOptions[0] ?? '',
      acceptedAt: initialValues?.acceptedAt ? dayjs(initialValues.acceptedAt) : null,
      description: initialValues?.description ?? ''
    };

    setFormValues(nextState);
    setFileList(
      (initialValues?.attachments ?? []).map((file) => ({
        uid: file.uid,
        name: file.name,
        status: 'done',
        url: file.url
      }))
    );
  }, [open, mode, initialValues, caseStages, caseTypes, urgencyOptions]);

  const handleSubmit = async () => {
    if (!onSubmit) {
      onCancel();
      return;
    }
    const requiredFields: Array<keyof CaseFormState> = [
      'caseNumber',
      'type',
      'clientName',
      'party',
      'lawyer',
      'stage',
      'urgency',
      'description'
    ];

    const missingField = requiredFields.find((field) => {
      const value = formValues[field];
      if (typeof value === 'string') {
        return !value.trim();
      }
      return !value;
    });

    if (!formValues.acceptedAt) {
      message.error('请选择受理时间');
      return;
    }

    if (missingField) {
      message.error('请填写完整的案件信息');
      return;
    }

    const payload: CaseModalResult = {
      caseNumber: formValues.caseNumber.trim(),
      type: formValues.type,
      clientName: formValues.clientName.trim(),
      party: formValues.party.trim(),
      lawyer: formValues.lawyer.trim(),
      stage: formValues.stage,
      urgency: formValues.urgency,
      acceptedAt: formValues.acceptedAt.format('YYYY-MM-DD'),
      description: formValues.description.trim(),
      attachments: fileList.map((file) => ({
        uid: file.uid,
        name: file.name,
        url: file.url
      }))
    };
    onSubmit(payload);
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
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <Descriptions column={2} bordered labelStyle={{ width: 120 }}>
          <Descriptions.Item label="案号">
            {mode === 'view' ? (
              initialValues?.caseNumber ?? '-'
            ) : (
              <Input
                value={formValues.caseNumber}
                onChange={(event) =>
                  setFormValues((prev) => ({
                    ...prev,
                    caseNumber: event.target.value
                  }))
                }
                placeholder="请输入案号"
              />
            )}
          </Descriptions.Item>
          <Descriptions.Item label="案件类型">
            {mode === 'view' ? (
              initialValues?.type ?? '-'
            ) : (
              <Select
                value={formValues.type}
                options={caseTypes.map((value) => ({ label: value, value }))}
                onChange={(value) =>
                  setFormValues((prev) => ({
                    ...prev,
                    type: value
                  }))
                }
                placeholder="请选择案件类型"
              />
            )}
          </Descriptions.Item>
          <Descriptions.Item label="委托人">
            {mode === 'view' ? (
              initialValues?.clientName ?? '-'
            ) : (
              <Input
                value={formValues.clientName}
                onChange={(event) =>
                  setFormValues((prev) => ({
                    ...prev,
                    clientName: event.target.value
                  }))
                }
                placeholder="请输入委托人"
              />
            )}
          </Descriptions.Item>
          <Descriptions.Item label="当事人">
            {mode === 'view' ? (
              initialValues?.party ?? '-'
            ) : (
              <Input
                value={formValues.party}
                onChange={(event) =>
                  setFormValues((prev) => ({
                    ...prev,
                    party: event.target.value
                  }))
                }
                placeholder="请输入当事人"
              />
            )}
          </Descriptions.Item>
          <Descriptions.Item label="承办律师">
            {mode === 'view' ? (
              initialValues?.lawyer ?? '-'
            ) : (
              <Input
                value={formValues.lawyer}
                onChange={(event) =>
                  setFormValues((prev) => ({
                    ...prev,
                    lawyer: event.target.value
                  }))
                }
                placeholder="请输入承办律师"
              />
            )}
          </Descriptions.Item>
          <Descriptions.Item label="案件进度">
            {mode === 'view' ? (
              initialValues?.stage ?? '-'
            ) : (
              <Select
                value={formValues.stage}
                options={caseStages.map((value) => ({ label: value, value }))}
                onChange={(value) =>
                  setFormValues((prev) => ({
                    ...prev,
                    stage: value
                  }))
                }
                placeholder="请选择案件进度"
              />
            )}
          </Descriptions.Item>
          <Descriptions.Item label="紧急程度">
            {mode === 'view' ? (
              initialValues?.urgency ?? '-'
            ) : (
              <Select
                value={formValues.urgency}
                options={urgencyOptions.map((value) => ({ label: value, value }))}
                onChange={(value) =>
                  setFormValues((prev) => ({
                    ...prev,
                    urgency: value
                  }))
                }
                placeholder="请选择紧急程度"
              />
            )}
          </Descriptions.Item>
          <Descriptions.Item label="受理时间">
            {mode === 'view' ? (
              initialValues?.acceptedAt ?? '-'
            ) : (
              <DatePicker
                style={{ width: '100%' }}
                value={formValues.acceptedAt}
                onChange={(value) =>
                  setFormValues((prev) => ({
                    ...prev,
                    acceptedAt: value ?? null
                  }))
                }
                placeholder="请选择受理时间"
              />
            )}
          </Descriptions.Item>
        </Descriptions>
        <div>
          <Typography.Title level={5}>案件描述</Typography.Title>
          {mode === 'view' ? (
            <Typography.Paragraph>
              {initialValues?.description?.trim() ? initialValues.description : '暂无描述'}
            </Typography.Paragraph>
          ) : (
            <Input.TextArea
              rows={4}
              value={formValues.description}
              onChange={(event) =>
                setFormValues((prev) => ({
                  ...prev,
                  description: event.target.value
                }))
              }
              placeholder="请填写案件描述"
            />
          )}
        </div>
        <div>
          <Typography.Title level={5}>材料补充清单</Typography.Title>
          {mode === 'view' ? (
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
          ) : (
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
          )}
        </div>
      </Space>
    </Modal>
  );
}
