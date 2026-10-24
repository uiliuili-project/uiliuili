import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { RequestWithUser } from '../common/auth-user';
import { IS_PUBLIC_KEY, OPTIONAL_AUTH_KEY } from '../common/decorators';
import { AuthService } from './auth.service';

interface AccessPayload {
  sub: string;
  type: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const optional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authorization = request.headers.authorization;
    const bearer =
      typeof authorization === 'string' && authorization.startsWith('Bearer ')
        ? authorization.slice(7)
        : undefined;
    const token = bearer ?? request.cookies?.ul_access;
    if (!token) {
      if (optional) return true;
      throw new UnauthorizedException('请先登录');
    }
    try {
      const payload = await this.jwt.verifyAsync<AccessPayload>(token);
      if (payload.type !== 'access' || !payload.sub) throw new Error('Invalid token type');
      const user = await this.auth.findById(payload.sub);
      if (!user) throw new Error('User not found');
      if (user.banned) throw new UnauthorizedException('账号已被封禁');
      request.user = user;
      return true;
    } catch (error) {
      if (optional) return true;
      throw new UnauthorizedException(
        error instanceof UnauthorizedException ? error.message : '登录状态已失效',
      );
    }
  }
}
