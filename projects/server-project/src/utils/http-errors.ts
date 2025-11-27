export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Invalid request payload', details?: unknown) {
    super(400, message, details);
    this.name = 'BadRequestError';
  }
}

export class AuthorizationError extends HttpError {
  constructor(message = 'Forbidden', status = 403, details?: unknown) {
    super(status, message, details);
    this.name = 'AuthorizationError';
  }
}
