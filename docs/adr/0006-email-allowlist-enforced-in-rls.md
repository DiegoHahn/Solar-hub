# 6. Email Allowlist Enforced in RLS Policies

* **Status:** Accepted
* **Date:** 2026-10-09
* **Decision Makers:** Diego Hahn
* **Amends:** [ADR 0002](0002-supabase-with-rls-without-custom-api.md) (accepted risk on `authenticated` access)

## Context

ADR 0002 granted the `authenticated` role read access to every dashboard table and write access to the cache tables (`ai_advisor_daily`, `daily_weather`) with `USING (true)`. The only gate on *who* counts as a legitimate user was the `ALLOWED_EMAILS` check in the Next.js middleware.

That check only protects the Next.js routes. Google sign-in is enabled in Supabase Auth, so anyone with a Google account can obtain a valid session and query the Supabase Data API directly with the public publishable key. With `USING (true)`, such a session could read all telemetry and utility data (including the account holder's CPF) and write to the cache and quota tables, bypassing the middleware entirely. The accepted risk in ADR 0002 assumed that only allowlisted emails could hold a session, which is no longer true.

## Decision

Authorization is enforced inside the database, in addition to the middleware:

1. **`public.allowed_users (email, created_at)`**: the list of emails allowed to use the dashboard, stored lowercase. RLS is enabled and no policy is granted to `anon` or `authenticated`, so the list is not readable through the Data API. Rows are inserted manually by the owner (SQL editor / service role); no email is committed to the repository.
2. **`public.is_allowed_user()`**: `SECURITY DEFINER`, `STABLE`, `search_path = ''`; returns whether `lower(auth.jwt() ->> 'email')` is in the table. Execution is revoked from `public`/`anon`.
3. **Every `authenticated` policy** on `solar_telemetry`, `utility_data`, `inverter_daily_history`, `inverter_monthly_history`, `ai_advisor_daily` and `daily_weather` uses `(SELECT public.is_allowed_user())` instead of `true`. The `daily_generation` view is `security_invoker`, so it inherits the telemetry policy.
4. **`increment_ai_quota`** raises `42501` for callers that are neither allowlisted nor `service_role`.

The `ALLOWED_EMAILS` middleware check stays as the first layer (it gives a proper redirect and audit log). The two lists must be kept in sync.

## Consequences

### Positive

* A valid session alone no longer exposes any data: a non-allowlisted user gets zero rows and cannot write, even when calling the Data API directly (covered by `dashboard/src/test/integration/allowlist.integration.test.ts`).
* The risk accepted in ADR 0002 for cache-table writes is now limited to allowlisted users.
* Collectors are unaffected: they write with the `service_role` key, which bypasses RLS.

### Negative and Mitigations

* **Deployment order:** once the migration runs, users missing from `allowed_users` (including the CI/E2E test account) see an empty dashboard. *Mitigation:* the migration header and the PR describe applying it and inserting the emails in the same transaction.
* **Two allowlists to maintain** (`ALLOWED_EMAILS` and `allowed_users`). *Mitigation:* the database is the source of truth for data access; a mismatch fails closed (empty dashboard), never open.
* **Trust in the `email` claim:** the check relies on the email in the Supabase JWT. Email/password sign-ups stay disabled, and Google only issues verified emails.
