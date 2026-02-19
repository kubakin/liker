import { Entity, PrimaryColumn, Column } from 'typeorm';

/** Пользователи, которым успешно поставили лайк (навсегда, для конверсии). */
@Entity('liked_user')
export class LikedUserEntity {
  @PrimaryColumn({ type: 'bigint' })
  userId!: string;

  @Column({ type: 'bigint' })
  likedAt!: string;
}
