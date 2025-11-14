import { randomUUID } from 'crypto';
import path from 'path';

import * as qiniu from 'qiniu';

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
};

export function isAllowedAvatarMimeType(mimeType: string): boolean {
  return Object.prototype.hasOwnProperty.call(ALLOWED_MIME_TYPES, mimeType);
}

interface QiniuContext {
  mac: qiniu.auth.digest.Mac;
  bucket: string;
  publicDomain: string;
  prefix: string;
  formUploader: qiniu.form_up.FormUploader;
  bucketManager: qiniu.rs.BucketManager;
}

let cachedContext: QiniuContext | null = null;

function ensureContext(): QiniuContext {
  if (cachedContext) {
    return cachedContext;
  }

  const accessKey = process.env.QINIU_ACCESS_KEY;
  const secretKey = process.env.QINIU_SECRET_KEY;
  const bucket = "laywer-app";
  const publicDomain = "http://t5kd4qxxn.hn-bkt.clouddn.com";
  const prefix = "avatars/";

  if (!accessKey || !secretKey || !bucket || !publicDomain) {
    throw new Error('七牛云配置缺失，请在环境变量中设置 QINIU_ACCESS_KEY、QINIU_SECRET_KEY、QINIU_BUCKET、QINIU_PUBLIC_DOMAIN');
  }

  const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
  const config = new qiniu.conf.Config({
    useHttpsDomain: true,
    useCdnDomain: true
  });

  config.zone = qiniu.zone.Zone_z2;

  const formUploader = new qiniu.form_up.FormUploader(config);
  const bucketManager = new qiniu.rs.BucketManager(mac, config);

  cachedContext = {
    mac,
    bucket,
    publicDomain,
    prefix: prefix.endsWith('/') ? prefix : `${prefix}/`,
    formUploader,
    bucketManager
  };

  return cachedContext;
}

function getExtension(mimeType: string, fileName?: string | null): string {
  if (mimeType && ALLOWED_MIME_TYPES[mimeType]) {
    return ALLOWED_MIME_TYPES[mimeType];
  }

  if (fileName) {
    const ext = path.extname(fileName).toLowerCase();
    if (ext && Object.values(ALLOWED_MIME_TYPES).includes(ext)) {
      return ext;
    }
  }

  return '.png';
}

function extractKeyFromPublicUrl(fullPath: string, domain: string, prefix: string): string | null {
  const normalized = fullPath.trim();
  if (!normalized) {
    return null;
  }

  const sanitizedDomain = domain
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '');
  const sanitizedPrefix = prefix.replace(/^\/+/, '').replace(/\/+$/, '/');

  const lower = normalized.toLowerCase();
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    const withoutProtocol = normalized.replace(/^https?:\/\//i, '');
    if (withoutProtocol.startsWith(sanitizedDomain)) {
      const remainder = withoutProtocol.slice(sanitizedDomain.length).replace(/^\//, '');
      return remainder || null;
    }
  }

  const normalizedWithoutLeadingSlash = normalized.replace(/^\/+/, '');
  if (normalizedWithoutLeadingSlash.startsWith(sanitizedPrefix)) {
    return normalizedWithoutLeadingSlash;
  }

  return null;
}

function buildPublicUrl(domain: string, key: string): string {
  const sanitizedDomain = domain.replace(/\/$/, '');
  const sanitizedKey = key.replace(/^\/+/, '');
  if (sanitizedDomain.startsWith('http://') || sanitizedDomain.startsWith('https://')) {
    return `${sanitizedDomain}/${sanitizedKey}`;
  }
  return `https://${sanitizedDomain}/${sanitizedKey}`;
}

async function deleteFromQiniu(manager: qiniu.rs.BucketManager, bucket: string, key: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    manager.delete(bucket, key, (error: Error | null, _body: unknown, info: { statusCode: number }) => {
      if (error) {
        return reject(error);
      }

      if (info.statusCode === 200 || info.statusCode === 612) {
        return resolve();
      }

      return reject(new Error(`删除旧头像失败，状态码：${info.statusCode}`));
    });
  });
}

async function uploadToQiniu(
  uploader: qiniu.form_up.FormUploader,
  mac: qiniu.auth.digest.Mac,
  bucket: string,
  key: string,
  buffer: Buffer,
  mimeType: string
): Promise<void> {
  const putPolicy = new qiniu.rs.PutPolicy({
    scope: bucket,
    expires: 3600
  });
  const uploadToken = putPolicy.uploadToken(mac);
  const putExtra = new qiniu.form_up.PutExtra();
  putExtra.fname = key;
  putExtra.mimeType = mimeType;

  await new Promise<void>((resolve, reject) => {
    uploader.put(uploadToken, key, buffer, putExtra, (error: Error | null, _body: unknown, info: { statusCode: number; data?: unknown }) => {
      if (error) {
        return reject(error);
      }

      if (info.statusCode === 200) {
        return resolve();
      }

      return reject(new Error(`上传头像失败，状态码：${info.statusCode}，${JSON.stringify(info.data)}`));
    });
  });
}

export interface UploadAvatarOptions {
  buffer: Buffer;
  mimeType: string;
  fileName?: string | null;
  currentPath?: string | null;
}

export async function uploadAvatar({ buffer, mimeType, fileName, currentPath }: UploadAvatarOptions): Promise<string> {
  if (!buffer || buffer.length === 0) {
    throw new Error('头像文件不能为空');
  }

  const extension = getExtension(mimeType, fileName);
  const { formUploader, mac, bucket, publicDomain, prefix, bucketManager } = ensureContext();
  const key = `${prefix}${Date.now()}-${randomUUID()}${extension}`;

  await uploadToQiniu(formUploader, mac, bucket, key, buffer, mimeType);

  if (currentPath) {
    const objectKey = extractKeyFromPublicUrl(currentPath, publicDomain, prefix);
    if (objectKey) {
      await deleteFromQiniu(bucketManager, bucket, objectKey).catch((error) => {
        console.warn('删除旧头像失败：', error);
      });
    }
  }

  return buildPublicUrl(publicDomain, key);
}
