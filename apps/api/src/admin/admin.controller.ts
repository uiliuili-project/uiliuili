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
  adminCommentQuerySchema,
  adminDanmakuQuerySchema,
  adminReportQuerySchema,
  adminUserQuerySchema,
  adminUserUpdateSchema,
  adminVideoQuerySchema,
  adminVideoUpdateSchema,
  announcementCreateSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  jobQuerySchema,
  moderationActionSchema,
  ownerTransferSchema,
  settingsUpdateSchema,
} from '@uiliuili/shared';
import { z } from 'zod';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser, RequireAnyPermission, RequirePermissions } from '../common/decorators';
import { zodBody, zodQuery } from '../common/zod';
import { AdminService } from './admin.service';

const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().max(100).optional(),
});

const moderationLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  decision: z.enum(['allow', 'reject', 'pending', 'flag']).optional(),
  targetType: z.enum(['comment', 'dynamic']).optional(),
});

const moderationTestSchema = z.object({
  content: z.string().min(1).max(10_000),
});

const appealQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'accepted', 'rejected']).optional(),
  q: z.string().max(100).optional(),
});

const appealHandleSchema = z.object({
  status: z.enum(['accepted', 'rejected']),
  note: z.string().max(500).optional(),
});

const oauthSchema = z.object({
  enabled: z.boolean().default(false),
  clientId: z.string().default(''),
  clientSecret: z.string().default(''),
  issuer: z.string().default(''),
  scopes: z.array(z.string()).default([]),
});

