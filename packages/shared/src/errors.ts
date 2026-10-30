export const ERROR_CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_INSTALLED: 'NOT_INSTALLED',
  INSTALL_DISABLED: 'INSTALL_DISABLED',
  INSTALL_TOKEN_REQUIRED: 'INSTALL_TOKEN_REQUIRED',
  INSTALL_FAILED: 'INSTALL_FAILED',
  UPGRADE_REQUIRED: 'UPGRADE_REQUIRED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  TRANSCODE_FAILED: 'TRANSCODE_FAILED',
  REGION_RESTRICTED: 'REGION_RESTRICTED',
  CAPTCHA_REQUIRED: 'CAPTCHA_REQUIRED',
  CAPTCHA_FAILED: 'CAPTCHA_FAILED',
  AI_MODERATION_BLOCKED: 'AI_MODERATION_BLOCKED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const unauthorized = (message = '请先登录') =>
  new AppError(ERROR_CODES.UNAUTHORIZED, message, 401);
export const forbidden = (message = '没有权限执行此操作') =>
  new AppError(ERROR_CODES.FORBIDDEN, message, 403);
export const notFound = (message = '资源不存在') =>
  new AppError(ERROR_CODES.NOT_FOUND, message, 404);
export const badRequest = (message = '请求参数错误', details?: unknown) =>
  new AppError(ERROR_CODES.BAD_REQUEST, message, 400, details);
export const conflict = (message = '资源冲突') => new AppError(ERROR_CODES.CONFLICT, message, 409);
