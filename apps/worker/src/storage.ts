import type { Db } from '@uiliuili/db';
import { decryptSecret, siteSettings } from '@uiliuili/db';
import { type StorageProvider, createStorageProvider } from '@uiliuili/media';
import type { SearchConfig, StorageConfig } from '@uiliuili/shared';
import { eq } from 'drizzle-orm';
import { workerConfig } from './config';

export async function secretSetting<T>(db: Db, key: string, fallback: T): Promise<T> {
  const rows = await db.select().from(siteSettings).where(eq(siteSettings.key, key)).limit(1);
  const row = rows[0];
  if (!row?.isSecret || !row.value) return fallback;
  try {
    return decryptSecret<T>(String(row.value), workerConfig.appKey);
  } catch {
    return fallback;
  }
}

export async function getStorage(db: Db): Promise<StorageProvider> {
  const stored = await secretSetting<StorageConfig | null>(db, 'storage_config', null);
  return createStorageProvider(stored ?? { driver: 'local', localPath: workerConfig.storageRoot });
}

export async function getSearchConfig(db: Db): Promise<SearchConfig> {
  return secretSetting<SearchConfig>(db, 'search_config', { driver: 'postgres' });
}
