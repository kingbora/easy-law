'use client';

import { useEffect, useMemo, useState } from 'react';

import { Avatar, Button, Form, Input, Modal, Space, Upload, message } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { UploadOutlined, UserOutlined } from '@ant-design/icons';

interface ProfileModalProps {
  open: boolean;
  initialValues?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  onCancel: () => void;
  onSubmit: (values: { name: string; image?: string | null }) => Promise<void> | void;
  confirmLoading?: boolean;
}

interface ProfileFormValues {
  name: string;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) ?? '');
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });

export default function ProfileModal({ open, initialValues, onCancel, onSubmit, confirmLoading }: ProfileModalProps) {
  const [form] = Form.useForm<ProfileFormValues>();
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const emailDisplay = useMemo(() => initialValues?.email ?? '', [initialValues?.email]);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setAvatarPreview(undefined);
      setFileList([]);
      setUploading(false);
      return;
    }

    form.setFieldsValue({
      name: initialValues?.name ?? ''
    });
    setAvatarPreview(initialValues?.image ?? undefined);
    setFileList([]);
  }, [form, initialValues, open]);

  const handleUploadChange = async ({ fileList: newFileList }: { fileList: UploadFile[] }) => {
    const latest = newFileList.slice(-1);
    setFileList(latest);

    const target = latest[0]?.originFileObj;
    if (!target) {
      return;
    }

    setUploading(true);
    try {
      const base64 = await fileToBase64(target);
      setAvatarPreview(base64);
    } catch (error) {
      setAvatarPreview(undefined);
      message.error('头像读取失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(undefined);
    setFileList([]);
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      await onSubmit({
        name: values.name.trim(),
        image: avatarPreview ?? null
      });
    } catch (error) {
      // validation errors handled by form
    }
  };

  return (
    <Modal
      open={open}
      title="个人资料"
      okText="保存"
      cancelText="取消"
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={confirmLoading || uploading}
      destroyOnClose
      maskClosable={false}
    >
      <Form form={form} layout="vertical">
        <Form.Item label="头像">
          <Space size={16} align="start">
            <Avatar size={72} src={avatarPreview} icon={<UserOutlined />} />
            <Space direction="vertical" size={8}>
              <Upload
                accept="image/*"
                beforeUpload={() => false}
                maxCount={1}
                showUploadList={false}
                fileList={fileList}
                onChange={handleUploadChange}
              >
                <Button icon={<UploadOutlined />}>上传头像</Button>
              </Upload>
              {avatarPreview ? (
                <Button type="link" danger onClick={handleRemoveAvatar}>
                  移除头像
                </Button>
              ) : null}
            </Space>
          </Space>
        </Form.Item>
        <Form.Item
          label="昵称"
          name="name"
          rules={[{ required: true, message: '请输入昵称' }]}
        >
          <Input placeholder="请输入昵称" maxLength={20} />
        </Form.Item>
        <Form.Item label="邮箱">
          <Input value={emailDisplay} disabled />
        </Form.Item>
      </Form>
    </Modal>
  );
}
