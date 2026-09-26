# AGENTS.md — AgPro Solutions Management System (v2)

Operational guide, architecture map, current system status, and pre-production roadmap for autonomous agents and engineers working on `agpro-v2`.

---

## 1. Project & Business Identity

* **Company**: **AgPro Solutions** ([agprosolu.com](https://agprosolu.com/))
* **Headquarters**: 1200 E Howard St, Creston, IA 50801
* **Contact**: Tel: `(641) 745-7392` &bull; Email: `agprosolu@gmail.com`
* **Official Slogan**: *"Putting The Farmer Back In Control!"*
* **Leadership**: Adam Leith (Farming & Custom Application) and Dane Wardenburg (Seed & Agronomy). Family- and veteran-owned.
* **Core Business**:
  1. **Crop Protection & Fertilizer**: Bulk chemicals, foliar nutrition, adjuvants, fungicides, burndowns.
  2. **Channel® Seed Corn & Soybean Distributor**: Authorized Bayer Channel SeedPro with in-house seed treatment.
  3. **Custom Aerial Drone Application**: Precision spraying/spreading via DJI Agras T50 fleet.
  4. **Ground Rig Application**: Targeted precision application with minimal drift.
  5. **Iowa Territory**: Southwest Iowa corridor (Union, Adams, Clarke, Ringgold, Taylor, Adair counties).

---

## 2. Edge-Native Technology Stack

To ensure low latency, zero cold starts, and multi-user concurrency on mobile tablets and desktop browsers:
* **Frontend**: SvelteKit 2 + Svelte 5 (TypeScript, Runes reactivity).
* **Styling**: Tailwind CSS v4 (GitHub-inspired theme with Light/Dark/System toggles).
* **API Router / Middleware**: Hono v4 running native on Cloudflare Workers edge runtime.
* **Database & ORM**: Cloudflare D1 SQL engine via Drizzle ORM (`drizzle-orm/d1`).
* **Authentication**: Edge-native Web Crypto PBKDF2 (100k iterations, SHA-256) password hashing + D1 `session` and `account` tables + HttpOnly Lax session cookies.
* **Storage**: Cloudflare R2 bucket (`agpro-documents`) for raw scans, PDFs, and invoices.
* **Deployment Target**: Cloudflare Pages with Git continuous deployment.

---

## 3. Current Implementation Status

All 4 initial development phases, production authentication lockdown, and branding alignment are **100% complete, verified, and deployed**:

### Phase 1: Edge-Database Schema Definition & Seeding (`DONE`)
* `src/lib/db/schema.ts`: 16 tables covering `users`, `accounts`, `sessions`, `verifications`, `customers`, `iowa_compliance_logs`, `vendors`, `products`, `drone_units`, `inventory_transactions`, `invoices`, `invoice_items`, `checks`, `check_sequences`, `document_ingestion_logs`, and `system_audit_logs`.
* `agpro-v2-prod` D1 Database: Clean production database created (`f5315046-250a-4f80-9d89-91fed09ce8a7`).
* Seeded with 13 products (Ventas, Tenkoz 4L, Nano, Xsate 53.8%, Enlist One, Interline, Channel 209-15 corn, Channel 2420E3 soy, Channel 198-45 Trecepta, DJI Agras T50 fleet, batteries, and nozzles).

### Phase 2: Hono Gateway Layer & Document Parse Controls (`DONE`)
* `src/lib/server/api/`: Sub-routers for auth, customers, inventory, ingestion, invoices, checks, compliance, system logs.
* `src/lib/server/parsers/`: Ingestion parsers for Channel Straight BOL (isolates BOL/CMR # and Order # for Iowa IDALS seed audits), Wickman Chemical, Atticus LLC, and I & B Ag Supply.
* `src/lib/server/rbac.ts`: Enforces `Sales`, `Manager`, and `Admin` permissions with security audit logging.

### Phase 3: Cross-Platform UI Layout Engine (`DONE`)
* GitHub-aesthetic responsive dashboard (`src/routes/+page.svelte`) with theme switcher (Light, Dark, System).
* `InvoiceComposer.svelte`: Customer profile auto-fills, 3-tier dynamic markups (*Financed App*, *Cash App*, *Carry*), and Iowa seed compliance submission gate (blocks submission if regulated seed lacks verified BOL/Order #).
* `IngestionView.svelte`: 1-click test document loaders with real-time extracted schema preview.
* Inventory, drone fleet tracking, CRM accounts, and Iowa compliance search.

### Phase 4: Electronic Distribution & Print Optimization (`DONE`)
* Physical print CSS (`@media print`) for US Letter (8.5" x 11") invoices and 3-part corporate check stock.
* `InvoicePrintModal.svelte`: Formatted with AgPro Solutions Creston header, IDALS compliance note, and Iowa sales tax exemption (§ 423.3).
* `ChecksView.svelte`: Admin-only checkwriting ledger with atomic sequential numbering, number-to-words legal line generator, and 3-part voucher stubs.

### Production Authentication & Hardening (`DONE`)
* `src/lib/server/crypto.ts`: Zero-dependency edge-native PBKDF2 password hashing & verification.
* `src/lib/components/LoginView.svelte`: Gated login screen with email/password authentication. Demo one-click persona switcher removed from production UI.
* Seeded Staff Logins in D1:
  * **Admin**: `admin@agpro.iowa` / `AgPro2026!Admin` (Curtis Vance)
  * **Manager**: `manager@agpro.iowa` / `AgPro2026!Mgr` (Sarah Lindqvist)
  * **Sales**: `sales@agpro.iowa` / `AgPro2026!Sales` (Jake Miller)

---

## 4. Git & Cloudflare Infrastructure Mapping

* **GitHub Repository**: [`https://github.com/bangsmackpow/agproapp-v2.git`](https://github.com/bangsmackpow/agproapp-v2.git) (Branch: `main`)
* **Cloudflare Account ID**: `0e528c886015cce349076fb7db222a88` (`curtislamasters@gmail.com`)
* **Live Pages Deployment**: `https://agproapp-v2.pages.dev`
* **D1 Database Binding**: `DB` &rarr; `agpro-v2-prod` (UUID: `f5315046-250a-4f80-9d89-91fed09ce8a7`)
* **R2 Bucket Binding**: `DOCUMENTS` &rarr; `agpro-documents`
* **Wrangler Pages Rule**: Do **not** include `account_id` or `[observability]` in `wrangler.toml` (Cloudflare Pages CI/CD rejects them).

---

## 5. Verification Commands (Quality Gates)

Run these commands before pushing any code changes:

```powershell
# 1. Run all 15 automated unit tests
pnpm test

# 2. Run TypeScript & Svelte compiler checks (must be 0 errors, 0 warnings)
pnpm check

# 3. Compile edge production bundle
pnpm build
```

When applying D1 migrations remotely:
```powershell
$env:CLOUDFLARE_ACCOUNT_ID="0e528c886015cce349076fb7db222a88"; pnpm wrangler d1 migrations apply agpro-v2-prod --remote
```

---

## 6. Remaining Items to Address Before Production Launch

Before cutting over as the daily operating system for AgPro Solutions, complete these items:

| # | Item | Category | Description | Priority |
|---|---|---|---|---|
| **1** | **Custom Production Domain** | DevOps | Bind custom domain (e.g. `app.agprosolu.com` or `portal.agprosolu.com`) to Cloudflare Pages in Cloudflare Dashboard &rarr; Pages &rarr; Custom Domains. | **High** |
| **2** | **Password Rotation & Staff Management UI** | Security | Provide an Admin UI tab to invite new staff, edit roles, and allow users to change their temporary passwords (`AgPro2026!*`) without direct SQL queries. | **High** |
| **3** | **R2 Object Upload Integration** | Storage | Connect `IngestionView.svelte` upload handler to stream incoming BOL/invoice PDFs and JPGs directly to the `DOCUMENTS` R2 bucket for permanent audit storage. | **Medium** |
| **4** | **Electronic Email Dispatch** | Integrations | Connect `POST /api/invoices/:id/dispatch` to a transactional email provider (SendGrid, Postmark, Resend, or Cloudflare Email Routing) to email invoice PDFs directly to growers. | **Medium** |
| **5** | **Physical Check Stock Alignment Test** | Hardware | Perform physical test prints on office check hardware with blank 3-part check stock to verify margins and perforation alignment (tunable via CSS variables in `src/app.css`). | **Medium** |
| **6** | **Historical Grower & Seed Data Migration** | Data | Import existing customer/grower rosters, field boundaries, and past Channel seed BOL records from legacy spreadsheets or accounting records into D1. | **Low** |
| **7** | **Off-line / PWA Field Support** | Mobile | Add service worker caching so field reps in rural Iowa with spotty cellular coverage can compose draft invoices and browse read-only inventory offline. | **Low** |
