# IBDL Freelancers Hub — Backend Monolith

Production API server for the **IBDL Freelancers Hub** platform built using Node.js, Express.js, TypeScript, PostgreSQL, and Prisma ORM.

---

## Architecture Overview

The backend uses a **Modular Monolith architecture** with a NestJS-inspired domain module structure and Clean Architecture principles:

- **Framework**: Express.js with TypeScript in strict mode.
- **Database & ORM**: PostgreSQL with Prisma ORM.
- **Layering Principle**: `Presentation → Application → Domain`. Infrastructure supports Application/Domain interfaces.
- **Domain Modules**: Business capabilities isolated inside `src/modules/<domain>/`.

---

## Current Phase Limitations

> [!IMPORTANT]
> **Repository Foundation Phase Only**:
> This repository is currently in the **Repository Foundation** stage. It includes project configuration, developer tooling (ESLint, Prettier, Husky), Docker containers, environment variable templates, and structural module directories.
>
> **No business logic, domain entities, Prisma schemas, database models, controllers, or API endpoints have been implemented in this phase.**

---

## Prerequisites

- **Node.js**: v20.x or v22.x LTS
- **npm**: v10.x+
- **Docker & Docker Compose**: (v24.x+ / Docker Desktop)

---

## Quick Start & Local Setup

### 1. Clone & Install Dependencies

```bash
git clone <repository-url>
cd server
npm install
```

### 2. Environment Configuration

Copy the template environment file to `.env`:

```bash
cp .env.example .env
```

### 3. Start Local PostgreSQL Database via Docker

```bash
docker compose up -d postgres
```

### 4. Run Development Server

```bash
npm run dev
```

The server foundation will start listening on port `5000` (or the port defined in `.env`).

---

## Available npm Scripts

| Script                 | Command                   | Description                                    |
| :--------------------- | :------------------------ | :--------------------------------------------- |
| `npm run dev`          | `tsx watch src/server.ts` | Starts development server with live reload     |
| `npm run build`        | `tsc`                     | Compiles TypeScript into JavaScript (`dist/`)  |
| `npm run start`        | `node dist/server.js`     | Runs compiled production server                |
| `npm run lint`         | `eslint .`                | Runs ESLint for static analysis                |
| `npm run format`       | `prettier --write .`      | Formats code with Prettier                     |
| `npm run format:check` | `prettier --check .`      | Verifies code formatting                       |
| `npm run type-check`   | `tsc --noEmit`            | Validates TypeScript types without emitting JS |
| `npm run prepare`      | `husky`                   | Configures Git pre-commit hooks                |

---

## Docker Commands

```bash
# Validate Docker Compose configuration
docker compose config

# Build API & PostgreSQL containers
docker compose build

# Start containers in detached mode
docker compose up -d

# View container logs
docker compose logs -f

# Stop containers
docker compose down
```

---

## Repository Structure

```text
server/
├── .agents/               # Project AI skills & security guidelines
├── .husky/                # Git pre-commit hooks
├── docker/
│   └── Dockerfile         # Multi-stage Node.js development container
├── prisma/                # Prisma schema & migrations directory
├── src/
│   ├── config/            # Validated environment configuration
│   ├── shared/            # Cross-cutting errors, middleware, & utilities
│   │   ├── errors/
│   │   ├── middleware/
│   │   ├── validation/
│   │   ├── providers/
│   │   └── utils/
│   ├── modules/           # Modular Monolith Business Domains
│   │   ├── auth/          # Authentication & credentials placeholder
│   │   ├── members/       # Member registry placeholder
│   │   ├── staff/         # Staff accounts placeholder
│   │   ├── membership/    # Membership tiers placeholder
│   │   ├── files/         # File management placeholder
│   │   ├── audit/         # Append-only audit log placeholder
│   │   └── notifications/ # Email/alerts placeholder
│   ├── app.ts             # Express app setup & baseline security middleware
│   └── server.ts          # Server bootstrap entrypoint
├── tests/                 # Unit, Integration, and API test placeholders
│   ├── unit/
│   ├── integration/
│   └── api/
├── .env.example           # Environment template
├── .eslintrc.json         # ESLint configuration
├── .prettierrc            # Prettier formatting rules
├── AGENTS.md              # AI Agent Contract & Engineering Rules
├── docker-compose.yml     # Local dev infrastructure (Node + PostgreSQL 16)
├── package.json           # Node.js dependencies & scripts
├── README.md              # Project documentation
└── tsconfig.json          # Strict TypeScript configuration
```

---

## Development Workflow & Code Quality

- **TypeScript Strict Mode**: Enabled (`strict: true`). Unsafe `any` types and implicit coercions are disallowed.
- **Git Hooks**: Husky runs `lint-staged` on pre-commit to lint and format all staged files automatically.
- **CI / Quality Checks**: All pull requests must pass `type-check`, `lint`, and `format:check` before merging.
