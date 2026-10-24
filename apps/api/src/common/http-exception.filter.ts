import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AppError, ERROR_CODES, type ErrorCode } from '@uiliuili/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const requestId = String(request.id ?? '');

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = ERROR_CODES.INTERNAL_ERROR;
    let message = '服务器内部错误';
    let details: unknown;

    if (exception instanceof AppError) {
      status = exception.status;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      code = ERROR_CODES.VALIDATION_FAILED;
      message = '请求参数校验失败';
      details = exception.flatten();
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        message = response;
      } else if (response && typeof response === 'object') {
        const body = response as Record<string, unknown>;
        message = String(body.message ?? message);
        code =
          (body.code as ErrorCode | undefined) ??
          (status === 401 ? ERROR_CODES.UNAUTHORIZED : code);
        details = body.details;
      }
      if (status === 401) code = ERROR_CODES.UNAUTHORIZED;
      if (status === 403) code = ERROR_CODES.FORBIDDEN;
      if (status === 404) code = ERROR_CODES.NOT_FOUND;
    } else if (exception instanceof Error) {
      message =
        process.env.NODE_ENV === 'production' ? '服务器内部错误' : exception.message || message;
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${status} ${requestId}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    void reply.status(status).send({
      error: {
        code,
        message,
        details,
        requestId,
      },
    });
  }
}
