import crypto from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  type Db,
  type DbUser,
  ensureDefaultFolders,
  hashToken,
  randomToken,
  refreshSessions,
  siteSettings,
  users,
  verificationTokens,
} from '@uiliuili/db';
import { isLoopback } from '@uiliuili/installer';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  OWNER_CLAIM_SETTING,
  type Permission,
  REFRESH_TOKEN_TTL_DAYS,
  type UserGroup,
  type UserRole,
  permissionsForRoles,
  userGroupForRoles,
} from '@uiliuili/shared';
import argon2 from 'argon2';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { AuditService } from '../common/audit.service';
import type { AuthUser } from '../common/auth-user';
import { DatabaseService } from '../common/database.service';
import { MailService } from '../common/mail.service';
import { SettingsService } from '../common/settings.service';

export interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  user: AuthUser;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly jwt: JwtService,
    private readonly settings: SettingsService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  async register(
    input: {
      username: string;
      email: string;
      password: string;
      claimToken?: string;
    },
    meta: SessionMeta = {},
  ): Promise<IssuedTokens> {
    const site = await this.settings.getSite();
    const email = input.email.trim().toLowerCase();
    const username = input.username.trim();
    const social = await this.settings.getSocialSettings();
    const mail = await this.settings.getMailConfig();
    const verificationRequired = Boolean(
      mail &&
        (await this.settings.getGroup('mail', { verificationRequired: false }))
          .verificationRequired,
    );
    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    const result = await this.database.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('uiliuili:owner'))`);
      const owners = await tx
        .select({ id: users.id })
        .from(users)
        .where(sql`${users.userGroup} = 'OWNER' OR ${users.roles} @> ARRAY['SUPER_ADMIN']::text[]`)
        .limit(1);
      const becomesOwner = owners.length === 0;

      if (becomesOwner) {
        await this.assertOwnerClaim(input.claimToken, meta.ip);
      } else {
        const registration = String(site.registration ?? 'open');
        if (registration === 'closed') throw new Error('本站暂未开放注册');
        if (registration === 'invite') throw new Error('本站目前仅限邀请注册');
      }

      const existing = await tx
        .select({ id: users.id })
        .from(users)
        .where(
          or(
            sql`lower(${users.email}) = ${email}`,
            sql`lower(${users.username}) = ${username.toLowerCase()}`,
          ),
        )
        .limit(1);
      if (existing.length > 0) throw new Error('用户名或邮箱已被使用');

      const [created] = await tx
        .insert(users)
        .values({
          username,
          email,
          displayName: username,
          passwordHash,
          emailVerified: becomesOwner ? true : !verificationRequired,
          roles: becomesOwner ? ['SUPER_ADMIN'] : ['USER'],
          userGroup: becomesOwner ? 'OWNER' : 'USER',
          level: becomesOwner ? 6 : 0,
          coinBalance: Number(social.dailyCoins ?? 2),
        })
        .returning();
      if (!created) throw new Error('注册失败');
      await ensureDefaultFolders(tx as unknown as Db, created.id);
      if (becomesOwner) {
        await tx.delete(siteSettings).where(eq(siteSettings.key, OWNER_CLAIM_SETTING));
      }
      return { created, becomesOwner };
    });

    if (!result.becomesOwner && verificationRequired) {
      await this.createEmailVerification(result.created.id, email);
    }
    await this.audit.record({
      actorId: result.created.id,
      action: result.becomesOwner ? 'auth.owner.claim' : 'auth.register',
      targetType: 'user',
      targetId: result.created.id,
      ipHash: this.hashIp(meta.ip),
      userAgent: meta.userAgent,
    });
    return this.issueSession(result.created, meta, false);
  }

  /**
   * Reports whether the instance still needs its first owner and whether a
   * claim token is required for the current caller.
   */
  async setupStatus(ip?: string): Promise<{ needsOwner: boolean; claimRequired: boolean }> {
    const rows = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(sql`${users.userGroup} = 'OWNER' OR ${users.roles} @> ARRAY['SUPER_ADMIN']::text[]`)
      .limit(1);
    const needsOwner = rows.length === 0;
    if (!needsOwner) return { needsOwner: false, claimRequired: false };
    const claim = await this.settings.getSecret<{ tokenHash?: string } | null>(
      OWNER_CLAIM_SETTING,
      null,
    );
    return {
      needsOwner: true,
      claimRequired: Boolean(claim?.tokenHash) && !isLoopback(ip),
    };
  }

  private async assertOwnerClaim(
    claimToken: string | undefined,
    ip: string | undefined,
  ): Promise<void> {
    if (isLoopback(ip)) return;
    const claim = await this.settings.getSecret<{ tokenHash?: string } | null>(
      OWNER_CLAIM_SETTING,
      null,
    );
    if (!claim?.tokenHash) {
      throw new Error('本站尚未配置站长认领码，请从服务器本机注册，或使用 owner:promote 恢复');
    }
    if (!claimToken?.trim()) throw new Error('请填写站长认领码');
    const expected = Buffer.from(claim.tokenHash, 'hex');
    const actual = Buffer.from(hashToken(claimToken.trim()), 'hex');
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      throw new Error('站长认领码不正确');
    }
  }

  async login(identifier: string, password: string, meta: SessionMeta): Promise<IssuedTokens> {
    const normalized = identifier.trim().toLowerCase();
    const rows = await this.database.db
      .select()
      .from(users)
      .where(
        or(
          sql`lower(${users.email}) = ${normalized}`,
          sql`lower(${users.username}) = ${normalized}`,
        ),
      )
      .limit(1);
    const user = rows[0];
    if (!user?.passwordHash) throw new Error('用户名或密码错误');
    const valid = await argon2.verify(user.passwordHash, password).catch(() => false);
    if (!valid) throw new Error('用户名或密码错误');
    if (user.banned) throw new Error('账号已被封禁');
    await this.database.db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));
    return this.issueSession(user, meta, true);
  }

  async refresh(rawRefreshToken: string | undefined, meta: SessionMeta): Promise<IssuedTokens> {
    if (!rawRefreshToken) throw new Error('登录状态已失效');
    const tokenHash = hashToken(rawRefreshToken);
    const rows = await this.database.db
      .select()
      .from(refreshSessions)
      .where(eq(refreshSessions.tokenHash, tokenHash))
      .limit(1);
    const session = rows[0];
    if (!session || session.expiresAt < new Date()) {
      throw new Error('登录状态已过期');
    }
    if (session.revokedAt) {
      await this.database.db
        .update(refreshSessions)
        .set({ revokedAt: new Date() })
        .where(eq(refreshSessions.userId, session.userId));
      throw new Error('检测到会话复用，请重新登录');
    }
    await this.database.db
      .update(refreshSessions)
      .set({ revokedAt: new Date() })
      .where(eq(refreshSessions.id, session.id));
    const userRows = await this.database.db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    const user = userRows[0];
    if (!user || user.banned) throw new Error('账号不可用');
    return this.issueSession(user, meta, true);
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    await this.database.db
      .update(refreshSessions)
      .set({ revokedAt: new Date() })
      .where(eq(refreshSessions.tokenHash, hashToken(rawRefreshToken)));
  }

  async findById(id: string): Promise<AuthUser | null> {
    const rows = await this.database.db.select().from(users).where(eq(users.id, id)).limit(1);
    const user = rows[0];
    return user ? this.toAuthUser(user) : null;
  }

  async findByIdentifier(identifier: string): Promise<AuthUser | null> {
    const normalized = identifier.trim().toLowerCase();
    const rows = await this.database.db
      .select()
      .from(users)
      .where(
        or(
          sql`lower(${users.email}) = ${normalized}`,
          sql`lower(${users.username}) = ${normalized}`,
        ),
      )
      .limit(1);
    const user = rows[0];
    return user ? this.toAuthUser(user) : null;
  }

  async updateProfile(
    userId: string,
    input: { displayName?: string; bio?: string; avatarUrl?: string },
  ): Promise<AuthUser> {
    const [updated] = await this.database.db
      .update(users)
      .set({
        displayName: input.displayName,
        bio: input.bio,
        avatarUrl: input.avatarUrl || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    if (!updated) throw new Error('用户不存在');
    return this.toAuthUser(updated);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const rows = await this.database.db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = rows[0];
    if (!user) throw new Error('用户不存在');
    if (user.passwordHash) {
      const valid = await argon2.verify(user.passwordHash, currentPassword).catch(() => false);
      if (!valid) throw new Error('当前密码不正确');
    }
    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    await this.database.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));
    await this.database.db
      .update(refreshSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshSessions.userId, userId), isNull(refreshSessions.revokedAt)));
  }

  async requestPasswordReset(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const rows = await this.database.db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${normalized}`)
      .limit(1);
    const user = rows[0];
    if (!user) return;
    const token = randomToken(32);
    await this.database.db.insert(verificationTokens).values({
      userId: user.id,
      type: 'password_reset',
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await this.mail.sendPasswordReset(user.email, token);
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const record = await this.consumeToken(token, 'password_reset');
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    await this.database.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, record.userId));
    await this.database.db
      .update(refreshSessions)
      .set({ revokedAt: new Date() })
      .where(eq(refreshSessions.userId, record.userId));
  }

  async verifyEmail(token: string): Promise<void> {
    const record = await this.consumeToken(token, 'email_verify');
    await this.database.db
      .update(users)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(users.id, record.userId));
  }

  async resendVerification(userId: string): Promise<void> {
    const rows = await this.database.db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = rows[0];
    if (!user) throw new Error('用户不存在');
    if (user.emailVerified) throw new Error('邮箱已验证');
    await this.createEmailVerification(user.id, user.email);
  }

  async listSessions(userId: string) {
    return this.database.db
      .select({
        id: refreshSessions.id,
        userAgent: refreshSessions.userAgent,
        ipHash: refreshSessions.ipHash,
        createdAt: refreshSessions.createdAt,
        expiresAt: refreshSessions.expiresAt,
      })
      .from(refreshSessions)
      .where(and(eq(refreshSessions.userId, userId), isNull(refreshSessions.revokedAt)))
      .orderBy(desc(refreshSessions.createdAt));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.database.db
      .update(refreshSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshSessions.id, sessionId), eq(refreshSessions.userId, userId)));
  }

  async findOrCreateOAuthUser(
    profile: {
      provider: string;
      providerAccountId: string;
      email: string;
      emailVerified: boolean;
      name: string;
      avatarUrl?: string;
    },
    meta: SessionMeta = {},
  ): Promise<AuthUser> {
    const { oauthAccounts } = await import('@uiliuili/db');
    const linked = await this.database.db
      .select({ user: users })
      .from(oauthAccounts)
      .innerJoin(users, eq(users.id, oauthAccounts.userId))
      .where(
        and(
          eq(oauthAccounts.provider, profile.provider),
          eq(oauthAccounts.providerAccountId, profile.providerAccountId),
        ),
      )
      .limit(1);
    if (linked[0]?.user) {
      if (linked[0].user.banned) throw new Error('账号已被封禁');
      return this.toAuthUser(linked[0].user);
    }

    const email = profile.email.trim().toLowerCase();
    const emailRows = await this.database.db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);
    let user = emailRows[0];
    if (user) {
      if (!profile.emailVerified || !user.emailVerified) {
        throw new Error('该邮箱已有账号，请先使用密码登录后在设置中绑定第三方账号');
      }
    } else {
      user = await this.database.db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('uiliuili:owner'))`);
        const owners = await tx
          .select({ id: users.id })
          .from(users)
          .where(
            sql`${users.userGroup} = 'OWNER' OR ${users.roles} @> ARRAY['SUPER_ADMIN']::text[]`,
          )
          .limit(1);
        const becomesOwner = owners.length === 0;
        if (becomesOwner && !isLoopback(meta.ip)) {
          throw new Error('请先使用密码注册第一个站长账号，再绑定第三方登录');
        }
        const base =
          (profile.name || email.split('@')[0] || 'user')
            .replace(/[^a-zA-Z0-9_-]/g, '')
            .slice(0, 20) || 'user';
        let username = base;
        for (let attempt = 0; attempt < 20; attempt += 1) {
          const exists = await tx
            .select({ id: users.id })
            .from(users)
            .where(sql`lower(${users.username}) = ${username.toLowerCase()}`)
            .limit(1);
          if (exists.length === 0) break;
          username = `${base}${crypto.randomInt(1000, 9999)}`;
        }
        const created = await tx
          .insert(users)
          .values({
            username,
            email,
            displayName: profile.name || username,
            avatarUrl: profile.avatarUrl,
            emailVerified: profile.emailVerified,
            roles: becomesOwner ? ['SUPER_ADMIN'] : ['USER'],
            userGroup: becomesOwner ? 'OWNER' : 'USER',
            level: becomesOwner ? 6 : 0,
          })
          .returning();
        const row = created[0];
        if (!row) throw new Error('无法创建第三方登录账号');
        await ensureDefaultFolders(tx as unknown as Db, row.id);
        if (becomesOwner) {
          await tx.delete(siteSettings).where(eq(siteSettings.key, OWNER_CLAIM_SETTING));
        }
        return row;
      });
    }

    await this.database.db
      .insert(oauthAccounts)
      .values({
        userId: user.id,
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
        email,
        avatarUrl: profile.avatarUrl,
      })
      .onConflictDoNothing();
    return this.toAuthUser(user);
  }

  async issueSessionForUserId(
    userId: string,
    meta: SessionMeta,
    remember = true,
  ): Promise<IssuedTokens> {
    const rows = await this.database.db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = rows[0];
    if (!user || user.banned) throw new Error('账号不可用');
    return this.issueSession(user, meta, remember);
  }

  async issueSession(user: DbUser, meta: SessionMeta, remember = true): Promise<IssuedTokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, type: 'access' },
      { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    );
    const refreshToken = randomToken(48);
    const csrfToken = randomToken(24);
    const security = await this.settings.getSecuritySettings();
    const sessionDays = Math.max(1, Number(security.sessionDays ?? REFRESH_TOKEN_TTL_DAYS));
    await this.database.db.insert(refreshSessions).values({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      userAgent: (meta.userAgent ?? '').slice(0, 500),
      ipHash: this.hashIp(meta.ip),
      expiresAt: new Date(Date.now() + (remember ? sessionDays : 1) * 24 * 60 * 60 * 1000),
    });
    await this.audit.record({
      actorId: user.id,
      action: 'auth.login',
      targetType: 'user',
      targetId: user.id,
      ipHash: this.hashIp(meta.ip),
      userAgent: meta.userAgent,
    });
    return { accessToken, refreshToken, csrfToken, user: this.toAuthUser(user) };
  }

  refreshCookieMaxAge(remember: boolean): number {
    return (remember ? REFRESH_TOKEN_TTL_DAYS : 1) * 24 * 60 * 60;
  }

  private async createEmailVerification(userId: string, email: string): Promise<void> {
    const token = randomToken(32);
    await this.database.db.insert(verificationTokens).values({
      userId,
      type: 'email_verify',
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await this.mail.sendVerification(email, token);
  }

  private async consumeToken(token: string, type: string) {
    const rows = await this.database.db
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.tokenHash, hashToken(token)),
          eq(verificationTokens.type, type),
          isNull(verificationTokens.usedAt),
        ),
      )
      .limit(1);
    const record = rows[0];
    if (!record || record.expiresAt < new Date()) throw new Error('链接无效或已过期');
    await this.database.db
      .update(verificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(verificationTokens.id, record.id));
    return record;
  }

  toAuthUser(user: DbUser): AuthUser {
    const roles = (user.roles ?? ['USER']) as UserRole[];
    const group = (user.userGroup as UserGroup | undefined) ?? userGroupForRoles(roles);
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      roles,
      group,
      permissions: permissionsForRoles(roles) satisfies Permission[],
      level: user.level,
      emailVerified: user.emailVerified,
      banned: user.banned,
      mutedUntil: user.mutedUntil,
      coinBalance: user.coinBalance,
    };
  }

  hashIp(ip?: string): string {
    if (!ip) return '';
    return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 32);
  }
}
