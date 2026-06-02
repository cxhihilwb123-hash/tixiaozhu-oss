# Security Policy

Tixiaozhu handles education-product flows, authentication, orders, payments, and student learning data. Please treat security and privacy issues carefully.

## Supported Versions

This open-source release is maintained from the main branch. Security fixes should target the latest public version unless a separate commercial agreement says otherwise.

## Reporting a Vulnerability

Please do not open a public issue for vulnerabilities that expose credentials, student data, payment state, admin access, or production infrastructure.

Send a private report to the repository owner with:

- A short summary of the issue.
- Reproduction steps or affected endpoint/page.
- Impact assessment.
- Any relevant logs or screenshots with secrets and personal data redacted.

## Sensitive Areas

- Admin authentication and session signing.
- Student authentication and data scoping.
- Payment session, webhook, refund, and order-state transitions.
- AI/OCR provider configuration.
- Store import/export and PostgreSQL migration.
- File upload, generated PDFs, backups, and object-storage integration.
- Production launch gates and preflight checks.

## Secret Handling

Never commit real secrets. Keep local values in ignored files such as `.env.local` or deployment platform secrets.

If a secret is accidentally committed or exposed, rotate it immediately and remove it from repository history before publishing.

## Production Status

The project includes commercial launch gates. Passing local development checks does not mean the project is ready for production. Run the production preflight and commercial readiness checks before any real deployment.
