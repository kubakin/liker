import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('api_key')
export class ApiKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 512 })
  token!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  label!: string | null;

  @Column({ type: 'bigint' })
  createdAt!: string;

  @Column({ type: 'bigint', nullable: true })
  lastUsedAt!: string | null;

  @Column({ type: 'bigint', nullable: true })
  disabledAt!: string | null;

  /** VK ID: refresh_token для обновления (срок жизни access_token 1 час). */
  @Column({ type: 'varchar', length: 1024, nullable: true })
  refreshToken!: string | null;

  /** VK ID: истекает в (ms), для авто-обновления. */
  @Column({ type: 'bigint', nullable: true })
  expiresAt!: string | null;

  /** VK ID: device_id нужен для refresh. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  deviceId!: string | null;
}
