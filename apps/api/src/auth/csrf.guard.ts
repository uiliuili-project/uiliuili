import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { RequestWithUser } from '../common/auth-user';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const EXEMPT_PREFIXES = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
  '/api/v1/auth/password/forgot',
  '/api/v1/auth/password/reset',
  '/api/v1/auth/email/verify',
  '/api/v1/auth/oauth',
  '/api/install',
];

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithUser & { method: string; url: string }>();
    if (SAFE_METHODS.has(request.method)) return true;
    if (request.headers.authorization) return true;
    const path = request.url.split('?')[0] ?? '';
    if (EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;
    const accessCookie = request.cookies?.ul_access;
    if (!accessCookie) return true;
    const cookie = request.cookies?.ul_csrf;
    const header = request.headers['x-csrf-token'];
    const supplied = Array.isArray(header) ? header[0] : header;
    if (!cookie || !supplied || cookie !== supplied) {
      throw new ForbiddenException('CSRF 校验失败，请刷新页面后重试');
    }
    return true;
  }
}
