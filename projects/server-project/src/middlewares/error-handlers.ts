import type { ErrorRequestHandler, Request, Response } from 'express';

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({
    message: 'Not Found'
  });
};

interface HttpError extends Error {
  status?: number;
  details?: unknown;
}

export const errorHandler: ErrorRequestHandler = (err: HttpError, _req, res, _next) => {
  const status = err.status ?? 500;
  const baseResponse: Record<string, unknown> = {
    message: err.message || 'Internal Server Error'
  };

  if (err.details) {
    baseResponse.details = err.details;
  }

  if (process.env.NODE_ENV !== 'production' && err.stack) {
    baseResponse.stack = err.stack;
  }

  res.status(status).json(baseResponse);
};
