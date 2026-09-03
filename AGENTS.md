# Via Carraria — Frontend Sub-Repository Specification (`viacarraria-frontend`)

The frontend application provides an interactive, spatial visual canvas for organizational knowledge trees, career roadmaps, and Spatial GraphRAG search results. This document explicitly details the technology stack, layout layers, state machine transitions, exact page behaviors, dialog components, control elements, and visual interaction specifications required to implement the UI.

---

## Technical Stack & Libraries

- **Framework**: React 18+, TypeScript, Vite / Next.js
- **Canvas Graph Engine**: React Flow (`@xyflow/react`)
- **Auto-Layout Engine**: Dagre (`dagre`) configured for Left-to-Right (`rankdir: 'LR'`) orientation
- **State Management**: Zustand (global graph & UX mode store `useGraphStore`)
- **Animations & Motion**: Framer Motion (`framer-motion`), Tailwind CSS (`clsx`, `tailwind-merge`)
- **UI Components & Popups**: Shadcn UI / Radix UI (`Dialog`, `Sheet`, `DropdownMenu`, `Tooltip`)
- **Toast Notifications**: Sonner (`sonner`)
- **Internationalization**: `i18next` dynamic multi-language engine

---

## Submodule Architecture & Environment Management

- **Environment Definition (`environment.yml`)**: Mamba environment `viacarraria-frontend` containing minimal platform tools ONLY (`nodejs`, `pnpm`).
- **Dependency Installation**: `mamba run -n viacarraria-frontend pnpm install`
- **Submodule Directory Standard**:
  - `platforms/docker/`: Dockerfile definitions for container wrapping and platform serving.
  - Docker Compose and Helm descriptors are owned exclusively by `viacarraria-infrastructure`.

---

## Multi-Layer UI Architecture

The application layout uses CSS absolute/fixed positioning and pointer-events rules to maintain an interactive canvas background alongside static overlay controls:

```
+-----------------------------------------------------------------+
| POPUP / MODAL LAYER (z-index: 20+, pointer-events: auto)        |
| - Node Details Modal / Sheet (scrollable description & sources) |
| - Document Viewer Popup (yellow context & orange hit highlights)|
| - Auth Dialog & Subscription Billing Modal                      |
| - Upgrade Quota Exceeded & Delete Confirmation Modals           |
+-----------------------------------------------------------------+
| OVERLAY UI LAYER (z-index: 10, pointer-events: none)            |
| - Header Nav Bar (Logo, Graph Select, Gear Edit, Create New)    |
| - Query History Drawer (bottom-left)                            |
| - Floating AI Searchbar (bottom-center)                         |
| - Graph Editor Control Panel (top-right)                        |
| (All interactive items set pointer-events: auto)                |
+-----------------------------------------------------------------+
| CANVAS LAYER (z-index: 0, w-full h-full, absolute)              |
| Interactive React Flow DAG Canvas (Pan, Zoom, Drag, Nodes/Edges)|
+-----------------------------------------------------------------+
```

---

## Comprehensive Page & View Specifications

### 1. Main Knowledge Canvas View (`/` or `/graph/:id`)
The main interactive canvas view displaying the selected knowledge graph DAG.
- **Canvas Layer (`z-index: 0`)**:
  - Full-screen container (`w-screen h-screen bg-slate-950`).
  - React Flow instance rendering custom subject nodes (`CustomSubjectNode`) and directed edges (`CustomEdge`).
  - Autolayout executed on mount via Dagre (`rankdir: 'LR'`, `nodesep: 50`, `ranksep: 100`).
  - Interactive panning, mouse-wheel zooming, node click handlers (`onNodeClick`), and viewport virtualization.
  - **In-Place Node Expansion**: Clicking a node in `IDLE` mode expands the node component *in-place on the canvas* to a fixed-size card. The description text and attached primary sources list are scrollable *inside* the card so the node container dimensions remain constant. Multiple nodes on the canvas can be expanded simultaneously.
