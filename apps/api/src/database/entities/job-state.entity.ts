import { Entity, PrimaryColumn, Column } from 'typeorm';

export interface LogEntryDto {
  id: string;
  ts: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  meta?: Record<string, unknown>;
}

@Entity('job_state')
export class JobStateEntity {
  @PrimaryColumn({ default: 'default' })
  id!: string;

  @Column({ type: 'varchar', length: 20, default: 'idle' })
  status!: string;

  @Column({ type: 'bigint', nullable: true })
  startedAt!: string | null;

  @Column({ type: 'bigint', nullable: true })
  stoppedAt!: string | null;

  @Column({ type: 'int', default: 0 })
  totalTargets!: number;

  @Column({ type: 'int', default: 0 })
  processed!: number;

  @Column({ type: 'int', default: 0 })
  liked!: number;

  @Column({ type: 'int', default: 0 })
  skipped!: number;

  @Column({ type: 'int', default: 0 })
  errors!: number;

  @Column({ type: 'varchar', nullable: true })
  currentKeyId!: string | null;

  @Column({ type: 'jsonb', default: [] })
  logs!: LogEntryDto[];
}
