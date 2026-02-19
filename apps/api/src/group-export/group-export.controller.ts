import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { GroupExportService } from './group-export.service';

@Controller('group-export')
export class GroupExportController {
  constructor(private readonly groupExport: GroupExportService) {}

  @Post()
  async export(@Body() body: { groupId: string }) {
    const groupId = body?.groupId?.trim();
    if (!groupId) return { error: 'groupId is required' };
    return this.groupExport.exportGroup(groupId);
  }

  @Get()
  list(@Query('groupId') groupId?: string) {
    return this.groupExport.listExports(groupId);
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    const e = await this.groupExport.getExport(id);
    if (!e) return { error: 'not found' };
    return e;
  }

  @Get(':id/members')
  async members(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const limitNum = Math.min(50000, Math.max(0, parseInt(limit ?? '10000', 10) || 10000));
    const offsetNum = Math.max(0, parseInt(offset ?? '0', 10) || 0);
    const userIds = await this.groupExport.getExportMemberIds(id, limitNum, offsetNum);
    return { exportId: id, userIds, count: userIds.length };
  }

  @Get(':id/conversion')
  async conversion(@Param('id') id: string) {
    const c = await this.groupExport.getConversion(id);
    if (!c) return { error: 'not found' };
    return c;
  }

  @Get(':id/after-stats')
  async afterStats(@Param('id') id: string) {
    const s = await this.groupExport.getAfterExportStats(id);
    if (!s) return { error: 'not found' };
    return s;
  }
}
