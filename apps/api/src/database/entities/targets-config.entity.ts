import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('targets_config')
export class TargetsConfigEntity {
  @PrimaryColumn({ default: 'default' })
  id!: string;

  @Column({ type: 'varchar', length: 20, default: 'user_ids' })
  kind!: string;

  @Column({ type: 'jsonb', nullable: true })
  userIds!: string[] | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  groupId!: string | null;

  /** Лимит участников группы (1–10000, загрузка пачками по 1000), когда цели берутся из группы. */
  @Column({ type: 'int', nullable: true })
  groupMemberLimit!: number | null;

  /** Лайкать только у кого сегодня день рождения. */
  @Column({ type: 'boolean', default: false })
  onlyBirthdayToday!: boolean;

  /** Остановить джоб после этого количества успешных лайков (null = без лимита). */
  @Column({ type: 'int', nullable: true })
  maxSuccessfulLikes!: number | null;

  /** Диапазон возрастов (при фильтре по ДР): минимальный возраст, null = не ограничено. */
  @Column({ type: 'int', nullable: true })
  minAge!: number | null;

  /** Диапазон возрастов (при фильтре по ДР): максимальный возраст, null = не ограничено. */
  @Column({ type: 'int', nullable: true })
  maxAge!: number | null;

  @Column({ type: 'bigint' })
  updatedAt!: string;
}
