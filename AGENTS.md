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

### Pre-Production Features: Staff Management, R2 Archival & Resend Dispatch (`DONE`)
* `src/lib/server/api/routes/users.ts`: Admin-only staff account lifecycle router (list staff, create staff, edit roles, toggle active/suspended status, and reset passwords).
* `ChangePasswordModal.svelte`: Self-service password rotation for any authenticated user via edge PBKDF2 hash update.
* `StaffManagementView.svelte`: Dedicated Admin management console with RBAC policy documentation, staff directory, and action dialogs.
* `src/lib/server/api/routes/ingestion.ts`: Full integration with Cloudflare R2 (`DOCUMENTS` binding -> `agpro-documents`). Incoming invoices and Channel seed BOLs are streamed directly into R2 object storage with metadata indexing.
* `src/lib/server/api/routes/invoices.ts`: Integrated with Resend API (`POST /api/invoices/:id/dispatch`) supporting `RESEND_API_KEY` and `RESEND_FROM_EMAIL` with branded Creston IA layout, IDALS compliance notice, and Iowa sales tax exemption (§ 423.3).

### Streamlined 4-Pillar Application Architecture (`DONE`)
The application is streamlined into 4 core navigation pillars:
1. **Invoices**: Primary operational view with quick summary metric cards (Total Sales Billed, Pending/Unpaid, Drone Coverage Acres), status filters, full composer, US Letter print preview, and Resend email dispatch.
2. **Customers (CRM)**: Grower directory, farm entities, contact details, purchase ledger, and linked Iowa seed BOL compliance history.
3. **Inventory**: Unified catalog (Chemicals, Seed, Drone equipment, Misc), 3-tier pricing, cycle count stock adjustments, and embedded **"Import BOL / Invoices"** modal with R2 document ingestion.
4. **Staff** (Admin only): Secure staff account lifecycle and RBAC controls.

---

## 6. Remaining Items to Address Before Production Launch

Before cutting over as the daily operating system for AgPro Solutions, complete these items:

| # | Item | Category | Description | Priority |
|---|---|---|---|---|
| **1** | **Custom Production Domain** | DevOps | Bind custom domain (e.g. `app.agprosolu.com` or `portal.agprosolu.com`) to Cloudflare Pages in Cloudflare Dashboard &rarr; Pages &rarr; Custom Domains. | **High** |
| **2** | **Resend Production Key in Cloudflare** | Configuration | Add `RESEND_API_KEY` (and optional `RESEND_FROM_EMAIL`) in Cloudflare Dashboard &rarr; Pages &rarr; `agpro-v2` &rarr; Settings &rarr; Environment variables. | **High** |
| **3** | **Physical Check Stock Alignment Test** | Hardware | Perform physical test prints on office check hardware with blank 3-part check stock to verify margins and perforation alignment (tunable via CSS variables in `src/app.css`). | **Medium** |
| **4** | **Historical Grower & Seed Data Migration** | Data | Import existing customer/grower rosters, field boundaries, and past Channel seed BOL records from legacy spreadsheets or accounting records into D1. | **Low** |
| **5** | **Off-line / PWA Field Support** | Mobile | Add service worker caching so field reps in rural Iowa with spotty cellular coverage can compose draft invoices and browse read-only inventory offline. | **Low** |
