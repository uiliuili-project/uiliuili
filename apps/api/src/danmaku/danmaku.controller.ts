import { Body, Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import { parseBilibiliXml } from '@uiliuili/danmaku';
import { type DanmakuCreateInput, danmakuCreateSchema, danmakuQuerySchema } from '@uiliuili/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser, OptionalAuth, Public } from '../common/decorators';
import { zodBody, zodQuery } from '../common/zod';
import { DanmakuService } from './danmaku.service';

const importSchema = z.object({
  xml: z.string().min(1).max(5_000_000),
});

@Controller('api/v1/videos')
export class DanmakuController {
  constructor(private readonly danmaku: DanmakuService) {}

  @Public()
  @OptionalAuth()
  @Get(':id/danmaku')
  async segment(
    @Param('id') id: string,
    @Query(zodQuery(danmakuQuerySchema)) query: z.infer<typeof danmakuQuerySchema>,
    @CurrentUser() viewer?: AuthUser,
  ) {
    return this.danmaku.segment(id, query.segment, viewer);
  }

  @Post(':id/danmaku')
  async send(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body(zodBody(danmakuCreateSchema)) body: DanmakuCreateInput,
    @Req() request: FastifyRequest,
  ) {
    return { item: await this.danmaku.send(user, id, body, request.ip) };
  }

  @Post(':id/danmaku/import')
  async importXml(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body(zodBody(importSchema)) body: z.infer<typeof importSchema>,
  ) {
    const parsed = parseBilibiliXml(body.xml);
    return this.danmaku.importXml(
      user,
      id,
      parsed.map((item) => ({
        progressMs: item.progressMs,
        mode: item.mode,
        color: item.color,
        fontSize: item.fontSize,
        content: item.content,
      })),
    );
  }

  @Public()
  @OptionalAuth()
  @Get(':id/danmaku/export')
  async exportXml(
    @Param('id') id: string,
    @CurrentUser() viewer: AuthUser | undefined,
    @Res() reply: FastifyReply,
  ) {
    const xml = await this.danmaku.exportXml(id, viewer);
    reply.header('Content-Type', 'application/xml; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="danmaku-${id}.xml"`);
    return reply.send(xml);
  }
}
