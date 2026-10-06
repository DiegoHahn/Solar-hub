# Contributing

The project follows the **GitHub Flow**: `main` is always production-ready and all changes are introduced via pull requests.

## Workflow

1. Create a feature branch from an up-to-date `main`, using the prefix corresponding to the change type:

   ```bash
   git switch main && git pull
   git switch -c feat/yearly-history
   ```

   Branch prefixes: `feat/`, `fix/`, `test/`, `docs/`, `refactor/`, `chore/`, `ci/`.

2. Keep commits atomic and adhere to the [Conventional Commits](https://www.conventionalcommits.org/) specification:

   ```text
   feat(inverters): yearly generation comparison per inverter
   fix(collector): reconnect to Solis logger after socket timeout
   ```

3. Open a pull request targeting `main`. The CI pipeline runs linting, typechecking, tests with strict coverage gates, production builds, and security scans (Trivy and Semgrep); Vercel deploys an isolated preview environment directly on the PR.

4. Once all status checks pass and code review comments are resolved, the PR is merged via **squash and merge**. The PR title becomes the commit message on `main`, preserving Conventional Commits history. The feature branch is automatically deleted.

Direct pushes to `main`, force pushes, and merges with failing checks are blocked by repository branch protection rulesets.

## Local Quality Checks

A `pre-push` hook runs automated test suites and coverage verification prior to each push. Enable it once per local clone:

```bash
git config core.hooksPath .githooks
```

To execute checks manually:

```bash
cd dashboard && npm run lint && npm run typecheck && npm run test:coverage
cd collector && ruff check . && ruff format --check . && pytest
```

## Releases

Releases follow [Semantic Versioning](https://semver.org/) and are automated by [release-please](https://github.com/googleapis/release-please) based on commits merged into `main`: it maintains an automated release PR with an updated `CHANGELOG.md` and version bump (`fix` and `perf` → patch, `feat` → minor, `!` / `BREAKING CHANGE` → major). Other commit types (`refactor`, `test`, `docs`, `ci`, `chore`, `style`) are preserved in Git history without triggering a version increment. When the release PR is merged, GitHub Releases and git tags are created automatically.

## Deployment

- **Dashboard:** Vercel automatically deploys `main` to production on every merge.
- **Edge Collector:** The physical edge device tracks `main`; following merged changes in `collector/`, pull the latest code and restart the systemd service (`systemctl restart solar-inverters@<user>`).
