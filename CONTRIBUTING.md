# Contributing

This monorepo follows a strict, single-module-per-PR workflow so that independent services stay independently reviewable and deployable. Read `00-source-of-truth.md` and `01-product-requirements.md` at the repo root before contributing — the PRD's Decisions Log (Section 9) is binding for any judgment call not explicitly settled by the brief.

## Branching

No direct pushes to `main`. Work on a feature branch and open a Pull Request.

Branch naming:

- `feat/<module>-<short-description>` — new functionality (e.g. `feat/receiving-service`, `feat/inventory-valuation-report`)
- `fix/<module>-<short-description>` — bug fixes (e.g. `fix/inventory-reservation`)
- `docs/<short-description>` — documentation-only changes (e.g. `docs/system-overview`)

## Pull Request scope

- A PR covers **one module** or **one significant feature**. Do not bundle unrelated changes across services.
- Prefer several small, focused commits over one large commit.
- Use [Conventional Commits](https://www.conventionalcommits.org/) style messages where practical (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`), scoped to the module when useful (e.g. `feat(inventory): add stock valuation endpoint`).

## Merge gate

A PR is only merged when:

- [ ] All CI checks pass (lint, build, unit tests, integration tests).
- [ ] API documentation is updated — the relevant `contracts/openapi/*.yaml` and/or `contracts/proto/*.proto` reflect the change.
- [ ] The feature flag for the module's phase is correctly configured (see the root `README.md`).
- [ ] The root `README.md` module table is updated if a module's status changed or a module was added.

## Definition of Done (per module)

A module is "Ready for Review" only when:

1. Source code lives in its correct `services/<module>` or `frontends/<module>` directory.
2. The feature flag for its phase is implemented and correctly scoped.
3. A PR is open against `main` with a focused, single-module diff.
4. The OpenAPI spec and/or `.proto` files are updated to match the implementation.
5. Unit and integration tests pass in CI (GitHub Actions).
6. The root `README.md` reflects the module's current status.

## Local development

See the root `README.md` for full setup instructions (`docker compose up`, per-service `pnpm dev`, running tests).

## Code review

Request a review once CI is green. Address review comments with additional commits on the same branch rather than force-pushing, unless asked to squash before merge.
