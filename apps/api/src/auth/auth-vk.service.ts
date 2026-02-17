import { Injectable } from '@nestjs/common';
import { ApiKeysService } from '../api-keys/api-keys.service';

const VK_AUTHORIZE_URL = 'https://oauth.vk.com/authorize';
const VK_ACCESS_TOKEN_URL = 'https://oauth.vk.com/access_token';

@Injectable()
export class AuthVkService {
  constructor(private readonly apiKeys: ApiKeysService) {}

  getAuthorizeUrl(redirectUriOverride?: string): string | null {
    const clientId = process.env.VK_APP_ID;
    const redirectUri = this.normalizeRedirectUri(redirectUriOverride ?? process.env.VK_REDIRECT_URI);
    console.log(redirectUri)
    if (!clientId || !redirectUri) return null;
    const scope = process.env.VK_OAUTH_SCOPE ?? '10240';
    const state = this.encodeRedirectUriToState(redirectUri);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      v: '5.131',
      state,
    });
    console.log(`${VK_AUTHORIZE_URL}?${params}`)
    return `${VK_AUTHORIZE_URL}?${params}`;
  }

  encodeRedirectUriToState(redirectUri: string): string {
    return Buffer.from(redirectUri, 'utf-8').toString('base64url');
  }

  decodeRedirectUriFromState(state: string): string | null {
    try {
      const uri = Buffer.from(state, 'base64url').toString('utf-8');
      return this.normalizeRedirectUri(uri);
    } catch {
      return null;
    }
  }

  getFrontendRedirectUrl(status: string, message?: string): string {
    const base = process.env.VK_FRONTEND_REDIRECT_URI || process.env.ADMIN_URL || 'http://localhost:3000';
    const url = new URL(base);
    url.searchParams.set('vk_token', status);
    if (message) url.searchParams.set('vk_message', encodeURIComponent(message));
    return url.toString();
  }

  async exchangeCodeAndSaveToken(code: string, redirectUriOverride?: string): Promise<{ ok: true; label?: string } | { ok: false; error: string }> {
    const clientId = process.env.VK_APP_ID;
    const clientSecret = process.env.VK_APP_SECRET;
    const redirectUri = this.normalizeRedirectUri(redirectUriOverride ?? process.env.VK_REDIRECT_URI);
    if (!clientId || !clientSecret || !redirectUri) {
      return { ok: false, error: 'VK_APP_ID, VK_APP_SECRET или VK_REDIRECT_URI не заданы' };
    }

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code: code,
    });
    const res = await fetch(`${VK_ACCESS_TOKEN_URL}?${params}`);
    const data = (await res.json()) as {
      access_token?: string;
      user_id?: number;
      error?: string;
      error_description?: string;
    };

    if (data.error) {
      return { ok: false, error: data.error_description || data.error };
    }
    if (!data.access_token) {
      return { ok: false, error: 'В ответе ВК нет access_token' };
    }

    const label = data.user_id ? `VK user ${data.user_id}` : undefined;
    await this.apiKeys.add(data.access_token, label);
    return { ok: true, label };
  }

  /** Текущий redirect_uri (нормализованный) из env. */
  getRedirectUri(): string | null {
    return this.normalizeRedirectUri(process.env.VK_REDIRECT_URI);
  }

  /** Без завершающего слеша — так же должно быть указано в настройках приложения ВК. */
  normalizeRedirectUri(uri: string | undefined): string | null {
    if (!uri || typeof uri !== 'string') return null;
    const trimmed = uri.trim();
    return trimmed.replace(/\/+$/, '') || null;
  }
}
