import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { GroupExportEntity, GroupExportMemberEntity, LikedUserEntity } from '../database/entities';
import { VkService } from '../vk/vk.service';

@Injectable()
export class GroupExportService {
  constructor(
    @InjectRepository(GroupExportEntity)
    private readonly exportRepo: Repository<GroupExportEntity>,
    @InjectRepository(GroupExportMemberEntity)
    private readonly memberRepo: Repository<GroupExportMemberEntity>,
    @InjectRepository(LikedUserEntity)
    private readonly likedRepo: Repository<LikedUserEntity>,
    private readonly apiKeys: ApiKeysService,
    private readonly vk: VkService,
  ) {}

  /** Выгрузить всех участников группы и сохранить в БД. */
  async exportGroup(groupId: string): Promise<
    | { ok: true; exportId: string; groupId: string; count: number; exportedAt: number }
    | { ok: false; error: string }
  > {
    const normalized = this.vk.normalizeGroupId(groupId);
    if (!normalized) {
      return { ok: false, error: 'Некорректный ID группы' };
    }
    const tokenRecord = await this.apiKeys.getNextAvailableToken();
    if (!tokenRecord) {
      return { ok: false, error: 'Нет доступного API ключа' };
    }
    const res = await this.vk.groupsGetAllMembers(tokenRecord.token, normalized);
    if (!res.ok) {
      return { ok: false, error: res.errorMsg || 'Не удалось загрузить участников' };
    }
    const userIds = res.data.items ?? [];
    const exportedAt = Date.now();
    const exportRow = this.exportRepo.create({
      groupId: normalized,
      exportedAt: String(exportedAt),
    });
    const saved = await this.exportRepo.save(exportRow);
    if (userIds.length > 0) {
      const BATCH = 2000;
      for (let i = 0; i < userIds.length; i += BATCH) {
        const chunk = userIds.slice(i, i + BATCH).map((uid) => ({
          exportId: saved.id,
          userId: String(uid),
        }));
        await this.memberRepo
          .createQueryBuilder()
          .insert()
          .into(GroupExportMemberEntity)
          .values(chunk)
          .orIgnore()
          .execute();
      }
    }
    return {
      ok: true,
      exportId: saved.id,
      groupId: normalized,
      count: userIds.length,
      exportedAt,
    };
  }

  async listExports(groupId?: string): Promise<{ id: string; groupId: string; count: number; exportedAt: number }[]> {
    const where = groupId && this.vk.normalizeGroupId(groupId)
      ? { groupId: this.vk.normalizeGroupId(groupId)! }
      : {};
    const exports = await this.exportRepo.find({
      where,
      order: { exportedAt: 'DESC' },
    });
    const result: { id: string; groupId: string; count: number; exportedAt: number }[] = [];
    for (const e of exports) {
      const count = await this.memberRepo.count({ where: { exportId: e.id } });
      result.push({
        id: e.id,
        groupId: e.groupId,
        count,
        exportedAt: Number(e.exportedAt),
      });
    }
    return result;
  }

  async getExport(exportId: string): Promise<{ id: string; groupId: string; count: number; exportedAt: number } | null> {
    const row = await this.exportRepo.findOne({ where: { id: exportId } });
    if (!row) return null;
    const count = await this.memberRepo.count({ where: { exportId } });
    return {
      id: row.id,
      groupId: row.groupId,
      count,
      exportedAt: Number(row.exportedAt),
    };
  }

  async getExportMemberIds(exportId: string, limit = 10000, offset = 0): Promise<number[]> {
    const rows = await this.memberRepo.find({
      where: { exportId },
      order: { userId: 'ASC' },
      take: limit,
      skip: offset,
      select: ['userId'],
    });
    return rows.map((r) => parseInt(r.userId, 10));
  }

  /** Конверсия: сколько участников выгрузки уже лайкнуты. */
  async getConversion(
    exportId: string,
  ): Promise<{ exportId: string; totalInExport: number; likedFromExport: number; totalLikedEver: number } | null> {
    const exp = await this.exportRepo.findOne({ where: { id: exportId } });
    if (!exp) return null;
    const totalInExport = await this.memberRepo.count({ where: { exportId } });
    const totalLikedEver = await this.likedRepo.count();
    const likedFromExport = await this.memberRepo
      .createQueryBuilder('m')
      .innerJoin(LikedUserEntity, 'l', 'l.userId = m.userId')
      .where('m.exportId = :id', { id: exportId })
      .getCount();
    return {
      exportId,
      totalInExport,
      likedFromExport,
      totalLikedEver,
    };
  }

