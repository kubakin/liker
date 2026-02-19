import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('group_export_member')
export class GroupExportMemberEntity {
  @PrimaryColumn('uuid')
  exportId!: string;

  @PrimaryColumn({ type: 'bigint' })
  userId!: string;
}
