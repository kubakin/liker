import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LikedUserEntity } from '../database/entities';
import { LikedUserController } from './liked-user.controller';
import { LikedUserService } from './liked-user.service';

@Module({
  imports: [TypeOrmModule.forFeature([LikedUserEntity])],
  controllers: [LikedUserController],
  providers: [LikedUserService],
  exports: [LikedUserService],
})
export class LikedUserModule {}
