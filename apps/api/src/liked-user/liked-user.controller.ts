import { Controller, Get, Query } from '@nestjs/common';
import { LikedUserService } from './liked-user.service';

@Controller('liked-users')
export class LikedUserController {
  constructor(private readonly likedUser: LikedUserService) {}

  @Get('count')
  count() {
    return this.likedUser.getCount().then((count) => ({ count }));
  }

  @Get()
  list(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    const limitNum = Math.min(1000, Math.max(1, parseInt(limit ?? '500', 10) || 500));
    const offsetNum = Math.max(0, parseInt(offset ?? '0', 10) || 0);
    return this.likedUser.list(limitNum, offsetNum).then((items) => ({ items }));
  }
}
