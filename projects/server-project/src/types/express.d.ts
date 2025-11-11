import type { SessionContext } from '../utils/auth-session';

declare global {
  namespace Express {
    interface Request {
      sessionContext?: SessionContext;
      file?: Multer.File;
    }
  }
}

export {};
