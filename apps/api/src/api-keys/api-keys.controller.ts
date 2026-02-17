import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';

@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Get()
  list() {
    return this.apiKeys.list();
  }

  @Post()
  add(@Body() body: { token: string; label?: string }) {
    const token = body?.token;
    if (!token || typeof token !== 'string') {
      return { error: 'token is required' };
    }
    return this.apiKeys.add(token, body.label);
  }

  @Post('bulk')
  addBulk(@Body() body: { tokens: string[] }) {
    const tokens = body?.tokens;
    if (!Array.isArray(tokens)) return { error: 'tokens array is required', added: 0 };
    return this.apiKeys.addBulk(tokens);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.apiKeys.remove(id);
  }

  @Post('enable-all')
  enableAll() {
    return this.apiKeys.enableAll();
  }
}
