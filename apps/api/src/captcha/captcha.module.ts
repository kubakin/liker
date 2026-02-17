import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { VkModule } from '../vk/vk.module';
import { PendingCaptchaEntity } from '../database/entities';
import { CaptchaController } from './captcha.controller';
import { CaptchaSolverService } from './captcha-solver.service';
import { CaptchaService } from './captcha.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PendingCaptchaEntity]),
    ApiKeysModule,
    VkModule,
  ],
  controllers: [CaptchaController],
  providers: [CaptchaSolverService, CaptchaService],
  exports: [CaptchaService],
})
export class CaptchaModule {}
