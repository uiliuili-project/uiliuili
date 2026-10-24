import { createStorageProvider } from '@uiliuili/media';
import type { StorageConfig } from '@uiliuili/shared';

export async function testStorage(config: StorageConfig): Promise<void> {
  const provider = createStorageProvider(config);
  await provider.test();
}
