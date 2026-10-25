import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveInstallerPaths, runtimeRoot } from './paths';

const originalRoot = process.env.UILIUILI_ROOT;

afterEach(() => {
  if (originalRoot === undefined) delete process.env.UILIUILI_ROOT;
  else process.env.UILIUILI_ROOT = originalRoot;
});

describe('runtimeRoot', () => {
  it('falls back to the process working directory', () => {
    delete process.env.UILIUILI_ROOT;
    expect(runtimeRoot()).toBe(path.resolve(process.cwd()));
  });

  it('honours UILIUILI_ROOT for container installs', () => {
    process.env.UILIUILI_ROOT = '/data';
    expect(runtimeRoot()).toBe('/data');
    const paths = resolveInstallerPaths();
    expect(paths.envFile).toBe('/data/.env');
    expect(paths.instanceFile).toBe('/data/config/instance.json');
    expect(paths.storageDir).toBe('/data/storage');
  });

  it('lets an explicit root win over the environment', () => {
    process.env.UILIUILI_ROOT = '/data';
    expect(runtimeRoot('/srv/uiliuili')).toBe('/srv/uiliuili');
  });
});
