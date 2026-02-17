import { Body, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthVkService } from './auth-vk.service';
import { AuthVkidService } from './auth-vkid.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authVk: AuthVkService,
    private readonly authVkid: AuthVkidService,
  ) {}

  /** Строит redirect_uri по Host запроса или query redirect_base (для туннеля). */
  private redirectUriFromRequest(req: Request, queryRedirectBase?: string): string | null {
    if (queryRedirectBase) {
      const base = queryRedirectBase.replace(/\/+$/, '');
      return this.authVk.normalizeRedirectUri(`${base}/api/auth/vk/callback`);
    }
    const host = req.get('host') || req.get('x-forwarded-host');
    if (!host) return null;
    const proto = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
    return this.authVk.normalizeRedirectUri(`${proto}://${host}/api/auth/vk/callback`);
  }

  /**
   * Возвращает текущий redirect_uri — этот же URL нужно указать в настройках приложения ВК (без слеша в конце).
   * При запросе через туннель вернёт URL с хостом туннеля.
   */
  @Get('vk/redirect-uri')
  vkRedirectUri(@Req() req: Request, @Query('redirect_base') redirectBase?: string) {
    const uri = this.redirectUriFromRequest(req, redirectBase) || this.authVk.getRedirectUri();
    return {
      redirect_uri: uri,
      hint: uri
        ? 'Скопируйте этот URL в настройки приложения ВК (Настройки → Redirect URI) без изменений.'
        : 'Задайте VK_REDIRECT_URI в .env или откройте эту ссылку с того же домена, что и админка.',
    };
  }

  /**
   * Редирект на страницу авторизации ВКонтакте.
   * redirect_uri берётся из Host запроса (туннель) или из VK_REDIRECT_URI.
   */
  @Get('vk')
  vkRedirect(@Req() req: Request, @Res() res: Response, @Query('redirect_base') redirectBase?: string) {
    const redirectUriOverride = this.redirectUriFromRequest(req, redirectBase);
    const url = this.authVk.getAuthorizeUrl(redirectUriOverride ?? undefined);
    if (!url) {
      res.redirect(302, this.authVk.getFrontendRedirectUrl('error', 'VK_APP_ID и VK_REDIRECT_URI не заданы'));
      return;
    }
    res.redirect(302, url);
  }

  /**
   * Callback от ВК: обмен code на access_token и сохранение ключа в БД.
   */
  @Get('vk/callback')
  async vkCallback(
    @Req() req: Request,
    @Query('state') state: string | undefined,
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() res: Response,
  ) {
    const redirectToFrontend = (status: string, message?: string) => {
      const url = this.authVk.getFrontendRedirectUrl(status, message);
      res.redirect(302, url);
    };

    if (error) {
      let msg = errorDescription || error;
      if (String(msg).toLowerCase().includes('redirect_uri') && state) {
        const decodedUri = this.authVk.decodeRedirectUriFromState(state);
        if (decodedUri) {
          msg = `${msg} Добавьте в настройках приложения ВК (dev.vk.com → Ваши приложения → Настройки → Redirect URI) этот адрес: ${decodedUri}`;
        }
      }
      redirectToFrontend('error', msg);
      return;
    }
    if (!code) {
      redirectToFrontend('error', 'Нет кода авторизации');
      return;
    }

    const redirectUriOverride = state ? this.authVk.decodeRedirectUriFromState(state) : undefined;
    const fromRequest = this.redirectUriFromRequest(req);
    const result = await this.authVk.exchangeCodeAndSaveToken(code, redirectUriOverride ?? fromRequest ?? undefined);
    if (result.ok) {
      redirectToFrontend('ok', result.label ? `Ключ добавлен: ${result.label}` : undefined);
    } else {
      redirectToFrontend('error', result.error);
    }
  }

  /**
   * Конфиг для VK ID SDK на фронте: appId и redirectUrl.
   * Для VK ID нужно отдельное приложение в https://id.vk.ru/about/business/go/ (не dev.vk.com).
   */
  @Get('vkid/config')
  vkidConfig(@Req() req: Request, @Query('redirect_base') redirectBase?: string) {
    const vkidAppId = process.env.VK_ID_APP_ID;
    const appId = vkidAppId || process.env.VK_APP_ID;
    let baseUrl = process.env.VK_FRONTEND_REDIRECT_URI || process.env.ADMIN_URL || 'http://localhost:3000';
    if (redirectBase) baseUrl = redirectBase.replace(/\/+$/, '');
    else {
      const host = req.get('host') || req.get('x-forwarded-host');
      if (host) {
        const proto = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
        baseUrl = `${proto}://${host}`;
      }
    }
    const redirectUrl = `${baseUrl}/auth/vkid-callback`;
    const hint =
      !vkidAppId && appId
        ? 'VK ID: создайте отдельное приложение в id.vk.ru (платформа Web) и укажите VK_ID_APP_ID в .env — иначе возможна ошибка «Selected sign-in method not available».'
        : undefined;
    return { appId: appId ? Number(appId) : null, redirectUrl, hint };
  }

  /**
   * Обмен кода VK ID на токен (после авторизации через VK ID SDK на фронте).
   */
  @Post('vkid/exchange')
  async vkidExchange(
    @Body() body: { code: string; code_verifier: string; redirect_uri: string; device_id: string; state: string },
    @Res() res: Response,
  ) {
    const { code, code_verifier, redirect_uri, device_id, state } = body || {};
    if (!code || !code_verifier || !redirect_uri || !device_id || !state) {
      return res.status(400).json({ error: 'Требуются code, code_verifier, redirect_uri, device_id, state' });
    }
    const result = await this.authVkid.exchangeCodeAndSaveToken(
      code,
      code_verifier,
      redirect_uri,
      device_id,
      state,
    );
    if (result.ok) {
      return res.json({ ok: true, message: result.label ? `Ключ добавлен: ${result.label}` : 'Токен добавлен' });
    }
    return res.status(400).json({ error: result.error });
  }
}