- **Overlay Layer (`z-index: 10`)**:
  - Header Navigation Bar (Top-left to top-right), including graph permission, known-user access count, copy action, and edit gear when permission is granted.
  - Floating AI Searchbar (Bottom-center).
  - Query History Drawer (Bottom-left).

### 2. Graph Builder / Visual Editor View (`/graph/builder` or `/graph/:id/edit`)
The visual editor view allowing users to create new graphs or modify existing ones.
- **Access Control**: Triggered via the Gear Edit Icon (`⚙`) located between the Graph Selector and "Create New" button, or by clicking "Create New" (restricted to paid `PRO` subscriptions; clicking "Create New" as a `FREE` user or guest triggers the Upgrade Dialog). Pre-baked system graphs assigned to system user `"jbed94"` are read-only for public users and editable exclusively by `"jbed94"`.
- **Canvas Layer (`z-index: 0`)**:
  - Starts with an empty canvas or clones an existing graph layout.
  - Nodes expose interactive handles: `<Handle type="target" position={Position.Left} />` and `<Handle type="source" position={Position.Right} />`.
  - Dragging a connection line from a right handle to a left handle automatically adds a new directed edge (`onConnect`).
  - Hovering/clicking a node displays a floating context toolbar (`<NodeToolbar position={Position.Top} />`) with actions:
    - `+ Add Child Node`: Instantiates a new connected child node to the right of the parent (`position.x + 220`).
    - `Edit Details`: Opens the Node Detail Drawer in edit mode.
    - `Delete Node`: Prompts the Delete Confirmation Dialog (*"Attached sources will also be deleted, are you sure?"*) before removing the node and its attached edges.
- **Node Detail Panel & Source Management**:
  - Includes a `+ Add Source` button at the bottom of the sources list.
  - Selecting a file initiates document upload **IMMEDIATELY** to the backend, without waiting for graph finalization.
- **Floating Controls Panel (Top-Right)**:
  - `+ Add Independent Root Node`: Inserts a disconnected node on the canvas.
  - `Auto-layout (Dagre)`: Recovers Left-to-Right organization across all nodes and edges.
- **Bottom Center Action Button**:
  - `Finalize & Prepare Graph`: Submits the saved graph structure for backend document parsing and vectorization. Displays ingestion status (progress bar / gray dot) on the Graph Selector dropdown. Existing, already-prepared sources in edited graphs skip re-ingestion.
- **Debounce Auto-Save Engine**:
  - Modifying nodes or edges invokes `useDebouncedCallback` (1000ms idle delay) to execute `PUT /api/graphs/:id`.
  - Displays a gear icon (`⚙`) next to draft items in the Graph Selector. Clicking a draft item opens the visual editor directly.

### 3. User Profile Page (`/profile`)
Accessible via the user avatar menu for registered users.
- Displays username, email address, password modification form, active login sessions, and subscription status badge (`FREE` or `PRO`).
- Provides account deletion and session termination actions.

### 4. Subscription & Pricing Page (`/pricing` or `/subscription`)
Accessible via the avatar menu or when hitting tier limits.
- Displays side-by-side tier comparison cards (`FREE`, `PRO`, `ENTERPRISE`).
- Highlights active subscription tier with a "Current Plan" badge.
- Clicking "Upgrade to Pro" triggers the Billing Payment Modal (collecting name, address, billing details) before redirecting to the payment gateway.

---

## Detailed Dialog & Modal Specifications

### 1. Node Detail Drawer / Sheet
- **Trigger**: Clicking any graph node in `IDLE` mode or clicking `Maximize View` inside an in-place expanded canvas node.
- **Layout**: Slide-out right panel (`Sheet`) or central modal (`Dialog`) using Radix UI / Shadcn.
- **Header**: Node title, subject category tag, parent prerequisites list.
- **Body**:
  - Scrollable rich Markdown content (description, syllabus, study guide).
  - Scrollable list of attached primary source files (PDF, Markdown, TXT). Each file row displays filename, file size, status badge (`READY`, `PROCESSING`, `ERROR`), and a delete button (in edit mode).
