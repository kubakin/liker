import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('group_export')
export class GroupExportEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  groupId!: string;

  @Column({ type: 'bigint' })
  exportedAt!: string;
}
