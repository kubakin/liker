import { Entity, PrimaryColumn, Column } from 'typeorm';

/** Пользователи, которых уже обработали (проверили/лайкнули) в указанную дату — чтобы не повторяться. */
@Entity('processed_user')
export class ProcessedUserEntity {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  processedDate!: string; // YYYY-MM-DD

  @PrimaryColumn({ type: 'bigint' })
  userId!: string; // number as string for bigint

  /** success = лайк поставлен, skipped = пропущен (нет поста / уже лайкнуто / капча), error = ошибка стены/лайка */
  @Column({ type: 'varchar', length: 20, default: 'success' })
  status!: string;

  @Column({ type: 'bigint', default: () => '0' })
  createdAt!: string;
}
