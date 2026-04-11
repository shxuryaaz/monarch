# Monarch API

Backend API for Monarch (Express + TypeScript + Prisma + SQLite).

## Quick start

Uses **PostgreSQL**. Set `DATABASE_URL` in `.env` (local Docker, [Neon](https://neon.tech), etc.).

```bash
npm install
cp .env.example .env
# Edit .env: DATABASE_URL, JWT_SECRET, FRONTEND_ORIGIN, SIWE_*
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

## Implemented endpoints

- `POST /auth/challenge`
- `POST /auth/verify`
- `GET /assets`
- `GET /portfolio/me` (auth)
- `POST /admin/assets` (auth + admin)
- `POST /purchases/intent` (auth)
- `POST /purchases/confirm` (auth)
- `POST /yield/distribute` (auth + admin)
- `POST /yield/claim` (auth)

## Deploy (Render/Railway)

- Build command: `npm install && npx prisma generate && npx prisma migrate deploy && npm run build`
- Start command: `npm run start`
- Required env vars: `DATABASE_URL` (Postgres `postgresql://...`), `JWT_SECRET`, `FRONTEND_ORIGIN`, `SIWE_DOMAIN`, `SIWE_ORIGIN`

For Render, use `render.yaml` in this folder as a starter blueprint. Create a Postgres instance (or Neon) and paste its URL into `DATABASE_URL`.