  /**
   * Лайки после выгрузки и сколько из них пришли в группу (на сегодня).
   * Выбираем выгрузку → смотрим, кого лайкнули после её даты → сверяем с текущим составом группы из VK.
   */
  async getAfterExportStats(
    exportId: string,
  ): Promise<{
    exportId: string;
    exportedAt: number;
    groupId: string;
    likedAfterExportCount: number;
    currentGroupCount: number;
    cameToGroupCount: number;
    error?: string;
  } | null> {
    const exp = await this.exportRepo.findOne({ where: { id: exportId } });
    if (!exp) return null;
    const exportedAt = Number(exp.exportedAt);
    const likedRows = await this.likedRepo
      .createQueryBuilder('l')
      .select('l.userId')
      .where('l.likedAt > :after', { after: String(exportedAt) })
      .getMany();
    const likedAfterExportIds = new Set(likedRows.map((r) => parseInt(r.userId, 10)));
    const tokenRecord = await this.apiKeys.getNextAvailableToken();
    if (!tokenRecord) {
      return {
        exportId,
        exportedAt,
        groupId: exp.groupId,
        likedAfterExportCount: likedAfterExportIds.size,
        currentGroupCount: 0,
        cameToGroupCount: 0,
        error: 'Нет доступного API ключа для загрузки текущего состава группы',
      };
    }
    const res = await this.vk.groupsGetAllMembers(tokenRecord.token, exp.groupId);
    if (!res.ok) {
      return {
        exportId,
        exportedAt,
        groupId: exp.groupId,
        likedAfterExportCount: likedAfterExportIds.size,
        currentGroupCount: 0,
        cameToGroupCount: 0,
        error: res.errorMsg || 'Не удалось загрузить текущий состав группы',
      };
    }
    const currentMemberIds = new Set(res.data.items ?? []);
    const wasInExportIds = await this.getExportMemberIdSet(exportId);
    let cameToGroupCount = 0;
    for (const uid of likedAfterExportIds) {
      if (currentMemberIds.has(uid) && !wasInExportIds.has(uid)) cameToGroupCount++;
    }
    return {
      exportId,
      exportedAt,
      groupId: exp.groupId,
      likedAfterExportCount: likedAfterExportIds.size,
      currentGroupCount: currentMemberIds.size,
      cameToGroupCount,
    };
  }

  /** Список ID пользователей: лайкнуты после выгрузки и сейчас в группе, но не были в выгрузке (реально пришли от лайков). */
  async getCameFromLikesList(exportId: string): Promise<{ userIds: number[]; count: number } | null> {
    const exp = await this.exportRepo.findOne({ where: { id: exportId } });
    if (!exp) return null;
    const exportedAt = Number(exp.exportedAt);
    const likedRows = await this.likedRepo
      .createQueryBuilder('l')
      .select('l.userId')
      .where('l.likedAt > :after', { after: String(exportedAt) })
      .getMany();
    const likedAfterExportIds = new Set(likedRows.map((r) => parseInt(r.userId, 10)));
    const tokenRecord = await this.apiKeys.getNextAvailableToken();
    if (!tokenRecord) return { userIds: [], count: 0 };
    const res = await this.vk.groupsGetAllMembers(tokenRecord.token, exp.groupId);
    if (!res.ok) return { userIds: [], count: 0 };
    const currentMemberIds = new Set(res.data.items ?? []);
    const wasInExportIds = await this.getExportMemberIdSet(exportId);
    const userIds = [...likedAfterExportIds]
      .filter((uid) => currentMemberIds.has(uid) && !wasInExportIds.has(uid))
      .sort((a, b) => a - b);
    return { userIds, count: userIds.length };
  }

  private async getExportMemberIdSet(exportId: string): Promise<Set<number>> {
    const rows = await this.memberRepo.find({
      where: { exportId },
      select: ['userId'],
    });
    return new Set(rows.map((r) => parseInt(r.userId, 10)));
  }
}
