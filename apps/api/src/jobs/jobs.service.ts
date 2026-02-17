import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VkService } from '../vk/vk.service';
import type { TargetsConfig } from '../targets/targets.service';
import { TargetsService } from '../targets/targets.service';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { CaptchaService } from '../captcha/captcha.service';
import { JobStateEntity, ProcessedUserEntity, type LogEntryDto } from '../database/entities';

const DEFAULT_JOB_ID = 'default';
const DELAY_MS = 3500;
const DELAY_AFTER_ERROR_MS = 10000;
const MAX_LOGS = 500;

export interface JobStateDto {
  status: string;
  startedAt?: number;
  stoppedAt?: number;
  totalTargets: number;
  processed: number;
  liked: number;
  skipped: number;
  errors: number;
  currentKeyId?: string;
  logs: LogEntryDto[];
}

@Injectable()
export class JobsService {
  private abortRequested = false;

  constructor(
    @InjectRepository(JobStateEntity)
    private readonly jobRepo: Repository<JobStateEntity>,
    @InjectRepository(ProcessedUserEntity)
    private readonly processedRepo: Repository<ProcessedUserEntity>,
    private readonly vk: VkService,
    private readonly targets: TargetsService,
    private readonly apiKeys: ApiKeysService,
    private readonly captcha: CaptchaService,
  ) {}

