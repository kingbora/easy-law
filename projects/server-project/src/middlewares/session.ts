import type { NextFunction, Request, Response } from 'express';

import { fetchSessionFromRequest } from '../utils/auth-session';

export class UnauthorizedError extends Error {
  status: number;

  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
    this.status = 401;
  }
}

export async function requireSession(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.sessionContext) {
      return next();
    }

  const session = await fetchSessionFromRequest(req);

    if (!session) {
      throw new UnauthorizedError();
    }

    req.sessionContext = session;
    return next();
  } catch (error) {
    return next(error);
  }
}
