import { Injectable } from '@nestjs/common';
import { ApiKeysService } from '../api-keys/api-keys.service';

/**
 * Обмен кода на токены по документации VK ID:
 * https://id.vk.com/about/business/go/docs/ru/vkid/latest/vk-id/connection/api-description#Poluchenie-cherez-kod-podtverzhdeniya
 */
const VK_ID_TOKEN_URL = 'https://id.vk.ru/oauth2/auth';

function encodeFormParam(value: string): string {
  return encodeURIComponent(value);
}

@Injectable()
export class AuthVkidService {
  constructor(private readonly apiKeys: ApiKeysService) {}

  /**
   * Обмен authorization_code на Access token, Refresh token, ID token.
   * POST id.vk.ru/oauth2/auth, Content-Type: application/x-www-form-urlencoded.
   * Обязательные параметры: grant_type, code_verifier, redirect_uri, code, client_id, device_id, state.
   */
  async exchangeCodeAndSaveToken(
    code: string,
    codeVerifier: string,
    redirectUri: string,
    deviceId: string,
    state: string,
  ): Promise<{ ok: true; label?: string } | { ok: false; error: string }> {
    const clientId = process.env.VK_ID_APP_ID || process.env.VK_APP_ID;
    if (!clientId) {
      return { ok: false, error: 'VK_ID_APP_ID или VK_APP_ID не заданы' };
    }

    const body =
      'grant_type=' +
      encodeFormParam('authorization_code') +
      '&code_verifier=' +
      encodeFormParam(codeVerifier) +
      '&redirect_uri=' +
      encodeFormParam(redirectUri) +
      '&code=' +
      encodeFormParam(code) +
      '&client_id=' +
      encodeFormParam(clientId) +
      '&device_id=' +
      encodeFormParam(deviceId) +
      '&state=' +
      encodeFormParam(state);

    const res = await fetch(VK_ID_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const raw = await res.text();
    let data: {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      user_id?: number;
      error?: string;
      error_description?: string;
    };
    try {
      data = JSON.parse(raw);
    } catch {
      return { ok: false, error: res.status === 404 ? '404 NOT FOUND: проверьте grant_type и параметры (см. документацию VK ID)' : `Ответ не JSON: ${raw.slice(0, 200)}` };
    }

    if (res.status === 404) {
      return { ok: false, error: '404 NOT FOUND. Проверьте, что переданы grant_type=authorization_code, code_verifier, redirect_uri, code, client_id, device_id, state (документация VK ID).' };
    }

    if (data.error) {
      return { ok: false, error: data.error_description || data.error };
    }
    if (!data.access_token) {
      return { ok: false, error: 'В ответе VK ID нет access_token' };
    }

    const label = data.user_id ? `VK ID user ${data.user_id}` : undefined;
    const vkidMeta =
      data.refresh_token && data.expires_in != null && deviceId
        ? {
            refreshToken: data.refresh_token,
            expiresInSeconds: data.expires_in,
            deviceId,
          }
        : undefined;
    await this.apiKeys.add(data.access_token, label, vkidMeta);
    return { ok: true, label };
  }
}
