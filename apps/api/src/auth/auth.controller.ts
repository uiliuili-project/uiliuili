import crypto from 'node:crypto';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from '@uiliuili/shared';
import { AppError, ERROR_CODES } from '@uiliuili/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AuthUser, RequestWithUser } from '../common/auth-user';
import { CurrentUser, Public } from '../common/decorators';
import { SettingsService } from '../common/settings.service';
import { zodBody } from '../common/zod';
import { AuthService } from './auth.service';
import { CookieService } from './cookie.service';
import { OAuthService } from './oauth.service';

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: CookieService,
    private readonly oauth: OAuthService,
    private readonly settings: SettingsService,
  ) {}

  @Public()
  @Get('csrf')
  csrf(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    let token = this.cookies.csrfToken(request);
    if (!token) {
      token = crypto.randomUUID();
      reply.setCookie('ul_csrf', token, {
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
    }
    return { token };
  }

  @Public()
  @Get('providers')
  async providers() {
    return { providers: await this.oauth.enabledProviders() };
  }

  @Public()
  @Post('register')
  async register(
    @Body(zodBody(registerSchema)) body: z.infer<typeof registerSchema>,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    try {
      const tokens = await this.auth.register(body);
      this.cookies.setAuthCookies(reply, tokens, true);
      return { user: tokens.user };
    } catch (error) {
      throw this.toAppError(error);
    }
  }

  @Public()
  @Post('login')
  async login(
    @Body(zodBody(loginSchema)) body: z.infer<typeof loginSchema>,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    try {
      const tokens = await this.auth.login(body.identifier, body.password, {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
      this.cookies.setAuthCookies(reply, tokens, body.remember);
      return { user: tokens.user };
    } catch (error) {
      throw this.toAppError(error);
    }
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    try {
      const tokens = await this.auth.refresh(this.cookies.refreshToken(request), {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
      this.cookies.setAuthCookies(reply, tokens, true);
      return { user: tokens.user };
    } catch (error) {
      this.cookies.clearAuthCookies(reply);
      throw new AppError(ERROR_CODES.UNAUTHORIZED, this.message(error), 401);
    }
  }

  @Public()
  @Post('logout')
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.auth.logout(this.cookies.refreshToken(request));
    this.cookies.clearAuthCookies(reply);
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return { user };
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(updateProfileSchema)) body: z.infer<typeof updateProfileSchema>,
  ) {
    return { user: await this.auth.updateProfile(user.id, body) };
  }

  @Post('password')
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(changePasswordSchema)) body: z.infer<typeof changePasswordSchema>,
  ) {
    try {
      await this.auth.changePassword(user.id, body.currentPassword, body.newPassword);
      return { ok: true };
    } catch (error) {
      throw this.toAppError(error);
    }
  }

  @Public()
  @Post('password/forgot')
  async forgotPassword(
    @Body(zodBody(forgotPasswordSchema)) body: z.infer<typeof forgotPasswordSchema>,
  ) {
    await this.auth.requestPasswordReset(body.email);
    return { ok: true, message: '如果该邮箱存在，我们已经发送了重置链接' };
  }

  @Public()
  @Post('password/reset')
  async resetPassword(
    @Body(zodBody(resetPasswordSchema)) body: z.infer<typeof resetPasswordSchema>,
  ) {
    try {
      await this.auth.resetPassword(body.token, body.password);
      return { ok: true };
    } catch (error) {
      throw this.toAppError(error);
    }
  }

  @Public()
  @Post('email/verify')
  async verifyEmail(@Body(zodBody(verifyEmailSchema)) body: z.infer<typeof verifyEmailSchema>) {
    try {
      await this.auth.verifyEmail(body.token);
      return { ok: true };
    } catch (error) {
      throw this.toAppError(error);
    }
  }

  @Post('email/resend')
  async resendEmail(@CurrentUser() user: AuthUser) {
    try {
      await this.auth.resendVerification(user.id);
      return { ok: true };
    } catch (error) {
      throw this.toAppError(error);
    }
  }

  @Get('sessions')
  async sessions(@CurrentUser() user: AuthUser) {
    return { sessions: await this.auth.listSessions(user.id) };
  }

  @Delete('sessions/:id')
  async revokeSession(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.auth.revokeSession(user.id, id);
    return { ok: true };
  }

  @Public()
  @Get('oauth/:provider')
  async oauthStart(
    @Param('provider') provider: string,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    try {
      const site = await this.settings.getSite();
      const state = await this.oauth.createState(provider);
      this.cookies.setOauthState(reply, state);
      const url = await this.oauth.authorizeUrl(provider, state, site.url);
      return reply.redirect(url, 302);
    } catch (error) {
      const site = await this.settings.getSite();
      return reply.redirect(
        `${site.url}/login?oauth_error=${encodeURIComponent(this.message(error))}`,
        302,
      );
    }
  }

  @Public()
  @Get('oauth/:provider/callback')
  async oauthCallback(
    @Param('provider') provider: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') oauthError: string | undefined,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const site = await this.settings.getSite();
    try {
      if (oauthError) throw new Error(oauthError);
      if (!code || !state) throw new Error('缺少授权参数');
      const cookieState = this.cookies.oauthState(request);
      if (!cookieState || cookieState !== state) throw new Error('OAuth state 校验失败');
      if (!(await this.oauth.verifyState(state, provider))) throw new Error('OAuth state 已过期');
      const profile = await this.oauth.exchange(provider, code, site.url);
      const user = await this.auth.findOrCreateOAuthUser(profile);
      const tokens = await this.auth.issueSessionForUserId(user.id, {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
      this.cookies.setAuthCookies(reply, tokens, true);
      this.cookies.clearOauthState(reply);
      return reply.redirect(site.url, 302);
    } catch (error) {
      return reply.redirect(
        `${site.url}/login?oauth_error=${encodeURIComponent(this.message(error))}`,
        302,
      );
    }
  }

  private toAppError(error: unknown): AppError {
    if (error instanceof AppError) return error;
    const message = this.message(error);
    if (message.includes('已被') || message.includes('已存在')) {
      return new AppError(ERROR_CODES.CONFLICT, message, 409);
    }
    return new AppError(ERROR_CODES.BAD_REQUEST, message, 400);
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
