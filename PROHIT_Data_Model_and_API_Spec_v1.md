# PROHIT Daily Task — Data Model & API Specification

**Version** 1.0 · **Companion to** PROHIT Daily Task BRD v1.0 · **Stack** Next.js (TypeScript) / MongoDB + Mongoose / NextAuth / Razorpay

This document turns BRD §6 (Functional Requirements), §8.2 (Data & Entitlement Model) and §9 (Pricing) into an implementable schema and API contract for Phase 1.

---

## 0. Decisions this document makes

The BRD leaves four things underspecified. Each is resolved here; if you disagree with a call, this is the section to argue with, because everything below depends on it.

### D1 — Workspace type and billing plan are separate axes

BRD §6.2 defines three workspace *types* (Personal / Team / Business). BRD §9 defines four *plans* (Free / Pro / Pro-Student / Team). BRD §9.2 then says a vertical module "requires a Team-tier workspace as base", which conflates the two — Team is a plan in §9 and a type in §6.2, and §6.4 says modules attach to *Business* workspaces.

**Resolution:** `type` describes structure (how many people, what's inside). `plan` describes billing. They are independent fields.

| Workspace type | Allowed plans | Members | Vertical modules |
|---|---|---|---|
| `personal` | `free`, `pro`, `pro_student` | 1 | No |
| `team` | `team` | 2–10 | No |
| `business` | `team` (per-seat) | 2–50 | Yes |

A vertical module therefore requires: `type === "business"` AND `plan === "team"` AND an active per-seat subscription. This satisfies both §6.4 and §9.2 without contradiction. `business` is a superset of `team` — same billing rate, module-capable, higher member cap.

### D2 — Free tier gets no Flow Board

Both Frame 6 variants in the wireframe show Flow Board as included in Free. BRD §9.1 lists Flow Board under Pro. **The BRD wins** — Flow Board is the single most visible upgrade trigger and giving it away removes the main reason an individual converts. The upgrade screen must be corrected.

### D3 — Deep Work Sprint ships as a locked nav item in Phase 1

BRD §5.2 defers it; the wireframe designs it fully. Building nav that changes shape between v1 and v1.1 is worse than shipping the entry point locked. The nav item ships, tapping it opens the upgrade/coming-soon sheet, and the feature flag flips in v1.1 with no layout change. `deep_work` therefore exists in the entitlement schema from day one, set `false` for everyone.

### D4 — Entitlements are read from a cache, never computed at request time

`entitlements_cache` is the only collection the request path reads for gating. `subscriptions` is written by Razorpay webhooks. This is BRD §8.2's stated intent, made explicit: **no API route ever queries `subscriptions` to make a gating decision.**

---

## 1. Collections

Six collections for Phase 1. `modules` is defined now but unused until Phase 3 — it is included because BRD §3 requires verticals to be addable as data, not code, and retrofitting that later is the expensive version.

```
users · workspaces · subscriptions · entitlements_cache · lists · tasks
(+ modules — defined, seeded empty, Phase 3)
```

### 1.1 `users`

```ts
{
  _id: ObjectId,
  email: string,              // unique, lowercased
  name: string,
  avatarUrl?: string,
  emailVerified?: Date,       // NextAuth
  studentVerification?: {
    collegeEmail: string,     // must resolve to an .edu / .ac.in domain
    verifiedAt: Date,
    expiresAt: Date           // re-verify annually — students graduate
  },
  defaultWorkspaceId: ObjectId,
  timezone: string,           // IANA, e.g. "Asia/Kolkata" — reminders depend on this
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:** `{ email: 1 }` unique.

`studentVerification.expiresAt` matters: BRD §9.1 prices the student tier at half of Pro. Without an expiry, a one-time verification grants the discount forever. Renewal at ₹499 should require re-verification.

### 1.2 `workspaces`

```ts
{
  _id: ObjectId,
  name: string,
  type: "personal" | "team" | "business",
  ownerId: ObjectId,          // → users
  members: [{
    userId: ObjectId,
    role: "owner" | "admin" | "member",
    joinedAt: Date
  }],
  activeModules: string[],    // module IDs, Phase 3. Always [] in Phase 1.
  settings: {
    weekStartsOn: 0 | 1,
    defaultView: "my_day" | "calendar" | "flow_board"
  },
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:** `{ ownerId: 1 }`, `{ "members.userId": 1 }`.

Every user gets a `personal` workspace on signup. It cannot be deleted or converted — it's the fallback when a user is removed from a team.

### 1.3 `subscriptions` — webhook write target

```ts
{
  _id: ObjectId,
  workspaceId: ObjectId,      // unique
  plan: "free" | "pro" | "pro_student" | "team",
  status: "active" | "past_due" | "cancelled" | "expired",
  seats: number,              // 1 for personal; billed seat count for team/business
  addons: {
    ai: boolean,              // ₹99/user/month — Phase 2
    modules: string[]         // ₹199/user/month each — Phase 3
  },
  razorpay: {
    customerId?: string,
    subscriptionId?: string,
    planId?: string,
    currentPeriodEnd?: Date
  },
  processedEvents: string[],  // Razorpay event IDs — see §4.2
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:** `{ workspaceId: 1 }` unique, `{ "razorpay.subscriptionId": 1 }`, `{ processedEvents: 1 }`.

Every workspace gets a `subscriptions` row at creation with `plan: "free"`, `status: "active"`. There is no "no subscription" state — that removes a whole class of null-handling from the gating path.

### 1.4 `entitlements_cache` — the only thing the request path reads

```ts
{
  _id: ObjectId,
  workspaceId: ObjectId,      // unique
  features: {
    flow_board: boolean,
    calendar_week_view: boolean,
    calendar_bridge: boolean,   // external calendar sync — Phase 2
    unlimited_attachments: boolean,
    multiple_reminders: boolean,
    deep_work: boolean,         // false for all of Phase 1 (D3)
    ai_assistant: boolean,      // Phase 2
    team_dashboard: boolean
  },
  limits: {
    maxLists: number,           // -1 = unlimited
    maxTasksPerList: number,
    maxRemindersPerTask: number,
    maxMembers: number,
    maxAttachmentMb: number
  },
  modules: string[],
  plan: string,                 // denormalised for UI display
  status: string,               // denormalised — drives the "payment failed" banner
  computedAt: Date,
  sourceEventId?: string        // last Razorpay event that produced this state
}
```

**Indexes:** `{ workspaceId: 1 }` unique.

#### Plan → entitlement matrix

This table is the single source of truth. It lives in code as a constant (`lib/entitlements/matrix.ts`), not in the database, so it can be diffed in version control.

| | Free | Pro / Pro-Student | Team (team & business) |
|---|---|---|---|
| `maxLists` | 5 | -1 | -1 |
| `maxTasksPerList` | 50 | -1 | -1 |
| `maxRemindersPerTask` | 1 | 5 | 5 |
| `maxMembers` | 1 | 1 | 10 (team) / 50 (business) |
| `maxAttachmentMb` | 0 | 100 | 500 |
| `flow_board` | ✗ | ✓ | ✓ |
| `calendar_week_view` | ✗ (month only) | ✓ | ✓ |
| `unlimited_attachments` | ✗ | ✓ | ✓ |
| `multiple_reminders` | ✗ | ✓ | ✓ |
| `team_dashboard` | ✗ | ✗ | ✓ |
| `deep_work` | ✗ | ✗ | ✗ (Phase 1) |
| `calendar_bridge` / `ai_assistant` | ✗ | ✗ | ✗ (Phase 2) |

Matches BRD §9.1 exactly, with D2 applied (Flow Board is Pro+).

#### Degraded read — the case the BRD doesn't cover

If `entitlements_cache` is missing or `computedAt` is older than 48 hours, **fall back to Free limits and log an alert** — do not fall back to permissive. A user briefly seeing Free limits after a billing outage is a support ticket; a user getting Pro features free because a cache write failed is a revenue leak that nobody reports.

### 1.5 `lists` (Projects)

```ts
{
  _id: ObjectId,
  workspaceId: ObjectId,
  name: string,
  color: string,              // hex, from the §10.1 palette
  icon?: string,
  order: number,
  archivedAt?: Date,
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:** `{ workspaceId: 1, archivedAt: 1, order: 1 }`.

Counting against `maxLists` excludes archived lists. Archiving is the escape hatch for a Free user at their limit who doesn't want to delete history.

### 1.6 `tasks`

```ts
{
  _id: ObjectId,
  workspaceId: ObjectId,
  listId: ObjectId,
  title: string,
  description?: string,
  status: "todo" | "in_progress" | "done",   // Flow Board columns
  boardColumnId?: string,                    // custom columns, defaults to status
  boardOrder: number,                        // position within column
  priority: 0 | 1 | 2 | 3,                   // none / low / medium / high
  dueDate?: Date,
  completedAt?: Date,
  tags: string[],
  subtasks: [{
    _id: ObjectId,
    title: string,
    done: boolean,
    order: number
  }],
  reminders: [{
    _id: ObjectId,
    remindAt: Date,
    channel: "email",                        // Phase 1 is email-only (BRD §5.1)
    sentAt?: Date
  }],
  recurrence?: {
    freq: "daily" | "weekly" | "monthly",
    interval: number,                        // every N units
    byWeekday?: number[],                    // 0=Sun, for weekly
    byMonthDay?: number,                     // for monthly
    until?: Date,
    count?: number,
    completionAnchored: boolean              // see note below
  },
  recurrenceParentId?: ObjectId,
  attachments: [{
    _id: ObjectId,
    filename: string,
    url: string,
    sizeBytes: number,
    uploadedBy: ObjectId,
    uploadedAt: Date
  }],
  assigneeId?: ObjectId,                     // team/business only
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
```
{ workspaceId: 1, listId: 1, status: 1 }        // list view
{ workspaceId: 1, dueDate: 1, completedAt: 1 }  // My Day + overdue count
{ workspaceId: 1, "reminders.remindAt": 1, "reminders.sentAt": 1 }  // reminder cron
{ workspaceId: 1, listId: 1, boardColumnId: 1, boardOrder: 1 }      // Flow Board
```

**Recurrence — the rule BRD §5.1 doesn't state.** `completionAnchored: false` generates the next instance from the *scheduled* date (a Monday standup stays on Mondays even if you tick it Wednesday). `completionAnchored: true` generates from the *completion* date (water the plants every 7 days from when you actually did it). Both are needed; TickTick supports both, and users notice loudly when only one exists. The next instance is materialised on completion, not pre-generated — pre-generating an unbounded daily recurrence writes thousands of documents.

### 1.7 `modules` (Phase 3, defined now)

```ts
{
  _id: string,                // "ca_practice", "coaching", "clinic", ...
  displayName: string,
  labelOverrides: {
    task: string,             // "Filing" / "Session" / "Appointment"
    list: string,             // "Client" / "Batch" / "Patient"
    assignee: string
  },
  customFields: [{
    key: string,
    label: string,
    type: "text" | "number" | "date" | "select" | "boolean",
    options?: string[],
    required: boolean,
    appliesTo: "task" | "list"
  }],
  pricePerSeatMonthly: number,   // 199
  isActive: boolean
}
```

Corresponds directly to the BRD §6.4 table. Adding a vertical means inserting one document — no deploy. Tasks in a module-enabled workspace carry a `customFieldValues: Record<string, any>` map validated against the active module's schema.

---

## 2. API surface

REST via Next.js route handlers under `/api/v1`. All routes require an authenticated session. All workspace-scoped routes require membership.

### 2.1 Middleware chain

Every workspace-scoped request passes through, in order:

1. **`withAuth`** — resolves session; 401 on failure.
2. **`withWorkspace`** — resolves `workspaceId` from path or header, confirms the user is in `members`; 403 on failure.
3. **`withEntitlements`** — loads `entitlements_cache` for the workspace, attaches to `ctx.entitlements`, applies the §1.4 degraded-read rule.
4. **`requireFeature(flag)` / `requireLimit(key, currentCount)`** — per-route gate.

### 2.2 The 402 contract

Feature gating returns **402 Payment Required**, never 403. This lets the client distinguish "you're not allowed" (403 → error toast) from "you need to upgrade" (402 → upgrade sheet) without string-matching error messages.

```json
{
  "error": "entitlement_required",
  "feature": "flow_board",
  "currentPlan": "free",
  "requiredPlan": "pro",
  "message": "Flow Board is available on Pro."
}
```

Limit breaches use the same status with a different shape:

```json
{
  "error": "limit_exceeded",
  "limit": "maxLists",
  "current": 5,
  "max": 5,
  "currentPlan": "free",
  "requiredPlan": "pro"
}
```

### 2.3 Endpoints

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/me` | User + workspace list + active entitlements. One call, hydrates the whole shell. |
| `POST` | `/api/v1/workspaces` | Create. `type` fixed at creation. |
| `GET/PATCH` | `/api/v1/workspaces/:id` | |
| `POST` | `/api/v1/workspaces/:id/members` | `requireLimit("maxMembers")` |
| `DELETE` | `/api/v1/workspaces/:id/members/:userId` | |
| `GET` | `/api/v1/workspaces/:id/lists` | |
| `POST` | `/api/v1/workspaces/:id/lists` | `requireLimit("maxLists")` |
| `PATCH/DELETE` | `/api/v1/lists/:id` | |
| `GET` | `/api/v1/workspaces/:id/tasks` | Filters: `listId`, `status`, `dueBefore`, `dueAfter`, `tags`, `assigneeId`, `q`. Cursor paginated. |
| `POST` | `/api/v1/workspaces/:id/tasks` | `requireLimit("maxTasksPerList")` |
| `GET/PATCH/DELETE` | `/api/v1/tasks/:id` | |
| `POST` | `/api/v1/tasks/:id/complete` | Sets `completedAt`, materialises next recurrence instance. |
| `POST` | `/api/v1/tasks/:id/subtasks` | |
| `PATCH` | `/api/v1/tasks/:id/subtasks/:sid` | |
| `POST` | `/api/v1/tasks/:id/reminders` | `requireLimit("maxRemindersPerTask")` |
| `POST` | `/api/v1/tasks/:id/attachments` | `requireFeature("unlimited_attachments")` + size check |
| `GET` | `/api/v1/workspaces/:id/board` | `requireFeature("flow_board")` — tasks grouped by column |
| `PATCH` | `/api/v1/tasks/:id/board-position` | Drag-and-drop; see §3 |
| `GET` | `/api/v1/workspaces/:id/calendar` | `?view=month\|week`; `week` requires `calendar_week_view` |
| `GET` | `/api/v1/workspaces/:id/my-day` | Today's tasks + overdue + completion % (Frame 1) |
| `GET` | `/api/v1/workspaces/:id/stats` | Completion trend; team breakdown requires `team_dashboard` |
| `POST` | `/api/v1/billing/checkout` | Creates Razorpay subscription, returns `subscriptionId` |
| `POST` | `/api/v1/billing/cancel` | Cancels at period end |
| `GET` | `/api/v1/billing/plans` | Drives the upgrade screen — never hardcode prices in the client |
| `POST` | `/api/v1/billing/verify-student` | Sends verification to college email |
| `POST` | `/api/webhooks/razorpay` | **No auth middleware** — signature verified instead. See §4. |

`/api/v1/billing/plans` being server-driven is what stops the Frame 6 ₹499/₹486 divergence from recurring: there is one price, it comes from one place.

---

## 3. Flow Board ordering

Drag-and-drop needs stable ordering that doesn't rewrite every sibling on each move. Use **fractional ordering**: `boardOrder` is a float, and moving a card between neighbours `a` and `b` sets it to `(a + b) / 2`.

```
PATCH /api/v1/tasks/:id/board-position
{ "boardColumnId": "in_progress", "afterTaskId": "...", "beforeTaskId": "..." }
```

The server computes the midpoint rather than trusting a client-supplied float. After ~50 subdivisions floats lose precision, so renormalise a column to integer spacing (1000, 2000, 3000…) when any gap drops below `0.0001`. This is a background job, not request-path work.

Moving a card to `done` sets `completedAt` and triggers recurrence, exactly as `/complete` does — one code path, called from two places.

---

## 4. Billing & entitlement flow

### 4.1 Sequence

```
Client → POST /billing/checkout
       → Razorpay subscription created (status: "created")
       → Razorpay Checkout opens client-side
       → User pays
       → Razorpay → POST /api/webhooks/razorpay  [subscription.charged]
                  → verify signature
                  → check processedEvents (idempotency)
                  → update subscriptions
                  → recompute entitlements_cache from the §1.4 matrix
                  → done
```

The client does **not** unlock features on Razorpay's success callback. It refetches `/api/v1/me` and reads the recomputed entitlements. Client-side success callbacks are spoofable and also fire before the webhook lands.

### 4.2 Idempotency — BRD §7 requires this, here's the mechanism

Razorpay retries webhooks. Duplicate delivery must not double-extend a period or double-charge seats.

```ts
const result = await Subscription.findOneAndUpdate(
  {
    "razorpay.subscriptionId": subId,
    processedEvents: { $ne: eventId }   // guard: skip if already seen
  },
  {
    $set: { status, plan, seats, "razorpay.currentPeriodEnd": periodEnd },
    $push: { processedEvents: { $slice: -100, $each: [eventId] } }
  },
  { new: true }
);

if (!result) return Response.json({ ok: true, deduped: true });  // 200, not an error
await recomputeEntitlements(result.workspaceId, eventId);
```

The `$ne` guard inside the query filter makes check-and-write a single atomic operation — two concurrent deliveries of the same event cannot both pass. `$slice: -100` bounds the array so it doesn't grow forever. Return **200** on a duplicate; a non-2xx makes Razorpay retry the thing you just correctly ignored.

### 4.3 Events to handle

| Event | Effect |
|---|---|
| `subscription.activated` | `status: active`, set plan/seats, recompute |
| `subscription.charged` | Extend `currentPeriodEnd`, ensure `active`, recompute |
| `subscription.pending` | `status: past_due` — keep features on, show banner |
| `subscription.halted` | `status: past_due` — grace period begins |
| `subscription.cancelled` | `status: cancelled`, features run to `currentPeriodEnd` |
| `subscription.completed` | `status: expired`, downgrade to Free entitlements |

**Grace period:** `past_due` keeps full entitlements for 7 days with a persistent banner, then downgrades. Cutting access the instant a card fails punishes users for expired cards, which is the most common failure and the least deliberate.

### 4.4 Downgrade — what happens to data over the new limit

A Pro user with 12 lists who drops to Free (5 lists) must not lose 7 lists. Rule: **data is never deleted on downgrade; it is made read-only.**

- Lists beyond `maxLists`, ordered by `order` descending, become read-only. Visible, greyed, with an upgrade prompt. No new tasks.
- Tasks beyond `maxTasksPerList` — existing ones stay fully editable; creation is blocked at the limit.
- Attachments stay downloadable; new uploads blocked.
- Reminders beyond the first per task are disabled but preserved, and reactivate on re-upgrade.

This needs to be in the entitlement layer from the start. Bolting it on after the first churned Pro user complains means a data migration.

---

## 5. Reminder delivery (Phase 1, email)

A cron every 5 minutes:

```ts
tasks.find({
  "reminders.remindAt": { $lte: now },
  "reminders.sentAt": { $exists: false },
  completedAt: { $exists: false }
})
```

Set `sentAt` **before** dispatching to the mail provider. A reminder that fails to send silently is a smaller failure than one that sends six times because the cron overlapped. Backed by the compound index in §1.6.

Reminder times are stored UTC and rendered in `user.timezone` — which is why §1.1 carries it. Every user on this product is in IST today; hardcoding that is a bug that surfaces on the first NRI student.

---

## 6. Open items for you to decide

1. **Attachment storage.** Not in the BRD. S3-compatible (Cloudflare R2 is cheapest at this scale, zero egress) vs. UploadThing. R2 fits the ₹30–40k budget better.
2. **Auth provider.** BRD §8.1 says "NextAuth / Clerk". Clerk's free tier caps at 10k MAU and handles org/multi-tenancy natively — real time saved for a solo founder. NextAuth is free forever but you build workspace-membership logic yourself. Pick before writing auth code, because it's not a cheap swap.
3. **Business workspace member cap.** I assumed 50 (§1.1). BRD only specifies 10 for Team.
4. **Business plan pricing.** BRD §9.1 prices Team at ₹149/user/month but doesn't price a Business workspace separately. Assumed identical, with modules as the upcharge.
5. **Comments.** Listed in the Core Engine (§6.1) and drawn in the wireframe (Frame 5 detail panel), but absent from the §5.1 MVP scope list. Currently not in this schema — confirm whether it ships in Phase 1.
