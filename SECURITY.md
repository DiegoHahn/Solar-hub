# Security Policy

## Supported versions

Only the latest release on `main` receives fixes. Older tags are not patched.

## Reporting a vulnerability

Please do not open a public issue for security problems.

Report it privately through [GitHub private vulnerability reporting](https://github.com/DiegoHahn/Solar-hub/security/advisories/new) and include:

- the affected component (dashboard, API route, collector, CI workflow);
- steps to reproduce or a proof of concept;
- the impact you expect.

You should get a first response within 7 days. Confirmed issues are fixed on a private branch and disclosed in the release notes once the fix is deployed.

## Scope

In scope:

- authentication and the email allowlist (`dashboard/src/lib/supabase/middleware.ts`, `dashboard/src/app/auth/`);
- Supabase Row Level Security policies (`supabase/migrations/`);
- API routes under `dashboard/src/app/api/`;
- isolation of the public demo (`/demo`) from production data;
- the edge collectors and their handling of credentials.

Out of scope:

- the inverters' and data logger's own firmware and local protocols;
- the utility cooperative portal and other third-party services;
- denial of service against the Vercel deployment or Supabase project.

## Automated checks

Every pull request runs Trivy (dependencies, secrets, misconfigurations) and Semgrep. CodeQL, Dependabot alerts and secret scanning with push protection are enabled on the repository.
