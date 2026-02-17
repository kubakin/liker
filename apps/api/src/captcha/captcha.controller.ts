import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CaptchaService } from './captcha.service';

@Controller('captcha')
export class CaptchaController {
  constructor(private readonly captcha: CaptchaService) {}

  @Get()
  list() {
    return this.captcha.listPending().then((items) => ({ items }));
  }

  @Get(':sid/image')
  async image(@Param('sid') sid: string, @Res() res: Response) {
    const result = await this.captcha.getCaptchaImage(sid);
    if (!result) {
      res.status(404).send('Not found');
      return;
    }
    res.setHeader('Content-Type', result.contentType);
    res.send(result.buffer);
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
