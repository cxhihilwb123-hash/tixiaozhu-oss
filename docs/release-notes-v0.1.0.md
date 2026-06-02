# Tixiaozhu v0.1.0

Initial public AGPL release.

## Included

- Student React/Vite app with onboarding, home, practice center, question store, capture/manual-input correction, wrong-question workbench, profile, points, and membership/payment entry points.
- Admin React/Vite app with login, dashboard, users, question packs, knowledge points, AI generation, learning records, billing, points, orders, refunds, and settings.
- Node API with student/admin auth, local file persistence, PostgreSQL JSONB snapshot support, payment deferral, webhook verification, AI/OCR strategy gates, static app serving, and production-readiness checks.
- Primary-school Chinese, math, and English question-bank structure.
- AGPL-3.0-or-later license with optional proprietary commercial licensing path.
- GitHub issue templates, PR template, release checklist, security policy, contribution guide, roadmap, architecture notes, and testing docs.

## Verified Locally

- `npm run build`
- `npm --prefix backend run audit:question-bank`
- `npm --prefix backend run audit:product-readiness`
- `npm --prefix backend run audit:runtime-security`
- `npm --prefix backend run audit:production-build`
- `npm audit` for root, frontend, admin, and backend

## Known Limits

- This is not advertised as a turnkey production SaaS.
- Commercial launch readiness can be blocked in local development until production database, strong secrets, AI, object storage, monitoring, and public domains are configured.
- Payment and OCR can be explicitly deferred for a limited release scope.
- The backend is functional but concentrated in `backend/src/server.js`; modularization is a roadmap item.
- Public demo screenshots should be added only after sanitization.
