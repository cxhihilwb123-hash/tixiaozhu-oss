# Testing and Verification

Tixiaozhu uses audit scripts as launch gates. They are intentionally more product-oriented than ordinary unit tests.

## Core Checks

```bash
npm run build
npm --prefix backend run audit:question-bank
npm --prefix backend run audit:product-readiness
npm --prefix backend run audit:runtime-security
npm run audit:production-build
```

What they cover:

- `build`: student and admin production bundles.
- `audit:question-bank`: pack, question, knowledge-point, coverage, duplication, and teaching-design quality.
- `audit:product-readiness`: internal-test business object readiness.
- `audit:runtime-security`: auth scoping, anonymous access blocking, payment deferral, and student data isolation.
- `audit:production-build`: scans production bundles for local API origins, default admin copy, mock payment residue, mock AI copy, source maps, and legacy demo residue.

## UI Audits

```bash
npm run audit:launch-ui
npm run audit:interaction-qa
```

These Playwright checks build the apps, start a local backend, and exercise high-value student and admin flows.

## Production-Oriented Checks

```bash
npm --prefix backend run audit:commercial-launch
npm --prefix backend run preflight:production
npm --prefix backend run smoke:production
```

Commercial launch readiness is allowed to return `blocked` for local development. That means the guard is working. A real production environment should configure PostgreSQL, strong admin/student secrets, AI service, object storage, monitoring, and public domains.

## Dependency Audit

```bash
npm audit --omit=dev
npm --prefix frontend audit --omit=dev
npm --prefix admin audit --omit=dev
npm --prefix backend audit --omit=dev
```

## Manual QA Notes

`QA_REPORT.md` records a prior local QA pass. Public repositories should not include screenshots or recordings that contain private information. Keep generated screenshots and videos ignored unless they are intentionally sanitized demo assets.
