---
name: backend-architecture
description: >-
  Architectural guidelines and constraints for the IBDL Freelancers Hub backend modular monolith.
  Use when designing, scaffolding, or implementing backend modules, layers (presentation, application,
  domain, infrastructure), Express routes, controllers, use cases, domain rules, and Prisma repositories.
---

# Backend Architecture Skill

The IBDL Freelancers Hub backend is a modular monolith built with Express and TypeScript.

## Module Structure

A module should represent a business capability.

Example:
`src/modules/auth/`

A module may contain:

- `presentation/`
- `application/`
- `domain/`
- `infrastructure/`

Do not create empty layers. Create only the layers needed by the feature.

## Presentation Layer

Responsible for HTTP concerns.

Examples:

- routes
- controllers

Controllers should:

- receive validated input
- call the application layer
- return HTTP responses

Controllers should remain thin.

## Application Layer

Responsible for application workflows.

Examples:

- `RegisterMemberUseCase`
- `LoginUseCase`
- `UpgradeMembershipUseCase`

Application services coordinate:

- business operations
- repositories
- domain rules
- external services

## Domain Layer

Contains domain concepts and business rules that do not depend on Express or Prisma.

Examples:

- domain types
- workflow rules
- eligibility rules
- state transition rules

Keep domain rules independent where practical.
Do not force a full Domain-Driven Design (DDD) implementation.

## Infrastructure Layer

Responsible for technical implementation details.

Examples:

- Prisma repositories
- email providers
- payment providers
- file storage providers

Infrastructure implementations should not leak into controllers.

## Dependency Direction

Preferred dependency direction:

```
Presentation → Application → Domain
```

Infrastructure supports the application layer.

- Avoid circular dependencies.
- Avoid modules directly accessing another module's internal repository.
- Use explicit interfaces or application services when cross-module interaction is required.

## Do Not Overengineer

Do not automatically create:

- interfaces (unless needed for abstractions/cross-module boundaries)
- factories
- abstract classes
- event buses
- CQRS
- dependency injection containers

Introduce abstractions only when they solve a current problem.
The architecture should remain simple enough for a small development team to understand.
