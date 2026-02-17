import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { VkModule } from './vk/vk.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { TargetsModule } from './targets/targets.module';
import { JobsModule } from './jobs/jobs.module';
import { CaptchaModule } from './captcha/captcha.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    DatabaseModule,
    VkModule,
    ApiKeysModule,
    TargetsModule,
    JobsModule,
    CaptchaModule,
    AuthModule,
  ],
})
export class AppModule {}
