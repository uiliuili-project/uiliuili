import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { config } from '../config';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CookieService } from './cookie.service';
import { CsrfGuard } from './csrf.guard';
import { OAuthService } from './oauth.service';
import { PermissionsGuard } from './permissions.guard';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: config.appKey || 'uiliuili-install-mode',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    CookieService,
    OAuthService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [AuthService, CookieService, OAuthService],
})
export class AuthModule {}
