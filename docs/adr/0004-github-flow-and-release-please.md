# 4. GitHub Flow and Automated Releases with Release Please

* **Status:** Accepted
* **Date:** 2026-09-29 (retroactive record)
* **Decision Makers:** Diego Hahn

## Context

Branching strategies featuring multiple concurrent long-lived branches (such as classic GitFlow with `develop`, `master`, `release/*`, and `hotfix/*`) introduce significant friction for agile projects:
1. **Integration conflicts ("merge hell"):** Long divergence between branches increases merge reconciliation complexity.
2. **Delivery lag:** Multiple manual stabilization gates between completing a feature and deploying to production.
3. **Inconsistent releases:** Manual git tagging and changelog drafting are error-prone and frequently fall out of sync.

Conversely, committing directly to `main` without automated pipelines would threaten production stability on Vercel and undermine atomic code reviews.

## Decision

We adopted GitHub Flow paired with Conventional Commits and Google Release Please automation:

1. **Short-lived feature branches:** All development branches off an up-to-date `main` using standardized semantic prefixes (`feat/`, `fix/`, `docs/`, `chore/`).
2. **Branch protection rulesets:** Direct commits to `main` are blocked. Branches require Pull Requests with all required status checks passing (configured without third-party approval counts, matching solo/pair engineering workflows).
3. **Automated CI gates per Pull Request:** Every PR must achieve 100% pass rates across:
   - Linting and static type checking (TypeScript in the dashboard, Ruff in the Python collector);
   - Unit and component tests with an enforced minimum code coverage threshold of ≥ 80%;
   - Production Next.js builds;
   - Security scanning for known vulnerabilities, misconfigurations, and leaked secrets (Trivy and Semgrep).
   Integration tests (using real Supabase and Open-Meteo services) and end-to-end (E2E) browser tests execute upon merge to `main` and via daily schedules to protect live credentials from fork PRs.
4. **Squash and Merge:** PRs are merged via squash commits, compressing branch revisions into a single atomic commit with a Conventional Commit message and maintaining a clean, linear history.
5. **Automated semantic versioning:** The `.github/workflows/release-please.yml` workflow parses merged Conventional Commits, computes the next Semantic Version (SemVer), updates `CHANGELOG.md`, and drafts or publishes GitHub Releases and git tags automatically.

## Consequences

### Positive

* **Linear, auditable history:** Clean git tree simplifies `git bisect`, audits, and automated rollbacks.
* **Continuous deployment confidence:** Every commit merged into `main` has passed strict static analysis, builds, and test coverage thresholds.
* **Predictable version governance:** Fully automated, categorized changelogs eliminating human versioning errors.

### Negative and Mitigations

* **Strict commit discipline:** PR titles and commit messages must conform strictly to Conventional Commits. *Mitigation:* Documented guidelines in `CONTRIBUTING.md` and automated validation in PR templates.
