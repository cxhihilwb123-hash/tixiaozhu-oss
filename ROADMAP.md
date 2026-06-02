# Roadmap

Tixiaozhu is an AGPL open-source education-product engineering sample. The current release is useful for local study, architecture review, and experimentation. It is not advertised as a turnkey production SaaS.

## Current Baseline

- Student app, admin app, and Node API.
- Local file persistence with PostgreSQL snapshot support.
- Primary-school Chinese, math, and English question-bank structure.
- Practice, wrong-question review, question-store, points, orders, admin operations, and AI-generation workflows.
- Launch-readiness, runtime-security, product-readiness, and question-bank audits.
- Payment and OCR can be explicitly deferred for a limited production scope.

## Near Term

- Split large backend routes and services out of `backend/src/server.js`.
- Add API reference documentation for student, admin, payment, and readiness endpoints.
- Add lighter fixtures for public demos and CI-friendly tests.
- Publish screenshots or a demo video that do not include private data.
- Improve modal accessibility, focus management, and mobile QA coverage.
- Add more explicit issue templates for question-bank quality reports.

## Production Hardening

- Complete PostgreSQL production migration guidance and backup/restore rehearsal.
- Replace all default admin and student secrets in deployment examples.
- Add object-storage integration for uploads, PDFs, and exports.
- Add monitoring and alerting examples.
- Add real payment-provider adapter documentation when commercial payment is no longer deferred.
- Add real OCR/vision adapter documentation when photo recognition is no longer deferred.

## Maintainer Automation

- Expand CI to cover dependency audit, launch gates, and focused UI checks.
- Add release checklist and changelog workflow.
- Add Codex-assisted PR review, issue triage, and security-review workflows for maintainers.
