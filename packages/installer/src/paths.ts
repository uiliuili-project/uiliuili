import fs from 'node:fs';
import path from 'node:path';

export interface InstallerPaths {
  root: string;
  configDir: string;
  instanceFile: string;
  envFile: string;
  storageDir: string;
  installTokenFile: string;
  installSessionDir: string;
}

export function resolveInstallerPaths(root = process.cwd()): InstallerPaths {
  const configDir = path.join(root, 'config');
  const storageDir = path.join(root, 'storage');
  return {
    root,
    configDir,
    instanceFile: path.join(configDir, 'instance.json'),
    envFile: path.join(root, '.env'),
    storageDir,
    installTokenFile: path.join(storageDir, 'install-token'),
    installSessionDir: path.join(storageDir, 'install-sessions'),
  };
}

export function ensureRuntimeDirs(paths: InstallerPaths): void {
  fs.mkdirSync(paths.configDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(paths.storageDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(paths.installSessionDir, { recursive: true, mode: 0o700 });
}

export function writeFileAtomic(file: string, content: string, mode = 0o600): void {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, content, { mode });
  fs.renameSync(temporary, file);
  try {
    fs.chmodSync(file, mode);
  } catch {}
}
