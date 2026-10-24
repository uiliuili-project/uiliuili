import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import {
  COOKIE_NAMES,
  databaseConfigSchema,
  installConfigSchema,
  installMailTestSchema,
  installStorageTestSchema,
} from '@uiliuili/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { zodBody } from '../common/zod';
import { config } from '../config';
import { InstallService } from './install.service';

const unlockSchema = z.object({ token: z.string().optional().default('') });

@Controller('api/install')
export class InstallController {
  constructor(private readonly installer: InstallService) {}

  @Get('status')
  status() {
    return this.installer.status();
  }

  @Post('unlock')
  unlock(
    @Body(zodBody(unlockSchema)) body: z.infer<typeof unlockSchema>,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = this.installer.unlock(body.token, request.ip);
    if ('sessionId' in result) {
      reply.setCookie(COOKIE_NAMES.install, result.sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.isSecure,
        path: '/',
        maxAge: 30 * 60,
      });
    }
    return { ok: true, ...result };
  }

  @Get('environment')
  async environment(@Req() request: FastifyRequest) {
    this.requireSession(request);
    return this.installer.environment();
  }

  @Post('test/database')
  async testDatabase(
    @Body(zodBody(z.object({ config: databaseConfigSchema }))) body: {
      config: z.infer<typeof databaseConfigSchema>;
    },
    @Req() request: FastifyRequest,
  ) {
    this.requireSession(request);
    return this.installer.testDatabase(body.config);
  }

  @Post('test/storage')
  async testStorage(
    @Body(zodBody(z.object({ config: installStorageTestSchema.shape.config })))
    body: { config: z.infer<typeof installStorageTestSchema>['config'] },
    @Req() request: FastifyRequest,
  ) {
    this.requireSession(request);
    return this.installer.testStorage(body.config);
  }

  @Post('test/mail')
  async testMail(
    @Body(zodBody(z.object({ config: installMailTestSchema.shape.config, to: z.string().email() })))
    body: { config: z.infer<typeof installMailTestSchema>['config']; to: string },
    @Req() request: FastifyRequest,
  ) {
    this.requireSession(request);
    return this.installer.testMail({ ...body.config, to: body.to });
  }

  @Post('run')
  run(
    @Body(zodBody(installConfigSchema)) body: z.infer<typeof installConfigSchema>,
    @Req() request: FastifyRequest,
  ) {
    this.requireSession(request);
    return this.installer.start(body);
  }

  @Get('progress')
  progress(@Req() request: FastifyRequest) {
    this.requireSession(request);
    return this.installer.progress();
  }

  private requireSession(request: FastifyRequest): void {
    const sessionId = request.cookies?.[COOKIE_NAMES.install];
    if (!this.installer.hasValidSession(sessionId, request.ip)) {
      throw new Error('安装会话已失效，请输入安装令牌');
    }
  }
}
