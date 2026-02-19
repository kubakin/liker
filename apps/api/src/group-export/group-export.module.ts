import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { GroupExportEntity, GroupExportMemberEntity, LikedUserEntity } from '../database/entities';
import { VkModule } from '../vk/vk.module';
import { GroupExportController } from './group-export.controller';
import { GroupExportService } from './group-export.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([GroupExportEntity, GroupExportMemberEntity, LikedUserEntity]),
    ApiKeysModule,
    VkModule,
  ],
  controllers: [GroupExportController],
  providers: [GroupExportService],
  exports: [GroupExportService],
})
export class GroupExportModule {}
