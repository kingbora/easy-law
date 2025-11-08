'use client';

import { useEffect, useState } from 'react';

import { App, Avatar, Form, Input, Modal, Progress, Radio, Space, Typography, Upload } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { CameraOutlined, UserOutlined } from '@ant-design/icons';
import imageCompression from 'browser-image-compression';
import styles from './ProfileModal.module.scss';

const MAX_COMPRESSED_SIZE = 2 * 1024 * 1024; // 2MB

function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size}B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)}KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(2)}MB`;
}

interface ProfileModalProps {
  open: boolean;
  initialValues?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    gender?: 'male' | 'female' | null;
  };
  onCancel: () => void;
  onSubmit: (values: ProfileSubmitPayload) => Promise<void> | void;
  confirmLoading?: boolean;
}

interface ProfileFormValues {
  name: string;
  email: string;
  gender: 'male' | 'female';
}

interface ProfileSubmitPayload {
  name: string;
  email: string;
  gender: 'male' | 'female';
  avatarFile?: File | null;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) ?? '');
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });

export default function ProfileModal({ open, initialValues, onCancel, onSubmit, confirmLoading }: ProfileModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<ProfileFormValues>();
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [compressedSize, setCompressedSize] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setAvatarPreview(undefined);
      setFileList([]);
      setUploading(false);
      setAvatarFile(null);
      setCompressionProgress(0);
      setCompressedSize(null);
      return;
    }

    form.setFieldsValue({
      name: initialValues?.name ?? '',
      email: initialValues?.email ?? '',
      gender: initialValues?.gender ?? 'male'
    });
    setAvatarPreview(initialValues?.image ?? undefined);
    setFileList([]);
    setAvatarFile(null);
    setCompressionProgress(0);
    setCompressedSize(null);
  }, [form, initialValues, open]);

  const handleUploadChange = async ({ fileList: newFileList }: { fileList: UploadFile[] }) => {
    const latest = newFileList.slice(-1);
    setFileList(latest);

    const target = latest[0]?.originFileObj;
    if (!target) {
      return;
    }

    setUploading(true);
    setCompressionProgress(0);
    setCompressedSize(null);
    try {
      const compressedFile = (await imageCompression(target, {
        useWebWorker: true,
        initialQuality: 1,
        alwaysKeepResolution: true,
        fileType: target.type || undefined,
        maxIteration: 1,
        onProgress: (progress: number) => {
          setCompressionProgress(Math.round(progress));
        }
      })) as File;

      const finalFile = compressedFile.size <= target.size ? compressedFile : target;

      const preview = await fileToBase64(finalFile);
      setAvatarPreview(preview);
      setAvatarFile(finalFile);

      setCompressionProgress(100);
      setCompressedSize(finalFile.size);

      if (finalFile.size > MAX_COMPRESSED_SIZE) {
        message.warning('压缩后文件仍超过 2MB，请选择更小的图片');
      }
    } catch (error) {
      setAvatarPreview(undefined);
      setAvatarFile(null);
      setCompressionProgress(0);
      setCompressedSize(null);
      message.error('头像读取失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      await onSubmit({
        name: values.name.trim(),
        email: values.email.trim(),
        gender: values.gender,
        avatarFile
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
      destroyOnHidden
      maskClosable={false}
    >
      <Form form={form} layout="vertical">
        <Form.Item label="头像">
          <Space size={16} align="start">
            <Upload
              accept="image/*"
              beforeUpload={() => false}
              maxCount={1}
              showUploadList={false}
              fileList={fileList}
              onChange={handleUploadChange}
              disabled={uploading}
              className={styles.avatarUpload}
            >
              <div className={styles.avatarUploadInner}>
                <Avatar size={72} src={avatarPreview} icon={<UserOutlined />} className={styles.avatarImage} />
                <div
                  className={`${styles.avatarMask} ${uploading ? styles.avatarMaskVisible : ''}`}
                >
                  <CameraOutlined className={styles.avatarMaskIcon} />
                  <span>更换头像</span>
                </div>
              </div>
            </Upload>
            {uploading || compressionProgress > 0 || compressedSize !== null ? (
              <Space direction="vertical" size={8}>
                {uploading || compressionProgress > 0 ? (
                  <Progress
                    percent={compressionProgress}
                    size="small"
                    status={uploading ? 'active' : compressionProgress === 100 ? 'success' : 'normal'}
                    showInfo
                  />
                ) : null}
                {compressedSize !== null ? (
                  <Typography.Text type={compressedSize > MAX_COMPRESSED_SIZE ? 'danger' : 'secondary'}>
                    压缩后大小：{formatFileSize(compressedSize)}
                  </Typography.Text>
                ) : null}
              </Space>
            ) : null}
          </Space>
        </Form.Item>
        <Form.Item
          label="昵称"
          name="name"
          rules={[{ required: true, message: '请输入昵称' }]}
        >
          <Input placeholder="请输入昵称" maxLength={20} />
        </Form.Item>
        <Form.Item
          label="邮箱"
          name="email"
          rules={[
            { required: true, message: '请输入邮箱地址' },
            { type: 'email', message: '邮箱格式不正确' },
            {
              validator: (_, value) => {
                if (!value) {
                  return Promise.resolve();
                }

                const normalized = String(value).trim();
                if (normalized !== value) {
                  return Promise.reject(new Error('邮箱前后不能包含空格'));
                }

                const emailPattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
                if (!emailPattern.test(normalized)) {
                  return Promise.reject(new Error('请输入合法的邮箱地址'));
                }

                return Promise.resolve();
              }
            }
          ]}
        >
          <Input placeholder="请输入邮箱" maxLength={50} />
        </Form.Item>
        <Form.Item
          label="性别"
          name="gender"
          rules={[{ required: true, message: '请选择性别' }]}
        >
          <Radio.Group>
            <Radio value="male">男</Radio>
            <Radio value="female">女</Radio>
          </Radio.Group>
        </Form.Item>
      </Form>
    </Modal>
  );
}
