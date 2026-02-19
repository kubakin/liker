import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobStateEntity, ProcessedUserEntity } from '../database/entities';
import { VkModule } from '../vk/vk.module';
import { TargetsModule } from '../targets/targets.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { CaptchaModule } from '../captcha/captcha.module';
import { LikedUserModule } from '../liked-user/liked-user.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([JobStateEntity, ProcessedUserEntity]),
    VkModule,
    TargetsModule,
    ApiKeysModule,
    CaptchaModule,
    LikedUserModule,
  ],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
