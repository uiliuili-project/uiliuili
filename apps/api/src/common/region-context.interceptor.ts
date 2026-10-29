import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { type Observable, defer } from 'rxjs';
import type { RequestWithUser } from './auth-user';
import { runWithRegionContext } from './region-context';
import { RegionService } from './region.service';

/**
 * Resolves the request region once per request and carries it through
 * AsyncLocalStorage so list queries and access checks share the same policy.
 */
@Injectable()
export class RegionContextInterceptor implements NestInterceptor {
  constructor(private readonly region: RegionService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const value = await this.region.resolve(request);
    return defer(() => runWithRegionContext(value, () => next.handle()));
  }
}
