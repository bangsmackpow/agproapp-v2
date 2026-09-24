# AgPro Iowa — Edge-Native Agricultural Management System

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-2.7-orange.svg)](https://kit.svelte.dev/)
[![Hono](https://img.shields.io/badge/Hono-4.13-E36002.svg)](https://hono.dev/)
[![Cloudflare D1](https://img.shields.io/badge/Cloudflare-D1_SQLite-F38020.svg)](https://developers.cloudflare.com/d1/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-0.45-green.svg)](https://orm.drizzle.team/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC.svg)](https://tailwindcss.com/)

A comprehensive, edge-native business management platform engineered for an agricultural drone fertilization, seed sales, and drone sales company based in Iowa. Designed to operate with zero cold starts and sub-50ms latency across mobile/tablet devices for field sales representatives and desktop browsers for corporate managers.

---

## 🌾 Target Architecture & Technology Stack

| Layer | Technology | Role & Edge Profile |
|---|---|---|
| **Frontend Framework** | **SvelteKit** (TypeScript) | Full-stack reactive UI with client hydration and SSR on Cloudflare Pages. |
| **API & Middleware Layer** | **Hono** | High-performance edge API router running natively inside Cloudflare Workers. |
| **Database Engine** | **Cloudflare D1** (SQLite) | Globally distributed, serverless SQL engine managed via **Drizzle ORM**. |
| **Authentication & RBAC** | **Better Auth** | D1 session-backed authentication enforcing strict RBAC route validations. |
| **UI Styling** | **Tailwind CSS v4** | GitHub-inspired aesthetic with Light, Dark, and System theme synchronization. |
| **Document Storage** | **Cloudflare R2** | Edge object storage for BOL scans, vendor invoices, and check calibration files. |

---

## 🚀 Key Functional Modules

### 1. Multi-User Authentication & Role-Based Access Control (RBAC)
* **Sales Persona**: Access to CRM, Invoice Creation, and Read-Only Inventory views. Restricted from inventory writes or checkwriting.
* **Manager Persona**: Full access to CRM, Invoicing, Inventory Management (write/edit/import), and Document Ingestion.
* **Admin Persona**: Unrestricted system access, immutable Security Audit Logs, and exclusive access to the **Checkwriting module**. Unauthorized role routing generates immediate HTTP 403 Forbidden responses logged in `system_audit_logs`.

### 2. Intelligent Data Ingestion & Auto-Import Engine
* **Vendor Document Parsing**: Specialized parsers for key agricultural partners:
  * **Channel Seed / Bayer CropScience**: Isolates and indexes `BOL/CMR Number` and `Order Number` tokens.
  * **Wickman Chemical**: Extracts herbicides, rate per acre (e.g. `32 oz`), cost basis, and application methods.
  * **Atticus LLC**: Extracts EPA registration numbers, active ingredients, and post-patent chemistry pricing.
  * **I & B Ag Supply**: Extracts spray nozzles, banjo pumps, and dry AMS water conditioners.
* **1-Click Test Documents**: Built-in sample document loaders in the UI to evaluate parsers without manual file uploads.
* **Automated D1 Ledger Commit**: Validates and updates inventory stock levels and logs audit transactions.

### 3. State of Iowa Regulatory Seed Compliance Engine (IDALS)
* Commercial seed sales in Iowa require strict compliance with Iowa Code Chapter 199.
* The system enforces a **Submission Gate**: creating an invoice containing regulated seed products requires verified `BOL/CMR Number` and `Order Number` tokens. Missing compliance numbers trigger a blocking HTTP 422 error.
* Maintains permanent chain-of-custody audit logs linking grower accounts, seed lot numbers, and shipping manifests.

### 4. Unified Multi-Category Inventory & 3-Tier Dynamic Pricing
* **Categorized Partitioning**: `Chemical`, `Seed`, `Drone`, and `MISC` inventory divisions.
* **Dynamic Markup Pricing Engine**:
  1. **Tier 1: Financed Application (High Margin)** — Product sold on finance terms with drone fertilization application included.
  2. **Tier 2: Cash Application (Standard Margin)** — Product paid cash/check with precision drone application included (Default).
  3. **Tier 3: Cash / Finance & Carry (Low/Flat Margin)** — Direct product sales where customer transports and self-applies.
* **Serialized Drone Fleet Management**: Unit serial tracking, FAA registration numbers, total flight hours, and firmware versions for DJI Agras T50 systems.

### 5. Protected Checkwriting Module (Admin Only)
* **Strict Concurrency-Safe Sequence**: Atomic serial numbering via `checkSequences` to prevent duplicate or missing checks.
* **Legal Words Converter**: Real-time legal amount-to-words parsing (e.g. `$1,250.50` &rarr; *"One Thousand Two Hundred Fifty and 50/100 Dollars"*).
* **Physical 3-Part Check Paper Calibration**: Edge-safe layout calibration designed for standard 8.5" x 11" 3-part corporate check stock (Top Check, Middle Voucher, Bottom Voucher).
* **Audit Logging**: Mandatory reason requirements for voiding checks, with user ID and timestamp tracking.

### 6. Electronic Distribution & Physical Print Optimization
* **Electronic Dispatch**: Formatted HTML notification preview, recipient custom notes, and automatic attachment of the State of Iowa Seed Compliance Certificate.
* **Print Engine Optimization**: Specialized `@media print` rules for physical US Letter (8.5" x 11") invoices with Iowa Ag Sales Tax Exemption declarations (Iowa Code § 423.3(8)) and detachable remittance stubs.

---

## 🛠 Project Structure

```
agpro-v2/
├── drizzle/
│   └── migrations/              # Cloudflare D1 SQL migration files
├── src/
│   ├── app.css                  # GitHub theme variables & @media print rules
│   ├── app.d.ts                 # Cloudflare Workers D1 & R2 platform bindings
│   ├── lib/
│   │   ├── api/
│   │   │   └── client.ts        # Client-side API fetcher injecting RBAC persona headers
│   │   ├── components/          # Responsive UI components (GitHub aesthetic)
│   │   │   ├── Header.svelte            # Header with Persona & Theme switchers
│   │   │   ├── Navigation.svelte        # Desktop tabs & mobile drawer
│   │   │   ├── DashboardOverview.svelte # Metric KPI tiles & activity feeds
│   │   │   ├── InvoiceComposer.svelte   # Invoice form with 3-tier pricing & Iowa compliance
│   │   │   ├── InvoicesListView.svelte  # Invoices table with status machine & print/dispatch
│   │   │   ├── InvoicePrintModal.svelte # Printable US Letter invoice layout
│   │   │   ├── InvoiceDispatchModal.svelte # Electronic invoice distribution modal
│   │   │   ├── InventoryView.svelte     # Multi-category inventory & serialized drone fleet
│   │   │   ├── IngestionView.svelte     # Document upload & 1-click test parsers
│   │   │   ├── CustomersView.svelte     # CRM directory with compliance purchase history
│   │   │   ├── ComplianceView.svelte    # Iowa seed regulatory audit ledger
│   │   │   ├── ChecksView.svelte        # Admin-locked checkwriting & 3-part preview
│   │   │   ├── ProductModal.svelte      # Manager/Admin product creator
│   │   │   └── AuditLogsView.svelte     # Security audit event logs
│   │   ├── db/
│   │   │   ├── schema.ts        # Drizzle ORM schema for Cloudflare D1
│   │   │   └── seed-data.ts     # Initial demo seed dataset (chemical_inventory.xlsx)
│   │   ├── server/
│   │   │   ├── api/             # Hono API router & controllers
│   │   │   ├── parsers/         # Ingestion parsers (Channel BOL, Wickman, Atticus, I&B)
│   │   │   ├── db.ts            # Drizzle D1 factory
│   │   │   └── rbac.ts          # Role-Based Access Control middleware
│   │   ├── stores/
│   │   │   ├── auth.svelte.ts   # Active persona state (Sales, Manager, Admin)
│   │   │   └── theme.svelte.ts  # Theme state (Light, Dark, System)
│   │   └── utils/
│   │       └── number-to-words.ts # Legal currency number to English words
│   └── routes/
│       ├── +layout.svelte
│       ├── +page.svelte         # Application dashboard root
│       └── api/[...paths]/      # SvelteKit bridge into native Hono Worker
├── tests/
│   └── phase2-verification.test.ts # Automated test suite (9 tests)
├── drizzle.config.ts            # Drizzle Kit D1 configuration
├── svelte.config.js             # SvelteKit config with Cloudflare adapter
├── vite.config.ts               # Vite with Tailwind v4 & SvelteKit plugins
└── wrangler.toml                # Cloudflare Worker, D1, and R2 bindings
```

---

## 💻 Development & Deployment Commands

```bash
# Install dependencies
pnpm install

# Run automated test suite
pnpm test

# Run TypeScript type check
pnpm check

# Start local development server
pnpm dev

# Generate new D1 SQL migrations
pnpm db:generate

# Build for Cloudflare Pages / Workers
pnpm build

# Deploy to Cloudflare
pnpm deploy
```

---

## 📄 License
Internal proprietary application for AgPro precision agricultural operations.
