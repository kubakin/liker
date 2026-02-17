const API = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || res.statusText);
  return data as T;
}

export const api = {
  apiKeys: {
    list: () => request<{ id: string; tokenMasked: string; label?: string; createdAt: number; lastUsedAt?: number; disabled?: boolean }[]>(`/api-keys`),
    add: (token: string, label?: string) => request<{ id: string; tokenMasked: string; label?: string; createdAt: number }>(`/api-keys`, { method: 'POST', body: JSON.stringify({ token, label }) }),
    addBulk: (tokens: string[]) => request<{ added: number; keys: { id: string; tokenMasked: string; createdAt: number }[] }>(`/api-keys/bulk`, { method: 'POST', body: JSON.stringify({ tokens }) }),
    remove: (id: string) => request<{ removed: boolean }>(`/api-keys/${id}`, { method: 'DELETE' }),
    enableAll: () => request<{ ok: boolean }>(`/api-keys/enable-all`, { method: 'POST' }),
  },
  targets: {
    get: () =>
      request<{
        kind: string;
        userIds?: string[];
        groupId?: string;
        groupMemberLimit?: number;
        onlyBirthdayToday?: boolean;
        maxSuccessfulLikes?: number | null;
        minAge?: number | null;
        maxAge?: number | null;
        updatedAt: number;
      }>(`/targets`),
    setUserIds: (userIds: string[] | string) => request(`/targets/user-ids`, { method: 'POST', body: JSON.stringify({ userIds }) }),
    setGroup: (groupId: string, groupMemberLimit?: number) =>
      request(`/targets/group`, { method: 'POST', body: JSON.stringify({ groupId, groupMemberLimit }) }),
    setGroupMemberLimit: (limit: number) =>
      request(`/targets/group-limit`, { method: 'POST', body: JSON.stringify({ limit }) }),
    setOnlyBirthdayToday: (enabled: boolean) =>
      request(`/targets/birthday-only`, { method: 'POST', body: JSON.stringify({ enabled }) }),
    setJobLimits: (body: {
      maxSuccessfulLikes?: number | null;
      minAge?: number | null;
      maxAge?: number | null;
    }) => request(`/targets/job-limits`, { method: 'POST', body: JSON.stringify(body) }),
  },
  jobs: {
    start: () => request<{ ok?: boolean; error?: string; totalTargets?: number }>(`/jobs/start`, { method: 'POST' }),
    stop: () => request<{ ok: boolean }>(`/jobs/stop`, { method: 'POST' }),
    status: () => request<{
      status: string;
      startedAt?: number;
      stoppedAt?: number;
      totalTargets: number;
      processed: number;
      liked: number;
      skipped: number;
      errors: number;
      currentKeyId?: string;
      logs: { id: string; ts: number; level: string; message: string; meta?: Record<string, unknown> }[];
    }>(`/jobs/status`),
    estimate: () =>
      request<
        | { ok: true; totalCandidates: number; excludedProcessed: number; estimate: number; afterBirthdayFilter?: number }
        | { ok: false; error: string }
      >(`/jobs/estimate`),
    processed: (date?: string) =>
      request<{ date: string; items: { userId: number; status: string }[]; count: number }>(
        `/jobs/processed${date ? '?date=' + encodeURIComponent(date) : ''}`,
      ),
  },
  captcha: {
    list: () => request<{ items: { sid: string; img: string; keyId: string; ownerId: number; itemId: number; createdAt: number }[] }>(`/captcha`),
    solve: (sid: string, key: string) => request<{ ok: boolean; likes?: number; error?: string }>(`/captcha/${sid}/solve`, { method: 'POST', body: JSON.stringify({ key }) }),
  },
  auth: {
    vkidConfig: (redirectBase?: string) =>
      request<{ appId: number | null; redirectUrl: string; hint?: string }>(`/auth/vkid/config${redirectBase ? '?redirect_base=' + encodeURIComponent(redirectBase) : ''}`),
    vkidExchange: (body: { code: string; code_verifier: string; redirect_uri: string; device_id: string; state: string }) =>
      request<{ ok: boolean; message?: string } | { error: string }>(`/auth/vkid/exchange`, { method: 'POST', body: JSON.stringify(body) }),
  },
};
