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

/**
 * Directory that holds installer state: `.env`, `config/instance.json` and `storage`.
 *
 * Defaults to the process working directory for source and systemd installs.
 * Containers set `UILIUILI_ROOT` (for example `/data`) so application code can
 * stay read-only while state lives on a persistent volume.
 */
export function runtimeRoot(override?: string): string {
  const configured = override?.trim() || process.env.UILIUILI_ROOT?.trim() || process.cwd();
  return path.resolve(configured);
}

export function resolveInstallerPaths(root = runtimeRoot()): InstallerPaths {
  const resolvedRoot = runtimeRoot(root);
  const configDir = path.join(resolvedRoot, 'config');
  const storageDir = path.join(resolvedRoot, 'storage');
  return {
    root: resolvedRoot,
    configDir,
    instanceFile: path.join(configDir, 'instance.json'),
    envFile: path.join(resolvedRoot, '.env'),
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
