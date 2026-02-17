import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PendingCaptchaEntity } from '../database/entities';

export interface PendingCaptchaDto {
  sid: string;
  img: string;
  keyId: string;
  ownerId: number;
  itemId: number;
  createdAt: number;
}

@Injectable()
export class CaptchaService {
  constructor(
    @InjectRepository(PendingCaptchaEntity)
    private readonly repo: Repository<PendingCaptchaEntity>,
  ) {}

  async addPending(sid: string, img: string, keyId: string, ownerId: number, itemId: number) {
    const existing = await this.repo.findOne({ where: { sid } });
    if (existing) return this.toDto(existing);
    const entity = this.repo.create({
      sid,
      img,
      keyId,
      ownerId,
      itemId,
      createdAt: String(Date.now()),
    });
    const saved = await this.repo.save(entity);
    return this.toDto(saved);
  }

  async listPending(): Promise<PendingCaptchaDto[]> {
    const rows = await this.repo.find({ order: { createdAt: 'DESC' } });
    return rows.map((r) => this.toDto(r));
  }

  async getPending(sid: string): Promise<PendingCaptchaDto | null> {
    const row = await this.repo.findOne({ where: { sid } });
    return row ? this.toDto(row) : null;
  }

  async removePending(sid: string): Promise<boolean> {
    const result = await this.repo.delete(sid);
    return (result.affected ?? 0) > 0;
  }

  private toDto(row: PendingCaptchaEntity): PendingCaptchaDto {
    return {
      sid: row.sid,
      img: row.img,
      keyId: row.keyId,
      ownerId: row.ownerId,
      itemId: row.itemId,
      createdAt: Number(row.createdAt),
    };
  }
}
