# API Reference

This document summarizes the public API shape exposed by the Node backend. It is intended as a contributor reference, not a full OpenAPI schema.

Default local API base:

```text
http://127.0.0.1:8787/api
```

## Authentication

Student sessions use `Authorization: Bearer <student-token>`.

Admin sessions use `Authorization: Bearer <admin-token>`.

Production or `REQUIRE_STUDENT_AUTH=true` requires real student tokens for personal learning data, purchases, uploads, and payment session creation.

## Health and Readiness

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Basic process health. |
| `GET` | `/api/ready` | Runtime readiness, static app availability, data layer, and launch-gate status. |
| `GET` | `/api/product-readiness` | Internal product-readiness report. |
| `GET` | `/api/commercial-launch-readiness` | Commercial launch-readiness report. |
| `GET` | `/api/question-bank-quality` | Question-bank quality report. Admin protected. |
| `GET` | `/api/question-bank-coverage` | Question-bank coverage report. |

## Student Auth

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create a student account and return a session token. |
| `POST` | `/api/auth/login` | Log in as a student and return a session token. |
| `GET` | `/api/auth/session` | Restore the current student session. |

## Admin Auth

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/admin/auth/login` | Log in as an administrator. |
| `GET` | `/api/admin/auth/session` | Restore the current admin session. |

Admin write APIs require an admin token. Local default admin credentials are for development only.

## Content and Question Bank

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/question-packs` | List question packs available to the current user/admin context. |
| `PATCH` | `/api/question-packs/:id` | Update a question pack. Admin protected. |
| `GET` | `/api/question-packs/:id/export` | Export a question pack in JSON-like form. |
| `GET` | `/api/question-packs/:id/export.pdf` | Export a question pack as PDF. |
| `GET` | `/api/question-packs/:id/export-status` | Read async export status. |
| `GET` | `/api/question-packs/:id/versions` | List pack version history. Admin protected. |
| `POST` | `/api/question-packs/:id/questions/bulk` | Bulk update pack questions. Admin protected. |
| `PATCH` | `/api/question-packs/:id/questions/reorder` | Reorder pack questions. Admin protected. |
| `GET` | `/api/questions` | List questions. |
| `PATCH` | `/api/questions/:id` | Update a question. Admin protected. |
| `GET` | `/api/knowledge-points` | List knowledge points. |
| `GET` | `/api/knowledge-points/:id/coach-pack.pdf` | Export a knowledge-point coach pack. Admin protected. |

## Learning Data

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/dashboard` | Student dashboard and learning summary data. |
| `GET` | `/api/learning-report` | Learning report data. |
| `GET` | `/api/learning-records` | Learning records. Student-scoped or admin protected depending on runtime. |
| `POST` | `/api/practice-records` | Create a practice record. Student-scoped in production. |
| `GET` | `/api/subject-scores` | Subject score summary. |
| `GET` | `/api/wrong-questions` | List wrong questions. Student-scoped in production. |
| `PATCH` | `/api/wrong-questions/:id` | Update wrong-question state. Student-scoped in production. |
| `GET` | `/api/wrong-questions/export.pdf` | Export wrong-question review material. |
| `GET` | `/api/favorite-questions` | List favorite questions. Student-scoped in production. |
| `POST` | `/api/favorite-questions` | Add a favorite question. Student-scoped in production. |

## Uploads, OCR, and Grading

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/uploaded-questions` | List uploaded/manual-input questions. Student-scoped in production. |
| `POST` | `/api/uploaded-questions` | Save an uploaded/manual-input question. Student-scoped in production. |
| `GET` | `/api/recognition/config` | Read OCR launch strategy and availability. |
| `POST` | `/api/uploads/recognize` | Recognize uploaded question content. Gated by OCR strategy. |
| `POST` | `/api/answers/grade` | Grade an answer or manual correction flow. |

## Points, Purchases, Orders, and Payments

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/payment/config` | Read payment launch strategy and visibility. |
| `GET` | `/api/membership-plans` | List membership plans. |
| `GET` | `/api/point-packages` | List point packages. |
| `GET` | `/api/point-rules` | List point rules. |
| `GET` | `/api/content-purchases` | List content purchases. Student-scoped in production. |
| `POST` | `/api/content-purchases/buy` | Buy/unlock a content pack. Student-scoped in production. |
| `GET` | `/api/point-transactions` | List point transactions. Student/admin scoped. |
| `GET` | `/api/points/account` | Read point account. Student-scoped in production. |
| `POST` | `/api/points/purchase` | Purchase points. Student-scoped in production. |
| `POST` | `/api/points/spend` | Spend points. Student-scoped in production. |
| `GET` | `/api/orders` | List orders. Admin protected in production. |
| `POST` | `/api/orders` | Create an order. Test-payment behavior is blocked in production. |
| `GET` | `/api/payments` | List payment records. Admin protected. |
| `POST` | `/api/payments/session` | Create a payment session. Student-scoped in production. |
| `POST` | `/api/payments/webhook` | Payment provider webhook with signature verification. |
| `POST` | `/api/payments/mock-confirm` | Development-only mock payment confirmation. |
| `POST` | `/api/payments/refund` | Create a refund record. Admin protected. |
| `POST` | `/api/admin/points/adjust` | Adjust a student's points. Admin protected. |

## Admin Settings and AI

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/users` | List users. Admin protected in production. |
| `GET` | `/api/settings` | Read system settings. |
| `PATCH` | `/api/settings` | Update system settings. Admin protected. |
| `POST` | `/api/ai/generate` | Generate questions through configured AI provider. Admin protected. |
| `GET` | `/api/ai/history` | List AI-generation history. Admin protected. |
| `POST` | `/api/ai/review` | Review generated content. Admin protected. |

## Error Shape

Most JSON responses use:

```json
{
  "ok": true,
  "data": {},
  "meta": {}
}
```

Errors generally use:

```json
{
  "ok": false,
  "error": "Human-readable message"
}
```

HTTP status codes are meaningful. Auth failures and launch-gate blocks should be treated as product signals, not only transport errors.

## Launch-Gate Notes

Payment and OCR can be deferred for a limited production scope:

```text
PAYMENT_LAUNCH_STRATEGY=deferred
OCR_LAUNCH_STRATEGY=deferred
```

Production deployments should still configure PostgreSQL, strong admin/student secrets, AI service, object storage, monitoring, and explicit public domains.
