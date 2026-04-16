# Riot Tracker Pro

Plataforma web **frontend + backend** para analítica de League of Legends inspirada en la experiencia premium de productos como Mobalytics, construida con stack moderno, tipado fuerte y arquitectura preparada para escalar.

## Stack

- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS + React Query
- **Backend**: Node.js + Express + TypeScript + Zod
- **Cache**: Redis (ioredis)
- **HTTP**: Axios con retries y manejo de rate limits

---

## Estructura del proyecto

```txt
.
├── apps
│   ├── api
│   │   ├── src
│   │   │   ├── clients
│   │   │   ├── config
│   │   │   ├── controllers
│   │   │   ├── middleware
│   │   │   ├── repositories
│   │   │   ├── routes
│   │   │   ├── services
│   │   │   ├── types
│   │   │   └── utils
│   └── web
│       └── src
│           ├── components
│           ├── features
│           ├── layouts
│           ├── pages
│           ├── services
│           ├── styles
│           └── types
├── .env.example
└── README.md
```

---

## Instalación

### 1) Prerrequisitos

- Node.js 20+
- npm 10+
- Redis local o remoto
- Riot API Key válida

### 2) Variables de entorno

Copia `.env.example` a `.env` y ajusta los valores:

```bash
cp .env.example .env
```

> ⚠️ Nunca subas llaves reales (`RIOT_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DATABASE_URL`) al repositorio. Si ya las compartiste públicamente, rótalas inmediatamente.

### 3) Instalar dependencias

```bash
npm install
```

### 4) Desarrollo local

En dos terminales:

```bash
npm run dev:api
npm run dev:web
```

- API: `http://localhost:1000` (usa `PORT=1000`; también se acepta `API_PORT`)
- Web: `http://localhost:5173`

---

## Arquitectura

## Backend (Clean-ish layered)

1. **Routes**: define endpoints REST limpios (`src/routes`).
2. **Controllers**: adaptadores HTTP request/response (`src/controllers`).
3. **Services**: lógica de negocio + agregación de Riot (`src/services`).
4. **Clients**: cliente Riot robusto (timeout, retries, 429 handling) (`src/clients`).
5. **Repositories**: acceso a caché Redis (`src/repositories`).
6. **Middleware**: validaciones y manejo de errores homogéneo (`src/middleware`).

## Frontend

- `pages/App.tsx`: orquestación del dashboard.
- `features/*`: módulos de dominio (player/match).
- `components/*`: piezas UI reutilizables (cards, métricas, estados).
- `services/*`: capa API centralizada.
- React Query para estados remotos, caché local, loaders y errores.

---

## Endpoints disponibles

Base: `/api/riot`

- `GET /profile/:region/:gameName/:tagLine`
- `GET /ranked/:region/:puuid`
- `GET /history/:region/:puuid?count=10`
- `GET /match/:region/:matchId`
- `GET /live/:region/:puuid`
- `GET /mastery/:region/:puuid?count=8`
- `GET /summary/:region/:gameName/:tagLine`

### Errores manejados profesionalmente

- `400 INVALID_REGION`
- `404 PLAYER_NOT_FOUND`
- `429 RIOT_RATE_LIMIT`
- `503 RIOT_TEMPORARY_ERROR / RIOT_UNAVAILABLE`
- `500 INTERNAL_ERROR`

---

## Rendimiento y robustez

- Caché por endpoint en Redis con TTL ajustado por tipo de recurso.
- Retries exponenciales para errores temporales.
- Respeto del `retry-after` en 429.
- Queries paralelas para resumen y métricas.
- Carga progresiva en frontend con skeletons.

---

## Sugerencias de mejoras futuras

1. Soporte multi-jugador comparativo en una misma vista.
2. Dashboard de recomendaciones por rol/champion pool.
3. Persistencia histórica en PostgreSQL para analítica longitudinal.
4. Worker queue (BullMQ) para pre-cálculo de insights.
5. Auth + perfiles guardados + favoritos.
6. Tests E2E (Playwright) y contract tests API.
7. Observabilidad completa (OpenTelemetry + Prometheus + Grafana).

---

## Notas legales

Este proyecto está **inspirado en patrones de UX gaming premium**, pero no copia código, assets ni elementos protegidos de terceros.
