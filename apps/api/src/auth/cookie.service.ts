import { Injectable } from '@nestjs/common';
import { ACCESS_TOKEN_TTL_SECONDS, COOKIE_NAMES, REFRESH_TOKEN_TTL_DAYS } from '@uiliuili/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config';

@Injectable()
export class CookieService {
  setAuthCookies(
    reply: FastifyReply,
    tokens: { accessToken: string; refreshToken: string; csrfToken: string },
    remember = true,
  ): void {
    const refreshMaxAge = remember ? REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 : undefined;
    reply.setCookie(COOKIE_NAMES.access, tokens.accessToken, {
      httpOnly: true,
      secure: config.isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: ACCESS_TOKEN_TTL_SECONDS,
    });
    reply.setCookie(COOKIE_NAMES.refresh, tokens.refreshToken, {
      httpOnly: true,
      secure: config.isSecure,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: refreshMaxAge,
    });
    reply.setCookie(COOKIE_NAMES.csrf, tokens.csrfToken, {
      httpOnly: false,
      secure: config.isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
    });
  }

  clearAuthCookies(reply: FastifyReply): void {
    reply.clearCookie(COOKIE_NAMES.access, { path: '/' });
    reply.clearCookie(COOKIE_NAMES.refresh, { path: '/api/v1/auth' });
    reply.clearCookie(COOKIE_NAMES.csrf, { path: '/' });
  }

  accessToken(request: FastifyRequest): string | undefined {
    return request.cookies?.[COOKIE_NAMES.access];
  }

  refreshToken(request: FastifyRequest): string | undefined {
    return request.cookies?.[COOKIE_NAMES.refresh];
  }

  csrfToken(request: FastifyRequest): string | undefined {
    return request.cookies?.[COOKIE_NAMES.csrf];
  }

  setOauthState(reply: FastifyReply, state: string): void {
    reply.setCookie('ul_oauth_state', state, {
      httpOnly: true,
      secure: config.isSecure,
      sameSite: 'lax',
      path: '/api/v1/auth/oauth',
      maxAge: 10 * 60,
    });
  }

  oauthState(request: FastifyRequest): string | undefined {
    return request.cookies?.ul_oauth_state;
  }

  clearOauthState(reply: FastifyReply): void {
    reply.clearCookie('ul_oauth_state', { path: '/api/v1/auth/oauth' });
  }
}
