import {
  type AdminConfig,
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
  type SiteConfig,
} from '@uiliuili/shared';
import { eq, sql } from 'drizzle-orm';
import type { Db } from './client';
import {
  appInstance,
  authProviders,
  categories,
  favoriteFolders,
  siteSettings,
  users,
} from './schema';

export interface SeedOptions {
  admin: AdminConfig;
  site: SiteConfig;
  passwordHash: string;
  instanceId: string;
  version: string;
  appKey: string;
}

export async function seedInstance(db: Db, options: SeedOptions): Promise<void> {
  const existing = await db.select().from(appInstance).limit(1);
  if (existing.length > 0) {
    throw new Error('This database already contains a uiliuili instance');
  }

  const settings = {
    ...DEFAULT_SETTINGS,
    site: {
      ...DEFAULT_SETTINGS.site,
      name: options.site.name,
      description: options.site.description,
      url: options.site.url,
      timezone: options.site.timezone,
      locale: options.site.locale,
      registration: options.site.registration,
    },
  };

  for (const [key, value] of Object.entries(settings)) {
    await db.insert(siteSettings).values({ key, value, isSecret: false }).onConflictDoNothing();
  }

  const [admin] = await db
    .insert(users)
    .values({
      username: options.admin.username,
      email: options.admin.email.toLowerCase(),
      passwordHash: options.passwordHash,
      displayName: options.admin.username,
      emailVerified: true,
      roles: ['SUPER_ADMIN'],
      userGroup: 'ADMIN',
      level: 6,
      coinBalance: settings.social.dailyCoins,
    })
    .returning();

  if (!admin) throw new Error('Failed to create administrator');

  await db.insert(favoriteFolders).values({
    userId: admin.id,
    name: '默认收藏夹',
    isDefault: true,
  });

  for (const category of DEFAULT_CATEGORIES) {
    await db
      .insert(categories)
      .values({ slug: category.slug, name: category.name, sort: category.sort })
      .onConflictDoNothing();
  }

  for (const provider of ['github', 'google', 'oidc']) {
    await db.insert(authProviders).values({ provider, enabled: false }).onConflictDoNothing();
  }

  await db.insert(appInstance).values({
    instanceId: options.instanceId,
    version: options.version,
    schemaVersion: 1,
  });
}

export async function ensureDefaultFolders(db: Db, userId: string): Promise<void> {
  const existing = await db
    .select()
    .from(favoriteFolders)
    .where(eq(favoriteFolders.userId, userId))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(favoriteFolders).values({
      userId,
      name: '默认收藏夹',
      isDefault: true,
    });
  }
}

export async function grantDailyCoins(db: Db, amount: number): Promise<void> {
  await db.update(users).set({
    coinBalance: sql`LEAST(${users.coinBalance} + ${amount}, 100)`,
  });
}
