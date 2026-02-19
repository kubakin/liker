import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LikedUserEntity } from '../database/entities';

@Injectable()
export class LikedUserService {
  constructor(
    @InjectRepository(LikedUserEntity)
    private readonly repo: Repository<LikedUserEntity>,
  ) {}

  /** Сохранить пользователя как успешно лайкнутого (первый лайк сохраняется навсегда). */
  async addLiked(userId: number): Promise<void> {
    const id = String(userId);
    const now = String(Date.now());
    await this.repo
      .createQueryBuilder()
      .insert()
      .values({ userId: id, likedAt: now })
      .orIgnore()
      .execute();
  }

  async getCount(): Promise<number> {
    return this.repo.count();
  }

  async list(limit = 500, offset = 0): Promise<{ userId: number; likedAt: number }[]> {
    const rows = await this.repo.find({
      order: { likedAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return rows.map((r) => ({
      userId: parseInt(r.userId, 10),
      likedAt: Number(r.likedAt),
    }));
  }

  /** Все ID лайкнутых (для подсчёта конверсии). */
  async getAllUserIds(): Promise<Set<number>> {
    const rows = await this.repo.find({ select: ['userId'] });
    return new Set(rows.map((r) => parseInt(r.userId, 10)));
  }

  /** ID пользователей, лайкнутых после указанного времени (timestamp ms). */
  async getLikedUserIdsAfter(afterTimestamp: number): Promise<number[]> {
    const after = String(afterTimestamp);
    const rows = await this.repo
      .createQueryBuilder('l')
      .select('l.userId')
      .where('l.likedAt > :after', { after })
      .getMany();
    return rows.map((r) => parseInt(r.userId, 10));
  }
}
