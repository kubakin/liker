import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { AuthController } from './auth.controller';
import { AuthVkService } from './auth-vk.service';
import { AuthVkidService } from './auth-vkid.service';

@Module({
  imports: [ApiKeysModule],
  controllers: [AuthController],
  providers: [AuthVkService, AuthVkidService],
})
export class AuthModule {}
