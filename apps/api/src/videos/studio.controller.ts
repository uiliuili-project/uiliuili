import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  presignPartsSchema,
  publishVideoSchema,
  recordPartSchema,
  uploadInitSchema,
  videoCreateSchema,
  videoUpdateSchema,
} from '@uiliuili/shared';
import { z } from 'zod';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { zodBody, zodQuery } from '../common/zod';
import { StudioService } from './studio.service';

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const subtitleSchema = z.object({
  language: z
    .string()
    .min(2)
    .max(16)
    .regex(/^[a-zA-Z0-9-]+$/),
  label: z.string().min(1).max(40),
  content: z.string().min(1).max(5_000_000),
});

const completeSchema = z.object({
  parts: z
    .array(z.object({ partNumber: z.number().int().positive(), etag: z.string().min(1) }))
    .optional(),
});

@Controller('api/v1/studio')
export class StudioController {
  constructor(private readonly studio: StudioService) {}

  @Get('videos')
  @RequirePermissions('video:upload')
  async list(
    @CurrentUser() user: AuthUser,
    @Query(zodQuery(listSchema)) query: z.infer<typeof listSchema>,
  ) {
    return this.studio.list(user.id, query.page, query.limit);
  }

  @Post('videos')
  @RequirePermissions('video:upload')
  async create(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(videoCreateSchema)) body: z.infer<typeof videoCreateSchema>,
  ) {
    return this.studio.create(user.id, body);
  }

  @Get('videos/:id')
  @RequirePermissions('video:upload')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.studio.get(user.id, id);
  }

  @Patch('videos/:id')
  @RequirePermissions('video:upload')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(videoUpdateSchema)) body: z.infer<typeof videoUpdateSchema>,
  ) {
    return this.studio.update(user.id, id, body);
  }

  @Delete('videos/:id')
  @RequirePermissions('video:upload')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.studio.remove(user.id, id);
  }

  @Post('videos/:id/upload')
  @RequirePermissions('video:upload')
  async initUpload(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(uploadInitSchema)) body: z.infer<typeof uploadInitSchema>,
  ) {
    return this.studio.initUpload(user.id, id, body);
  }

  @Post('uploads/:uploadId/parts/presign')
  @RequirePermissions('video:upload')
  async presign(
    @CurrentUser() user: AuthUser,
    @Param('uploadId') uploadId: string,
    @Body(zodBody(presignPartsSchema)) body: z.infer<typeof presignPartsSchema>,
  ) {
    return this.studio.presignParts(user.id, uploadId, body.partNumbers);
  }

  @Put('uploads/:uploadId/parts/:partNumber')
  @RequirePermissions('video:upload')
  async putPart(
    @CurrentUser() user: AuthUser,
    @Param('uploadId') uploadId: string,
    @Param('partNumber') partNumber: string,
    @Body() body: Buffer,
  ) {
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body ?? []);
    return this.studio.putLocalPart(user.id, uploadId, Number(partNumber), buffer);
  }

  @Post('uploads/:uploadId/parts')
  @RequirePermissions('video:upload')
  async recordPart(
    @CurrentUser() user: AuthUser,
    @Param('uploadId') uploadId: string,
    @Body(zodBody(recordPartSchema)) body: z.infer<typeof recordPartSchema>,
  ) {
    return this.studio.recordPart(user.id, uploadId, body.partNumber, body.etag, body.size);
  }

  @Post('uploads/:uploadId/complete')
  @RequirePermissions('video:upload')
  async complete(
    @CurrentUser() user: AuthUser,
    @Param('uploadId') uploadId: string,
    @Body(zodBody(completeSchema)) body: z.infer<typeof completeSchema>,
  ) {
    return this.studio.completeUpload(user.id, uploadId, body.parts);
  }

  @Post('videos/:id/publish')
  @RequirePermissions('video:upload')
  async publish(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(publishVideoSchema)) body: z.infer<typeof publishVideoSchema>,
  ) {
    return this.studio.publish(user, id, body.publishAt);
  }

  @Post('videos/:id/subtitles')
  @RequirePermissions('video:upload')
  async subtitle(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(subtitleSchema)) body: z.infer<typeof subtitleSchema>,
  ) {
    return this.studio.setSubtitle(user.id, id, body.language, body.label, body.content);
  }

  @Put('videos/:id/cover')
  @RequirePermissions('video:upload')
  async cover(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: Buffer,
    @Headers('content-type') contentType: string,
  ) {
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body ?? []);
    return this.studio.setCover(user.id, id, buffer, contentType.split(';')[0] ?? contentType);
  }
}
