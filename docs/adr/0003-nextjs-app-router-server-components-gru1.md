# 3. Next.js App Router with Server Components and Vercel gru1 Region

* **Status:** Accepted
* **Date:** 2026-09-04 (retroactive record)
* **Decision Makers:** Diego Hahn

## Context

Dashboards built strictly as client-side Single Page Applications (SPAs running entirely in the browser) encounter well-known limitations:

1. **Request waterfalls:** Browsers must download JavaScript bundles, initialize the framework runtime, display empty layout skeletons, and dispatch cascading asynchronous API requests to fetch telemetry, weather forecasts, bills, and charts.
2. **Excessive JavaScript bundle size:** Formatting libraries, data transformation logic, and database client SDKs are shipped to the end-user device.
3. **Network transit latency:** If serverless functions run in distant hosting regions (such as North America), communication between the end-user in Brazil, the web server, and the database accumulates round-trip network delays on every request.

## Decision

We adopted Next.js 16 with App Router, React Server Components (RSC), and deployment in the `gru1` (São Paulo, Brazil) region on Vercel:

1. **Server Components by default:** Core application routes fetch database records directly during server rendering. Clients receive ready-to-render HTML containing complete data, drastically shortening time to first meaningful paint.
2. **Targeted interactivity boundary:** Only components requiring DOM events, browser lifecycle hooks, or Canvas/SVG manipulation (Recharts, Radix UI tabs, Theme toggle) declare the `'use client'` directive.
3. **Vercel `gru1` region deployment:** Serverless functions are provisioned in the São Paulo (`gru1`) datacenter, minimizing latency to Brazilian end-users and the local database endpoint.
4. **API credential protection:** Sensitive external API integrations (Google Gemini AI, Open-Meteo) execute within server route handlers and Server Components, preventing service tokens and API keys from leaking to client bundles.

## Consequences

### Positive

* **Reduced round-trip latency:** Geographical co-location of serverless functions minimizes perceived response times.
* **Efficient initial page loads:** Pre-rendered HTML payloads ensure immediate data visibility and prevent Cumulative Layout Shift (CLS).
* **Minimal client-side bundle size:** Parsing algorithms, statistical calculations, and data aggregators stay on the server.
* **Secret isolation:** AI model tokens, prompt templates, and infrastructure secrets remain inaccessible to client browsers.

### Negative and Mitigations

* **Serialization boundaries:** Requires strict discipline when passing objects between Server and Client Components. *Mitigation:* Comprehensive TypeScript interfaces enforcing serializable props across all component boundaries.
