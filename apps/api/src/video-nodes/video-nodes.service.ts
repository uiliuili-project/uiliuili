import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import {
  decryptSecret,
  encryptSecret,
  videoNodeAssets,
  videoNodeReplicationJobs,
  videoNodeUploadLeases,
  videoNodes,
  videoParts,
  videoRenditions,
  videos,
} from '@uiliuili/db';
import {
  AppError,
  DEFAULT_SETTINGS,
  ERROR_CODES,
  type VideoNodeRoutingMode,
} from '@uiliuili/shared';
import {
  type AssetStatus,
  type CreateAssetResponse,
  type NodeInfo,
  type PlaybackSignResponse,
} from '@uiliuili/video-node-contract';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { AuditService } from '../common/audit.service';
import type { AuthUser } from '../common/auth-user';
import { DatabaseService } from '../common/database.service';
import { currentRegionContext } from '../common/region-context';
import { SettingsService } from '../common/settings.service';
import { config } from '../config';
import { VideoNodeClient, VideoNodeHttpError } from './video-node.client';

type NodeRow = typeof videoNodes.$inferSelect;
type NodeAssetRow = typeof videoNodeAssets.$inferSelect;

export interface VideoNodeInput {
  name: string;
  baseUrl: string;
  keyId?: string;
  secret?: string;
  enabled?: boolean;
  region?: string;
  regions?: string[];
  weight?: number;
  maxConcurrency?: number;
}

export interface RemoteUploadStart {
  nodeId: string;
  nodeName: string;
  nodeBaseUrl: string;
  remoteUploadId: string;
  remoteAssetId: string;
  uploadToken: string;
  partSize: number;
  totalParts: number;
  expiresAt: Date;
}

export interface SignedRemotePlayback extends PlaybackSignResponse {
  nodeId: string;
  nodeName: string;
  storageMode: 'remote';
}

export interface RemoteUploadTarget {
  videoId: string;
  partId: string | null;
  filename: string;
  size: number;
  contentType: string;
  region?: string;
}

/** Rows exposed to the admin console; secrets are never included. */
function publicNode(node: NodeRow) {
  return {
    id: node.id,
    name: node.name,
    baseUrl: node.baseUrl,
    keyId: node.keyId,
    enabled: node.enabled,
    region: node.region,
    regions: node.regions,
    weight: node.weight,
    maxConcurrency: node.maxConcurrency,
    status: node.status,
    version: node.version,
    storageUsedBytes: Number(node.storageUsedBytes),
    storageCapacityBytes: Number(node.storageCapacityBytes),
    lastSeenAt: node.lastSeenAt?.toISOString() ?? null,
    lastError: node.lastError,
    hasSecret: Boolean(node.secretEncrypted),
    createdAt: node.createdAt.toISOString(),
    updatedAt: node.updatedAt.toISOString(),
  };
}

