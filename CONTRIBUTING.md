# Contributing

Thanks for taking a look at Tixiaozhu. The project is open source under AGPL-3.0-or-later and welcomes practical, well-verified contributions.

## What Helps Most

- Improve setup docs, API docs, and production-readiness notes.
- Add focused tests for student flows, admin flows, payment deferral, OCR deferral, and data scoping.
- Refactor large modules into smaller route, service, and data-layer files without changing behavior.
- Improve accessibility, mobile layout, and empty/error states.
- Improve question-bank quality checks and teaching-content coverage.

Question-bank contributors should also read [docs/question-bank-contributing.md](docs/question-bank-contributing.md).

## Local Setup

Install dependencies in each workspace:

```bash
npm ci
npm --prefix frontend ci
npm --prefix admin ci
npm --prefix backend ci
```

Run the three services:

```bash
npm --prefix backend run dev
npm --prefix frontend run dev
npm --prefix admin run dev
```

Default local URLs:

- Student app: `http://127.0.0.1:5173/`
- Admin app: `http://127.0.0.1:5174/`
- API: `http://127.0.0.1:8787/api`

The local admin account is only for development:

```text
username: admin
password: admin123
```

## Verification

Before opening a pull request, run the smallest relevant set of checks:

```bash
npm run build
npm --prefix backend run audit:question-bank
npm --prefix backend run audit:product-readiness
npm --prefix backend run audit:runtime-security
npm run audit:production-build
```

For UI changes, also run:

```bash
npm run audit:launch-ui
npm run audit:interaction-qa
```

## Pull Request Guidelines

- Keep changes small and reviewable.
- Reuse existing UI and API patterns before adding abstractions.
- Do not commit `.env*`, local data, screenshots with private information, or generated build output.
- Document behavior changes in README or `docs/` when they affect setup, security, deployment, or maintainer workflows.
- If a production blocker is intentionally deferred, make sure the relevant audit reports it clearly.

## License

Contributions are accepted under the same public license used by this repository: GNU Affero General Public License v3.0 or later. See [docs/license-faq.md](docs/license-faq.md) for a plain-language explanation. Proprietary commercial licensing may be offered separately by the copyright holder.
