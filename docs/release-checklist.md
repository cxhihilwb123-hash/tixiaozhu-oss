# Public Release Checklist

Use this before publishing a new public AGPL open-source release.

## Safety

- [ ] No `.env`, `.env.*`, `.env.local`, `.env.deepseek.local`, or deployment credential files are tracked.
- [ ] No real API keys, database URLs, payment credentials, Vercel tokens, session secrets, or private certificates are present.
- [ ] Local credentials used during development have been rotated if there is any chance they were exposed.
- [ ] `backend/data/`, build output, Playwright output, screenshots, and videos are excluded unless intentionally sanitized.
- [ ] QA artifacts contain no private account, student, payment, or deployment information.

## Project Metadata

- [ ] `LICENSE` is present.
- [ ] `COMMERCIAL.md` is present.
- [ ] `README.md` describes AGPL status and optional commercial licensing clearly.
- [ ] `CONTRIBUTING.md`, `SECURITY.md`, `ROADMAP.md`, and `CODE_OF_CONDUCT.md` are present.
- [ ] GitHub issue templates and pull request template are present.

## Verification

```bash
npm ci
npm --prefix frontend ci
npm --prefix admin ci
npm --prefix backend ci
npm run build
npm --prefix backend run audit:question-bank
npm --prefix backend run audit:product-readiness
npm --prefix backend run audit:runtime-security
npm run audit:production-build
npm audit --omit=dev
npm --prefix frontend audit --omit=dev
npm --prefix admin audit --omit=dev
npm --prefix backend audit --omit=dev
```

## GitHub Launch

- [ ] Repository is public.
- [ ] Repository description says "AGPL open source" and does not imply MIT/Apache-style permissive licensing.
- [ ] First release tag is created, for example `v0.1.0`.
- [ ] README screenshots or demo video are sanitized.
- [ ] Issues are seeded with roadmap items and known limitations.
- [ ] CI passes on the public default branch.
