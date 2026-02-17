import { Injectable } from '@nestjs/common';

const API_BASE = 'https://api.2captcha.com';
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 120000;

@Injectable()
export class CaptchaSolverService {
  private readonly apiKey: string | null;

  constructor() {
    const key = process.env.CAPTCHA_SOLVER_API_KEY?.trim();
    this.apiKey = key && key.length > 0 ? key : null;
  }

  isConfigured(): boolean {
    return this.apiKey != null;
  }

  /**
   * Решает капчу по URL изображения или base64.
   * Возвращает текст капчи или null при ошибке/таймауте.
   */
  async solve(imageUrlOrBase64: string): Promise<string | null> {
    if (!this.apiKey) return null;
    const base64 = await this.toBase64(imageUrlOrBase64);
    if (!base64) return null;
    const taskId = await this.createTask(base64);
    if (taskId == null) return null;
    return this.pollResult(taskId);
  }

  private async toBase64(input: string): Promise<string | null> {
    const trimmed = input.trim();
    if (trimmed.startsWith('data:')) {
      const base = trimmed.replace(/^data:image\/\w+;base64,/, '');
      return base.length > 0 ? base : null;
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        const res = await fetch(trimmed);
        if (!res.ok) return null;
        const buf = await res.arrayBuffer();
        const b64 = Buffer.from(buf).toString('base64');
        return b64.length > 0 ? b64 : null;
      } catch {
        return null;
      }
    }
    return trimmed.length > 0 ? trimmed : null;
  }

  private async createTask(base64Body: string): Promise<number | null> {
    try {
      const res = await fetch(`${API_BASE}/createTask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientKey: this.apiKey,
          task: {
            type: 'ImageToTextTask',
            body: base64Body,
          },
        }),
      });
      const json = (await res.json()) as { errorId?: number; taskId?: number; errorDescription?: string };
      if (json.errorId !== 0 || json.taskId == null) {
        return null;
      }
      return json.taskId;
    } catch {
      return null;
    }
  }

  private async pollResult(taskId: number): Promise<string | null> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${API_BASE}/getTaskResult`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientKey: this.apiKey,
            taskId,
          }),
        });
        const json = (await res.json()) as {
          errorId?: number;
          status?: string;
          solution?: { text?: string };
          errorDescription?: string;
        };
        if (json.errorId !== 0) return null;
        if (json.status === 'ready' && json.solution?.text != null) {
          return json.solution.text.trim();
        }
      } catch {
        // continue polling
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    return null;
  }
}
