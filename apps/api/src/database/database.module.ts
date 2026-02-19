import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ApiKeyEntity,
  TargetsConfigEntity,
  PendingCaptchaEntity,
  JobStateEntity,
  ProcessedUserEntity,
  GroupExportEntity,
  GroupExportMemberEntity,
  LikedUserEntity,
} from './entities';

function getTypeOrmOptions() {
  const url = process.env.DATABASE_URL;
  const passwordOverride = process.env.DATABASE_PASSWORD;
  const base = {
    type: 'postgres' as const,
    entities: [
      ApiKeyEntity,
      TargetsConfigEntity,
      PendingCaptchaEntity,
      JobStateEntity,
      ProcessedUserEntity,
      GroupExportEntity,
      GroupExportMemberEntity,
      LikedUserEntity,
    ],
    synchronize: true,
    logging: process.env.TYPEORM_LOGGING === 'true',
    password: '', // pg требует строку
  };
  if (!url) return base;
  try {
    const u = new URL(url);
    const password =
      passwordOverride !== undefined && passwordOverride !== ''
        ? String(passwordOverride)
        : (u.password != null ? String(u.password) : '');
    return {
      ...base,
      host: u.hostname || 'localhost',
      port: u.port ? parseInt(u.port, 10) : 5432,
      username: u.username || undefined,
      password,
      database: u.pathname ? u.pathname.slice(1).replace(/^\/+/, '') : undefined,
    };
  } catch {
    return base;
  }
}

@Module({
  imports: [TypeOrmModule.forRoot(getTypeOrmOptions())],
})
export class DatabaseModule {}
