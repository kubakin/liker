import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TargetsConfigEntity } from '../database/entities';
import { VkModule } from '../vk/vk.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { TargetsController } from './targets.controller';
import { TargetsService } from './targets.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TargetsConfigEntity]),
    VkModule,
    ApiKeysModule,
  ],
  controllers: [TargetsController],
  providers: [TargetsService],
  exports: [TargetsService],
})
export class TargetsModule {}
