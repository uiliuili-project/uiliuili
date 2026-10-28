import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
  imports: [AdminModule],
  controllers: [ReviewController],
  providers: [ReviewService],
})
export class ReviewModule {}