@Controller('api/v1/admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  @RequirePermissions('audit:read')
  async dashboard() {
    return this.admin.dashboard();
  }

  @Get('users')
  @RequirePermissions('user:view')
  async users(@Query(zodQuery(adminUserQuerySchema)) query: z.infer<typeof adminUserQuerySchema>) {
    return this.admin.listUsers(query);
  }

  @Patch('users/:id')
  @RequirePermissions('user:moderate')
  async updateUser(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(adminUserUpdateSchema)) body: z.infer<typeof adminUserUpdateSchema>,
  ) {
    return this.admin.updateUser(actor, id, body);
  }

  @Delete('users/:id')
  @RequirePermissions('user:moderate')
  async deleteUser(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.admin.deleteUser(actor, id);
  }

  @Post('owner/transfer')
  @RequirePermissions('owner:transfer')
  async transferOwner(
    @CurrentUser() actor: AuthUser,
    @Body(zodBody(ownerTransferSchema)) body: z.infer<typeof ownerTransferSchema>,
  ) {
    return this.admin.transferOwner(actor, body.userId, body.password);
  }

  @Get('videos')
  @RequirePermissions('video:manage_any')
  async videos(
    @Query(zodQuery(adminVideoQuerySchema)) query: z.infer<typeof adminVideoQuerySchema>,
  ) {
    return this.admin.listVideos(query);
  }

  @Patch('videos/:id')
  @RequirePermissions('video:manage_any')
  async updateVideo(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(adminVideoUpdateSchema)) body: z.infer<typeof adminVideoUpdateSchema>,
  ) {
    return this.admin.updateVideo(actor, id, body);
  }

  @Get('appeals')
  @RequirePermissions('video:manage_any')
  async appeals(@Query(zodQuery(appealQuerySchema)) query: z.infer<typeof appealQuerySchema>) {
    return this.admin.listAppeals(query);
  }

  @Post('appeals/:id/handle')
  @RequirePermissions('video:manage_any')
  async handleAppeal(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(appealHandleSchema)) body: z.infer<typeof appealHandleSchema>,
  ) {
    return this.admin.handleAppeal(actor, id, body);
  }

  @Get('danmaku')
  @RequirePermissions('danmaku:manage')
  async danmaku(
    @Query(zodQuery(adminDanmakuQuerySchema)) query: z.infer<typeof adminDanmakuQuerySchema>,
  ) {
    return this.admin.listDanmaku(query);
  }

  @Post('danmaku/:id/moderate')
  @RequirePermissions('danmaku:manage')
  async moderateDanmaku(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(moderationActionSchema)) body: z.infer<typeof moderationActionSchema>,
  ) {
    return this.admin.moderateDanmaku(actor.id, id, body.action);
  }

  @Get('comments')
  @RequirePermissions('comment:manage')
  async comments(
    @Query(zodQuery(adminCommentQuerySchema)) query: z.infer<typeof adminCommentQuerySchema>,
  ) {
    return this.admin.listComments(query);
  }

  @Post('comments/:id/moderate')
  @RequirePermissions('comment:manage')
  async moderateComment(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(moderationActionSchema)) body: z.infer<typeof moderationActionSchema>,
  ) {
    return this.admin.moderateComment(actor.id, id, body.action);
  }

  @Get('moderation/logs')
  @RequirePermissions('comment:manage')
  async moderationLogs(
    @Query(zodQuery(moderationLogQuerySchema)) query: z.infer<typeof moderationLogQuerySchema>,
  ) {
    return this.admin.listModerationLogs(query);
  }

  @Post('moderation/test')
  @RequirePermissions('settings:integration')
  async testModeration(
    @Body(zodBody(moderationTestSchema)) body: z.infer<typeof moderationTestSchema>,
  ) {
    return this.admin.testModeration(body.content);
  }

  @Get('reports')
  @RequirePermissions('report:manage')
  async reports(
    @Query(zodQuery(adminReportQuerySchema)) query: z.infer<typeof adminReportQuerySchema>,
  ) {
    return this.admin.listReports(query);
  }

  @Post('reports/:id/handle')
  @RequirePermissions('report:manage')
  async handleReport(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(moderationActionSchema)) body: z.infer<typeof moderationActionSchema>,
  ) {
    return this.admin.handleReport(actor.id, id, body);
  }

  @Get('categories')
  @RequirePermissions('category:manage')
  async categories() {
    return { items: await this.admin.listCategories() };
  }

  @Post('categories')
  @RequirePermissions('category:manage')
  async createCategory(
    @CurrentUser() actor: AuthUser,
    @Body(zodBody(categoryCreateSchema)) body: z.infer<typeof categoryCreateSchema>,
  ) {
    return this.admin.createCategory(actor.id, body);
  }

  @Patch('categories/:id')
  @RequirePermissions('category:manage')
  async updateCategory(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(categoryUpdateSchema)) body: z.infer<typeof categoryUpdateSchema>,
  ) {
    return this.admin.updateCategory(actor.id, id, body);
  }

  @Delete('categories/:id')
  @RequirePermissions('category:manage')
  async deleteCategory(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.admin.deleteCategory(actor.id, id);
  }

  @Get('tags')
  @RequirePermissions('category:manage')
  async tags() {
    return { items: await this.admin.listTags() };
  }

  @Get('settings')
  @RequireAnyPermission(
    'settings:site',
    'settings:content',
    'settings:integration',
    'settings:security',
  )
  async settings(@CurrentUser() actor: AuthUser) {
    return this.admin.getSettings(actor);
  }

  @Post('site/logo')
  @RequirePermissions('settings:site')
  async uploadLogo(
    @CurrentUser() actor: AuthUser,
    @Body() body: Buffer,
    @Headers('content-type') contentType?: string,
  ) {
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body ?? []);
    return this.admin.uploadLogo(
      actor.id,
      buffer,
      (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '',
    );
  }

  @Put('settings')
  @RequireAnyPermission(
    'settings:site',
    'settings:content',
    'settings:integration',
    'settings:security',
  )
  async updateSettings(
    @CurrentUser() actor: AuthUser,
    @Body(zodBody(settingsUpdateSchema)) body: z.infer<typeof settingsUpdateSchema>,
  ) {
    return this.admin.updateSettings(actor, body.patches);
  }

  @Put('oauth/:provider')
  @RequirePermissions('settings:integration')
  async updateOAuth(
    @CurrentUser() actor: AuthUser,
    @Param('provider') provider: string,
    @Body(zodBody(oauthSchema)) body: z.infer<typeof oauthSchema>,
  ) {
    return this.admin.updateOAuth(actor.id, provider, body);
  }

  @Get('system')
  @RequirePermissions('system:view')
  async system() {
    return this.admin.system();
  }

  @Get('system/update')
  @RequirePermissions('system:view')
  async checkUpdate() {
    return this.admin.checkUpdate();
  }

  @Get('system/upgrade')
  @RequirePermissions('system:view')
  async upgradeStatus() {
    return this.admin.upgradeStatus();
  }

  @Post('system/upgrade/backup')
  @RequirePermissions('system:update')
  async createBackup(@CurrentUser() actor: AuthUser) {
    return this.admin.createBackup(actor.id);
  }

  @Post('system/upgrade')
  @RequirePermissions('system:update')
  async applyUpgrade(
    @CurrentUser() actor: AuthUser,
    @Body() body: { confirm?: string; backup?: boolean },
  ) {
    return this.admin.applyUpgrade(actor.id, String(body.confirm ?? ''), body.backup !== false);
  }

  @Post('system/maintenance')
  @RequirePermissions('system:update')
  async setMaintenance(@CurrentUser() actor: AuthUser, @Body() body: { enabled?: boolean }) {
    return this.admin.setMaintenance(actor.id, Boolean(body.enabled));
  }

  @Get('jobs')
  @RequirePermissions('system:view')
  async jobs(@Query(zodQuery(jobQuerySchema)) query: z.infer<typeof jobQuerySchema>) {
    return this.admin.listJobs(query);
  }

  @Post('jobs/:id/retry')
  @RequirePermissions('system:operate')
  async retryJob(@Param('id') id: string) {
    return this.admin.retryJob(id);
  }

  @Post('jobs/:id/cancel')
  @RequirePermissions('system:operate')
  async cancelJob(@Param('id') id: string) {
    return this.admin.cancelJob(id);
  }

  @Get('audit')
  @RequirePermissions('audit:read')
  async audit(@Query(zodQuery(auditQuerySchema)) query: z.infer<typeof auditQuerySchema>) {
    return this.admin.listAudit(query);
  }

  @Get('announcements')
  @RequirePermissions('announcement:manage')
  async announcements() {
    return { items: await this.admin.listAnnouncements() };
  }

  @Post('announcements')
  @RequirePermissions('announcement:manage')
  async createAnnouncement(
    @CurrentUser() actor: AuthUser,
    @Body(zodBody(announcementCreateSchema)) body: z.infer<typeof announcementCreateSchema>,
  ) {
    return this.admin.createAnnouncement(actor.id, body);
  }

  @Patch('announcements/:id')
  @RequirePermissions('announcement:manage')
  async updateAnnouncement(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(announcementCreateSchema.partial())) body: z.infer<
      typeof announcementCreateSchema
    >,
  ) {
    return this.admin.updateAnnouncement(actor.id, id, body);
  }

  @Delete('announcements/:id')
  @RequirePermissions('announcement:manage')
  async deleteAnnouncement(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.admin.deleteAnnouncement(actor.id, id);
  }

  @Post('search/reindex')
  @RequirePermissions('system:operate')
  async reindex() {
    return this.admin.reindex();
  }
}
