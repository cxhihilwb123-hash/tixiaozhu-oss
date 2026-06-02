# Architecture

Tixiaozhu is organized as three applications plus shared operational docs:

```text
frontend/   student-facing React/Vite app
admin/      operations React/Vite app
backend/    Node HTTP API, persistence, readiness gates, and audits
api/        serverless entrypoint wrapper for compatible deployments
docs/       launch, testing, database, and maintenance documentation
```

## Runtime Shape

```text
Student app  ->  /api  ->  Node backend  ->  file store or PostgreSQL JSONB snapshot
Admin app    ->  /api  ->  Node backend  ->  readiness audits and admin operations
```

The backend can also serve the built student and admin static files. In that mode `/` serves the student app, `/admin/` serves the admin app, and `/api/*` serves JSON endpoints.

## Student App

The student app covers:

- Onboarding and grade selection.
- Home dashboard.
- Practice center.
- Question store.
- Capture/manual-input correction.
- Wrong-question workbench.
- Profile, points, and membership/payment entry points.

Important files:

- `frontend/src/App.jsx`
- `frontend/src/pages/PracticeCenterPage.jsx`
- `frontend/src/pages/QuestionStorePage.jsx`
- `frontend/src/pages/CapturePage.jsx`
- `frontend/src/stores/index.js`
- `frontend/src/utils/api.js`

## Admin App

The admin app covers:

- Login and session restore.
- Dashboard.
- Users.
- Question packs and uploaded questions.
- Knowledge points.
- AI generation.
- Learning records and wrong questions.
- Billing, points, orders, refunds, and settings.

Important files:

- `admin/src/App.jsx`
- `admin/src/components/AdminLayout.jsx`
- `admin/src/pages/QuestionsPage.jsx`
- `admin/src/pages/BillingPage.jsx`
- `admin/src/pages/SettingsPage.jsx`
- `admin/src/utils/api.js`

## Backend

The backend currently lives mostly in `backend/src/server.js`. It handles:

- CORS and static app serving.
- Student and admin auth.
- Question-bank APIs.
- Practice records, wrong questions, uploads, and purchases.
- Orders, payment sessions, mock confirmation in development, webhook verification, and refunds.
- Readiness and production launch gates.
- AI and OCR strategy enforcement.
- Store import/export and persistence flushes.

Supporting files:

- `backend/src/store-persistence.js`
- `backend/src/store-validation.js`
- `backend/src/commercial-launch-readiness.js`
- `backend/src/product-readiness.js`
- `backend/src/elementary-question-bank.js`
- `backend/src/seed-data.js`
- `backend/src/launch-integrations.js`

## Data Layer

Local development uses file persistence under `backend/data/`, which is intentionally ignored by git.

Production-style deployments should use:

```text
TIXIAOZHU_DATA_LAYER=postgres
DATABASE_URL=...
TIXIAOZHU_DATABASE_TABLE=tixiaozhu_store
```

The current PostgreSQL layer stores validated business snapshots in JSONB. That keeps migration from the local file store simple while preserving a boundary for future relational tables.

## Launch Gates

The project intentionally distinguishes:

- Local development readiness.
- Product/internal-test readiness.
- Commercial launch readiness.

Useful commands:

```bash
npm --prefix backend run audit:question-bank
npm --prefix backend run audit:product-readiness
npm --prefix backend run audit:commercial-launch
npm --prefix backend run audit:runtime-security
npm run audit:production-build
```

Commercial readiness may be blocked even when local development checks pass. That is expected when production database, strong secrets, AI, object storage, monitoring, or real domains are not configured.
