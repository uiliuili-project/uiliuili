import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators';
import { ImageUploadService } from '../common/image-upload.service';
import { RateLimitService } from '../common/rate-limit.service';

@Controller('api/v1/uploads')
export class UploadsController {
  constructor(
    private readonly images: ImageUploadService,
    private readonly rateLimit: RateLimitService,
  ) {}

  /** Raw-body image upload shared by dynamics and other composer fields. */
  @Post('images')
  async image(
    @CurrentUser() user: AuthUser,
    @Body() body: Buffer,
    @Headers('content-type') _contentType: string,
    @Req() request: FastifyRequest,
  ) {
    await this.rateLimit.check('image', this.rateLimit.contextFrom(user, request.ip));
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body ?? []);
    const saved = await this.images.save(`users/${user.id}/images`, buffer, 10 * 1024 * 1024);
    return { url: saved.url, contentType: saved.contentType, bytes: saved.bytes };
  }
}
