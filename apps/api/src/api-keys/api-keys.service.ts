import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKeyEntity } from '../database/entities';

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly repo: Repository<ApiKeyEntity>,
  ) {}

  async list() {
    const keys = await this.repo.find({ order: { createdAt: 'ASC' } });
    return keys.map((k) => ({
      id: k.id,
      tokenMasked: this.maskToken(k.token),
      label: k.label ?? undefined,
      createdAt: Number(k.createdAt),
      lastUsedAt: k.lastUsedAt != null ? Number(k.lastUsedAt) : undefined,
      disabled: k.disabledAt != null,
    }));
  }

  async add(
    token: string,
    label?: string,
    vkidMeta?: { refreshToken: string; expiresInSeconds: number; deviceId: string },
  ) {
    const entity = this.repo.create({
      token: token.trim(),
      label: label?.trim() || null,
      createdAt: String(Date.now()),
      refreshToken: vkidMeta?.refreshToken?.trim() || null,
      expiresAt:
        vkidMeta?.expiresInSeconds != null
          ? String(Date.now() + vkidMeta.expiresInSeconds * 1000)
          : null,
      deviceId: vkidMeta?.deviceId?.trim() || null,
    });
    const saved = await this.repo.save(entity);
    return {
      id: saved.id,
      tokenMasked: this.maskToken(saved.token),
      label: saved.label ?? undefined,
      createdAt: Number(saved.createdAt),
    };
  }

  async addBulk(tokens: string[]) {
    const toInsert = tokens
      .filter((t) => typeof t === 'string' && t.trim().length > 0)
      .map((t) =>
        this.repo.create({
          token: t.trim(),
          createdAt: String(Date.now()),
        }),
      );
    if (toInsert.length === 0) return { added: 0, keys: [] };
    const saved = await this.repo.save(toInsert);
    return {
      added: saved.length,
      keys: saved.map((r) => ({
        id: r.id,
        tokenMasked: this.maskToken(r.token),
        createdAt: Number(r.createdAt),
      })),
    };
  }

  async remove(id: string) {
    const result = await this.repo.delete(id);
    return { removed: (result.affected ?? 0) > 0 };
  }

  async enableAll() {
    await this.repo.update({}, { disabledAt: null });
    return { ok: true };
  }

  async getKeyById(id: string): Promise<{ id: string; token: string } | null> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) return null;
    return { id: row.id, token: row.token };
  }

  /** Для VK ID: обновить access_token по refresh_token (срок жизни 1 ч). */
  async refreshVkidKeyIfExpired(id: string): Promise<boolean> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row?.refreshToken || !row?.deviceId) return false;
    const expiresAt = row.expiresAt ? Number(row.expiresAt) : 0;
    if (expiresAt > Date.now() + 5 * 60 * 1000) return false; // ещё не истёк (запас 5 мин)
    const clientId = process.env.VK_ID_APP_ID || process.env.VK_APP_ID;
    if (!clientId) return false;
    const state =
      'refresh_' +
      Math.random().toString(36).slice(2) +
      Math.random().toString(36).slice(2) +
      Date.now().toString(36);
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: row.refreshToken,
      client_id: clientId,
      device_id: row.deviceId,
      state,
    });
    const res = await fetch('https://id.vk.ru/oauth2/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (data.error || !data.access_token) return false;
    const newExpiresAt =
      data.expires_in != null ? String(Date.now() + data.expires_in * 1000) : null;
    await this.repo.update(id, {
      token: data.access_token,
      refreshToken: data.refresh_token ?? row.refreshToken,
      expiresAt: newExpiresAt,
    });
    return true;
  }

  async getNextAvailableToken(): Promise<ApiKeyEntity | null> {
    const rows = await this.repo
      .createQueryBuilder('k')
      .where('k.disabledAt IS NULL')
      .orderBy('k.lastUsedAt', 'ASC', 'NULLS FIRST')
      .take(1)
      .getMany();
    return rows[0] ?? null;
  }

  async markKeyUsed(id: string) {
    await this.repo.update(id, { lastUsedAt: String(Date.now()) });
  }

  async disableKey(id: string) {
    await this.repo.update(id, { disabledAt: String(Date.now()) });
  }

  maskToken(token: string): string {
    if (token.length <= 8) return '***';
    return token.slice(0, 4) + '…' + token.slice(-4);
  }
}
