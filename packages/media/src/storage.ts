import type { StorageConfig } from '@uiliuili/shared';
import { LocalStorageProvider } from './local';
import { S3StorageProvider } from './s3';
import type { StorageProvider } from './types';

export function createStorageProvider(config: StorageConfig): StorageProvider {
  if (config.driver === 's3') {
    return new S3StorageProvider(config.s3);
  }
  return new LocalStorageProvider({ root: config.localPath });
}
