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
  Req,
} from '@nestjs/common';
import {
  collaboratorInviteSchema,
  collectionCreateSchema,
  collectionItemSchema,
  collectionUpdateSchema,
  presignPartsSchema,
  publishVideoSchema,
  recordPartSchema,
  uploadInitSchema,
  videoAppealCreateSchema,
  videoCreateSchema,
  videoPartCreateSchema,
  videoPartUpdateSchema,
  videoUpdateSchema,
} from '@uiliuili/shared';
import type { FastifyRequest } from 'fastify';
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

const analyticsSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

const inboxSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(['visible', 'hidden', 'pending', 'deleted']).optional(),
});

const moderateSchema = z.object({
  action: z.enum(['hide', 'visible', 'delete']),
});

const respondSchema = z.object({
  accept: z.boolean(),
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
    @Req() request: FastifyRequest,
  ) {
    return this.studio.create(user.id, body, request.ip);
  }

  @Get('videos/trash')
  @RequirePermissions('video:upload')
  async trash(
    @CurrentUser() user: AuthUser,
    @Query(zodQuery(listSchema)) query: z.infer<typeof listSchema>,
  ) {
    return this.studio.listDeleted(user.id, query.page, query.limit);
  }

  @Get('videos/:id')
  @RequirePermissions('video:upload')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.studio.get(user.id, id);
  }

  @Post('videos/:id/restore')
  @RequirePermissions('video:upload')
  async restore(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.studio.restore(user.id, id);
  }

  @Delete('videos/:id/purge')
  @RequirePermissions('video:upload')
  async purge(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.studio.purge(user.id, id);
  }

  @Get('videos/:id/history')
  @RequirePermissions('video:upload')
  async history(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.studio.history(user.id, id);
  }

  @Get('appeals')
  @RequirePermissions('video:upload')
  async appeals(
    @CurrentUser() user: AuthUser,
    @Query(zodQuery(listSchema)) query: z.infer<typeof listSchema>,
  ) {
    return this.studio.listAppeals(user.id, query.page, query.limit);
  }

  @Post('videos/:id/appeals')
  @RequirePermissions('video:upload')
  async createAppeal(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(videoAppealCreateSchema)) body: z.infer<typeof videoAppealCreateSchema>,
  ) {
    return this.studio.createAppeal(user.id, id, body);
  }

  @Get('analytics')
  @RequirePermissions('video:upload')
  async analytics(
    @CurrentUser() user: AuthUser,
    @Query(zodQuery(analyticsSchema)) query: z.infer<typeof analyticsSchema>,
  ) {
    return this.studio.analytics(user.id, query.days);
  }

  @Get('comments')
  @RequirePermissions('video:upload')
  async comments(
    @CurrentUser() user: AuthUser,
    @Query(zodQuery(inboxSchema)) query: z.infer<typeof inboxSchema>,
  ) {
    return this.studio.commentsInbox(user.id, query);
  }

  @Post('comments/:id/moderate')
  @RequirePermissions('video:upload')
  async moderateComment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(moderateSchema)) body: z.infer<typeof moderateSchema>,
  ) {
    return this.studio.moderateComment(user.id, id, body.action);
  }

  @Get('danmaku')
  @RequirePermissions('video:upload')
  async danmaku(
    @CurrentUser() user: AuthUser,
    @Query(zodQuery(inboxSchema)) query: z.infer<typeof inboxSchema>,
  ) {
    return this.studio.danmakuInbox(user.id, query);
  }

  @Post('danmaku/:id/moderate')
  @RequirePermissions('video:upload')
  async moderateDanmaku(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(moderateSchema)) body: z.infer<typeof moderateSchema>,
  ) {
    return this.studio.moderateDanmaku(user.id, id, body.action);
  }

  @Get('collections')
  @RequirePermissions('video:upload')
  async collections(@CurrentUser() user: AuthUser) {
    return this.studio.listCollections(user.id);
  }

  @Post('collections')
  @RequirePermissions('video:upload')
  async createCollection(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(collectionCreateSchema)) body: z.infer<typeof collectionCreateSchema>,
  ) {
    return this.studio.createCollection(user.id, body);
  }

  @Patch('collections/:id')
  @RequirePermissions('video:upload')
  async updateCollection(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(collectionUpdateSchema)) body: z.infer<typeof collectionUpdateSchema>,
  ) {
    return this.studio.updateCollection(user.id, id, body);
  }

  @Delete('collections/:id')
  @RequirePermissions('video:upload')
  async deleteCollection(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.studio.deleteCollection(user.id, id);
  }

  @Get('collections/:id/items')
  @RequirePermissions('video:upload')
  async collectionItems(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.studio.collectionItems(user.id, id);
  }

  @Post('collections/:id/items')
  @RequirePermissions('video:upload')
  async addCollectionItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(collectionItemSchema)) body: z.infer<typeof collectionItemSchema>,
  ) {
    return this.studio.addCollectionItem(user.id, id, body.videoId);
  }

  @Delete('collections/:id/items/:videoId')
  @RequirePermissions('video:upload')
  async removeCollectionItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('videoId') videoId: string,
  ) {
    return this.studio.removeCollectionItem(user.id, id, videoId);
  }

  @Get('fans')
  @RequirePermissions('video:upload')
  async fans(@CurrentUser() user: AuthUser) {
    return this.studio.fans(user.id);
  }

  @Get('growth')
  @RequirePermissions('video:upload')
  async growth(@CurrentUser() user: AuthUser) {
    return this.studio.growth(user.id);
  }

  @Get('collaborations')
  @RequirePermissions('video:upload')
  async collaborations(@CurrentUser() user: AuthUser) {
    return this.studio.myCollaborations(user.id);
  }

  @Get('videos/:id/collaborators')
  @RequirePermissions('video:upload')
  async collaborators(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.studio.collaborators(user.id, id);
  }

  @Post('videos/:id/collaborators')
  @RequirePermissions('video:upload')
  async inviteCollaborator(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(collaboratorInviteSchema)) body: z.infer<typeof collaboratorInviteSchema>,
  ) {
    return this.studio.inviteCollaborator(user.id, id, body.username, body.role);
  }

  @Delete('videos/:id/collaborators/:userId')
  @RequirePermissions('video:upload')
  async removeCollaborator(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') collaboratorId: string,
  ) {
    return this.studio.removeCollaborator(user.id, id, collaboratorId);
  }

  @Post('collaborations/:videoId/respond')
  @RequirePermissions('video:upload')
  async respondCollaboration(
    @CurrentUser() user: AuthUser,
    @Param('videoId') videoId: string,
    @Body(zodBody(respondSchema)) body: z.infer<typeof respondSchema>,
  ) {
    return this.studio.respondCollaboration(user.id, videoId, body.accept);
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

  @Get('videos/:id/parts')
  @RequirePermissions('video:upload')
  async listParts(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.studio.listParts(user.id, id);
  }

  @Post('videos/:id/parts')
  @RequirePermissions('video:upload')
  async createPart(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(videoPartCreateSchema)) body: z.infer<typeof videoPartCreateSchema>,
  ) {
    return this.studio.createPart(user.id, id, body);
  }

  @Patch('videos/:id/parts/:partId')
  @RequirePermissions('video:upload')
  async updatePart(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('partId') partId: string,
    @Body(zodBody(videoPartUpdateSchema)) body: z.infer<typeof videoPartUpdateSchema>,
  ) {
    return this.studio.updatePart(user.id, id, partId, body);
  }

  @Delete('videos/:id/parts/:partId')
  @RequirePermissions('video:upload')
  async removePart(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('partId') partId: string,
  ) {
    return this.studio.removePart(user.id, id, partId);
  }

  @Get('videos/:id/subtitles')
  @RequirePermissions('video:upload')
  async listSubtitles(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.studio.listSubtitles(user.id, id);
  }

  @Delete('videos/:id/subtitles/:language')
  @RequirePermissions('video:upload')
  async removeSubtitle(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('language') language: string,
  ) {
    return this.studio.removeSubtitle(user.id, id, language);
  }

  @Get('videos/:id/stats')
  @RequirePermissions('video:upload')
  async stats(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.studio.stats(user.id, id);
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
