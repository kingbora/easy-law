import type { RequestHandler } from 'express';

declare module 'multer' {
  interface StorageEngine {}

  interface Limits {
    fileSize?: number;
  }

  interface MulterOptions {
    storage?: StorageEngine;
    limits?: Limits;
  }

  class MulterError extends Error {
    code: string;
    field?: string;
    constructor(code: string, field?: string);
  }

  interface MulterInstance {
    single(fieldName: string): RequestHandler;
  }

  interface MulterModule {
    (options?: MulterOptions): MulterInstance;
    MulterError: typeof MulterError;
    memoryStorage(): StorageEngine;
  }

  const multer: MulterModule;
  export = multer;
}

declare namespace Express {
  namespace Multer {
    interface File {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    }
  }

  interface Request {
    file?: Multer.File;
  }
}