@Injectable()
export class VideoNodesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VideoNodesService.name);
  private timer: NodeJS.Timeout | null = null;
  private sweeping = false;

  constructor(
    private readonly database: DatabaseService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.sweep(), 12_000);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async settingsGroup() {
    return this.settings.getGroup('videoNodes', DEFAULT_SETTINGS.videoNodes);
  }

  private decrypt(node: NodeRow): string {
    try {
      return decryptSecret<string>(node.secretEncrypted, config.appKey);
    } catch {
      throw new AppError(ERROR_CODES.INTERNAL_ERROR, '视频节点密钥无法解密', 500);
    }
  }

  private client(node: NodeRow): VideoNodeClient {
    return new VideoNodeClient({
      id: node.id,
      baseUrl: node.baseUrl,
      keyId: node.keyId,
      secret: this.decrypt(node),
    });
  }

  async list() {
    const rows = await this.database.db.select().from(videoNodes).orderBy(videoNodes.name);
    return { items: rows.map(publicNode) };
  }

  async get(id: string): Promise<NodeRow> {
    const [row] = await this.database.db
      .select()
      .from(videoNodes)
      .where(eq(videoNodes.id, id))
      .limit(1);
    if (!row) throw new AppError(ERROR_CODES.NOT_FOUND, '视频节点不存在', 404);
    return row;
  }

  async create(actor: AuthUser, input: VideoNodeInput) {
    if (!input.secret) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '请填写节点密钥', 400);
    }
    this.assertUrl(input.baseUrl);
    const [created] = await this.database.db
      .insert(videoNodes)
      .values({
        name: input.name.trim().slice(0, 80),
        baseUrl: input.baseUrl.trim().replace(/\/$/, ''),
        keyId: (input.keyId ?? 'default').trim().slice(0, 64),
        secretEncrypted: encryptSecret(input.secret, config.appKey),
        enabled: input.enabled ?? true,
        region: (input.region ?? '').toUpperCase().slice(0, 8),
        regions: this.normalizeRegions(input.regions, input.region),
        weight: input.weight ?? 100,
        maxConcurrency: input.maxConcurrency ?? 2,
      })
      .returning();
    if (!created) throw new AppError(ERROR_CODES.INTERNAL_ERROR, '创建视频节点失败', 500);
    await this.audit.record({
      actorId: actor.id,
      action: 'admin.video_node.create',
      targetType: 'video_node',
      targetId: created.id,
      after: { name: created.name, baseUrl: created.baseUrl, region: created.region },
    });
    return publicNode(created);
  }

  async update(actor: AuthUser, id: string, input: Partial<VideoNodeInput>) {
    const existing = await this.get(id);
    if (input.baseUrl) this.assertUrl(input.baseUrl);
    const regions =
      input.regions !== undefined || input.region !== undefined
        ? this.normalizeRegions(input.regions ?? existing.regions, input.region ?? existing.region)
        : undefined;
    const [updated] = await this.database.db
      .update(videoNodes)
      .set({
        name: input.name?.trim().slice(0, 80),
        baseUrl: input.baseUrl?.trim().replace(/\/$/, ''),
        keyId: input.keyId?.trim().slice(0, 64),
        secretEncrypted: input.secret ? encryptSecret(input.secret, config.appKey) : undefined,
        enabled: input.enabled,
        region: input.region?.toUpperCase().slice(0, 8),
        regions,
        weight: input.weight,
        maxConcurrency: input.maxConcurrency,
        updatedAt: new Date(),
      })
      .where(eq(videoNodes.id, id))
      .returning();
    if (!updated) throw new AppError(ERROR_CODES.NOT_FOUND, '视频节点不存在', 404);
    await this.audit.record({
      actorId: actor.id,
      action: 'admin.video_node.update',
      targetType: 'video_node',
      targetId: id,
      before: { name: existing.name, enabled: existing.enabled },
      after: { name: updated.name, enabled: updated.enabled, secretRotated: Boolean(input.secret) },
    });
    return publicNode(updated);
  }

  async remove(actor: AuthUser, id: string) {
    const existing = await this.get(id);
    await this.database.db.delete(videoNodes).where(eq(videoNodes.id, id));
    await this.audit.record({
      actorId: actor.id,
      action: 'admin.video_node.delete',
      targetType: 'video_node',
      targetId: id,
      before: { name: existing.name, baseUrl: existing.baseUrl },
    });
    return { ok: true };
  }

  async test(actor: AuthUser, id: string) {
    const node = await this.get(id);
    const started = Date.now();
    try {
      const info = await this.client(node).request<NodeInfo>('GET', '/api/v1/node/info');
      await this.database.db
        .update(videoNodes)
        .set({
          status: info.status === 'degraded' ? 'degraded' : 'online',
          version: info.version,
          storageUsedBytes: Math.round(info.storage.usedBytes),
          storageCapacityBytes: Math.round(info.storage.capacityBytes),
          lastSeenAt: new Date(),
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(videoNodes.id, id));
      await this.audit.record({
        actorId: actor.id,
        action: 'admin.video_node.test',
        targetType: 'video_node',
        targetId: id,
        after: { ok: true, latencyMs: Date.now() - started },
      });
      return { ok: true, latencyMs: Date.now() - started, info };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.database.db
        .update(videoNodes)
        .set({ status: 'offline', lastError: message.slice(0, 500), updatedAt: new Date() })
        .where(eq(videoNodes.id, id));
      await this.audit.record({
        actorId: actor.id,
        action: 'admin.video_node.test',
        targetType: 'video_node',
        targetId: id,
        after: { ok: false, error: message.slice(0, 500) },
      });
      return { ok: false, latencyMs: Date.now() - started, error: message };
    }
  }

  /** Picks a node for a new upload under the configured strategy. */
  async pickNode(region?: string): Promise<NodeRow | null> {
    const group = await this.settingsGroup();
    if (!group.enabled) return null;
    const rows = await this.database.db
      .select()
      .from(videoNodes)
      .where(and(eq(videoNodes.enabled, true), sql`${videoNodes.status} <> 'offline'`));
    if (rows.length === 0) {
      if (group.uploadStrategy === 'fixed') {
        throw new AppError(ERROR_CODES.BAD_REQUEST, '固定上传节点不可用', 503);
      }
      return null;
    }
    const strategy = group.uploadStrategy as VideoNodeRoutingMode;
    if (strategy === 'fixed') {
      const fixed = rows.find((node) => node.id === group.fixedNodeId);
      if (!fixed) {
        throw new AppError(ERROR_CODES.BAD_REQUEST, '固定上传节点不可用', 503);
      }
      return fixed;
    }
    if (strategy === 'region') {
      const country = (region ?? currentRegionContext().code ?? '').toUpperCase();
      const mapped = country ? group.regionMap[country] : undefined;
      const mappedNode = mapped ? rows.find((node) => node.id === mapped) : undefined;
      if (mappedNode) return mappedNode;
      const regional = rows.find(
        (node) => node.region === country || node.regions.includes(country),
      );
      if (regional) return regional;
    }
    // Least loaded, weighted so a heavier node takes proportionally more.
    return [...rows].sort((left, right) => {
      const leftScore = Number(left.storageUsedBytes) / Math.max(1, left.weight);
      const rightScore = Number(right.storageUsedBytes) / Math.max(1, right.weight);
      if (leftScore !== rightScore) return leftScore - rightScore;
      return left.name.localeCompare(right.name);
    })[0]!;
  }

  async beginRemoteUpload(input: RemoteUploadTarget): Promise<RemoteUploadStart | null> {
    const group = await this.settingsGroup();
    const node = await this.pickNode(input.region);
    if (!node) return null;
    const uploadSettings = await this.settings.getUploadSettings();
    let created: CreateAssetResponse;
    try {
      created = await this.client(node).request<CreateAssetResponse>(
        'POST',
        '/api/v1/node/assets',
        {
          filename: input.filename,
          size: input.size,
          contentType: input.contentType,
          profile: 'auto',
          constraints: {
            maxHeight: Number(uploadSettings.maxResolution) || 1080,
            maxDurationSeconds: Number(uploadSettings.maxDurationSeconds) || 14_400,
          },
          metadata: {
            siteVideoId: input.videoId,
            ...(input.partId ? { partId: input.partId } : {}),
          },
        },
      );
    } catch (error) {
      await this.database.db
        .update(videoNodes)
        .set({
          status: 'degraded',
          lastError: (error instanceof Error ? error.message : String(error)).slice(0, 500),
          updatedAt: new Date(),
        })
        .where(eq(videoNodes.id, node.id));
      if (group.uploadStrategy === 'fixed') {
        throw new AppError(ERROR_CODES.BAD_REQUEST, '固定上传节点不可用', 503);
      }
      throw error;
    }
    await this.database.db
      .update(videoNodes)
      .set({ status: 'online', lastSeenAt: new Date(), updatedAt: new Date() })
      .where(eq(videoNodes.id, node.id));
    return {
      nodeId: node.id,
      nodeName: node.name,
      nodeBaseUrl: created.publicUrl || node.baseUrl,
      remoteUploadId: created.uploadId,
      remoteAssetId: created.assetId,
      uploadToken: created.uploadToken,
      partSize: created.partSize,
      totalParts: created.totalParts,
      expiresAt: new Date(created.expiresAt),
    };
  }

  async completeRemoteUpload(input: {
    sessionId: string;
    videoId: string;
    partId: string | null;
    nodeId: string;
    remoteUploadId: string;
    remoteAssetId: string;
  }): Promise<AssetStatus> {
    const node = await this.get(input.nodeId);
    const status = await this.client(node).request<AssetStatus>(
      'POST',
      `/api/v1/node/uploads/${encodeURIComponent(input.remoteUploadId)}/complete`,
      {},
    );
    await this.database.db
      .update(videoNodeUploadLeases)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(videoNodeUploadLeases.uploadSessionId, input.sessionId));
    await this.database.db
      .insert(videoNodeAssets)
      .values({
        videoId: input.videoId,
        partId: input.partId,
        nodeId: input.nodeId,
        remoteAssetId: input.remoteAssetId,
        status: 'transcoding',
        isPrimary: true,
      })
      .onConflictDoUpdate({
        target: [videoNodeAssets.nodeId, videoNodeAssets.remoteAssetId],
        set: { status: 'transcoding', updatedAt: new Date() },
      });
    await this.database.db
      .update(videos)
      .set({
        storageMode: 'remote',
        primaryNodeId: input.nodeId,
        remoteAssetId: input.remoteAssetId,
        status: 'processing',
        updatedAt: new Date(),
      })
      .where(eq(videos.id, input.videoId));
    if (input.partId) {
      await this.database.db
        .update(videoParts)
        .set({
          storageMode: 'remote',
          primaryNodeId: input.nodeId,
          remoteAssetId: input.remoteAssetId,
          status: 'processing',
          updatedAt: new Date(),
        })
        .where(eq(videoParts.id, input.partId));
    }
    return status;
  }

  /** Returns the ready replicas for a video (or one part), region first. */
  private async replicaCandidates(videoId: string, partId: string | null): Promise<NodeAssetRow[]> {
    const rows = await this.database.db
      .select()
      .from(videoNodeAssets)
      .where(
        and(
          eq(videoNodeAssets.videoId, videoId),
          partId ? eq(videoNodeAssets.partId, partId) : isNull(videoNodeAssets.partId),
          eq(videoNodeAssets.status, 'ready'),
        ),
      )
      .orderBy(desc(videoNodeAssets.isPrimary));
    if (rows.length === 0) return [];
    const nodes = await this.database.db
      .select()
      .from(videoNodes)
      .where(
        inArray(
          videoNodes.id,
          rows.map((row) => row.nodeId),
        ),
      );
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const country = currentRegionContext().code.toUpperCase();
    return rows
      .filter((row) => byId.get(row.nodeId)?.enabled !== false)
      .sort((left, right) => {
        const regionScore = (row: NodeAssetRow) => {
          const node = byId.get(row.nodeId);
          if (!node || !country) return 0;
          return node.region === country || node.regions.includes(country) ? 2 : 0;
        };
        const diff = regionScore(right) - regionScore(left);
        if (diff !== 0) return diff;
        return Number(right.isPrimary) - Number(left.isPrimary);
      });
  }

  /** Signs a playback URL with the closest healthy replica. */
  async signPlayback(
    videoId: string,
    partId: string | null,
    ttlSeconds?: number,
  ): Promise<SignedRemotePlayback | null> {
    const candidates = await this.replicaCandidates(videoId, partId);
    if (candidates.length === 0) return null;
    const group = await this.settingsGroup();
    for (const candidate of candidates) {
      try {
        const node = await this.get(candidate.nodeId);
        const signed = await this.client(node).request<PlaybackSignResponse>(
          'POST',
          '/api/v1/node/playback/sign',
          {
            assetId: candidate.remoteAssetId,
            ttlSeconds: ttlSeconds ?? group.playbackTtlSeconds,
          },
        );
        return {
          ...signed,
          nodeId: node.id,
          nodeName: node.name,
          storageMode: 'remote',
        };
      } catch (error) {
        this.logger.warn(
          `Failed to sign playback on node ${candidate.nodeId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        if (error instanceof VideoNodeHttpError && error.status === 409) continue;
        // Try the next replica; an expired token or a node outage must not
        // break playback for every other node.
      }
    }
    return null;
  }

  /** Signs every ready part once, used by the video detail payload. */
  async signPartPlaylists(videoId: string, ttlSeconds?: number) {
    const rows = await this.database.db
      .select({ partId: videoNodeAssets.partId })
      .from(videoNodeAssets)
      .where(
        and(
          eq(videoNodeAssets.videoId, videoId),
          eq(videoNodeAssets.status, 'ready'),
          sql`${videoNodeAssets.partId} IS NOT NULL`,
        ),
      );
    const partIds = [...new Set(rows.map((row) => row.partId).filter(Boolean))] as string[];
    const entries: Array<readonly [string, SignedRemotePlayback]> = [];
    for (const partId of partIds) {
      const signed = await this.signPlayback(videoId, partId, ttlSeconds);
      if (signed) entries.push([partId, signed]);
    }
    return new Map(entries);
  }

  async summary() {
    const [nodes, byStatus, jobs] = await Promise.all([
      this.list(),
      this.database.db
        .select({ status: videoNodeAssets.status, value: sql<number>`count(*)` })
        .from(videoNodeAssets)
        .groupBy(videoNodeAssets.status),
      this.database.db
        .select({ status: videoNodeReplicationJobs.status, value: sql<number>`count(*)` })
        .from(videoNodeReplicationJobs)
        .groupBy(videoNodeReplicationJobs.status),
    ]);
    return {
      nodes: nodes.items,
      assets: Object.fromEntries(byStatus.map((row) => [row.status, Number(row.value)])),
      replication: Object.fromEntries(jobs.map((row) => [row.status, Number(row.value)])),
    };
  }

  async listAssets(videoId?: string) {
    const rows = await this.database.db
      .select({ asset: videoNodeAssets, nodeName: videoNodes.name })
      .from(videoNodeAssets)
      .innerJoin(videoNodes, eq(videoNodes.id, videoNodeAssets.nodeId))
      .where(videoId ? eq(videoNodeAssets.videoId, videoId) : sql`true`)
      .orderBy(desc(videoNodeAssets.createdAt))
      .limit(200);
    return {
      items: rows.map(({ asset, nodeName }) => ({
        id: asset.id,
        videoId: asset.videoId,
        partId: asset.partId,
        nodeId: asset.nodeId,
        nodeName,
        remoteAssetId: asset.remoteAssetId,
        status: asset.status,
        isPrimary: asset.isPrimary,
        durationSeconds: asset.durationSeconds,
        width: asset.width,
        height: asset.height,
        error: asset.error,
        createdAt: asset.createdAt.toISOString(),
        updatedAt: asset.updatedAt.toISOString(),
      })),
    };
  }

  async createReplicationJob(actor: AuthUser, assetId: string, targetNodeId: string) {
    const group = await this.settingsGroup();
    if (!group.replication.enabled) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '多节点副本功能未开启', 400);
    }
    const [asset] = await this.database.db
      .select()
      .from(videoNodeAssets)
      .where(eq(videoNodeAssets.id, assetId))
      .limit(1);
    if (!asset) throw new AppError(ERROR_CODES.NOT_FOUND, '远端资产不存在', 404);
    if (asset.status !== 'ready') {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '只有转码完成的资产可以复制', 400);
    }
    if (asset.nodeId === targetNodeId) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '目标节点与源节点相同', 400);
    }
    const copies = await this.database.db
      .select({ id: videoNodeAssets.id })
      .from(videoNodeAssets)
      .where(
        and(
          eq(videoNodeAssets.videoId, asset.videoId),
          asset.partId ? eq(videoNodeAssets.partId, asset.partId) : isNull(videoNodeAssets.partId),
          inArray(videoNodeAssets.status, ['ready', 'transcoding']),
        ),
      );
    if (copies.length >= group.replication.maxCopies) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '已达到副本数量上限', 400);
    }
    const [job] = await this.database.db
      .insert(videoNodeReplicationJobs)
      .values({
        assetId,
        sourceNodeId: asset.nodeId,
        targetNodeId,
        status: 'pending',
      })
      .returning();
    if (!job) throw new AppError(ERROR_CODES.INTERNAL_ERROR, '创建复制任务失败', 500);
    await this.audit.record({
      actorId: actor.id,
      action: 'admin.video_node.replicate',
      targetType: 'video_node_asset',
      targetId: assetId,
      after: { targetNodeId },
    });
    void this.processReplicationJobs();
    return { id: job.id, status: job.status };
  }

  async listReplicationJobs() {
    const [jobs, nodes] = await Promise.all([
      this.database.db
        .select()
        .from(videoNodeReplicationJobs)
        .orderBy(desc(videoNodeReplicationJobs.createdAt))
        .limit(100),
      this.database.db.select().from(videoNodes),
    ]);
    const names = new Map(nodes.map((node) => [node.id, node.name]));
    return {
      items: jobs.map((job) => ({
        id: job.id,
        assetId: job.assetId,
        sourceNodeId: job.sourceNodeId,
        targetNodeId: job.targetNodeId,
        sourceName: names.get(job.sourceNodeId) ?? '',
        targetName: names.get(job.targetNodeId) ?? '',
        status: job.status,
        error: job.error,
        attempts: job.attempts,
        remoteAssetId: job.remoteAssetId,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
      })),
    };
  }

  async retryReplicationJob(actor: AuthUser, id: string) {
    const [updated] = await this.database.db
      .update(videoNodeReplicationJobs)
      .set({ status: 'pending', error: null, updatedAt: new Date() })
      .where(eq(videoNodeReplicationJobs.id, id))
      .returning();
    if (!updated) throw new AppError(ERROR_CODES.NOT_FOUND, '复制任务不存在', 404);
    await this.audit.record({
      actorId: actor.id,
      action: 'admin.video_node.replicate_retry',
      targetType: 'video_node_replication_job',
      targetId: id,
    });
    void this.processReplicationJobs();
    return { id, status: 'pending' };
  }

  // ---------------------------------------------------------------------------
  // Background sweeps
  // ---------------------------------------------------------------------------

  private async sweep(): Promise<void> {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      const group = await this.settingsGroup();
      if (!group.enabled) return;
      await this.syncAssets();
      await this.processReplicationJobs();
    } catch (error) {
      this.logger.warn(
        `Video node sweep failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.sweeping = false;
    }
  }

  async syncAssets(limit = 40): Promise<void> {
    const rows = await this.database.db
      .select({ asset: videoNodeAssets, node: videoNodes })
      .from(videoNodeAssets)
      .innerJoin(videoNodes, eq(videoNodes.id, videoNodeAssets.nodeId))
      .where(inArray(videoNodeAssets.status, ['pending', 'uploading', 'transcoding']))
      .orderBy(videoNodeAssets.updatedAt)
      .limit(limit);
    for (const { asset, node } of rows) {
      try {
        const status = await this.client(node).request<AssetStatus>(
          'GET',
          `/api/v1/node/assets/${encodeURIComponent(asset.remoteAssetId)}`,
        );
        await this.applyRemoteStatus(asset, status);
        await this.database.db
          .update(videoNodes)
          .set({ status: 'online', lastSeenAt: new Date(), lastError: null })
          .where(eq(videoNodes.id, node.id));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to sync remote asset ${asset.id}: ${message}`);
        if (error instanceof VideoNodeHttpError && error.status === 404) {
          await this.database.db
            .update(videoNodeAssets)
            .set({ status: 'failed', error: '节点上不存在该资产', updatedAt: new Date() })
            .where(eq(videoNodeAssets.id, asset.id));
        } else {
          await this.database.db
            .update(videoNodes)
            .set({ status: 'degraded', lastError: message.slice(0, 500) })
            .where(eq(videoNodes.id, node.id));
        }
      }
    }
  }

  private async applyRemoteStatus(asset: NodeAssetRow, status: AssetStatus): Promise<void> {
    if (status.status === asset.status && status.status !== 'ready' && status.status !== 'failed') {
      return;
    }
    if (status.status === 'ready') {
      await this.database.db
        .update(videoNodeAssets)
        .set({
          status: 'ready',
          durationSeconds: status.durationSeconds,
          width: status.width,
          height: status.height,
          error: null,
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(videoNodeAssets.id, asset.id));
      await this.persistRenditions(asset, status);
      await this.markSiteReady(asset, status);
      await this.maybeReplicate(asset);
      return;
    }
    if (status.status === 'failed') {
      await this.database.db
        .update(videoNodeAssets)
        .set({
          status: 'failed',
          error: status.error ?? '节点转码失败',
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(videoNodeAssets.id, asset.id));
      await this.database.db
        .update(videos)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(videos.id, asset.videoId));
      if (asset.partId) {
        await this.database.db
          .update(videoParts)
          .set({ status: 'failed', updatedAt: new Date() })
          .where(eq(videoParts.id, asset.partId));
      }
      return;
    }
    if (status.status !== asset.status) {
      await this.database.db
        .update(videoNodeAssets)
        .set({ status: status.status, lastSyncedAt: new Date(), updatedAt: new Date() })
        .where(eq(videoNodeAssets.id, asset.id));
    }
  }

  private async persistRenditions(asset: NodeAssetRow, status: AssetStatus): Promise<void> {
    await this.database.db
      .delete(videoRenditions)
      .where(
        and(
          eq(videoRenditions.videoId, asset.videoId),
          asset.partId ? eq(videoRenditions.partId, asset.partId) : isNull(videoRenditions.partId),
        ),
      );
    for (const rendition of status.renditions) {
      await this.database.db.insert(videoRenditions).values({
        videoId: asset.videoId,
        partId: asset.partId,
        quality: rendition.quality,
        width: rendition.width,
        height: rendition.height,
        bitrate: rendition.bitrate,
        // Sentinels are ignored by the HLS key resolver; playback signs fresh
        // node URLs on demand.
        playlistKey: `remote:${asset.remoteAssetId}:${rendition.quality}`,
      });
    }
  }

  private async markSiteReady(asset: NodeAssetRow, status: AssetStatus): Promise<void> {
    if (asset.partId) {
      await this.database.db
        .update(videoParts)
        .set({
          status: 'ready',
          storageMode: 'remote',
          primaryNodeId: asset.nodeId,
          remoteAssetId: asset.remoteAssetId,
          durationSeconds: status.durationSeconds,
          width: status.width,
          height: status.height,
          updatedAt: new Date(),
        })
        .where(eq(videoParts.id, asset.partId));
      const parts = await this.database.db
        .select({ status: videoParts.status })
        .from(videoParts)
        .where(eq(videoParts.videoId, asset.videoId));
      if (parts.every((part) => part.status === 'ready')) {
        await this.database.db
          .update(videos)
          .set({
            status: 'ready',
            storageMode: 'remote',
            updatedAt: new Date(),
          })
          .where(eq(videos.id, asset.videoId));
      }
      return;
    }
    await this.database.db
      .update(videos)
      .set({
        status: 'ready',
        storageMode: 'remote',
        primaryNodeId: asset.nodeId,
        remoteAssetId: asset.remoteAssetId,
        durationSeconds: status.durationSeconds,
        width: status.width,
        height: status.height,
        updatedAt: new Date(),
      })
      .where(eq(videos.id, asset.videoId));
  }

  private async maybeReplicate(asset: NodeAssetRow): Promise<void> {
    const group = await this.settingsGroup();
    if (!group.replication.enabled || group.replication.mode !== 'auto') return;
    const existing = await this.database.db
      .select({ id: videoNodeAssets.id })
      .from(videoNodeAssets)
      .where(
        and(
          eq(videoNodeAssets.videoId, asset.videoId),
          asset.partId ? eq(videoNodeAssets.partId, asset.partId) : isNull(videoNodeAssets.partId),
          inArray(videoNodeAssets.status, ['ready', 'transcoding']),
        ),
      );
    if (existing.length >= group.replication.maxCopies) return;
    const sourceNode = await this.get(asset.nodeId);
    const nodes = await this.database.db
      .select()
      .from(videoNodes)
      .where(and(eq(videoNodes.enabled, true), sql`${videoNodes.status} <> 'offline'`));
    const targets = nodes.filter(
      (node) =>
        node.id !== sourceNode.id &&
        (!group.replication.sameRegionOnly || node.region === sourceNode.region),
    );
    for (const target of targets) {
      const already = await this.database.db
        .select({ id: videoNodeAssets.id })
        .from(videoNodeAssets)
        .where(
          and(
            eq(videoNodeAssets.nodeId, target.id),
            eq(videoNodeAssets.remoteAssetId, asset.remoteAssetId),
          ),
        )
        .limit(1);
      if (already.length > 0) continue;
      const pending = await this.database.db
        .select({ id: videoNodeReplicationJobs.id })
        .from(videoNodeReplicationJobs)
        .where(
          and(
            eq(videoNodeReplicationJobs.assetId, asset.id),
            eq(videoNodeReplicationJobs.targetNodeId, target.id),
            inArray(videoNodeReplicationJobs.status, ['pending', 'running']),
          ),
        )
        .limit(1);
      if (pending.length > 0) continue;
      await this.database.db.insert(videoNodeReplicationJobs).values({
        assetId: asset.id,
        sourceNodeId: asset.nodeId,
        targetNodeId: target.id,
        status: 'pending',
      });
      if (existing.length + 1 >= group.replication.maxCopies) break;
    }
  }

  async processReplicationJobs(): Promise<void> {
    for (let index = 0; index < 5; index += 1) {
      const claimed = (await this.database.db.execute(sql`
        UPDATE "uiliuili"."video_node_replication_jobs"
        SET "status" = 'running', "updated_at" = now()
        WHERE "id" = (
          SELECT "id" FROM "uiliuili"."video_node_replication_jobs"
          WHERE "status" = 'pending'
          ORDER BY "created_at"
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING "id", "asset_id", "source_node_id", "target_node_id", "attempts"
      `)) as unknown as Array<{
        id: string;
        asset_id: string;
        source_node_id: string;
        target_node_id: string;
        attempts: number;
      }>;
      const job = Array.isArray(claimed) ? claimed[0] : null;
      if (!job) return;
      await this.runReplicationJob(job);
    }
  }

  private async runReplicationJob(job: {
    id: string;
    asset_id: string;
    source_node_id: string;
    target_node_id: string;
    attempts: number;
  }): Promise<void> {
    try {
      const [asset] = await this.database.db
        .select()
        .from(videoNodeAssets)
        .where(eq(videoNodeAssets.id, job.asset_id))
        .limit(1);
      if (!asset) throw new Error('源资产已删除');
      const source = await this.get(job.source_node_id);
      const target = await this.get(job.target_node_id);
      const grant = await this.client(source).request<{ sourceUrl: string; expiresAt: string }>(
        'POST',
        `/api/v1/node/assets/${encodeURIComponent(asset.remoteAssetId)}/replication-grant`,
        {},
      );
      const imported = await this.client(target).request<{ assetId: string; status: string }>(
        'POST',
        '/api/v1/node/replicas/import',
        {
          sourceUrl: grant.sourceUrl,
          profile: 'auto',
          durationSeconds: asset.durationSeconds,
          width: asset.width,
          height: asset.height,
          metadata: {
            siteVideoId: asset.videoId,
            ...(asset.partId ? { partId: asset.partId } : {}),
          },
        },
        { timeoutMs: 30 * 60 * 1000 },
      );
      await this.database.db
        .insert(videoNodeAssets)
        .values({
          videoId: asset.videoId,
          partId: asset.partId,
          nodeId: target.id,
          remoteAssetId: imported.assetId,
          status: imported.status === 'ready' ? 'ready' : 'transcoding',
          isPrimary: false,
          durationSeconds: asset.durationSeconds,
          width: asset.width,
          height: asset.height,
        })
        .onConflictDoUpdate({
          target: [videoNodeAssets.nodeId, videoNodeAssets.remoteAssetId],
          set: {
            status: imported.status === 'ready' ? 'ready' : 'transcoding',
            updatedAt: new Date(),
          },
        });
      await this.database.db
        .update(videoNodeReplicationJobs)
        .set({
          status: 'done',
          remoteAssetId: imported.assetId,
          error: null,
          updatedAt: new Date(),
        })
        .where(eq(videoNodeReplicationJobs.id, job.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const attempts = job.attempts + 1;
      await this.database.db
        .update(videoNodeReplicationJobs)
        .set({
          status: attempts >= 3 ? 'failed' : 'pending',
          attempts,
          error: message.slice(0, 500),
          updatedAt: new Date(),
        })
        .where(eq(videoNodeReplicationJobs.id, job.id));
    }
  }

  private normalizeRegions(regions: string[] | undefined, region: string | undefined): string[] {
    const values = [...(regions ?? []), region ?? '']
      .map((item) => item.trim().toUpperCase().slice(0, 8))
      .filter(Boolean);
    return [...new Set(values)];
  }

  private assertUrl(value: string): void {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '节点地址不是合法 URL', 400);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '节点地址必须使用 HTTP 或 HTTPS', 400);
    }
  }

  async settingsForAdmin(): Promise<Record<string, unknown>> {
    return this.settingsGroup();
  }
}
