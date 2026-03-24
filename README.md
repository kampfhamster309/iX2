# iX2 — Real Estate Management Platform

**[English](#english) | [Deutsch](#deutsch)**

---

<a name="english"></a>

## English

iX2 is a modular, self-hosted real estate management platform with multi-lingual support (EN/DE). It covers core property management, accounting (full double-entry bookkeeping), and maintenance operations.

### Tech Stack

| Layer           | Technology              |
| --------------- | ----------------------- |
| Runtime         | Node.js 22.x LTS        |
| Language        | TypeScript 5.x (strict) |
| Backend         | NestJS 11 + Fastify     |
| Frontend        | React 19 + Vite 6       |
| Database        | PostgreSQL 16           |
| ORM             | Prisma 6                |
| Package manager | pnpm 10 (workspaces)    |

### Prerequisites

- **Node.js 22.x** — via [nvm](https://github.com/nvm-sh/nvm): `nvm install 22 && nvm use 22`
- **pnpm 10** — `npm install -g pnpm`
- **Docker + Docker Compose** — for PostgreSQL

### Getting Started

**1. Install dependencies**

```bash
pnpm install
```

**2. Start the database**

```bash
docker compose up -d
```

Wait until the health check passes:

```bash
docker compose ps   # Status should show "healthy"
```

**3. Configure environment**

Create `apps/api/.env`:

```env
DATABASE_URL="postgresql://ix2:ix2dev@localhost:5432/ix2"
JWT_ACCESS_SECRET="change-this-in-production"
JWT_REFRESH_SECRET="change-this-in-production"
JWT_ACCESS_EXPIRY="15m"
JWT_REFRESH_EXPIRY="7d"
PORT=4000
```

Create `apps/web/.env`:

```env
VITE_API_URL=/api
```

**4. Run database migrations**

```bash
pnpm --filter @ix2/api db:migrate
```

**5. Seed sample data** _(optional)_

```bash
pnpm --filter @ix2/api db:seed
```

This creates:

- `admin@ix2.local` / `Admin1234!` — Admin user
- `manager@ix2.local` / `Manager1234!` — Manager user
- 2 sample properties with 6 units, 3 tenants, 3 active contracts

**6. Start the application**

```bash
pnpm dev
```

- Frontend: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:4000](http://localhost:4000)
- Swagger docs: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)

To expose the frontend on your local network (e.g. for tablet access):

```bash
pnpm --filter @ix2/web dev -- --host
```

The API is proxied through the Vite dev server, so it works from any device on the network without additional configuration.

### Running Individual Apps

```bash
pnpm --filter @ix2/api dev    # API only
pnpm --filter @ix2/web dev    # Frontend only
```

### Common Commands

```bash
pnpm lint                              # Lint entire monorepo
pnpm test                              # Run all tests
pnpm build                             # Build all apps and packages

pnpm --filter @ix2/api test            # API tests only
pnpm --filter @ix2/api test:coverage   # API test coverage
pnpm --filter @ix2/web test            # Frontend tests only

pnpm --filter @ix2/api db:migrate      # Run pending DB migrations (dev)
pnpm --filter @ix2/api db:seed         # Seed sample data
pnpm --filter @ix2/api db:generate     # Regenerate Prisma client after schema changes
```

### Project Structure

```
iX2/
  apps/
    api/              # NestJS backend (port 4000)
      src/
        auth/         # JWT auth, RBAC guards, roles decorator
        users/        # User lookup service
        properties/   # Property & unit CRUD with ownership scoping
        tenants/      # Tenant management
        contracts/    # Contract lifecycle (create, terminate)
        prisma/       # PrismaService (global)
      prisma/
        schema.prisma # Database schema
        seed.ts       # Sample data seed script
      test/           # Integration tests (Vitest + real DB)
    web/              # React frontend (port 3000)
      src/
        pages/        # Page components (Login, Dashboard, Properties, ...)
        components/   # UI primitives (Button, Input, Card) and layout shell
        context/      # AuthContext — token management and session restore
        lib/          # axios API client, TanStack Query client, utilities
        i18n/         # i18next initialisation
  packages/
    shared/           # Shared TypeScript types and Zod schemas
    i18n/             # EN/DE translation strings (consumed by the frontend)
```

### User Roles

| Role          | Access                                                       |
| ------------- | ------------------------------------------------------------ |
| `ADMIN`       | Full access to everything                                    |
| `MANAGER`     | Access scoped to assigned properties                         |
| `ACCOUNTANT`  | Read access to properties; full access to accounting module  |
| `MAINTENANCE` | Read access to properties; full access to maintenance module |
| `TENANT`      | Read-only access to own contract data                        |

### Production Deployment

iX2 is designed for self-hosted deployment on a single VPS using Docker Compose.

**Important before going to production:**

- Replace `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in `apps/api/.env` with strong random secrets (`openssl rand -hex 64`)
- Set `CORS_ORIGIN` in `apps/api/.env` to your actual frontend domain
- Set `VITE_API_URL` in `apps/web/.env` to your actual API URL (e.g. `https://api.yourdomain.com`)
- Build the frontend: `pnpm --filter @ix2/web build` and serve `apps/web/dist/` via nginx
- Build the API: `pnpm --filter @ix2/api build` and run `node apps/api/dist/main.js`
- Run migrations against the production database: `pnpm --filter @ix2/api exec prisma migrate deploy`

---

<a name="deutsch"></a>

## Deutsch

iX2 ist eine modulare, selbst gehostete Immobilienverwaltungsplattform mit mehrsprachiger Unterstützung (DE/EN). Das System umfasst die Kernverwaltung von Immobilien, Buchhaltung (vollständige doppelte Buchführung) und Instandhaltungsoperationen.

### Technologie-Stack

| Schicht         | Technologie             |
| --------------- | ----------------------- |
| Laufzeit        | Node.js 22.x LTS        |
| Sprache         | TypeScript 5.x (strict) |
| Backend         | NestJS 11 + Fastify     |
| Frontend        | React 19 + Vite 6       |
| Datenbank       | PostgreSQL 16           |
| ORM             | Prisma 6                |
| Paketverwaltung | pnpm 10 (Workspaces)    |

### Voraussetzungen

- **Node.js 22.x** — über [nvm](https://github.com/nvm-sh/nvm): `nvm install 22 && nvm use 22`
- **pnpm 10** — `npm install -g pnpm`
- **Docker + Docker Compose** — für PostgreSQL

### Erste Schritte

**1. Abhängigkeiten installieren**

```bash
pnpm install
```

**2. Datenbank starten**

```bash
docker compose up -d
```

Warten bis der Health-Check erfolgreich ist:

```bash
docker compose ps   # Status sollte "healthy" anzeigen
```

**3. Umgebungsvariablen konfigurieren**

`apps/api/.env` erstellen:

```env
DATABASE_URL="postgresql://ix2:ix2dev@localhost:5432/ix2"
JWT_ACCESS_SECRET="in-produktion-aendern"
JWT_REFRESH_SECRET="in-produktion-aendern"
JWT_ACCESS_EXPIRY="15m"
JWT_REFRESH_EXPIRY="7d"
PORT=4000
```

`apps/web/.env` erstellen:

```env
VITE_API_URL=/api
```

**4. Datenbankmigrationen ausführen**

```bash
pnpm --filter @ix2/api db:migrate
```

**5. Beispieldaten einspielen** _(optional)_

```bash
pnpm --filter @ix2/api db:seed
```

Dies erstellt:

- `admin@ix2.local` / `Admin1234!` — Admin-Benutzer
- `manager@ix2.local` / `Manager1234!` — Manager-Benutzer
- 2 Beispielimmobilien mit 6 Einheiten, 3 Mietern und 3 aktiven Verträgen

**6. Anwendung starten**

```bash
pnpm dev
```

- Frontend: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:4000](http://localhost:4000)
- Swagger-Dokumentation: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)

Um das Frontend im lokalen Netzwerk zugänglich zu machen (z. B. für Tablet-Zugriff):

```bash
pnpm --filter @ix2/web dev -- --host
```

Die API wird über den Vite-Dev-Server weitergeleitet und funktioniert daher von jedem Gerät im Netzwerk ohne weitere Konfiguration.

### Einzelne Apps starten

```bash
pnpm --filter @ix2/api dev    # Nur API
pnpm --filter @ix2/web dev    # Nur Frontend
```

### Häufige Befehle

```bash
pnpm lint                              # Gesamtes Monorepo linten
pnpm test                              # Alle Tests ausführen
pnpm build                             # Alle Apps und Pakete bauen

pnpm --filter @ix2/api test            # Nur API-Tests
pnpm --filter @ix2/api test:coverage   # API-Testabdeckung
pnpm --filter @ix2/web test            # Nur Frontend-Tests

pnpm --filter @ix2/api db:migrate      # Ausstehende DB-Migrationen ausführen (Entwicklung)
pnpm --filter @ix2/api db:seed         # Beispieldaten einspielen
pnpm --filter @ix2/api db:generate     # Prisma-Client nach Schemaänderungen neu generieren
```

### Projektstruktur

```
iX2/
  apps/
    api/              # NestJS-Backend (Port 4000)
      src/
        auth/         # JWT-Authentifizierung, RBAC-Guards, Rollen-Decorator
        users/        # Benutzer-Lookup-Service
        properties/   # Immobilien- & Einheiten-CRUD mit Besitzer-Scoping
        tenants/      # Mieterverwaltung
        contracts/    # Vertrags-Lifecycle (erstellen, kündigen)
        prisma/       # PrismaService (global)
      prisma/
        schema.prisma # Datenbankschema
        seed.ts       # Skript für Beispieldaten
      test/           # Integrationstests (Vitest + echte Datenbank)
    web/              # React-Frontend (Port 3000)
      src/
        pages/        # Seitenkomponenten (Login, Dashboard, Immobilien, ...)
        components/   # UI-Primitives (Button, Input, Card) und Layout-Shell
        context/      # AuthContext — Token-Verwaltung und Session-Wiederherstellung
        lib/          # axios-API-Client, TanStack-Query-Client, Hilfsfunktionen
        i18n/         # i18next-Initialisierung
  packages/
    shared/           # Gemeinsame TypeScript-Typen und Zod-Schemas
    i18n/             # DE/EN-Übersetzungen (vom Frontend verwendet)
```

### Benutzerrollen

| Rolle         | Zugriff                                                              |
| ------------- | -------------------------------------------------------------------- |
| `ADMIN`       | Vollzugriff auf alles                                                |
| `MANAGER`     | Zugriff auf zugewiesene Immobilien                                   |
| `ACCOUNTANT`  | Lesezugriff auf Immobilien; Vollzugriff auf das Buchhaltungsmodul    |
| `MAINTENANCE` | Lesezugriff auf Immobilien; Vollzugriff auf das Instandhaltungsmodul |
| `TENANT`      | Nur-Lese-Zugriff auf eigene Vertragsdaten                            |

### Produktiv-Deployment

iX2 ist für das selbst gehostete Deployment auf einem einzelnen VPS mit Docker Compose ausgelegt.

**Wichtig vor dem Produktiveinsatz:**

- `JWT_ACCESS_SECRET` und `JWT_REFRESH_SECRET` in `apps/api/.env` durch starke Zufallswerte ersetzen (`openssl rand -hex 64`)
- `CORS_ORIGIN` in `apps/api/.env` auf die tatsächliche Frontend-Domain setzen
- `VITE_API_URL` in `apps/web/.env` auf die tatsächliche API-URL setzen (z. B. `https://api.ihredomain.de`)
- Frontend bauen: `pnpm --filter @ix2/web build`, dann `apps/web/dist/` über nginx ausliefern
- API bauen: `pnpm --filter @ix2/api build`, dann `node apps/api/dist/main.js` ausführen
- Migrationen gegen die Produktionsdatenbank ausführen: `pnpm --filter @ix2/api exec prisma migrate deploy`
