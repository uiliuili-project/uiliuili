import crypto from 'node:crypto';
import fs from 'node:fs';
import { ensureRuntimeDirs, resolveInstallerPaths, runtimeRoot, writeFileAtomic } from './paths';

export function getOrCreateInstallToken(root = runtimeRoot()): string {
  if (process.env.INSTALL_TOKEN) return process.env.INSTALL_TOKEN;
  const paths = resolveInstallerPaths(root);
  ensureRuntimeDirs(paths);
  if (fs.existsSync(paths.installTokenFile)) {
    const existing = fs.readFileSync(paths.installTokenFile, 'utf8').trim();
    if (existing) return existing;
  }
  const token = crypto.randomBytes(24).toString('base64url');
  writeFileAtomic(paths.installTokenFile, `${token}\n`, 0o600);
  return token;
}

export function verifyInstallToken(root: string, input: string): boolean {
  const expected = getOrCreateInstallToken(root);
  const left = Buffer.from(expected);
  const right = Buffer.from(input ?? '');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function clearInstallToken(root = runtimeRoot()): void {
  const paths = resolveInstallerPaths(root);
  fs.rmSync(paths.installTokenFile, { force: true });
  fs.rmSync(paths.installSessionDir, { recursive: true, force: true });
}

export function isLoopback(address: string | undefined): boolean {
  if (!address) return false;
  return (
    address === '127.0.0.1' ||
    address === '::1' ||
    address === '::ffff:127.0.0.1' ||
    address.startsWith('127.')
  );
}
