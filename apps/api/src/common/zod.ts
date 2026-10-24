import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: '请求参数校验失败',
        details: result.error.flatten(),
      });
    }
    return result.data;
  }
}

export function zodBody<T>(schema: ZodType<T>): ZodPipe<T> {
  return new ZodPipe(schema);
}

export function zodQuery<T>(schema: ZodType<T>): ZodPipe<T> {
  return new ZodPipe(schema);
}
