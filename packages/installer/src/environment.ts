import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkFfmpeg } from '@uiliuili/media';
import { ensureRuntimeDirs, resolveInstallerPaths, runtimeRoot } from './paths';

export interface EnvironmentCheck {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  required: boolean;
}

export interface EnvironmentReport {
  ok: boolean;
  checks: EnvironmentCheck[];
  platform: string;
  arch: string;
  nodeVersion: string;
  memoryMb: number;
  diskFreeMb: number;
}

function canWrite(directory: string): boolean {
  try {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const probe = path.join(directory, `.write-test-${Date.now()}`);
    fs.writeFileSync(probe, 'ok', { mode: 0o600 });
    fs.rmSync(probe, { force: true });
    return true;
  } catch {
    return false;
  }
}

export async function checkEnvironment(root = runtimeRoot()): Promise<EnvironmentReport> {
  const checks: EnvironmentCheck[] = [];
  const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);
  checks.push({
    id: 'node',
    label: 'Node.js 22+',
    ok: major >= 22,
    detail: process.version,
    required: true,
  });

  const paths = resolveInstallerPaths(root);
  try {
    ensureRuntimeDirs(paths);
  } catch {}
  checks.push({
    id: 'config-writable',
    label: '配置目录可写',
    ok: canWrite(paths.configDir),
    detail: paths.configDir,
    required: true,
  });
  checks.push({
    id: 'storage-writable',
    label: '存储目录可写',
    ok: canWrite(paths.storageDir),
    detail: paths.storageDir,
    required: true,
  });

  try {
    const binaries = await checkFfmpeg();
    checks.push({
      id: 'ffmpeg',
      label: 'FFmpeg / ffprobe',
      ok: true,
      detail: `${binaries.ffmpeg}, ${binaries.ffprobe}`,
      required: true,
    });
  } catch (error) {
    checks.push({
      id: 'ffmpeg',
      label: 'FFmpeg / ffprobe',
      ok: false,
      detail: error instanceof Error ? error.message.split('\n')[0]! : '未找到 FFmpeg',
      required: true,
    });
  }

  const memoryMb = Math.round(os.totalmem() / 1024 / 1024);
  checks.push({
    id: 'memory',
    label: '内存不少于 1 GB',
    ok: memoryMb >= 1024,
    detail: `${memoryMb} MB`,
    required: false,
  });

  let diskFreeMb = 0;
  try {
    if (typeof fs.statfsSync === 'function') {
      const stats = fs.statfsSync(paths.root);
      diskFreeMb = Math.round((stats.bavail * stats.bsize) / 1024 / 1024);
    }
  } catch {}
  checks.push({
    id: 'disk',
    label: '磁盘空间不少于 2 GB',
    ok: diskFreeMb === 0 || diskFreeMb >= 2048,
    detail: diskFreeMb === 0 ? '未知' : `${diskFreeMb} MB`,
    required: false,
  });

  return {
    ok: checks.every((check) => !check.required || check.ok),
    checks,
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    memoryMb,
    diskFreeMb,
  };
}
