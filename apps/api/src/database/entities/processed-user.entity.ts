import { Entity, PrimaryColumn, Column } from 'typeorm';

/** Пользователи, которых уже обработали (проверили/лайкнули) в указанную дату — чтобы не повторяться. */
@Entity('processed_user')
export class ProcessedUserEntity {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  processedDate!: string; // YYYY-MM-DD

  @PrimaryColumn({ type: 'bigint' })
  userId!: string; // number as string for bigint

  @Column({ type: 'bigint', default: () => '0' })
  createdAt!: string;
}
