import { useState, useEffect } from 'react';
import { api } from './api';

const VKID_OAUTH2_RESPONSE = 'oauth2_authorize_response';

type Tab = 'keys' | 'targets' | 'job' | 'captcha';

export default function App() {
  const [tab, setTab] = useState<Tab>('job');

  // Страница callback для VK ID SDK: popup редиректится сюда с code, state, device_id — отправляем в opener и закрываемся
  const isVkidCallback = typeof window !== 'undefined' && window.location.pathname === '/auth/vkid-callback';
  if (isVkidCallback) {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const device_id = params.get('device_id');
    const error = params.get('error');
    if (window.opener) {
      const origin = window.location.origin;
      if (error) {
        window.opener.postMessage({ action: VKID_OAUTH2_RESPONSE + (state || ''), payload: { error: params.get('error_description') || error } }, origin);
      } else if (code && state && device_id) {
        window.opener.postMessage({
          action: VKID_OAUTH2_RESPONSE + state,
          payload: { type: 'code', code, state, device_id, expires_in: 600 },
        }, origin);
      }
      window.close();
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-800 text-zinc-400">
        <p>Окно можно закрыть.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-surface-500 bg-surface-800/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Liker
          </h1>
          <nav className="flex gap-1">
            {(['job', 'keys', 'targets', 'captcha'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  tab === t
                    ? 'bg-accent text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-surface-600'
                }`}
              >
                {t === 'job' ? 'Задача' : t === 'keys' ? 'Ключи' : t === 'targets' ? 'Цели' : 'Капча'}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        {tab === 'keys' && <KeysPanel />}
        {tab === 'targets' && <TargetsPanel />}
        {tab === 'job' && <JobPanel />}
        {tab === 'captcha' && <CaptchaPanel />}
      </main>
    </div>
  );
}

function KeysPanel() {
  const [list, setList] = useState<Awaited<ReturnType<typeof api.apiKeys.list>>>([]);
  const [token, setToken] = useState('');
  const [label, setLabel] = useState('');
  const [bulk, setBulk] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const load = () => api.apiKeys.list().then(setList).catch((e) => setMessage(e.message));

  useEffect(() => {
    load();
  }, []);

  // Результат OAuth ВК после редиректа с callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vkStatus = params.get('vk_token');
    const vkMsg = params.get('vk_message');
    if (vkStatus) {
      const msg = vkStatus === 'ok'
        ? (vkMsg ? decodeURIComponent(vkMsg) : 'Токен ВКонтакте успешно добавлен.')
        : (vkMsg ? decodeURIComponent(vkMsg) : 'Не удалось получить токен.');
      setMessage(msg);
      if (vkStatus === 'ok') load();
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const addOne = async () => {
    if (!token.trim()) return;
    setLoading(true);
    setMessage('');
    try {
      await api.apiKeys.add(token.trim(), label.trim() || undefined);
      setToken('');
      setLabel('');
      load();
    } catch (e) {
      setMessage(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  };

  const addBulkKeys = async () => {
    const tokens = bulk.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (tokens.length === 0) return;
    setLoading(true);
    setMessage('');
    try {
      const res = await api.apiKeys.addBulk(tokens);
      setBulk('');
      setMessage(`Добавлено ключей: ${res.added}`);
      load();
    } catch (e) {
      setMessage(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.apiKeys.remove(id);
      load();
    } catch (e) {
      setMessage(String((e as Error).message));
    }
  };

  const enableAll = async () => {
    try {
      await api.apiKeys.enableAll();
      setMessage('Все ключи включены');
      load();
    } catch (e) {
      setMessage(String((e as Error).message));
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-surface-700 rounded-xl border border-surface-500 p-5">
        <h2 className="text-lg font-semibold text-white mb-4">API-ключи ВКонтакте</h2>
        <p className="text-zinc-400 text-sm mb-4">
          Добавьте один или несколько access token. При лимитах и блокировках будет использован следующий ключ.
        </p>
        {message && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-amber-500/10 text-amber-400 text-sm">
            {message}
          </div>
        )}
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Токен</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="vk1.a.xxx..."
              className="w-72 px-3 py-2 rounded-lg bg-surface-600 border border-surface-500 text-sm focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Метка (необязательно)</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Аккаунт 1"
              className="w-32 px-3 py-2 rounded-lg bg-surface-600 border border-surface-500 text-sm focus:ring-2 focus:ring-accent outline-none"
            />
          </div>
          <button
            onClick={addOne}
            disabled={loading || !token.trim()}
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium text-sm disabled:opacity-50"
          >
            Добавить
          </button>
        </div>
        <div className="pt-4 border-t border-surface-500">
          <label className="block text-xs text-zinc-500 mb-1">Несколько токенов (по одному на строку или через запятую)</label>
          <textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder="token1&#10;token2&#10;..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-surface-600 border border-surface-500 text-sm font-mono focus:ring-2 focus:ring-accent outline-none resize-y"
          />
          <button
            onClick={addBulkKeys}
            disabled={loading || !bulk.trim()}
            className="mt-2 px-4 py-2 rounded-lg bg-surface-600 hover:bg-surface-500 text-sm disabled:opacity-50"
          >
            Добавить все
          </button>
        </div>
        <div className="mt-4">
          <button onClick={enableAll} className="text-sm text-accent hover:underline">
            Включить все отключённые ключи
          </button>
        </div>
      </section>
      <section className="bg-surface-700 rounded-xl border border-surface-500 p-5">
        <h3 className="font-medium text-white mb-3">Список ключей</h3>
        <ul className="space-y-2">
          {list.map((k) => (
            <li
              key={k.id}
              className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-600"
            >
              <span className="font-mono text-sm text-zinc-300">
                {k.tokenMasked}
                {k.label && <span className="text-zinc-500 ml-2">({k.label})</span>}
                {k.disabled && <span className="ml-2 text-amber-400 text-xs">отключён</span>}
              </span>
              <button
                onClick={() => remove(k.id)}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                Удалить
              </button>
            </li>
          ))}
          {list.length === 0 && (
            <li className="text-zinc-500 text-sm py-4">Нет ключей. Добавьте хотя бы один.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

function TargetsPanel() {
  const [config, setConfig] = useState<Awaited<ReturnType<typeof api.targets.get>> | null>(null);
  const [userIdsText, setUserIdsText] = useState('');
  const [groupId, setGroupId] = useState('');
  const [groupMemberLimit, setGroupMemberLimit] = useState<number>(1000);
  const [maxSuccessfulLikes, setMaxSuccessfulLikes] = useState<number | ''>('');
  const [minAge, setMinAge] = useState<number | ''>('');
  const [maxAge, setMaxAge] = useState<number | ''>('');
  const [message, setMessage] = useState('');

  const load = () => api.targets.get().then(setConfig).catch((e) => setMessage(e.message));

  useEffect(() => {
    load();
  }, []);

  const saveUserIds = async () => {
    const ids = userIdsText.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    try {
      await api.targets.setUserIds(ids);
      setMessage('Сохранено');
      load();
    } catch (e) {
      setMessage(String((e as Error).message));
    }
  };

  const saveGroup = async () => {
    if (!groupId.trim()) return;
    try {
      const limit = Math.min(1000, Math.max(1, groupMemberLimit));
      await api.targets.setGroup(groupId.trim(), limit);
      setMessage('Сохранено');
      load();
    } catch (e) {
      setMessage(String((e as Error).message));
    }
  };

  const saveGroupLimit = async () => {
    try {
      const limit = Math.min(1000, Math.max(1, groupMemberLimit));
      await api.targets.setGroupMemberLimit(limit);
      setMessage('Лимит сохранён');
      load();
    } catch (e) {
      setMessage(String((e as Error).message));
    }
  };

  const saveJobLimits = async () => {
    try {
      await api.targets.setJobLimits({
        maxSuccessfulLikes: maxSuccessfulLikes === '' ? null : Number(maxSuccessfulLikes),
        minAge: minAge === '' ? null : Number(minAge),
        maxAge: maxAge === '' ? null : Number(maxAge),
      });
      setMessage('Настройки джоба сохранены');
      load();
    } catch (e) {
      setMessage(String((e as Error).message));
    }
  };

  useEffect(() => {
    if (config?.kind === 'user_ids' && config.userIds?.length) {
      setUserIdsText(config.userIds.join('\n'));
    }
    if (config?.kind === 'group' && config.groupId) {
      setGroupId(config.groupId);
      if (config.groupMemberLimit != null) setGroupMemberLimit(config.groupMemberLimit);
    }
    if (config?.maxSuccessfulLikes != null) setMaxSuccessfulLikes(config.maxSuccessfulLikes);
    else setMaxSuccessfulLikes('');
    if (config?.minAge != null) setMinAge(config.minAge);
    else setMinAge('');
    if (config?.maxAge != null) setMaxAge(config.maxAge);
    else setMaxAge('');
  }, [
    config?.kind,
    config?.userIds,
    config?.groupId,
    config?.groupMemberLimit,
    config?.maxSuccessfulLikes,
    config?.minAge,
    config?.maxAge,
  ]);

  return (
    <div className="space-y-6">
      <section className="bg-surface-700 rounded-xl border border-surface-500 p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Цели для лайков</h2>
        <p className="text-zinc-400 text-sm mb-4">
          Укажите список ID пользователей ВК или одну группу — лайки будут ставиться на последний пост на стене каждого.
          Обработанных сегодня в БД не повторяем.
        </p>
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <label className="text-zinc-400 text-sm">
            Лимит успешных лайков за запуск (0 или пусто = без лимита):
            <input
              type="number"
              min={0}
              value={maxSuccessfulLikes === '' || maxSuccessfulLikes == null ? '' : maxSuccessfulLikes}
              onChange={(e) =>
                setMaxSuccessfulLikes(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))
              }
              onBlur={saveJobLimits}
              className="ml-2 w-24 px-2 py-1 rounded bg-surface-600 border border-surface-500 text-sm"
            />
          </label>
          <span className="text-zinc-500 text-xs">
            (при фильтре ДР) Возраст от
            <input
              type="number"
              min={0}
              max={120}
              placeholder="—"
              value={minAge === '' || minAge == null ? '' : minAge}
              onChange={(e) =>
                setMinAge(e.target.value === '' ? '' : Math.max(0, Math.min(120, Number(e.target.value))))
              }
              onBlur={saveJobLimits}
              className="mx-1 w-14 px-1 py-0.5 rounded bg-surface-600 border border-surface-500 text-sm"
            />
            до
            <input
              type="number"
              min={0}
              max={120}
              placeholder="—"
              value={maxAge === '' || maxAge == null ? '' : maxAge}
              onChange={(e) =>
                setMaxAge(e.target.value === '' ? '' : Math.max(0, Math.min(120, Number(e.target.value))))
              }
              onBlur={saveJobLimits}
              className="ml-1 w-14 px-1 py-0.5 rounded bg-surface-600 border border-surface-500 text-sm"
            />
            лет
          </span>
        </div>
        <label className="mb-4 flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config?.onlyBirthdayToday ?? false}
            onChange={async (e) => {
              try {
                await api.targets.setOnlyBirthdayToday(e.target.checked);
                setMessage(e.target.checked ? 'Включено: только у кого сегодня ДР' : 'Выключено');
                load();
              } catch (err) {
                setMessage(String((err as Error).message));
              }
            }}
            className="rounded border-surface-500 bg-surface-600 text-accent focus:ring-accent"
          />
          <span className="text-sm text-zinc-300">
            Лайкать только у кого сегодня ДР
            <span className="text-zinc-500 ml-1">(при группе — только участники с ДР сегодня)</span>
          </span>
        </label>
        {message && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm">
            {message}
          </div>
        )}
        <div className="space-y-6">
          <div>
            <h3 className="font-medium text-white mb-2">Список ID пользователей</h3>
            <textarea
              value={userIdsText}
              onChange={(e) => setUserIdsText(e.target.value)}
              placeholder="123456789&#10;987654321&#10;или через запятую"
              rows={6}
              className="w-full px-3 py-2 rounded-lg bg-surface-600 border border-surface-500 text-sm font-mono focus:ring-2 focus:ring-accent outline-none resize-y"
            />
            <button
              onClick={saveUserIds}
              className="mt-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm"
            >
              Сохранить список
            </button>
          </div>
          <div className="pt-4 border-t border-surface-500">
            <h3 className="font-medium text-white mb-2">Или группа ВКонтакте</h3>
            <p className="text-zinc-500 text-sm mb-2">
              ID группы или короткое имя (например club123 или group_name). Будут взяты участники группы.
            </p>
            <input
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              placeholder="club123 или short_name"
              className="w-full max-w-md px-3 py-2 rounded-lg bg-surface-600 border border-surface-500 text-sm focus:ring-2 focus:ring-accent outline-none"
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="text-zinc-400 text-sm">
                Лимит участников:
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={groupMemberLimit}
                  onChange={(e) => setGroupMemberLimit(Number(e.target.value) || 1000)}
                  className="ml-2 w-20 px-2 py-1 rounded bg-surface-600 border border-surface-500 text-sm"
                />
              </label>
              <button
                onClick={saveGroup}
                disabled={!groupId.trim()}
                className="px-4 py-2 rounded-lg bg-surface-600 hover:bg-surface-500 text-sm disabled:opacity-50"
              >
                Сохранить группу
              </button>
              {config?.kind === 'group' && config.groupId && (
                <button
                  type="button"
                  onClick={saveGroupLimit}
                  className="px-4 py-2 rounded-lg bg-surface-600 hover:bg-surface-500 text-sm text-zinc-300"
                >
                  Сохранить только лимит
                </button>
              )}
            </div>
          </div>
        </div>
        {config && (
          <div className="mt-4 pt-4 border-t border-surface-500 text-sm text-zinc-500">
            Сейчас:{' '}
            {config.kind === 'user_ids'
              ? `список (${config.userIds?.length ?? 0} ID)`
              : `группа ${config.groupId}${config.groupMemberLimit != null ? `, лимит ${config.groupMemberLimit}` : ''}`}
          </div>
        )}
      </section>
    </div>
  );
}

function JobPanel() {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof api.jobs.status>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const load = () => api.jobs.status().then(setStatus).catch(() => setStatus(null));

  useEffect(() => {
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, []);

  const start = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await api.jobs.start();
      if (res.error) setMessage(res.error);
      else setMessage(`Запущено. Целей: ${res.totalTargets ?? 0}`);
      load();
    } catch (e) {
      setMessage(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  };

  const stop = async () => {
    try {
      await api.jobs.stop();
      setMessage('Остановка запрошена');
      load();
    } catch (e) {
      setMessage(String((e as Error).message));
    }
  };

  const running = status?.status === 'running';

  return (
    <div className="space-y-6">
      <section className="bg-surface-700 rounded-xl border border-surface-500 p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Задача</h2>
        {message && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-amber-500/10 text-amber-400 text-sm">
            {message}
          </div>
        )}
        <div className="flex flex-wrap gap-4 items-center mb-6">
          <button
            onClick={start}
            disabled={loading || running}
            className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Старт
          </button>
          <button
            onClick={stop}
            disabled={!running}
            className="px-5 py-2.5 rounded-lg bg-red-600/80 hover:bg-red-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Стоп
          </button>
          {status && (
            <span className="text-zinc-400 text-sm">
              {status.processed} / {status.totalTargets} · лайков: {status.liked} · пропущено: {status.skipped} · ошибок: {status.errors}
            </span>
          )}
        </div>
        {status && status.logs?.length > 0 && (
          <div className="rounded-lg bg-surface-800 border border-surface-500 overflow-hidden">
            <h3 className="px-4 py-2 text-sm font-medium text-zinc-400 border-b border-surface-500">Лог</h3>
            <ul className="max-h-96 overflow-y-auto p-2 font-mono text-xs">
              {[...status.logs].reverse().map((log) => (
                <li
                  key={log.id}
                  className={`py-1 px-2 rounded ${
                    log.level === 'error' ? 'text-red-400' :
                    log.level === 'warn' ? 'text-amber-400' :
                    log.level === 'success' ? 'text-emerald-400' : 'text-zinc-400'
                  }`}
                >
                  <span className="text-zinc-500 mr-2">
                    {new Date(log.ts).toLocaleTimeString('ru')}
                  </span>
                  {log.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function CaptchaPanel() {
  const [items, setItems] = useState<{ sid: string; img: string; keyId: string; ownerId: number; itemId: number; createdAt: number }[]>([]);
  const [solving, setSolving] = useState<string | null>(null);
  const [input, setInput] = useState<Record<string, string>>({});

  const load = () => api.captcha.list().then((r) => setItems(r.items)).catch(() => setItems([]));

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const solve = async (sid: string) => {
    const key = input[sid]?.trim();
    if (!key) return;
    setSolving(sid);
    try {
      await api.captcha.solve(sid, key);
      setInput((prev) => ({ ...prev, [sid]: '' }));
      load();
    } finally {
      setSolving(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-surface-700 rounded-xl border border-surface-500 p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Капча</h2>
        <p className="text-zinc-400 text-sm mb-4">
          Если ВК запросила капчу, она появится здесь. Введите текст с картинки и нажмите «Отправить» — лайк будет поставлен.
        </p>
        {items.length === 0 ? (
          <p className="text-zinc-500 text-sm">Нет ожидающих капч.</p>
        ) : (
          <ul className="space-y-4">
            {items.map((c) => (
              <li
                key={c.sid}
                className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-surface-600 border border-surface-500"
              >
                <img src={c.img} alt="captcha" className="rounded border border-surface-500" />
                <div className="flex-1 min-w-[200px]">
                  <input
                    value={input[c.sid] ?? ''}
                    onChange={(e) => setInput((prev) => ({ ...prev, [c.sid]: e.target.value }))}
                    placeholder="Введите текст с картинки"
                    className="w-full px-3 py-2 rounded-lg bg-surface-700 border border-surface-500 text-sm focus:ring-2 focus:ring-accent outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && solve(c.sid)}
                  />
                </div>
                <button
                  onClick={() => solve(c.sid)}
                  disabled={solving === c.sid || !(input[c.sid]?.trim())}
                  className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm disabled:opacity-50"
                >
                  {solving === c.sid ? '…' : 'Отправить'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
