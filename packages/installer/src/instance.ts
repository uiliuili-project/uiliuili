import fs from 'node:fs';
import { APP_VERSION, INSTALL_TOKEN_FILE, type InstallConfig } from '@uiliuili/shared';
import { ensureRuntimeDirs, resolveInstallerPaths, runtimeRoot, writeFileAtomic } from './paths';

export interface InstanceRecord {
  installed: true;
  instanceId: string;
  version: string;
  schemaVersion: number;
  installedAt: string;
  siteUrl: string;
  locale: string;
}

export function instanceExists(root = runtimeRoot()): boolean {
  return fs.existsSync(resolveInstallerPaths(root).instanceFile);
}

export function readInstance(root = runtimeRoot()): InstanceRecord | null {
  const file = resolveInstallerPaths(root).instanceFile;
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as InstanceRecord;
  } catch {
    return null;
  }
}

export function writeInstance(
  root: string,
  config: InstallConfig,
  instanceId: string,
): InstanceRecord {
  const paths = resolveInstallerPaths(root);
  ensureRuntimeDirs(paths);
  const record: InstanceRecord = {
    installed: true,
    instanceId,
    version: APP_VERSION,
    schemaVersion: 1,
    installedAt: new Date().toISOString(),
    siteUrl: config.site.url,
    locale: config.locale,
  };
  writeFileAtomic(paths.instanceFile, `${JSON.stringify(record, null, 2)}\n`, 0o600);
  return record;
}

export function removeInstanceFile(root = runtimeRoot()): void {
  fs.rmSync(resolveInstallerPaths(root).instanceFile, { force: true });
}

export function installTokenPath(root = runtimeRoot()): string {
  return `${resolveInstallerPaths(root).storageDir}/${INSTALL_TOKEN_FILE}`;
}
