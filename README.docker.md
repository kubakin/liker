# Деплой через Docker Compose

## Запуск

```bash
docker compose up -d --build
```

- Админка: http://localhost:3000  
- API: внутри сети по адресу `api:3002` (снаружи не проброшен; запросы идут через nginx в контейнере admin).

## Переменные окружения для API

В `docker-compose.yml` для сервиса `api` уже заданы:

- `DATABASE_URL` — подключение к контейнеру Postgres.

Остальное (VK, лимиты и т.д.) можно передать так:

1. Создайте в корне репозитория файл `.env` (по образцу `.env.docker.example`).
2. В `docker-compose.yml` в сервисе `api` раскомментируйте блок `env_file: - .env`.

Либо пропишите переменные в секции `environment` сервиса `api` в `docker-compose.yml`.

## Остановка и данные

```bash
docker compose down
```

Данные БД хранятся в volume `postgres_data`. Чтобы удалить и их:

```bash
docker compose down -v
```
