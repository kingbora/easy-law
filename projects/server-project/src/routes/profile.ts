import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import multer from 'multer';

import { isAllowedAvatarMimeType, uploadAvatar } from '../services/avatar-service';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE
  }
}).single('file');

function handleMulterError(error: unknown, res: Response, next: NextFunction): boolean {
  if (!error) {
    return false;
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? '头像文件过大，请上传小于 5MB 的图片'
        : '上传头像失败，请重试';
    res.status(400).json({ message });
    return true;
  }

  next(error as Error);
  return true;
}

const router = Router();

router.post('/avatar', (req: Request, res: Response, next: NextFunction) => {
  upload(req, res, async (error: unknown) => {
    if (handleMulterError(error, res, next)) {
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ message: '请选择要上传的头像文件' });
      return;
    }

    const mimeType = file.mimetype;
    if (!isAllowedAvatarMimeType(mimeType)) {
      res.status(400).json({ message: '仅支持上传 PNG/JPG/WEBP/GIF 图片' });
      return;
    }

    try {
      const currentPath = typeof req.body?.currentPath === 'string' ? req.body.currentPath.trim() : undefined;
      const uploadedPath = await uploadAvatar({
        buffer: file.buffer,
        mimeType,
        fileName: file.originalname,
        currentPath: currentPath || undefined
      });

      res.status(200).json({ path: uploadedPath });
    } catch (err) {
      next(err as Error);
    }
  });
});

export default router;
