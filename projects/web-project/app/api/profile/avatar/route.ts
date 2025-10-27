import { randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

import { NextResponse } from 'next/server';

const AVATAR_DIR = path.join(process.cwd(), 'public', 'avatar');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
};

function generateUniqueFileName(extension: string): string {
  const uniqueId = randomBytes(8).toString('hex');
  return `${uniqueId}${extension}`;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ message: '请选择要上传的头像文件' }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ message: '头像文件不能为空' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ message: '头像文件过大，请上传小于 5MB 的图片' }, { status: 400 });
    }

    const mimeType = file.type;
    const extension =
      MIME_EXTENSION_MAP[mimeType] ||
      path.extname(file.name || '').toLowerCase() ||
      '.png';

    if (!(mimeType in MIME_EXTENSION_MAP) && !extension.match(/^\.(png|jpe?g|webp|gif)$/)) {
      return NextResponse.json({ message: '仅支持上传 PNG/JPG/WEBP/GIF 图片' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await mkdir(AVATAR_DIR, { recursive: true });
    const fileName = generateUniqueFileName(extension);
    const targetPath = path.join(AVATAR_DIR, fileName);

    await writeFile(targetPath, buffer);

    return NextResponse.json({ path: `/avatar/${fileName}` });
  } catch (error) {
    console.error('Avatar upload failed', error);
    return NextResponse.json({ message: '上传头像失败，请稍后重试' }, { status: 500 });
  }
}
