import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { CAPTCHA_ACTIONS, captchaVerifySchema } from '@uiliuili/shared';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AuthUser } from './auth-user';
import { CaptchaService } from './captcha.service';
import { CurrentUser, OptionalAuth, Public } from './decorators';
import { zodBody } from './zod';

@Controller('api/v1/security')
export class SecurityController {
  constructor(private readonly captcha: CaptchaService) {}

  @Public()
  @Get('captcha')
  async status() {
    const settings = await this.captcha.isEnabled();
    return { enabled: settings };
  }

  @Public()
  @OptionalAuth()
  @Post('captcha/verify')
  async verify(
    @Body(zodBody(captchaVerifySchema)) body: z.infer<typeof captchaVerifySchema>,
    @CurrentUser() user: AuthUser | undefined,
    @Req() request: FastifyRequest,
  ) {
    return this.captcha.verify(
      body.token,
      body.action,
      CaptchaService.contextFrom(user, request.ip),
    );
  }

  /** The action list is exposed so clients can pre-render the right widget. */
  @Public()
  @Get('captcha/actions')
  actions() {
    return { actions: CAPTCHA_ACTIONS };
  }
}
