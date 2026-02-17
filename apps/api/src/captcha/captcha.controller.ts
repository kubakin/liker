import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CaptchaService } from './captcha.service';

@Controller('captcha')
export class CaptchaController {
  constructor(private readonly captcha: CaptchaService) {}

  @Get()
  list() {
    return this.captcha.listPending().then((items) => ({ items }));
  }

  @Get(':sid')
  async one(@Param('sid') sid: string) {
    const c = await this.captcha.getPending(sid);
    if (!c) return { error: 'not found' };
    return c;
  }

  @Post(':sid/solve')
  async solve(@Param('sid') sid: string, @Body() body: { key: string }) {
    const key = body?.key?.trim();
    if (!key) return { error: 'key is required' };
    const result = await this.captcha.submitSolution(sid, key);
    if (result.ok) return { ok: true, likes: result.likes };
    return { ok: false, errorCode: result.errorCode, errorMsg: result.errorMsg };
  }
}
