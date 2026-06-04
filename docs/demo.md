# Demo Walkthrough

This page is a quick visual tour for reviewers, contributors, and Codex for OSS evaluators.

## 1. Student Learning Dashboard

The student app starts from a daily learning path rather than a marketplace-first view. The first question is "what should the child do today?": finish the recommended practice, capture or manually enter extra questions, recycle wrong questions, and only then use the question store to add more targeted packs.

![Student learning dashboard](assets/screenshots/student-home.png)

## 2. Question Store

The question store is a supplemental source of practice. It organizes primary-school Chinese, math, and English into textbook-sync, special-training, and paper/diagnostic packs. The current baseline contains `252` packs, `6912` questions, and `108` knowledge points. Pack cards now emphasize the covered knowledge points and the situation where a pack is useful, so parents can understand why a child should practice it instead of only seeing a category label.

![Question store](assets/screenshots/question-store.png)

## 3. First Reviewer Feedback

The v0.1.1 flow polish was prompted by early public feedback from `@stevesagronegocios673-ux` on issue #15. Their review pointed out that parents and students need a stronger "today's task" path before browsing question packs. The project now treats the question store as a supplemental source, not the first attention target on the student home page.

## 4. Operations Admin

The admin app includes dashboard, users, question content, AI generation, knowledge points, learning records, billing/points, and settings.

![Admin dashboard](assets/screenshots/admin-dashboard.png)

## 5. Launch Gates

The repository includes GitHub Actions launch gates for:

- Dependency install.
- Production dependency audit.
- Frontend/admin build.
- Question-bank audit.
- Product-readiness audit.
- Runtime-security audit.
- Production-bundle residue scan.
- Commercial launch readiness as an informational local-default check.

Latest workflow: [OSS Launch Gates](https://github.com/cxhihilwb123-hash/tixiaozhu-oss/actions/workflows/launch-gates.yml).

## 6. Why It Is Useful

Tixiaozhu is designed as a complete Chinese AI education-product engineering sample. It shows how to combine student UX, admin operations, structured content, auth, payments/points, production gates, and audit workflows in one AGPL open-source repository.