- **Footer Controls**:
  - `Maximize View`: Expands the drawer into a full-screen overlay modal.
  - `+ Add Source`: (Edit mode only) Triggers file browser upload for custom documents (uploads immediately upon selection).

### 2. Source Viewer Modal / Window
- **Trigger**: Clicking any source document row or clicking an AI search match snippet.
- **Frame Reuse**: Opening a new source reuses the active viewer window/frame rather than stacking multiple modal overlays on top of each other.
- **Spatial RAG Highlighting & Auto-Scroll**:
  - **Parent Context Span (`SpanChunk`)**: Highlighted with a translucent yellow background (`bg-yellow-500/30`).
  - **Exact Hit Chunk (`Chunk`)**: Highlighted with a prominent orange border and background (`bg-orange-500/40 border border-orange-500`).
  - **Auto-Focus Behavior**: If opened via source click, camera/scrollbar smoothly focuses on the best-matching chunk; if opened via match snippet click, focuses directly on that specific hit.
- **Optimization**: Caches rendered document pages in memory for instant modal re-opening.

### 3. Auth Dialog / Modal (Log In / Sign Up)
- **Trigger**: Clicking "Sign Up" avatar button for anonymous guests or attempting restricted actions (e.g., custom PDF uploads, exceeding 3 guest queries).
- **Layout**: Tabbed dialog modal (`Log In` / `Sign Up`).
- **Fields**: Email address, Password, Username. Includes social auth triggers (GitHub, Google).
- **Guest Data Migration**: Better Auth's anonymous account-link callback moves previous guest query history and memory to the newly created credential or OAuth account.

### 4. Upgrade Required / Quota Exceeded Dialog
- **Trigger**: Triggered when an anonymous user exhausts 3 daily queries, a free user exhausts 20 daily queries, or a user attempts to exceed plan limits (e.g., free user selecting $>10$ nodes or uploading custom files).
- **Content**: Clean warning icon, quota status summary (e.g., *"Daily query budget reached (3/3)"*), feature callout checklist, and a primary CTA button: `"Upgrade to Pro - $9/mo"`.

### 5. Delete Confirmation Dialog
- **Trigger**: Clicking "Delete Node" or "Delete Graph".
- **Content**: Warning prompt: *"Attached sources will also be deleted, are you sure?"*
- **Actions**: `Cancel` (secondary button) and `Confirm Delete` (destructive red button).

---

## Complete UX State Machine & Transitions (`useGraphStore`)

The UI operates across 3 global modes managed by Zustand (`useGraphStore`):

```
                       Focus AI Input / Toggle Switch
           ┌──────────────────────────────────────────────┐
           │                                              │
           ▼                                              │
      [ IDLE ] ──────────────────────────────────► [ CONTEXT_SELECTION ]
     (Default) ◄─────────────────────────────────         │
           ▲            Cancel / Escape                   │ Submit Query (Enter)
           │                                              │
           │              Select Query History            │
           └────────────────────────────────────── [ VISUAL_RESULTS ]
```

### 1. `IDLE` Mode (Default Exploration)
- **Visuals**: Full color nodes (`bg-slate-800 border-slate-700`), standard camera navigation.
- **Controls**: Clicking nodes expands them in-place or opens Node Detail Sheet. Graph Selector dropdown allows switching active knowledge graphs.

### 2. `CONTEXT_SELECTION` Mode (Targeted Search Filtering)
- **Trigger**: Focus/click in the floating AI searchbar, or clicking the explicit Idle/Selection toggle switch.
- **Visuals**:
  - Canvas background dims slightly (`backdrop-blur-sm`).
  - Every node renders a top-right checkbox (default `checked = true`).
  - Expanding a node exposes individual source document checkboxes.
  - Unchecking a parent node automatically unchecks all its attached sources.
  - Manually unchecking some sources inside a node sets the parent node checkbox to an indeterminate state (horizontal dash `-`).

