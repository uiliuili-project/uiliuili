import crypto from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppError, ERROR_CODES } from '@uiliuili/shared';
import { StorageService } from './storage.service';

export interface ImageUploadResult {
  key: string;
  url: string;
  contentType: string;
  bytes: number;
}

interface DetectedImage {
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
}

/**
 * Validates and stores user-uploaded images. Only raster formats are accepted;
 * SVG is rejected because it can carry scripts. The declared content type is
 * ignored in favour of the real file signature.
 */
@Injectable()
export class ImageUploadService {
  constructor(private readonly storage: StorageService) {}

  async save(
    prefix: string,
    buffer: Buffer,
    maxBytes = 10 * 1024 * 1024,
  ): Promise<ImageUploadResult> {
    if (!buffer || buffer.length === 0) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '图片内容为空', 400);
    }
    const detected = this.detect(buffer);
    if (!detected) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '图片只支持 JPEG、PNG 或 WebP', 400);
    }
    if (buffer.length > maxBytes) {
      const limitMb = Math.floor(maxBytes / 1024 / 1024);
      throw new AppError(ERROR_CODES.BAD_REQUEST, `图片不能超过 ${limitMb} MB`, 400);
    }
    const unique = `${Date.now().toString(36)}-${crypto.randomUUID()}`;
    const key = `${prefix.replace(/\/+$/, '')}/${unique}.${detected.extension}`;
    const provider = await this.storage.provider();
    await provider.putObject(key, buffer, detected.contentType);
    return {
      key,
      url: this.publicUrl(key),
      contentType: detected.contentType,
      bytes: buffer.length,
    };
  }

  /** Best-effort deletion used when replacing an image. */
  async removeByUrl(url: string | null | undefined): Promise<void> {
    const key = this.keyFromUrl(url);
    if (!key) return;
    try {
      const provider = await this.storage.provider();
      await provider.deleteObject(key);
    } catch {
      // Orphaned objects are harmless; never fail the user request for this.
    }
  }

  publicUrl(key: string): string {
    return `/media/${key
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/')}`;
  }

  keyFromUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    const marker = '/media/';
    const index = url.indexOf(marker);
    if (index < 0) return null;
    const raw = url
      .slice(index + marker.length)
      .split('?')[0]
      .split('/')
      .map((part) => {
        try {
          return decodeURIComponent(part);
        } catch {
          return part;
        }
      })
      .join('/');
    return raw || null;
  }

  private detect(buffer: Buffer): DetectedImage | null {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { contentType: 'image/jpeg', extension: 'jpg' };
    }
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { contentType: 'image/png', extension: 'png' };
    }
    if (
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
      return { contentType: 'image/webp', extension: 'webp' };
    }
    return null;
  }
}
