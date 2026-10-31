import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

export class NodeStorage {
  readonly root: string;
  private readonly uploadRoot: string;

  constructor(root: string) {
    this.root = path.resolve(root);
    this.uploadRoot = path.join(this.root, 'uploads');
  }

  async ensureReady(): Promise<void> {
    await fsp.mkdir(this.uploadRoot, { recursive: true });
    await fsp.mkdir(path.join(this.root, 'assets'), { recursive: true });
  }

  resolve(key: string): string {
    const normalized = path.posix.normalize(key.replaceAll('\\', '/')).replace(/^\/+/, '');
    if (
      normalized === '' ||
      normalized.startsWith('../') ||
      normalized.includes('/../') ||
      normalized === '..'
    ) {
      throw new Error('Invalid storage key');
    }
    const target = path.join(this.root, normalized);
    if (!target.startsWith(`${this.root}${path.sep}`) && target !== this.root) {
      throw new Error('Invalid storage key');
    }
    return target;
  }

  uploadDir(uploadId: string): string {
    return this.resolve(`uploads/${uploadId}`);
  }

  partPath(uploadId: string, partNumber: number): string {
    return this.resolve(`uploads/${uploadId}/part_${String(partNumber).padStart(6, '0')}`);
  }

  async writePart(uploadId: string, partNumber: number, body: Buffer): Promise<string> {
    const target = this.partPath(uploadId, partNumber);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(target, body);
    return crypto.createHash('sha256').update(body).digest('hex');
  }

  async assemble(uploadId: string, assetId: string, extension: string): Promise<string> {
    const sourceKey = `assets/${assetId}/source${extension ? `.${extension}` : ''}`;
    const target = this.resolve(sourceKey);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    const directory = this.uploadDir(uploadId);
    const files = (await fsp.readdir(directory)).filter((file) => /^part_\d+$/.test(file)).sort();
    if (files.length === 0) throw new Error('No uploaded parts found');
    await fsp.writeFile(target, Buffer.alloc(0));
    for (const file of files) {
      await pipeline(
        fs.createReadStream(path.join(directory, file)),
        fs.createWriteStream(target, { flags: 'a' }),
      );
    }
    return sourceKey;
  }

  async removeUpload(uploadId: string): Promise<void> {
    await fsp.rm(this.uploadDir(uploadId), { recursive: true, force: true });
  }

  async removeAsset(assetId: string): Promise<void> {
    await fsp.rm(this.resolve(`assets/${assetId}`), { recursive: true, force: true });
  }

  async usageBytes(): Promise<number> {
    let total = 0;
    const walk = async (directory: string): Promise<void> => {
      let entries: fs.Dirent[];
      try {
        entries = await fsp.readdir(directory, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) await walk(full);
        else {
          try {
            total += (await fsp.stat(full)).size;
          } catch {
            // The file may have been removed between readdir and stat.
          }
        }
      }
    };
    await walk(this.root);
    return total;
  }
}
