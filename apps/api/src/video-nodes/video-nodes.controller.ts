import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { zodBody, zodQuery } from '../common/zod';
import { VideoNodesService } from './video-nodes.service';

const regionSchema = z.string().trim().toUpperCase().max(8);

const nodeCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  baseUrl: z.string().trim().url().max(500),
  keyId: z.string().trim().max(64).optional(),
  secret: z.string().trim().min(1).max(500),
  enabled: z.boolean().optional(),
  region: regionSchema.optional(),
  regions: z.array(regionSchema).max(100).optional(),
  weight: z.number().int().min(1).max(1000).optional(),
  maxConcurrency: z.number().int().min(1).max(64).optional(),
});

const nodeUpdateSchema = nodeCreateSchema.partial().extend({
  keyId: z.string().trim().max(64).optional(),
  secret: z.string().trim().max(500).optional(),
});

const replicateSchema = z.object({
  targetNodeId: z.string().uuid(),
});

const assetQuerySchema = z.object({
  videoId: z.string().uuid().optional(),
});

@Controller('admin/video-nodes')
@RequirePermissions('video_node:manage')
export class VideoNodesController {
  constructor(private readonly nodes: VideoNodesService) {}

  @Get()
  async list() {
    return this.nodes.list();
  }

  @Get('summary')
  async summary() {
    return this.nodes.summary();
  }

  @Get('assets')
  async assets(@Query(zodQuery(assetQuerySchema)) query: z.infer<typeof assetQuerySchema>) {
    return this.nodes.listAssets(query.videoId);
  }

  @Get('replication-jobs')
  async replicationJobs() {
    return this.nodes.listReplicationJobs();
  }

  @Post()
  async create(
    @CurrentUser() actor: AuthUser,
    @Body(zodBody(nodeCreateSchema)) body: z.infer<typeof nodeCreateSchema>,
  ) {
    return this.nodes.create(actor, body);
  }

  @Patch(':id')
  async update(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(nodeUpdateSchema)) body: z.infer<typeof nodeUpdateSchema>,
  ) {
    return this.nodes.update(actor, id, body);
  }

  @Delete(':id')
  async remove(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.nodes.remove(actor, id);
  }

  @Post(':id/test')
  async test(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.nodes.test(actor, id);
  }

  @Post('assets/:assetId/replicas')
  async replicate(
    @CurrentUser() actor: AuthUser,
    @Param('assetId') assetId: string,
    @Body(zodBody(replicateSchema)) body: z.infer<typeof replicateSchema>,
  ) {
    return this.nodes.createReplicationJob(actor, assetId, body.targetNodeId);
  }

  @Post('replication-jobs/:id/retry')
  async retry(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.nodes.retryReplicationJob(actor, id);
  }

  @Post('sync')
  async sync() {
    await this.nodes.syncAssets(200);
    return { ok: true };
  }
}
