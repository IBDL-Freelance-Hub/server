---
name: backend-security
description: >-
  Security guidelines, controls, and review rules for the IBDL Freelancers Hub backend.
  Use when designing or implementing authentication, authorization, input validation, HTTP security,
  sensitive data handling, database operations, file security, error handling, and security reviews.
---

# Backend Security Skill

Apply the following security rules whenever designing or implementing backend functionality.

## Core Principle

Never trust client input.
Every request is potentially manipulated.
All security controls must be enforced server-side.

## Authentication

Authentication must:

- verify credentials securely
- avoid user enumeration where possible
- use secure password hashing
- protect authentication endpoints against brute-force attacks
- support account lockout according to the approved specification
- never expose password hashes
- never log credentials

## Authorization

Authorization must:

- be enforced server-side
- validate the authenticated account
- validate the role at request time
- validate ownership where required

A member may access only their own records unless explicitly authorized otherwise.
A hidden UI element is not an authorization mechanism.

Unauthorized operations must:

- change nothing
- return a clear refusal
- be auditable when required

## Input Validation

Validate:

- request body
- route parameters
- query parameters
- uploaded file metadata

Validation must happen before business logic.
Reject unexpected or invalid data.

## HTTP Security

Use appropriate protections including:

- security headers
- controlled CORS configuration
- rate limiting
- request size limits
- secure cookie configuration

Security configuration must differ appropriately between development and production environments.

## Sensitive Data

Never expose:

- password hashes
- secrets
- authentication tokens
- internal stack traces
- private member data
- payment credentials

Never log:

- passwords
- authorization headers
- cookies
- payment details
- sensitive personal information unless explicitly required and safely handled

## Database Security

Use parameterized database access through Prisma.
Never build raw SQL queries using untrusted input.
Critical rules should be protected through database constraints where appropriate.

## File Security

Do not trust:

- file extensions
- MIME types provided by clients
- file names

Uploaded files must pass the approved validation and malware scanning workflow before becoming active.

## Error Security

Production errors must not expose:

- stack traces
- internal file paths
- database details
- infrastructure information

Log detailed errors internally.
Return controlled error responses externally.

## Security Review Checklist

Before completing a feature, check:

1. Can an unauthenticated user access this?
2. Can an authenticated user access another user's data?
3. Can a role perform an operation it should not perform?
4. Is all input validated?
5. Could sensitive data leak?
6. Is the operation protected against brute force or abuse?
7. Does the operation require audit logging?
8. Are secrets excluded from the implementation?
