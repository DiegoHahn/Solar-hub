# Architectural Decision Records (ADRs)

This directory documents the key architectural decisions made during the design and evolution of **Solar Hub**, structured according to the [MADR (Markdown Architectural Decision Records)](https://adr.github.io/madr/) format.

Each record details the technical context, requirements that drove the decision, the adopted choice, and the consequences (benefits, trade-offs, and mitigations).

---

## Decision Index

| ADR | Title | Date | Status | Decision Summary |
| :---: | :--- | :---: | :---: | :--- |
| [0001](0001-edge-to-cloud-collection-on-local-device.md) | Edge-to-Cloud Collection via Local SBC | 2026-08-30 | **Accepted** | Replaced proprietary vendor clouds with an on-premises SBC (Orange Pi 4 Pro) querying inverters via Modbus and Solarman V5 with offline JSON queuing. |
| [0002](0002-supabase-with-rls-without-custom-api.md) | Supabase with Row Level Security (RLS) without Intermediate API | 2026-09-25 | **Accepted** | Direct access to managed PostgreSQL via Server Components with row-level RLS policies and write access restricted to pre-authorized accounts for caching. |
| [0003](0003-nextjs-app-router-server-components-gru1.md) | Next.js App Router with Server Components and Vercel gru1 Region | 2026-09-04 | **Accepted** | Server-side rendering without client-side request waterfalls, hosted in the gru1 (São Paulo) region on Vercel. |
| [0004](0004-github-flow-and-release-please.md) | GitHub Flow and Automated Releases with Release Please | 2026-09-29 | **Accepted** | Ephemeral branches, CI with strict ≥ 80% coverage gates, linear squash merges, and automated releases derived from Conventional Commits. |
| [0005](0005-tests-with-anonymized-real-data.md) | Testing with Anonymized Real Data and Minimal Mocks | 2026-09-29 | **Accepted** | Test suite built on anonymized production fixtures, real local loopback HTTP servers, and minimization of synthetic test doubles. |
| [0006](0006-email-allowlist-enforced-in-rls.md) | Email Allowlist Enforced in RLS Policies | 2026-10-09 | **Accepted** | `public.allowed_users` and `public.is_allowed_user()` gate every `authenticated` policy, so a valid session outside the allowlist reads zero rows even through the Data API. |

---

## MADR Standard Structure

Each ADR adheres to the standard layout:
* **Context:** Problem statement, forces involved, and evaluated alternatives.
* **Decision:** Technical approach selected and justification.
* **Consequences:** Acquired benefits, trade-offs, and mitigation strategies.