### 3. `VISUAL_RESULTS` Mode (Spatial GraphRAG Presentation)
- **Trigger**: Submitting a query from the floating searchbar (Pressing `Enter` or clicking `Search`) or selecting a record from the Query History Drawer.
- **Visual Behavior & Animation**:
  - **Unmatched Nodes**: Rendered with low opacity and grayscale (`opacity: 0.2`, `filter: grayscale(1)`).
  - **Matched Nodes**: Rendered with pulsing glow borders (`bg-indigo-950 border-indigo-400 ring-4 ring-indigo-500/30 animate-pulse`), displaying reference badges (+1, +3, +5).
  - **Flowing Edges**: Edges connecting matched nodes become animated SVG flowing lines (`animated: true`, `stroke: #6366f1`).
  - **Spatial Camera Auto-Focus**: React Flow instance automatically executes `fitBounds()` or `setCenter()` with smooth duration (`800ms`) to center the camera on the cluster of matched nodes.
  - **Expandable Matched Snippets**: Expanding a matched node displays orange direct-match snippets sorted by relevance. When Extended Search is enabled, each direct match can contain a second nested list of blue one-hop adjacent-node context snippets. Clicking either snippet opens the Source Viewer Modal with its corresponding orange or blue highlight.
  - **Results Sidebar**: `VISUAL_RESULTS` also renders a right-side source list with orange direct matches and optional blue nested extended-context rows. Clicking a source opens it without a focused range; clicking a direct or extended row opens it and focuses the matching orange or blue range.

---

## Detailed Control & Overlay Component Specifications

### 1. Header Navigation Bar (Top Overlay)
- **Graph Selector Dropdown**: Select menu listing available pre-baked system graphs (*Computer Science*, *English Learning*, *Medicine*) and user-owned custom graphs. Displays status badges (`Ready`, `Preparing...`, `Draft ⚙`).
- **Gear Edit Icon (`⚙`)**: Positioned between the Graph Selector and "Create New" button. Toggles between graph viewing mode and Graph Builder / Visual Editor mode.
- **"Create New" Button**: Positioned to the right of the Gear Edit Icon. Opens the Graph Builder with an empty canvas (paid subscription feature gate; shows Upgrade Dialog for Free users or guests).
- **User Avatar / Auth Button**: Displays user profile avatar dropdown (Profile, Pricing, Logout) or "Sign Up" button for guests (which opens the Auth Signup Modal).

### 2. Floating AI Searchbar (Bottom-Center Overlay)
- Fixed position (`fixed bottom-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl`).
- Glassmorphism dark container (`bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-2xl`).
- Input field: Placeholder *"Ask AI about selected topics (e.g. 'Where are relational databases explained?')..."*.
- Focus event or typing triggers `CONTEXT_SELECTION` mode. Pressing `Enter` submits the query to `/api/search` and transitions to `VISUAL_RESULTS` mode.
- Registered users can opt into `Extended` search. The label shows a tier-specific context budget: 3 for Free or 15 for Pro; guests do not receive the control.
- Hovering or keyboard-focusing `Extended` reveals its adjacent-node/context-budget description.
- Collapsing an expanded node preserves the current camera position; only newly expanded nodes receive camera focus.
- Contains a "Cancel" button when active to return to `IDLE` mode.

### 3. Query History Drawer / Sidebar (Bottom-Left Overlay)
- Floating collapsible panel (`fixed bottom-6 left-6 z-20`).
- Displays a chronological list of past queries with timestamps, target graph title, and query text.
- Ongoing in-flight queries render an animated progress bar.
- **Interactions**:
  - **Clicking a History Record**: Transitions the canvas directly into `VISUAL_RESULTS` mode for that historical query.
  - **Clicking the `Edit` Button on a History Record**: Opens `CONTEXT_SELECTION` mode pre-populated with that specific query's node/source selection and query text for re-execution or adjustment.
  - **Pinning & Custom Naming**: Allows users to pin favorite queries to the top of the history list and assign custom labels.

---

## Frontend Build & Test Commands

- **Unit Tests**: `pnpm --filter web test`
- **Watch Mode**: `pnpm --filter web test:watch`
- **Lint & Type-Check**: `pnpm --filter web lint`
