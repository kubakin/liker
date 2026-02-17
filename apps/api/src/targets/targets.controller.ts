import { Body, Controller, Get, Post } from '@nestjs/common';
import { TargetsService } from './targets.service';

@Controller('targets')
export class TargetsController {
  constructor(private readonly targets: TargetsService) {}

  @Get()
  get() {
    return this.targets.get();
  }

  @Post('user-ids')
  setUserIds(@Body() body: { userIds: string[] } | { userIds: string }) {
    const raw = body?.userIds;
    if (Array.isArray(raw)) {
      return this.targets.setUserIds(raw);
    }
    if (typeof raw === 'string') {
      return this.targets.setUserIds(raw.split(/[\n,]/).map((s) => s.trim()).filter(Boolean));
    }
    return { error: 'userIds required (array or string)' };
  }

  @Post('group')
  setGroup(@Body() body: { groupId: string; groupMemberLimit?: number }) {
    const groupId = body?.groupId;
    if (!groupId || typeof groupId !== 'string') {
      return { error: 'groupId is required' };
    }
    return this.targets.setGroup(groupId, body.groupMemberLimit);
  }

  @Post('group-limit')
  setGroupMemberLimit(@Body() body: { limit: number }) {
    const limit = body?.limit;
    if (limit == null || typeof limit !== 'number') {
      return { error: 'limit is required (number 1–10000)' };
    }
    return this.targets.setGroupMemberLimit(limit);
  }

  @Post('birthday-only')
  setOnlyBirthdayToday(@Body() body: { enabled: boolean }) {
    const enabled = body?.enabled;
    if (typeof enabled !== 'boolean') {
      return { error: 'enabled is required (boolean)' };
    }
    return this.targets.setOnlyBirthdayToday(enabled);
  }

  @Post('job-limits')
  setJobLimits(
    @Body()
    body: { maxSuccessfulLikes?: number | null; minAge?: number | null; maxAge?: number | null },
  ) {
    return this.targets.setJobLimits(
      body.maxSuccessfulLikes,
      body.minAge,
      body.maxAge,
    );
  }
}
