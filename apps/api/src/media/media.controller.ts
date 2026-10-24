import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Public } from '../common/decorators';
import { StorageService } from '../common/storage.service';
import { streamStorageObject } from './stream';

@Controller('media')
export class MediaController {
  constructor(private readonly storage: StorageService) {}

  @Public()
  @Get('*')
  async serve(
    @Param('*') rawKey: string,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
    @Query('exp') expires?: string,
    @Query('sig') signature?: string,
  ) {
    const key = decodeURIComponent(rawKey);
    if (key.startsWith('videos/')) {
      const exp = Number(expires);
      if (!signature || !this.storage.verify(key, exp, signature)) {
        return reply.status(403).send('Forbidden');
      }
    }
    const provider = await this.storage.provider();
    if (provider.driver === 's3') {
      return reply.redirect(await provider.signedUrl(key, 3600), 302);
    }
    return streamStorageObject(
      reply,
      provider,
      key,
      request.headers.range,
      request.headers['content-type'] as string | undefined,
    );
  }
}
