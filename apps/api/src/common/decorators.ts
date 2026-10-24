import { type ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';
import type { Permission } from '@uiliuili/shared';
import type { AuthUser, RequestWithUser } from './auth-user';

export const IS_PUBLIC_KEY = 'isPublic';
export const OPTIONAL_AUTH_KEY = 'optionalAuth';
export const PERMISSIONS_KEY = 'permissions';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const OptionalAuth = () => SetMetadata(OPTIONAL_AUTH_KEY, true);
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser | undefined => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);

export const RequestMeta = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestWithUser => {
    return context.switchToHttp().getRequest<RequestWithUser>();
  },
);
