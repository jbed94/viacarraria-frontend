# Via Carraria — Frontend Specification (`viacarraria-frontend`)

Interactive canvas UI: Left-to-Right knowledge DAGs, Spatial GraphRAG visualization, Graph Builder, monetization/ad banners, and standalone Admin Panel.

---

## Tech Stack

- **Framework**: React 18+, TypeScript, Vite
- **Canvas Engine**: React Flow (`@xyflow/react`)
- **Auto-Layout**: Dagre (`dagre`, Left-to-Right `rankdir: 'LR'`)
- **State Management**: Zustand (`useGraphStore`)
- **Animations & Styling**: Framer Motion, Tailwind CSS
- **Component Primitives**: Radix UI / Shadcn UI (`Dialog`, `Sheet`, `DropdownMenu`, `Tooltip`)
- **Notifications & Localization**: Sonner (`sonner`), `i18next`

---

## Environment & Directory Rules

- **Env (`environment.yml`)**: Mamba env `viacarraria-frontend`. Tools: `nodejs`, `pnpm` only.
- **Install**: `mamba run -n viacarraria-frontend pnpm install`
- **Packaging**: `platforms/docker/` contains `Dockerfile` (main web app) and `Dockerfile.admin` (decoupled admin app). Compose and Helm files reside in `viacarraria-infrastructure`.

---

## Layered UI Architecture

1. **Popup / Modal Layer (`z-index: 20+`)**:
   - Source Viewer with yellow parent context (`SpanChunk`) and orange hit snippet (`Chunk`) highlights.
   - Node Details Sheet, Auth Dialog, Pricing Dialog, Credit Top-Up and History Dialogs, Retention Dashboard, Guide Modals.
2. **Overlay UI Layer (`z-index: 10`, `pointer-events: none` on container, `auto` on controls)**:
   - Header Navigation Bar, Floating AI Searchbar, Query History Drawer, Results Sidebar, Ad Consent Banner, Google Ad cards, Maintenance and Retention warning banners.
3. **Canvas Layer (`z-index: 0`, full viewport)**:
   - React Flow DAG canvas with pan, zoom, drag, in-place node expansion, and custom animated edges.

---

## UX State Machine (`useGraphStore`)

- **`IDLE` (Exploration)**:
  - Standard navigation. Nodes display full color.
  - In-place node expansion: clicking a node expands it directly on canvas into a fixed-size card. Content and sources scroll internally without altering node bounds. Multiple nodes expand simultaneously.
- **`CONTEXT_SELECTION` (Targeted Search)**:
  - Triggered by focusing the searchbar or clicking the mode toggle switch.
  - Background dims. Nodes display selection checkboxes (default checked).
  - Expanding a node exposes attached source checkboxes. Unchecking parent unchecks sources; partial source selection sets parent checkbox indeterminate (`-`).
- **`VISUAL_RESULTS` (Spatial GraphRAG Retrieval)**:
  - Triggered by query submission (Enter) or selecting a record from Query History.
  - Matched nodes pulse with glowing borders and badges (+1, +3); unmatched nodes dim (`opacity: 0.2`, grayscale).
  - Connecting edges animate SVG flow. Camera smoothly centers (`fitBounds`) on the matched cluster.
  - Expanding matched nodes displays orange direct match snippets and blue nested extended adjacent-node context. Clicking opens Source Viewer focused on target coordinates.
  - Results Sidebar lists direct and extended matches.

---

## Core Views & Functional Modules

### 1. Main Knowledge Canvas (`/` or `/graph/:id`)
- Mounts React Flow canvas with Dagre Left-to-Right orientation.
- Renders `CustomSubjectNode` and `CustomEdge`. Supports viewport virtualization, panning, and mouse-wheel zooming.
- Host view for search overlays, query history, and ad integration.

### 2. Graph Builder / Visual Editor (`/graph/builder` or `/graph/:id/edit`)
- Pro-tier workspace for creating and modifying custom knowledge DAGs. System templates by `"jbed94"` are read-only.
- Interactive connection handles: drag from right handle to left handle creates directed edges.
- Node toolbar (`<NodeToolbar>`): `+ Add Child Node`, `Edit Details`, `Delete Node` (with confirmation prompt).
- Source upload: `+ Add Source` uploads files to S3/MinIO immediately upon selection.
- Controls: `+ Add Independent Root Node`, `Auto-layout (Dagre)`, and `Finalize & Prepare Graph` (triggers backend parsing).
- Auto-save engine: debounced changes (`useDebouncedCallback`, 1000ms idle) update PostgreSQL JSONB asynchronously.

### 3. Monetization, Credits & Ads Integration
- **Pricing & Tier Upgrade**: Tier comparison cards (`FREE`, `PRO`, `ENTERPRISE`), billing modal for checkout.
- **Credits System**: Credit balance badge in header, top-up modal for credit purchases, credit transaction history dialog.
- **Ad Engine**: AdConsentBanner prompts GDPR compliance. GoogleAdCard renders responsive ad slots on free/guest tiers and dispatches impression, click, and dismissal telemetry to the backend.

### 4. Decoupled Admin Panel (`admin.tsx` / port 4174)
- Standalone administrative interface protected by `AdminAuthGuard`.
- Tabbed modules:
  - **Overview**: System telemetry, active session counts, and platform health.
  - **Users**: User profiles, subscription tier adjustments (`FREE`, `PRO`), and session audits.
  - **Graphs**: Interactive JSONB canvas viewer, node/edge schema validation, and template curation.
  - **Plans & Ad Telemetry**: Dynamic plan configuration, ad telemetry storage status, manual rollup execution, and retention purging.
  - **Subscriptions & Billing**: Subscription events and billing audits.
  - **Retention & Archives**: Automated retention sweeps, cold storage export triggers, and in-browser S3 NDJSON gzip audit archive viewer.
  - **Settings & System**: System environment configuration and service status.

---

## Operational Commands

- `pnpm --filter web test` (Unit tests)
- `pnpm --filter web test:watch` (Watch mode)
- `pnpm --filter web lint` (Lint and type-check)
