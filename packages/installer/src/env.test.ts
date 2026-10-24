import type { InstallConfig } from '@uiliuili/shared';
import { describe, expect, it } from 'vitest';
import { buildDatabaseUrl, buildEnvFile } from './env';

const baseConfig: InstallConfig = {
  locale: 'zh-CN',
  database: {
    host: 'db.internal',
    port: 5432,
    database: 'uiliuili',
    user: 'user',
    password: 'p@ss word',
    ssl: true,
    schema: 'uiliuili',
    createIfMissing: false,
  },
  site: {
    name: 'uiliuili',
    description: '',
    url: 'https://video.example.com',
    timezone: 'Asia/Shanghai',
    locale: 'zh-CN',
    registration: 'open',
  },
  admin: {
    username: 'admin',
    email: 'admin@example.com',
    password: 'TestPassword123',
  },
  storage: { driver: 'local', localPath: './storage/uploads' },
  search: { driver: 'postgres' },
  demoContent: false,
};

describe('installer environment files', () => {
  it('encodes database credentials and SSL', () => {
    const url = buildDatabaseUrl(baseConfig.database);
    expect(url).toContain('p%40ss%20word');
    expect(url).toContain('?sslmode=require');
    expect(url).toContain('/uiliuili');
  });

  it('never persists the installer token in .env', () => {
    const content = buildEnvFile(baseConfig, {
      production: true,
      appKey: 'a'.repeat(64),
    });
    expect(content).not.toContain('INSTALL_TOKEN');
    expect(content).toContain('APP_KEY=');
    expect(content).toContain('DATABASE_URL=');
  });

  it('keeps optional services out when not configured', () => {
    const content = buildEnvFile(baseConfig, {
      production: true,
      appKey: 'b'.repeat(64),
    });
    expect(content).not.toContain('REDIS_URL=');
    expect(content).not.toContain('MEILISEARCH_URL=');
  });

  it('disables localhost installer bypass in production', () => {
    const content = buildEnvFile(baseConfig, {
      production: true,
      appKey: 'c'.repeat(64),
    });
    expect(content).toContain('INSTALL_ALLOW_LOCALHOST=false');
    const development = buildEnvFile(baseConfig, {
      production: false,
      appKey: 'd'.repeat(64),
    });
    expect(development).toContain('INSTALL_ALLOW_LOCALHOST=true');
  });
});
