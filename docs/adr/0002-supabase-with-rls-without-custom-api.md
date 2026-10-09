# 2. Supabase with Row Level Security (RLS) without an Intermediate API Layer

* **Status:** Accepted, amended by [ADR 0006](0006-email-allowlist-enforced-in-rls.md)
* **Date:** 2026-09-25 (retroactive record)
* **Decision Makers:** Diego Hahn

## Context

Dashboard-oriented web applications often adopt a traditional three-tier architecture: Frontend (SPA) → Backend/API (Node.js/Python) → Database (SQL).

For Solar Hub, maintaining an intermediate custom API service would introduce:
1. **Operational overhead:** Needing to provision, monitor, and maintain additional cloud services or container runtimes.
2. **Duplicated type layers:** Writing redundant DTOs, serializes, and REST controller routes simply to forward database records to the client.
3. **Extra network latency:** An additional network hop (Browser/SSR → API Gateway → PostgreSQL).

## Decision

We adopted Supabase (managed PostgreSQL) with Row Level Security (RLS) as our unified data and authentication layer, queried directly by Next.js via React Server Components and Route Handlers:

1. **Authentication:** Supabase Auth manages identities via JWT tokens stored in cookies managed by the `@supabase/ssr` package (`sameSite=lax`). These session cookies are **not** `httpOnly`: the browser client reads them so it can refresh the session (only the demo-mode cookie is `httpOnly`). Public registrations are disabled in the project; only accounts pre-authorized via the `ALLOWED_EMAILS` environment variable can access application routes.
2. **Data isolation via RLS:**
   - **Restricted reads:** All tables enforce `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. Anonymous (`anon`) users have no read permissions on telemetry or utility billing tables.
   - **Restricted writes on telemetry:** The `solar_telemetry` and `utility_data` tables reject write operations (INSERT, UPDATE, DELETE) from users with the `authenticated` role. Only the administrative `service_role` key, held exclusively on the local edge hardware, can write these records.
3. **`authenticated` writes on cache tables (`ai_advisor_daily` and `daily_weather`):**
   - The dashboard consumes weather forecasts from Open-Meteo and recommendations from the Gemini AI Energy Advisor. To prevent API cost spikes and rate limit exhaustion, responses are cached by date.
   - Vercel serverless functions execute under the identity of the logged-in user (`authenticated`). To persist daily cache entries without exposing the privileged `service_role` key in the Vercel cloud environment, we grant write permissions for the `authenticated` role on `ai_advisor_daily` and `daily_weather`.
   - **Accepted risk:** The `authenticated` role can perform INSERT/UPDATE queries on these cache tables for any date. This risk is accepted because public user signups are disabled in Supabase Auth, and only trusted emails explicitly specified in `ALLOWED_EMAILS` can establish authenticated sessions.

> **Update (2026-10-09):** the assumption above did not hold: with Google sign-in enabled, any Google account can obtain an `authenticated` session, and `ALLOWED_EMAILS` is only checked by the Next.js middleware, not by the Data API. [ADR 0006](0006-email-allowlist-enforced-in-rls.md) moves the allowlist into the database (`public.allowed_users` + `public.is_allowed_user()`), and every `authenticated` policy now requires it instead of `USING (true)`.

## Consequences

### Positive

* **Lean architecture:** Zero intermediate backend servers or reverse proxies to orchestrate and scale.
* **Database-level centralized access control:** Security policies are applied at the row level in PostgreSQL. As originally written (`USING (true)`), they only separated anonymous from authenticated sessions; *who* may use the dashboard was decided by the Next.js middleware alone, so a valid session could bypass it through the Data API. Since [ADR 0006](0006-email-allowlist-enforced-in-rls.md), the policies also check the email allowlist, so the middleware and the database enforce the same rule independently.
* **Serverless execution without master keys:** Weather and AI caching functions run seamlessly on Vercel without exposing the `service_role` key to frontend bundles or cloud hosting environment configurations.

### Negative and Mitigations

* **Coupling to database primitives:** Access rules depend on PostgreSQL syntax and RLS mechanisms. *Mitigation:* PostgreSQL is an open standard; all security policies are declared in version-controlled SQL migrations within the repository.
