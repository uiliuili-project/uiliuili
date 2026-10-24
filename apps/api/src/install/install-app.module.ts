import { Module } from '@nestjs/common';
import { HealthController } from '../health.controller';
import { InstallModule } from './install.module';

@Module({
  imports: [InstallModule],
  controllers: [HealthController],
})
export class InstallAppModule {}
