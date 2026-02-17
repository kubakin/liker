import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { PendingCaptchaEntity } from '../database/entities';
import { VkService } from '../vk/vk.service';
import { CaptchaSolverService } from './captcha-solver.service';

export interface PendingCaptchaDto {
  sid: string;
  img: string;
  keyId: string;
  ownerId: number;
  itemId: number;
  createdAt: number;
}

export interface SubmitResult {
  ok: boolean;
  likes?: number;
  errorCode?: number;
  errorMsg?: string;
}

@Injectable()
export class CaptchaService {
  constructor(
    @InjectRepository(PendingCaptchaEntity)
    private readonly repo: Repository<PendingCaptchaEntity>,
    private readonly apiKeys: ApiKeysService,
    private readonly vk: VkService,
    @Optional() private readonly solver: CaptchaSolverService | null,
  ) {}

  async addPending(sid: string, img: string, keyId: string, ownerId: number, itemId: number) {
    const existing = await this.repo.findOne({ where: { sid } });
    if (existing) return this.toDto(existing);
    const imgData = await this.normalizeCaptchaImage(img);
    const entity = this.repo.create({
      sid,
      img: imgData,
      keyId,
      ownerId,
      itemId,
      createdAt: String(Date.now()),
    });
    const saved = await this.repo.save(entity);
    if (this.solver?.isConfigured()) {
      this.runAutoSolve(saved.sid).catch(() => {});
    }
    return this.toDto(saved);
  }

  /** Отправить решение капчи в VK (лайк с captcha_key) и удалить из очереди. */
  async submitSolution(sid: string, key: string): Promise<SubmitResult> {
    const pending = await this.getPending(sid);
    if (!pending) return { ok: false, errorMsg: 'captcha not found or already solved' };
    const keyRecord = await this.apiKeys.getKeyById(pending.keyId);
    if (!keyRecord) return { ok: false, errorMsg: 'api key not found' };
    const result = await this.vk.likesAdd(
      keyRecord.token,
      'post',
      pending.ownerId,
      pending.itemId,
      pending.sid,
      key,
    );
    await this.removePending(sid);
    if (result.ok) return { ok: true, likes: result.data.likes };
    return { ok: false, errorCode: result.errorCode, errorMsg: result.errorMsg };
  }

  /** Загружает картинку по URL с сервера и возвращает data URL, чтобы в браузере не запрашивать VK (там отдают HTML с «установите новую версию»). */
  private async normalizeCaptchaImage(img: string): Promise<string> {
    const trimmed = img.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return img;
    }
    try {
      const res = await fetch(trimmed, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Liker/1.0)' },
      });
      if (!res.ok) return img;
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.startsWith('image/')) return img;
      const buf = await res.arrayBuffer();
      const b64 = Buffer.from(buf).toString('base64');
      const mime = contentType.split(';')[0].trim() || 'image/png';
      return `data:${mime};base64,${b64}`;
    } catch {
      return img;
    }
  }

  private async runAutoSolve(sid: string): Promise<void> {
    const pending = await this.getPending(sid);
    if (!pending) return;
    const key = await this.solver!.solve(pending.img);
    if (key) await this.submitSolution(sid, key);
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
