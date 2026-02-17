import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('pending_captcha')
export class PendingCaptchaEntity {
  @PrimaryColumn()
  sid!: string;

  @Column({ type: 'text' })
  img!: string;

  @Column()
  keyId!: string;

  @Column({ type: 'int' })
  ownerId!: number;

  @Column({ type: 'int' })
  itemId!: number;

  @Column({ type: 'bigint' })
  createdAt!: string;
}
