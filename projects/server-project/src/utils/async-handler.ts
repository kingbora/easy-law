import type { NextFunction, Request, Response } from 'express';

export type AsyncRouteHandler<TRequest extends Request = Request, TResponse extends Response = Response> = (
  req: TRequest,
  res: TResponse,
  next: NextFunction
) => Promise<unknown> | unknown;

export function asyncHandler<TRequest extends Request = Request, TResponse extends Response = Response>(
  handler: AsyncRouteHandler<TRequest, TResponse>
) {
  return (req: TRequest, res: TResponse, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
