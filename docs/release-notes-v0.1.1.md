# Tixiaozhu v0.1.1

Product-flow polish based on the first external reviewer feedback.

## Changed

- Moved the student home narrative from a question-store-first flow to a daily learning path:
  1. Today's recommended practice.
  2. Capture or manually enter extra questions.
  3. Recycle wrong questions.
  4. Add question packs only when more targeted practice is needed.
- Updated question-store summary numbers to read like parent-facing product copy, for example "42 个题包" and "20 积分" instead of bare dashboard-style numbers.
- Added visible pack-card hints for covered knowledge points and suitable practice situations.
- Updated the demo walkthrough to describe the question store as supplemental practice, not the first attention target.

## Thanks

Thanks to `@stevesagronegocios673-ux` for the first public education-product flow review on issue #15. The feedback helped clarify that parents and students need to understand "what should the child do today?" before browsing or buying more question packs.

## Verification

- `npm run build`
- `npm --prefix backend run audit:question-bank`
- `npm --prefix backend run audit:product-readiness`
- `npm --prefix backend run audit:runtime-security`
- `npm run audit:production-build`
