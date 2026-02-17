# Сборка (в apps/api нет своего package-lock — ставим и собираем здесь)
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# Продакшен
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
COPY package.json ./
COPY --from=builder /app/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

EXPOSE 3002

CMD ["node", "dist/main.js"]
