import { Body, Controller, Delete, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import {
  coinSchema,
  feedbackSchema,
  playlistQuerySchema,
  progressSchema,
  reportSchema,
  videoListQuerySchema,
} from '@uiliuili/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser, OptionalAuth, Public } from '../common/decorators';
import { StorageService } from '../common/storage.service';
import { zodBody, zodQuery } from '../common/zod';
import { streamStorageObject } from '../media/stream';
import { VideosService } from './videos.service';

const userVideosQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(['new', 'hot']).default('new'),
});

/** Coarse device class used only for anonymous aggregate analytics. */
function deviceFromUserAgent(userAgent?: string): string {
  const ua = (userAgent ?? '').toLowerCase();
  if (!ua) return 'unknown';
  if (/bot|crawler|spider|preview/.test(ua)) return 'bot';
  if (/\btv\b|smarttv|appletv|googletv/.test(ua)) return 'tv';
  if (/ipad|tablet|playbook|silk/.test(ua)) return 'tablet';
  if (/mobi|iphone|android.*mobile|windows phone/.test(ua)) return 'mobile';
  return 'desktop';
}

@Controller('api/v1/videos')
export class VideosController {
  constructor(
    private readonly videos: VideosService,
    private readonly storage: StorageService,
  ) {}

  @Public()
  @OptionalAuth()
  @Get()
  async list(@Query(zodQuery(videoListQuerySchema)) query: z.infer<typeof videoListQuerySchema>) {
    return this.videos.list(query);
  }

  @Public()
  @OptionalAuth()
  @Get(':id')
  async detail(@Param('id') id: string, @CurrentUser() viewer?: AuthUser) {
    return this.videos.detail(id, viewer);
  }

  @Public()
  @OptionalAuth()
  @Get(':id/related')
  async related(@Param('id') id: string) {
    return this.videos.related(id);
  }

  @Public()
  @OptionalAuth()
  @Get(':id/playlist')
  async playlist(
    @Param('id') id: string,
    @Query(zodQuery(playlistQuerySchema)) query: z.infer<typeof playlistQuerySchema>,
    @Req() request: FastifyRequest,
    @CurrentUser() viewer?: AuthUser,
  ) {
    return this.videos.playlist(id, viewer, query.partId, {
      source: query.source,
      device: deviceFromUserAgent(request.headers['user-agent']),
    });
  }

  @Public()
  @OptionalAuth()
  @Get(':id/parts/:partId/hls/*')
  async partHls(
    @Param('id') id: string,
    @Param('partId') partId: string,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
    @CurrentUser() viewer?: AuthUser,
  ) {
    const params = request.params as Record<string, string>;
    const filePath = params['*'] ?? params['0'] ?? '';
    const { key } = await this.videos.hlsKey(id, filePath, viewer, partId);
    const provider = await this.storage.provider();
    reply.header(
      'Cache-Control',
      filePath.endsWith('.m3u8') ? 'no-cache' : 'public, max-age=31536000, immutable',
    );
    return streamStorageObject(reply, provider, key, request.headers.range);
  }

  @Public()
  @OptionalAuth()
  @Get(':id/hls/*')
  async hls(
    @Param('id') id: string,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
    @CurrentUser() viewer?: AuthUser,
  ) {
    const params = request.params as Record<string, string>;
    const filePath = params['*'] ?? params['0'] ?? '';
    const { key } = await this.videos.hlsKey(id, filePath, viewer);
    const provider = await this.storage.provider();
    reply.header(
      'Cache-Control',
      filePath.endsWith('.m3u8') ? 'no-cache' : 'public, max-age=31536000, immutable',
    );
    return streamStorageObject(reply, provider, key, request.headers.range);
  }

  @Post(':id/like')
  async like(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.videos.toggleLike(id, user, true);
  }

  @Delete(':id/like')
  async unlike(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.videos.toggleLike(id, user, false);
  }

  @Post(':id/coin')
  async coin(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body(zodBody(coinSchema)) body: z.infer<typeof coinSchema>,
  ) {
    return this.videos.addCoin(id, user, body.amount);
  }

  @Post(':id/favorite')
  async favorite(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.videos.toggleFavorite(id, user, true);
  }

  @Post(':id/watch-later')
  async addWatchLater(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.videos.toggleWatchLater(id, user, true);
  }

  @Delete(':id/watch-later')
  async removeWatchLater(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.videos.toggleWatchLater(id, user, false);
  }

  @Delete(':id/favorite')
  async unfavorite(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.videos.toggleFavorite(id, user, false);
  }

  @Post(':id/progress')
  async progress(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body(zodBody(progressSchema)) body: z.infer<typeof progressSchema>,
    @Req() request: FastifyRequest,
  ) {
    return this.videos.saveProgress(id, user, body, {
      device: deviceFromUserAgent(request.headers['user-agent']),
    });
  }

  @Post(':id/report')
  async report(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(reportSchema)) body: z.infer<typeof reportSchema>,
  ) {
    return this.videos.report(user, body);
  }

  @Post('feedback')
  async feedback(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(feedbackSchema)) body: z.infer<typeof feedbackSchema>,
  ) {
    return this.videos.feedback(user, body);
  }
}

@Controller('api/v1/users')
export class UserVideosController {
  constructor(private readonly videos: VideosService) {}

  @Public()
  @OptionalAuth()
  @Get(':username/videos')
  async byUploader(
    @Param('username') username: string,
    @Query(zodQuery(userVideosQuerySchema)) query: z.infer<typeof userVideosQuerySchema>,
  ) {
    return this.videos.byUploader(username, query);
  }
}

@Controller('api/v1/categories')
export class CategoriesController {
  constructor(private readonly videos: VideosService) {}

  @Public()
  @OptionalAuth()
  @Get()
  async list() {
    return { items: await this.videos.getCategories() };
  }
}
