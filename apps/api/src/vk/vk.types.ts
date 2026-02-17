export const VK_API_VERSION = '5.131';

export interface VkError {
  error_code: number;
  error_msg: string;
  captcha_sid?: string;
  captcha_img?: string;
  request_params?: unknown[];
}

export interface VkApiResponse<T> {
  response?: T;
  error?: VkError;
}

export interface WallPost {
  id: number;
  owner_id: number;
  from_id: number;
  date: number;
  text?: string;
  copy_history?: unknown[];
}

export interface WallGetResponse {
  count: number;
  items: WallPost[];
}

export interface LikesAddResponse {
  likes: number;
}

export interface LikesIsLikedResponse {
  liked: 0 | 1;
  copied?: 0 | 1;
}

export interface VkGroup {
  id: number;
  name: string;
  screen_name?: string;
  is_closed?: 0 | 1;
  type?: string;
}

export type GroupsGetByIdResponse = VkGroup[];

export interface VkUser {
  id: number;
  bdate?: string; // "D.M", "DD.MM" или "DD.MM.YYYY"
}

export type UsersGetResponse = VkUser[];

// Error codes
export const VK_ERROR_TOO_MANY_REQUESTS = 6;
export const VK_ERROR_FLOOD = 9;
export const VK_ERROR_CAPTCHA = 14;
export const VK_ERROR_ACCESS_DENIED = 15;
