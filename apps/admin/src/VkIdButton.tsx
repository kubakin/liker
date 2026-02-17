import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Config,
  OAuthList,
  OAuthName,
  OAuthListInternalEvents,
  WidgetEvents,
  ConfigResponseMode,
} from '@vkid/sdk';
import { api } from './api';

function randomString(length: number, chars: string): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  let s = '';
  for (let i = 0; i < length; i++) s += chars[arr[i]! % chars.length];
  return s;
}

export function VkIdButton({
  onSuccess,
  onError,
}: {
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [hint, setHint] = useState<string | null>(null);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cfgRef = useRef<{
    appId: number;
    redirectUrl: string;
    codeVerifier: string;
    state: string;
  } | null>(null);
  const oauthListRef = useRef<InstanceType<typeof OAuthList> | null>(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  const redirectBase =
    typeof window !== 'undefined' && !window.location.origin.includes('localhost')
      ? window.location.origin
      : undefined;

  useEffect(() => {
    api.auth
      .vkidConfig(redirectBase)
      .then((r) => r.hint && setHint(r.hint))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const { appId, redirectUrl } = await api.auth.vkidConfig(redirectBase);
      if (!appId || !redirectUrl) {
        setWidgetError('VK ID не настроен: задайте VK_ID_APP_ID в .env API');
        return;
      }
      if (!mounted || !containerRef.current) return;
      const codeVerifier = randomString(
        64,
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-',
      );
      const state = randomString(
        40,
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-',
      );
      cfgRef.current = { appId, redirectUrl, codeVerifier, state };
      Config.init({
        app: appId,
        redirectUrl,
        state,
        codeVerifier,
        responseMode: ConfigResponseMode.Callback,
      });
      if (!mounted || !containerRef.current) return;
      const oauthList = new OAuthList();
      oauthListRef.current = oauthList;
      oauthList
        .on(OAuthListInternalEvents.LOGIN_SUCCESS, async (payload: { code?: string; state?: string; device_id?: string }) => {
          const cfg = cfgRef.current;
          if (!cfg?.redirectUrl || !payload?.code || !payload?.device_id) {
            onErrorRef.current('Нет кода или device_id в ответе VK ID');
            return;
          }
          try {
            const exchange = await api.auth.vkidExchange({
              code: payload.code,
              code_verifier: cfg.codeVerifier,
              redirect_uri: cfg.redirectUrl,
              device_id: payload.device_id,
              state: payload.state ?? cfg.state,
            });
            if ('error' in exchange) {
              onErrorRef.current(exchange.error);
              return;
            }
            onSuccessRef.current();
          } catch (e) {
            onErrorRef.current(e instanceof Error ? e.message : String(e));
          }
        })
        .on(WidgetEvents.ERROR, (payload: { code?: string; text?: string }) => {
          onErrorRef.current(payload?.text ?? payload?.code ?? 'Ошибка VK ID');
        })
        .render({
          container: containerRef.current,
          oauthList: [OAuthName.VK],
        });
    };
    run();
    return () => {
      mounted = false;
      oauthListRef.current?.close();
      oauthListRef.current = null;
    };
  }, []);

  if (widgetError) {
    return (
      <span className="text-amber-500/90 text-sm">
        {widgetError}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <div ref={containerRef} className="min-h-[40px]" />
      {hint && (
        <span className="text-amber-500/90 text-xs max-w-xs" title={hint}>
          {hint}
        </span>
      )}
    </span>
  );
}
