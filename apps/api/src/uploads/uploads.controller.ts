import { Body, Controller, Headers, Post } from '@nestjs/common';
import { AppError, ERROR_CODES } from '@uiliuili/shared';
import type { AuthUser } from '../common/auth-user';
import { CacheService } from '../common/cache.service';
import { CurrentUser } from '../common/decorators';
import { ImageUploadService } from '../common/image-upload.service';

@Controller('api/v1/uploads')
export class UploadsController {
  constructor(
    private readonly images: ImageUploadService,
    private readonly cache: CacheService,
  ) {}

  /** Raw-body image upload shared by dynamics and other composer fields. */
  @Post('images')
  async image(
    @CurrentUser() user: AuthUser,
    @Body() body: Buffer,
    @Headers('content-type') _contentType: string,
  ) {
    const attempts = await this.cache.increment(`upload:image:${user.id}`, 3600);
    if (attempts > 60) {
      throw new AppError(ERROR_CODES.RATE_LIMITED, '上传过于频繁，请稍后再试', 429);
    }
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body ?? []);
    const saved = await this.images.save(`users/${user.id}/images`, buffer, 10 * 1024 * 1024);
    return { url: saved.url, contentType: saved.contentType, bytes: saved.bytes };
  }
}
