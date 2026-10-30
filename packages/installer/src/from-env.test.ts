import { describe, expect, it } from 'vitest';
import { InstallEnvError, buildInstallConfigFromEnv } from './from-env';

const baseEnv: NodeJS.ProcessEnv = {
  APP_URL: 'https://video.example.com',
  DATABASE_URL: 'postgres://user:p%40ss@db.internal:5433/uiliuili?sslmode=require',
};

describe('buildInstallConfigFromEnv', () => {
  it('parses DATABASE_URL including encoded credentials and SSL', () => {
    const config = buildInstallConfigFromEnv(baseEnv);
    expect(config.database).toMatchObject({
      host: 'db.internal',
      port: 5433,
      database: 'uiliuili',
      user: 'user',
      password: 'p@ss',
      ssl: true,
      schema: 'uiliuili',
    });
    expect(config.site.url).toBe('https://video.example.com');
  });

  it('maps storage, redis and search toggles', () => {
    const config = buildInstallConfigFromEnv({
      ...baseEnv,
      STORAGE_ROOT: '/data/storage/uploads',
      REDIS_URL: 'redis://redis:6379',
      MEILISEARCH_URL: 'http://meili:7700',
      MEILISEARCH_KEY: 'secret',
    });
    expect(config.storage).toEqual({ driver: 'local', localPath: '/data/storage/uploads' });
    expect(config.redis).toEqual({ url: 'redis://redis:6379' });
    expect(config.search).toMatchObject({ driver: 'meilisearch', url: 'http://meili:7700' });
  });

  it('keeps optional services disabled when unset', () => {
    const config = buildInstallConfigFromEnv(baseEnv);
    expect(config.redis).toBeNull();
    expect(config.search).toEqual({ driver: 'postgres' });
    expect(config.mail).toBeUndefined();
  });

  it('does not require administrator credentials', () => {
    const config = buildInstallConfigFromEnv(baseEnv);
    expect(config.site.name).toBe('萌悠');
    expect('admin' in config).toBe(false);
  });

  it('rejects an unsupported storage driver', () => {
    expect(() => buildInstallConfigFromEnv({ ...baseEnv, STORAGE_DRIVER: 'ftp' })).toThrow(
      /不支持的 STORAGE_DRIVER/,
    );
  });

  it('accepts explicit DB_* variables instead of DATABASE_URL', () => {
    const { DATABASE_URL: _ignored, ...env } = baseEnv;
    const config = buildInstallConfigFromEnv({
      ...env,
      DB_HOST: 'postgres',
      DB_PORT: '5432',
      DB_NAME: 'uiliuili',
      DB_USER: 'uiliuili',
      DB_PASSWORD: 'dbpass',
    });
    expect(config.database.host).toBe('postgres');
    expect(config.database.password).toBe('dbpass');
  });
});
