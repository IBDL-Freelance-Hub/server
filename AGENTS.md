# IBDL Freelancers Hub — Backend Engineering & AI Agent Constitution

The IBDL Freelancers Hub backend is a modular monolith built with Express and TypeScript.

All AI coding agents, software engineers, and contributors MUST strictly obey the rules set forth in this document.

---

## Mandated AI Agent Contract & Guardrails

Every AI agent working on this repository MUST strictly observe the following 13 rules without exception:

1. **Read AGENTS.md First**: Read `AGENTS.md` before performing any code generation, modification, or repository refactoring.
2. **Read Project Skills**: Read all applicable skills in `.agents/skills/` (specifically `.agents/skills/backend-architecture/SKILL.md` and `.agents/skills/backend-security/SKILL.md`) prior to feature design or implementation.
3. **Follow Specification Authority**: Treat the Functional Requirements and System Behaviour Specification v5.0 Final as the sole functional authority.
4. **Never Invent Business Rules**: Never invent business rules, workflow states, prices, limits, permissions, legal policies, or operational processes.
5. **Never Alter Approved Architecture**: Preserve the approved Modular Monolith architecture, Express runtime, and PostgreSQL/Prisma stack. Never introduce microservices, CQRS, event buses, or heavy DI containers without explicit approval.
6. **Never Implement Unapproved Features**: Stick strictly to the explicitly approved phase and sprint scope.
7. **No Unapproved Database Models**: Never create database models or Prisma schemas before the database model design is explicitly approved.
8. **No Unapproved Endpoints**: Never create API endpoints or controllers before the API contract is approved.
9. **Never Weaken Security Controls**: Server-side authentication, authorization, ownership validation, Zod request validation, rate limiting, and password hashing MUST be enforced. UI visibility is never treated as security.
10. **Never Bypass Quality Checks**: Never bypass tests, linting (`npm run lint`), strict type checking (`npm run type-check`), formatting (`npm run format:check`), or pre-commit hooks.
11. **Stop & Clarify Ambiguities**: If a requirement or behavior is ambiguous, STOP and ask the user for explicit clarification instead of guessing or assuming.
12. **Produce Implementation Plans**: Produce a detailed implementation plan (`implementation_plan.md`) before undertaking any significant feature development.
13. **Respect Task Scope**: Focus exclusively on the current assigned task and stop immediately upon completion. Never proceed into future implementation phases automatically.

---

## Architectural & Layering Rules

### Module Structure

A module must represent a business capability (e.g., `src/modules/auth/`, `src/modules/members/`).
A module may contain:

- `presentation/` (routes, thin controllers)
- `application/` (use cases, application services)
- `domain/` (domain types, pure business rules)
- `infrastructure/` (Prisma repositories, third-party integrations)

### Layer Responsibilities

- **Presentation**: HTTP concerns only. Controllers MUST remain thin: receive validated input, call the application layer, and return HTTP responses. Database ORM primitives must never leak into controllers.
- **Application**: Manages workflows and use cases. Coordinates repositories, domain rules, and external services.
- **Domain**: Pure business concepts and rules with **zero dependencies on Express or Prisma**.
- **Infrastructure**: Technical implementation details (Prisma repositories, storage providers, email providers).

### Dependency Direction

`Presentation → Application → Domain`. Infrastructure supports the Application layer.

- Avoid circular dependencies.
- Cross-module access must use explicit public interfaces or exported application services. Direct access to another module's internal repository is forbidden.

---

## Pragmatism & Simplicity ("Do Not Overengineer")

- Do **not** automatically introduce unnecessary interfaces, factories, abstract classes, event buses, CQRS, or DI containers.
- Introduce abstractions only when solving an immediate, concrete problem.
- Keep the codebase simple, lean, and maintainable.
