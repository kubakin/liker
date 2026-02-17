import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TargetsConfigEntity } from '../database/entities';
import { VkService } from '../vk/vk.service';
import { ApiKeysService } from '../api-keys/api-keys.service';

const DEFAULT_ID = 'default';

export interface TargetsConfig {
  kind: 'user_ids' | 'group';
  userIds?: string[];
  groupId?: string;
  /** Сколько участников группы загружать (1–10000, пачками по 1000). */
  groupMemberLimit?: number;
  /** Лайкать только у кого сегодня ДР. */
  onlyBirthdayToday?: boolean;
  /** Остановить джоб после этого количества успешных лайков. */
  maxSuccessfulLikes?: number | null;
  /** Диапазон возрастов (при фильтре ДР): мин. возраст. */
  minAge?: number | null;
  /** Диапазон возрастов (при фильтре ДР): макс. возраст. */
  maxAge?: number | null;
  updatedAt: number;
}

@Injectable()
export class TargetsService {
  constructor(
    @InjectRepository(TargetsConfigEntity)
    private readonly repo: Repository<TargetsConfigEntity>,
    private readonly vk: VkService,
    private readonly apiKeys: ApiKeysService,
  ) {}

  async get(): Promise<TargetsConfig> {
    let row = await this.repo.findOne({ where: { id: DEFAULT_ID } });
    if (!row) {
      row = this.repo.create({
        id: DEFAULT_ID,
        kind: 'user_ids',
        userIds: [],
        updatedAt: String(Date.now()),
      });
      await this.repo.save(row);
    }
    return {
      kind: row.kind as 'user_ids' | 'group',
      userIds: row.userIds ?? undefined,
      groupId: row.groupId ?? undefined,
      groupMemberLimit: row.groupMemberLimit ?? undefined,
      onlyBirthdayToday: row.onlyBirthdayToday ?? false,
      maxSuccessfulLikes: row.maxSuccessfulLikes ?? undefined,
      minAge: row.minAge ?? undefined,
      maxAge: row.maxAge ?? undefined,
      updatedAt: Number(row.updatedAt),
    };
  }

  async setJobLimits(maxSuccessfulLikes?: number | null, minAge?: number | null, maxAge?: number | null) {
    let row = await this.repo.findOne({ where: { id: DEFAULT_ID } });
    if (!row) {
      row = this.repo.create({
        id: DEFAULT_ID,
        kind: 'user_ids',
        userIds: [],
        updatedAt: String(Date.now()),
      });
      await this.repo.save(row);
    }
    if (maxSuccessfulLikes !== undefined) {
      row.maxSuccessfulLikes =
        maxSuccessfulLikes == null ? null : Math.max(0, Math.floor(Number(maxSuccessfulLikes)));
    }
    if (minAge !== undefined) {
      row.minAge = minAge == null ? null : Math.max(0, Math.min(120, Math.floor(Number(minAge))));
    }
    if (maxAge !== undefined) {
      row.maxAge = maxAge == null ? null : Math.max(0, Math.min(120, Math.floor(Number(maxAge))));
    }
    row.updatedAt = String(Date.now());
    await this.repo.save(row);
    return this.get();
  }

  async setUserIds(userIds: string[]) {
    const normalized = userIds
      .flatMap((s) => s.split(/[\s,]+/))
      .map((s) => s.trim().replace(/^.*vk\.com\/(id)?([0-9]+).*$/i, '$2'))
      .filter((s) => /^\d+$/.test(s));
    await this.upsert({
      kind: 'user_ids',
      userIds: [...new Set(normalized)],
      groupId: null,
    });
    return this.get();
  }

  async setGroup(groupId: string, groupMemberLimit?: number) {
    const normalized = this.vk.normalizeGroupId(groupId);
    if (!normalized) {
      throw new BadRequestException('Укажите ID группы или короткое имя (например club123 или group_name)');
    }

    const limit =
      groupMemberLimit != null
        ? Math.min(10000, Math.max(1, Math.floor(Number(groupMemberLimit))))
        : null;

    const key = await this.apiKeys.getNextAvailableToken();
    if (!key) {
      throw new BadRequestException('Добавьте хотя бы один API-ключ для проверки группы');
    }

    const res = await this.vk.groupsGetById(key.token, normalized);
    if (!res.ok) {
      const msg =
        res.errorCode === 100
          ? 'Группа не найдена. Проверьте ID или короткое имя.'
          : res.errorMsg || 'Группа недоступна';
      throw new BadRequestException(msg);
    }
    if (!res.data?.length) {
      throw new BadRequestException('Группа не найдена');
    }

    await this.upsert({
      kind: 'group',
      userIds: null,
      groupId: normalized,
      groupMemberLimit: limit,
    });
    return this.get();
  }

  async setOnlyBirthdayToday(enabled: boolean) {
    let row = await this.repo.findOne({ where: { id: DEFAULT_ID } });
    if (!row) {
      row = this.repo.create({
        id: DEFAULT_ID,
        kind: 'user_ids',
        userIds: [],
        groupId: null,
        groupMemberLimit: null,
        onlyBirthdayToday: enabled,
        updatedAt: String(Date.now()),
      });
      await this.repo.save(row);
    } else {
      row.onlyBirthdayToday = enabled;
      row.updatedAt = String(Date.now());
      await this.repo.save(row);
    }
    return this.get();
  }

  async setGroupMemberLimit(limit: number) {
    const row = await this.repo.findOne({ where: { id: DEFAULT_ID } });
    if (!row || row.kind !== 'group') {
      throw new BadRequestException('Сначала укажите группу');
    }
    const value = Math.min(10000, Math.max(1, Math.floor(Number(limit))));
    row.groupMemberLimit = value;
    row.updatedAt = String(Date.now());
    await this.repo.save(row);
    return this.get();
  }

  private async upsert(data: {
    kind: string;
    userIds: string[] | null;
    groupId: string | null;
    groupMemberLimit?: number | null;
  }) {
    let row = await this.repo.findOne({ where: { id: DEFAULT_ID } });
    if (!row) {
      row = this.repo.create({
        id: DEFAULT_ID,
        kind: data.kind,
        userIds: data.userIds,
        groupId: data.groupId,
        groupMemberLimit: data.groupMemberLimit ?? null,
        updatedAt: String(Date.now()),
      });
    } else {
      row.kind = data.kind;
      row.userIds = data.userIds;
      row.groupId = data.groupId;
      row.groupMemberLimit = data.groupMemberLimit ?? row.groupMemberLimit ?? null;
      row.updatedAt = String(Date.now());
    }
    await this.repo.save(row);
  }
}
