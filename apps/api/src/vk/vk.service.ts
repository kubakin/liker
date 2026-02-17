import { Injectable } from '@nestjs/common';
import {
  VK_API_VERSION,
  VkApiResponse,
  WallGetResponse,
  LikesAddResponse,
  LikesIsLikedResponse,
  GroupsGetByIdResponse,
  UsersGetResponse,
  VK_ERROR_TOO_MANY_REQUESTS,
  VK_ERROR_FLOOD,
  VK_ERROR_CAPTCHA,
  VK_ERROR_ACCESS_DENIED,
} from './vk.types';

export type VkResult<T> =
  | { ok: true; data: T }
  | { ok: false; errorCode: number; errorMsg: string; captchaSid?: string; captchaImg?: string };

@Injectable()
export class VkService {
  private readonly baseUrl = 'https://api.vk.com/method';

  private async fetchVk<T>(url: string): Promise<VkApiResponse<T>> {
    const res = await fetch(url);
    const text = await res.text();
    console.log(res, text)
    try {
      return JSON.parse(text) as VkApiResponse<T>;
    } catch {
      return {
        error: {
          error_code: 0,
          error_msg: res.ok
            ? 'VK вернул не JSON'
            : `HTTP ${res.status}: ответ не JSON (возможно страница ошибки)`,
        },
      };
    }
  }

  async wallGet(accessToken: string, ownerId: number, count = 1): Promise<VkResult<WallGetResponse>> {
    const params = new URLSearchParams({
      v: VK_API_VERSION,
      access_token: accessToken,
      owner_id: String(ownerId),
      count: String(count),
      filter: 'owner', // только посты самого владельца стены
    });
    const json = await this.fetchVk<WallGetResponse>(`${this.baseUrl}/wall.get?${params}`);
    return this.parseResponse(json);
  }

  async likesIsLiked(
    accessToken: string,
    type: 'post',
    ownerId: number,
    itemId: number,
  ): Promise<VkResult<LikesIsLikedResponse>> {
    const params = new URLSearchParams({
      v: VK_API_VERSION,
      access_token: accessToken,
      type,
      owner_id: String(ownerId),
      item_id: String(itemId),
    });
    const json = await this.fetchVk<LikesIsLikedResponse>(`${this.baseUrl}/likes.isLiked?${params}`);
    return this.parseResponse(json);
  }

  async likesAdd(
    accessToken: string,
    type: 'post',
    ownerId: number,
    itemId: number,
    captchaSid?: string,
    captchaKey?: string,
  ): Promise<VkResult<LikesAddResponse>> {
    const params: Record<string, string> = {
      v: VK_API_VERSION,
      access_token: accessToken,
      type,
      owner_id: String(ownerId),
      item_id: String(itemId),
    };
    if (captchaSid && captchaKey) {
      params.captcha_sid = captchaSid;
      params.captcha_key = captchaKey;
    }
    const qs = new URLSearchParams(params);
    const json = await this.fetchVk<LikesAddResponse>(`${this.baseUrl}/likes.add?${qs}`);
    return this.parseResponse(json);
  }

  /** Нормализует ID группы: убирает URL, оставляет short name или числовой id. */
  normalizeGroupId(groupId: string): string {
    const trimmed = groupId.trim();
    const match = trimmed.replace(/^.*\/([a-zA-Z0-9_]+)$/, '$1');
    return match || trimmed;
  }

  async usersGet(
    accessToken: string,
    userIds: number[],
    fields = 'bdate',
  ): Promise<VkResult<UsersGetResponse>> {
    if (userIds.length === 0) return { ok: true, data: [] };
    const params = new URLSearchParams({
      v: VK_API_VERSION,
      access_token: accessToken,
      user_ids: userIds.slice(0, 1000).join(','),
      fields,
    });
    const json = await this.fetchVk<UsersGetResponse>(`${this.baseUrl}/users.get?${params}`);
    console.log(json)
    return this.parseResponse(json);
  }

  async groupsGetById(accessToken: string, groupId: string): Promise<VkResult<GroupsGetByIdResponse>> {
    const id = this.normalizeGroupId(groupId);
    const params = new URLSearchParams({
      v: VK_API_VERSION,
      access_token: accessToken,
      group_id: id,
    });
    const json = await this.fetchVk<GroupsGetByIdResponse>(`${this.baseUrl}/groups.getById?${params}`);
    return this.parseResponse(json);
  }

  async groupsGetMembers(
    accessToken: string,
    groupId: string,
    count = 1000,
  ): Promise<VkResult<{ items: number[] }>> {
    const id = this.normalizeGroupId(groupId);
    const limit = Math.min(1000, Math.max(1, Math.floor(count)));
    const params = new URLSearchParams({
      v: VK_API_VERSION,
      access_token: accessToken,
      group_id: id,
      count: String(limit),
    });
    const json = await this.fetchVk<{ items: number[] }>(`${this.baseUrl}/groups.getMembers?${params}`);
    return this.parseResponse(json);
  }

  private parseResponse<T>(json: VkApiResponse<T>): VkResult<T> {
    if (json.response !== undefined) {
      return { ok: true, data: json.response };
    }
    const err = json.error!;
    return {
      ok: false,
      errorCode: err.error_code,
      errorMsg: err.error_msg,
      captchaSid: err.captcha_sid,
      captchaImg: err.captcha_img,
    };
  }

  isRateLimitOrBlock(code: number): boolean {
    return code === VK_ERROR_TOO_MANY_REQUESTS || code === VK_ERROR_FLOOD || code === VK_ERROR_ACCESS_DENIED;
  }

  isCaptcha(code: number): boolean {
    return code === VK_ERROR_CAPTCHA;
  }
}
