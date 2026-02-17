import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { VkService } from '../vk/vk.service';
import { CaptchaService } from './captcha.service';

@Controller('captcha')
export class CaptchaController {
  constructor(
    private readonly captcha: CaptchaService,
    private readonly apiKeys: ApiKeysService,
    private readonly vk: VkService,
  ) {}

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
    const pending = await this.captcha.getPending(sid);
    if (!pending) return { error: 'captcha not found or already solved' };
    const keyRecord = await this.apiKeys.getKeyById(pending.keyId);
    if (!keyRecord) return { error: 'api key not found' };
    const result = await this.vk.likesAdd(
      keyRecord.token,
      'post',
      pending.ownerId,
      pending.itemId,
      pending.sid,
      key,
    );
    await this.captcha.removePending(sid);
    if (result.ok) return { ok: true, likes: result.data.likes };
    return { ok: false, errorCode: result.errorCode, errorMsg: result.errorMsg };
  }
}
