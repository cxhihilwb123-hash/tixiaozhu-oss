# Question-Bank Contributing Guide

Tixiaozhu's question bank is designed as a product system, not a pile of exercises. Contributions should preserve the structure that makes the content useful for students, parents, and operators.

## Current Content Shape

The public baseline includes:

- `252` question packs.
- `6912` questions.
- `108` knowledge points.
- Primary-school Chinese, math, and English only.
- Three product lines: textbook sync, special training, and paper/diagnostic packs.
- Variant-family structure from concept recognition to challenge questions.

Run:

```bash
npm --prefix backend run audit:question-bank
```

## What Good Contributions Look Like

Good question-bank work usually does one of these:

- Fixes a wrong answer or weak explanation.
- Strengthens a thin stem into a real scenario/task.
- Adds clearer step-by-step reasoning.
- Improves parent-review or teacher-commentary notes.
- Fixes a knowledge-point, grade, difficulty, or pack mismatch.
- Removes duplication or mechanical drill residue.
- Improves coverage without adding unrelated subjects.

## What to Avoid

- Do not add secondary-school subjects to the primary-school baseline.
- Do not add generic arithmetic drills without scenario, method, or review value.
- Do not lower the teaching-design fields just to make data entry easier.
- Do not remove launch or content-quality audits to make a weak contribution pass.
- Do not include copyrighted textbook pages, private school materials, or paid workbook content unless you have the rights to contribute it.

## Key Fields to Preserve

Question packs should preserve:

- Subject.
- Grade.
- Series: textbook, special, or paper.
- Product positioning.
- Teaching goals.
- Knowledge-point coverage.
- Suggested scenario and usage.

Questions should preserve:

- Question body.
- Correct answer.
- Step-by-step explanation.
- Knowledge point.
- Difficulty and cognitive level.
- Common mistake diagnosis.
- Scoring notes.
- Parent or teacher review hint.
- Variant-family role.

## Reporting a Question Issue

Use the "Question-bank quality" issue template and include:

- Subject.
- Grade.
- Pack ID if known.
- Question ID if known.
- What is wrong.
- Suggested correction.

## Verifying a Contribution

Run:

```bash
npm --prefix backend run audit:question-bank
npm --prefix backend run audit:product-readiness
npm run build
```

If your contribution changes user-facing content or admin views, also check the relevant page manually or with the UI audit workflow.
