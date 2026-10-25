import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { DanmakuCreateInput, danmakuCreateSchema } from '@uiliuili/shared';
import type { Subscription } from 'rxjs';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import type { AuthUser } from '../common/auth-user';
import { VideosService } from '../videos/videos.service';
import { DanmakuBus } from './danmaku.bus';
import { DanmakuService } from './danmaku.service';

interface SocketData {
  user?: AuthUser;
  videoId?: string;
  partId?: string | null;
}

function roomName(videoId: string, partId?: string | null): string {
  return `video:${videoId}:${partId ?? 'legacy'}`;
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const result: Record<string, string> = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) result[key] = decodeURIComponent(value);
  }
  return result;
}

@WebSocketGateway({
  namespace: '/danmaku',
  cors: { origin: true, credentials: true },
})
export class DanmakuGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly viewers = new Map<string, Set<string>>();
  private subscription: Subscription | null = null;

  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
    private readonly videos: VideosService,
    private readonly danmaku: DanmakuService,
    private readonly bus: DanmakuBus,
  ) {}

  onModuleInit(): void {
    this.subscription = this.bus.events.subscribe((event) => {
      this.server?.to(roomName(event.videoId, event.partId)).emit('danmaku', {
        videoId: event.videoId,
        partId: event.partId ?? null,
        item: event.item,
      });
    });
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  async handleConnection(client: Socket): Promise<void> {
    const cookies = parseCookies(client.handshake.headers.cookie);
    const token = cookies.ul_access;
    if (!token) return;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; type: string }>(token);
      if (payload.type !== 'access') return;
      const user = await this.auth.findById(payload.sub);
      if (user && !user.banned) {
        (client.data as SocketData).user = user;
      }
    } catch {}
  }

  handleDisconnect(client: Socket): void {
    this.leaveRoom(client);
  }

  @SubscribeMessage('join')
  async join(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { videoId?: string; partId?: string | null },
  ) {
    const videoId = String(payload?.videoId ?? '');
    if (!videoId) return { ok: false };
    const partId = payload?.partId ? String(payload.partId) : null;
    const user = (client.data as SocketData).user;
    try {
      const row = await this.videos.getRow(videoId);
      this.videos.assertCanView(row.video, user);
      if (partId) await this.videos.getPart(videoId, partId);
    } catch {
      return { ok: false, error: '视频不存在' };
    }
    this.leaveRoom(client);
    (client.data as SocketData).videoId = videoId;
    (client.data as SocketData).partId = partId;
    const room = roomName(videoId, partId);
    await client.join(room);
    const set = this.viewers.get(room) ?? new Set<string>();
    set.add(client.id);
    this.viewers.set(room, set);
    this.server.to(room).emit('viewers', { videoId, partId, count: set.size });
    return { ok: true, viewers: set.size };
  }

  @SubscribeMessage('leave')
  leave(@ConnectedSocket() client: Socket) {
    this.leaveRoom(client);
    return { ok: true };
  }

  @SubscribeMessage('send')
  async send(@ConnectedSocket() client: Socket, @MessageBody() payload: Record<string, unknown>) {
    const user = (client.data as SocketData).user;
    if (!user) {
      client.emit('blocked', { message: '请先登录后发送弹幕' });
      return { ok: false, error: '请先登录' };
    }
    const parsed = danmakuCreateSchema.safeParse(payload);
    if (!parsed.success) {
      client.emit('blocked', { message: '弹幕格式不正确', details: parsed.error.flatten() });
      return { ok: false, error: '弹幕格式不正确' };
    }
    const videoId = String(payload.videoId ?? (client.data as SocketData).videoId ?? '');
    const data = { ...(parsed.data as DanmakuCreateInput) };
    if (!data.partId && (client.data as SocketData).partId !== undefined) {
      data.partId = (client.data as SocketData).partId ?? undefined;
    }
    try {
      const item = await this.danmaku.send(user, videoId, data, client.handshake.address);
      return { ok: true, item };
    } catch (error) {
      const message = error instanceof Error ? error.message : '发送失败';
      client.emit('blocked', { message });
      return { ok: false, error: message };
    }
  }

  private leaveRoom(client: Socket): void {
    const videoId = (client.data as SocketData).videoId;
    if (!videoId) return;
    const partId = (client.data as SocketData).partId ?? null;
    const room = roomName(videoId, partId);
    void client.leave(room);
    const set = this.viewers.get(room);
    if (set) {
      set.delete(client.id);
      if (set.size === 0) this.viewers.delete(room);
      this.server?.to(room).emit('viewers', { videoId, partId, count: set.size });
    }
    (client.data as SocketData).videoId = undefined;
    (client.data as SocketData).partId = undefined;
  }
}