  async start() {
    const state = await this.getState();
    if (state.status === 'running') {
      return { error: 'Job already running' };
    }
    const keyRecord = await this.apiKeys.getNextAvailableToken();
    if (!keyRecord) {
      await this.addLog('error', 'Нет доступных API ключей. Добавьте ключи или включите отключённые.');
      return { error: 'No API keys available' };
    }
    const config = await this.targets.get();
    let userIds: number[] = [];
    if (config.kind === 'user_ids' && config.userIds?.length) {
      userIds = config.userIds.map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n));
    } else if (config.kind === 'group' && config.groupId) {
      const token = await this.apiKeys.getNextAvailableToken();
      if (!token) return { error: 'No API key to fetch group members' };
      const limit = config.groupMemberLimit ?? 1000;
      const res = await this.vk.groupsGetMembers(token.token, config.groupId, limit);
      if (!res.ok) {
        await this.addLog('error', `Не удалось получить участников группы: ${res.errorMsg}`, {
          errorCode: res.errorCode,
        });
        return { error: res.errorMsg };
      }
      userIds = res.data.items;
    }

    const today = this.getTodayDate();
    await this.cleanupOldProcessed(today);
    const processedToday = await this.getProcessedUserIdsForDate(today);
    const beforeExclude = userIds.length;
    userIds = userIds.filter((id) => !processedToday.has(id));
    if (beforeExclude > userIds.length) {
      await this.addLog(
        'info',
        `Исключено уже обработанных сегодня: ${beforeExclude} → ${userIds.length} целей`,
      );
    }

    if (config.onlyBirthdayToday && userIds.length > 0) {
      const token = await this.apiKeys.getNextAvailableToken();
      if (!token) {
        await this.addLog('warn', 'Нет ключа для проверки ДР — лайкаем всех.');
      } else {
        const withBirthdayToday = await this.filterUsersWithBirthdayToday(
          token.token,
          userIds,
          config.minAge ?? undefined,
          config.maxAge ?? undefined,
        );
        await this.addLog(
          'info',
          `Фильтр «только ДР сегодня»: ${userIds.length} → ${withBirthdayToday.length} целей`,
        );
        userIds = withBirthdayToday;
      }
    }
    if (userIds.length === 0) {
      await this.addLog('warn', 'Нет целей для лайков. Укажите user IDs или группу.');
      return { error: 'No targets' };
    }
    this.abortRequested = false;
    await this.resetState();
    await this.setState({
      status: 'running',
      startedAt: Date.now(),
      totalTargets: userIds.length,
      processed: 0,
      liked: 0,
      skipped: 0,
      errors: 0,
      logs: [],
    });
    await this.addLog('info', `Старт: ${userIds.length} целей, задержка ${DELAY_MS} мс`);
    this.runLoop(userIds, config).catch(async (err) => {
      await this.addLog('error', String(err?.message || err));
      await this.setState({ status: 'stopped', stoppedAt: Date.now() });
    });
    return { ok: true, totalTargets: userIds.length };
  }

  async stop() {
    this.abortRequested = true;
    await this.addLog('info', 'Остановка запрошена');
    return { ok: true };
  }

  async status(): Promise<JobStateDto> {
    return this.getState();
  }

  /** Оценка: сколько человек будет обработано при запуске (без старта джоба). */
  async estimate(): Promise<
    | { ok: true; totalCandidates: number; excludedProcessed: number; estimate: number; afterBirthdayFilter?: number }
    | { ok: false; error: string }
  > {
    const config = await this.targets.get();
    let userIds: number[] = [];
    if (config.kind === 'user_ids' && config.userIds?.length) {
      userIds = config.userIds.map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n));
    } else if (config.kind === 'group' && config.groupId) {
      const token = await this.apiKeys.getNextAvailableToken();
      if (!token) return { ok: false, error: 'Нет API ключа для загрузки участников группы' };
      const limit = config.groupMemberLimit ?? 1000;
      const res = await this.vk.groupsGetMembers(token.token, config.groupId, limit);
      if (!res.ok) return { ok: false, error: res.errorMsg || 'Не удалось загрузить участников группы' };
      userIds = res.data.items;
    }
    const totalCandidates = userIds.length;
    if (totalCandidates === 0) {
      return { ok: true, totalCandidates: 0, excludedProcessed: 0, estimate: 0 };
    }
    const today = this.getTodayDate();
    const processedToday = await this.getProcessedUserIdsForDate(today);
    userIds = userIds.filter((id) => !processedToday.has(id));
    const excludedProcessed = totalCandidates - userIds.length;
    if (!config.onlyBirthdayToday) {
      return {
        ok: true,
        totalCandidates,
        excludedProcessed,
        estimate: userIds.length,
      };
    }
    const token = await this.apiKeys.getNextAvailableToken();
    if (!token) {
      return {
        ok: true,
        totalCandidates,
        excludedProcessed,
        estimate: userIds.length,
        afterBirthdayFilter: undefined,
      };
    }
    const withBirthday = await this.filterUsersWithBirthdayToday(
      token.token,
      userIds,
      config.minAge ?? undefined,
      config.maxAge ?? undefined,
    );
    return {
      ok: true,
      totalCandidates,
      excludedProcessed,
      estimate: withBirthday.length,
      afterBirthdayFilter: withBirthday.length,
    };
  }

  /** Список обработанных (проверенных/лайкнутых) за дату. */
  async getProcessedByDate(
    date: string,
  ): Promise<{ date: string; items: { userId: number; status: string }[]; count: number }> {
    const rows = await this.processedRepo.find({
      where: { processedDate: date },
      order: { createdAt: 'ASC' },
    });
    const items = rows
      .map((r) => ({ userId: parseInt(r.userId, 10), status: r.status || 'success' }))
      .filter((item) => !Number.isNaN(item.userId));
    return { date, items, count: items.length };
  }

  private async getState(): Promise<JobStateDto> {
    let row = await this.jobRepo.findOne({ where: { id: DEFAULT_JOB_ID } });
    if (!row) {
      row = this.jobRepo.create({
        id: DEFAULT_JOB_ID,
        status: 'idle',
        totalTargets: 0,
        processed: 0,
        liked: 0,
        skipped: 0,
        errors: 0,
        logs: [],
      });
      await this.jobRepo.save(row);
    }
    return {
      status: row.status,
      startedAt: row.startedAt != null ? Number(row.startedAt) : undefined,
      stoppedAt: row.stoppedAt != null ? Number(row.stoppedAt) : undefined,
      totalTargets: row.totalTargets,
      processed: row.processed,
      liked: row.liked,
      skipped: row.skipped,
      errors: row.errors,
      currentKeyId: row.currentKeyId ?? undefined,
      logs: row.logs ?? [],
    };
  }

  private async setState(update: Partial<JobStateDto>) {
    let row = await this.jobRepo.findOne({ where: { id: DEFAULT_JOB_ID } });
    if (!row) {
      row = this.jobRepo.create({
        id: DEFAULT_JOB_ID,
        status: 'idle',
        totalTargets: 0,
        processed: 0,
        liked: 0,
        skipped: 0,
        errors: 0,
        logs: [],
      });
      await this.jobRepo.save(row);
    }
    if (update.status != null) row.status = update.status;
    if (update.startedAt !== undefined) row.startedAt = update.startedAt == null ? null : String(update.startedAt);
    if (update.stoppedAt !== undefined) row.stoppedAt = update.stoppedAt == null ? null : String(update.stoppedAt);
    if (update.totalTargets != null) row.totalTargets = update.totalTargets;
    if (update.processed != null) row.processed = update.processed;
    if (update.liked != null) row.liked = update.liked;
    if (update.skipped != null) row.skipped = update.skipped;
    if (update.errors != null) row.errors = update.errors;
    if (update.currentKeyId !== undefined) row.currentKeyId = update.currentKeyId ?? null;
    if (update.logs != null) row.logs = update.logs;
    await this.jobRepo.save(row);
  }

  private async addLog(
    level: LogEntryDto['level'],
    message: string,
    meta?: Record<string, unknown>,
  ) {
    const state = await this.getState();
    const logs = [...(state.logs || [])];
    logs.push({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      ts: Date.now(),
      level,
      message,
      meta,
    });
    if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS);
    await this.setState({ logs });
  }

  private async resetState() {
    await this.setState({
      status: 'idle',
      startedAt: undefined,
      stoppedAt: undefined,
      totalTargets: 0,
      processed: 0,
      liked: 0,
      skipped: 0,
      errors: 0,
      currentKeyId: undefined,
      logs: [],
    });
  }

  /** Обновляет VK ID токен по refresh_token если истёк (срок жизни 1 ч), возвращает актуальный token. */
  private async ensureKeyToken(keyRecord: { id: string; token: string }): Promise<string> {
    await this.apiKeys.refreshVkidKeyIfExpired(keyRecord.id);
    const fresh = await this.apiKeys.getKeyById(keyRecord.id);
    return fresh?.token ?? keyRecord.token;
  }

  private async runLoop(userIds: number[], config: TargetsConfig) {
    let keyRecord = await this.apiKeys.getNextAvailableToken();
    if (!keyRecord) {
      await this.addLog('error', 'Нет доступных ключей');
      await this.setState({ status: 'stopped', stoppedAt: Date.now() });
      return;
    }
    keyRecord = { ...keyRecord, token: await this.ensureKeyToken(keyRecord) };
    await this.setState({ currentKeyId: keyRecord.id });
    await this.addLog('info', `Используется ключ ${keyRecord.label || keyRecord.id}`);

    const today = this.getTodayDate();
    const maxLikes =
      config.maxSuccessfulLikes != null && config.maxSuccessfulLikes > 0
        ? config.maxSuccessfulLikes
        : null;

    for (let i = 0; i < userIds.length; i++) {
      if (this.abortRequested) {
        await this.addLog('info', 'Остановлено пользователем');
        await this.setState({ status: 'stopped', stoppedAt: Date.now() });
        return;
      }
      const s = await this.getState();
      if (maxLikes != null && s.liked >= maxLikes) {
        await this.addLog('info', `Достигнут лимит успешных лайков: ${maxLikes}`);
        break;
      }
      const ownerId = userIds[i];
      const nextKey = await this.apiKeys.getNextAvailableToken();
      if (!nextKey) {
        await this.addLog('error', 'Все ключи исчерпаны или отключены');
        await this.setState({ status: 'stopped', stoppedAt: Date.now() });
        return;
      }
      keyRecord = { ...nextKey, token: await this.ensureKeyToken(nextKey) };
      await this.setState({ currentKeyId: keyRecord.id });

      const wallRes = await this.vk.wallGet(keyRecord.token, ownerId, 1);
      if (!wallRes.ok) {
        await this.markProcessedToday(ownerId, today, 'error');
        await this.addLog('warn', `Стена ${ownerId}: ${wallRes.errorMsg}`, {
          ownerId,
          errorCode: wallRes.errorCode,
        });
        const s = await this.getState();
        await this.setState({ processed: s.processed + 1, errors: s.errors + 1 });
        await this.delay(DELAY_AFTER_ERROR_MS);
        continue;
      }
      const items = wallRes.data.items;
      if (!items || items.length === 0) {
        await this.markProcessedToday(ownerId, today, 'skipped');
        await this.addLog('info', `Нет постов на стене ${ownerId}`, { ownerId });
        const s = await this.getState();
        await this.setState({ processed: s.processed + 1, skipped: s.skipped + 1 });
        await this.delay(1000);
        continue;
      }
      const post = items[0];
      await this.apiKeys.markKeyUsed(keyRecord.id);

      const isLikedRes = await this.vk.likesIsLiked(
        keyRecord.token,
        'post',
        post.owner_id,
        post.id,
      );
      if (isLikedRes.ok && isLikedRes.data.liked === 1) {
        await this.markProcessedToday(ownerId, today, 'skipped');
        await this.addLog('info', `Уже лайкнуто: стена ${ownerId}, пост ${post.id}`, {
          ownerId,
          postId: post.id,
        });
        const s = await this.getState();
        await this.setState({ processed: s.processed + 1, skipped: s.skipped + 1 });
        await this.delay(1000);
        continue;
      }

      const likeRes = await this.vk.likesAdd(
        keyRecord.token,
        'post',
        post.owner_id,
        post.id,
      );
      if (likeRes.ok) {
        await this.markProcessedToday(ownerId, today, 'success');
        await this.addLog('success', `Лайк поставлен: стена ${ownerId}, пост ${post.id}`, {
          ownerId,
          postId: post.id,
        });
        const s = await this.getState();
        await this.setState({ processed: s.processed + 1, liked: s.liked + 1 });
        if (maxLikes != null && s.liked + 1 >= maxLikes) {
          await this.addLog('info', `Достигнут лимит успешных лайков: ${maxLikes}`);
          break;
        }
      } else {
        await this.markProcessedToday(
          ownerId,
          today,
          this.vk.isCaptcha(likeRes.errorCode) ? 'skipped' : 'error',
        );
        if (this.vk.isCaptcha(likeRes.errorCode)) {
          await this.captcha.addPending(
            likeRes.captchaSid!,
            likeRes.captchaImg!,
            keyRecord.id,
            post.owner_id,
            post.id,
          );
          await this.addLog('warn', `Капча для стены ${ownerId}. Решите в разделе «Капча».`, {
            ownerId,
            captchaSid: likeRes.captchaSid,
          });
          const s = await this.getState();
          await this.setState({ processed: s.processed + 1, skipped: s.skipped + 1 });
        } else if (this.vk.isRateLimitOrBlock(likeRes.errorCode)) {
          await this.apiKeys.disableKey(keyRecord.id);
          await this.addLog('warn', `Ключ ${keyRecord.id} отключён (лимит/флуд). Переключаемся на следующий.`);
          i--;
        } else {
          await this.addLog('error', `Лайк ${ownerId}/${post.id}: ${likeRes.errorMsg}`, {
            ownerId,
            postId: post.id,
            errorCode: likeRes.errorCode,
          });
          const s = await this.getState();
          await this.setState({ processed: s.processed + 1, errors: s.errors + 1 });
        }
      }
      await this.delay(DELAY_MS);
    }

    await this.addLog('success', 'Все цели обработаны.');
    await this.setState({ status: 'idle', stoppedAt: Date.now() });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getTodayDate(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private async getProcessedUserIdsForDate(date: string): Promise<Set<number>> {
    const rows = await this.processedRepo.find({ where: { processedDate: date } });
    return new Set(rows.map((r) => parseInt(r.userId, 10)));
  }

  private async cleanupOldProcessed(today: string): Promise<void> {
    const [y, m, d] = today.split('-').map(Number);
    const cutoff = new Date(y, m - 1, d);
    cutoff.setDate(cutoff.getDate() - 3);
    const cutoffStr =
      cutoff.getFullYear() +
      '-' +
      String(cutoff.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(cutoff.getDate()).padStart(2, '0');
    await this.processedRepo
      .createQueryBuilder()
      .delete()
      .where('processedDate < :cutoff', { cutoff: cutoffStr })
      .execute();
  }

  private async markProcessedToday(
    userId: number,
    date: string,
    status: 'success' | 'skipped' | 'error' = 'success',
  ): Promise<void> {
    await this.processedRepo.upsert(
      {
        processedDate: date,
        userId: String(userId),
        status,
        createdAt: String(Date.now()),
      },
      { conflictPaths: ['processedDate', 'userId'] },
    );
  }

  /** Оставляет только пользователей, у которых сегодня ДР и (если заданы) возраст в диапазоне. Запросы по 10 пользователей. */
  private async filterUsersWithBirthdayToday(
    accessToken: string,
    userIds: number[],
    minAge?: number | null,
    maxAge?: number | null,
  ): Promise<number[]> {
    const now = new Date();
    const todayDay = now.getDate();
    const todayMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const result: number[] = [];
    const CHUNK_SIZE = 10;
    for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
      const chunk = userIds.slice(i, i + CHUNK_SIZE);
      const res = await this.vk.usersGet(accessToken, chunk, 'bdate');
      if (!res.ok) {
        await this.addLog('warn', `users.get (ДР): ${res.errorMsg}`, { errorCode: res.errorCode });
        continue;
      }
      for (const u of res.data) {
        if (!u.bdate) continue;
        const parts = u.bdate.trim().split('.');
        if (parts.length < 2) continue;
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        if (Number.isNaN(day) || Number.isNaN(month)) continue;
        if (day !== todayDay || month !== todayMonth) continue;
        if (minAge != null || maxAge != null) {
          const year = parts.length >= 3 ? parseInt(parts[2], 10) : null;
          if (year == null || Number.isNaN(year)) continue;
          const age = currentYear - year;
          if (minAge != null && age < minAge) continue;
          if (maxAge != null && age > maxAge) continue;
        }
        result.push(u.id);
      }
    }
    return result;
  }
}
