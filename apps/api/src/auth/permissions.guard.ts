import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '@uiliuili/shared';
import type { RequestWithUser } from '../common/auth-user';
import { ANY_PERMISSIONS_KEY, PERMISSIONS_KEY } from '../common/decorators';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const anyRequired = this.reflector.getAllAndOverride<Permission[]>(ANY_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if ((!required || required.length === 0) && (!anyRequired || anyRequired.length === 0)) {
      return true;
    }
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user) throw new ForbiddenException('请先登录');
    const granted = new Set(user.permissions);
    if (
      required &&
      required.length > 0 &&
      !required.every((permission) => granted.has(permission))
    ) {
      throw new ForbiddenException('没有权限执行此操作');
    }
    if (
      anyRequired &&
      anyRequired.length > 0 &&
      !anyRequired.some((permission) => granted.has(permission))
    ) {
      throw new ForbiddenException('没有权限执行此操作');
    }
    return true;
  }
}
