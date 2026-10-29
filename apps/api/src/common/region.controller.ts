import { Controller, Get } from '@nestjs/common';
import { regionOption } from '@uiliuili/shared';
import type { AuthUser } from './auth-user';
import { CurrentUser, OptionalAuth, Public } from './decorators';
import { currentRegionContext } from './region-context';
import { RegionService } from './region.service';

@Controller('api/v1/region')
export class RegionController {
  constructor(private readonly region: RegionService) {}

  @Public()
  @Get('options')
  options() {
    return this.region.options();
  }

  @Public()
  @OptionalAuth()
  @Get('context')
  context(@CurrentUser() user?: AuthUser) {
    const context = currentRegionContext();
    const option = regionOption(context.code);
    const unrestricted = Boolean(context.code) && !context.blockedRegions.includes(context.code);
    return {
      region: {
        code: context.code,
        name: option?.name ?? context.code,
        nameEn: option?.nameEn ?? context.code,
      },
      source: context.source,
      unrestricted,
      showRestricted: context.showRestricted,
      restrictedAllowed: context.restrictedAllowed,
      canUploadRestricted: Boolean(user) && unrestricted,
      canManageRegions: Boolean(user?.permissions.includes('settings:content')),
      blockedRegions: context.blockedRegions,
      defaultBehavior: context.defaultBehavior,
      defaultMessage: context.defaultMessage,
    };
  }
}
