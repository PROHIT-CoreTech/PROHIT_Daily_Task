# PROHIT Daily Task — Phase 1

Next.js 15 (App Router) + MongoDB/Mongoose + NextAuth + Razorpay + Tailwind v4
+ shadcn/ui. Implements the Core Engine, entitlement gating, billing webhook,
and (as of the Auth + Shell + My Day slice) the first real page of the web
app, from BRD v1.0 and the Data Model & API Spec v1.

Built in **vertical slices** — API and UI together per capability — rather
than backend-then-frontend. See `docs` note below on what's shipped vs. roadmap.

## Run

```bash
npm install
cp .env.example .env      # fill MONGODB_URI and NEXTAUTH_SECRET at minimum
npm run dev
```

Magic-link login needs `EMAIL_SERVER`/`EMAIL_FROM` set to a real SMTP
transport (e.g. a free Mailtrap sandbox for local dev) — without it, sign-in
emails silently no-op (logged, not sent; see `src/lib/mail.ts` and
`src/lib/auth.ts`'s `EmailProvider`).

```bash
npm run typecheck         # tsc --noEmit
npx tsx scripts/verify.ts # 22 logic tests, no DB required
npm run build
```

The reminder cron needs `CRON_SECRET` set and an external scheduler (Vercel
Cron, Railway scheduled job, cron-job.org) hitting `GET /api/cron/reminders`
every 5 minutes with `Authorization: Bearer <CRON_SECRET>` or
`?secret=<CRON_SECRET>` — there's no long-running process in this app to
host a cron inside, so the trigger has to come from outside. Test it
manually with `curl "http://localhost:3000/api/cron/reminders?secret=$CRON_SECRET"`.

## Layout

```
src/lib/
  db.ts                     Mongoose connection, hot-reload safe
  types.ts                  Shared domain types
  auth.ts                   NextAuth config
  models/                   User, Workspace, Subscription,
                            EntitlementCache, List, Task, Invitation
  mail.ts                   Nodemailer transport shared with NextAuth's
                            EMAIL_SERVER config; best-effort send
  entitlements/
    matrix.ts               Plan -> features/limits. Single source of truth.
    compute.ts              Recompute (write) + read with degraded fallback
  api/guard.ts              Auth -> membership -> entitlements -> gates
  tasks/completion.ts       completeTask()/uncompleteTask() — the one
                             completion implementation, shared by
                             /complete and /board-position
  queries/
    hydrate.ts              User+workspaces+entitlements, React-cached per
                             request; shared by /api/v1/me and the app shell
    myDay.ts                Frame 1 query, shared by the API route and page
  utils/
    recurrence.ts           Next-instance calculation
    boardOrder.ts           Fractional ordering for drag-and-drop
    calendarGrid.ts          Month/week grid math — local Date components
                             throughout (dateKey/parseDateKey), never a
                             date-only ISO string parsed as UTC

src/app/(app)/              Authenticated shell (redirects to /login if no
                             session). Workspace switcher writes a cookie via
                             a server action (actions.ts), not a DB write —
                             it's a per-browser preference, not account state.
  my-day/                    Today's tasks, overdue, completion %
  lists/                     Sidebar of lists (delete = archive, hover for
                             the trash icon) + quick-add task, expandable
                             per-task edit panel (description/priority/due
                             date/tags/subtasks/assignee — assignee picker
                             only renders when the workspace has >1 member).
  board/                     Flow Board: dnd-kit kanban on the existing board
                             API. Gated by the flow_board entitlement — Free
                             workspaces see UpgradePrompt, not the board.
  calendar/                  Month grid (all plans) / week grid (Pro+, via
                             calendar_week_view). Grid math lives in
                             lib/utils/calendarGrid.ts — pure + unit tested.
  team/                      Members list, pending invites, invite form.
                             Workspace creation lives in the switcher
                             (components/app/workspace-switcher.tsx), not
                             here — needed a Team/Business workspace to exist
                             before this page has anything to manage.
src/app/login/               Magic-link sign-in (NextAuth EmailProvider)
src/app/invite/[token]/      Public invite-acceptance landing page (linked
                             from the invite email) — handles not-signed-in,
                             wrong-email-signed-in, expired, and already-used
                             states before showing the Join button.
src/components/ui/           Hand-written shadcn/ui-style primitives (button,
                             card, avatar, dropdown-menu, progress, separator,
                             skeleton) — copied-in source per shadcn
                             convention, not an installed component library
public/manifest.json, sw.js  Minimal PWA: installable + stale-while-offline
                             caching of GET API responses. Icons in
                             public/icons/ are placeholders (regenerate via
                             `node scripts/generate-icons.mjs`) pending real
                             brand assets.

src/app/api/
  v1/me                             Hydrates the app shell in one call
  v1/workspaces                     POST create (seeds subscription + cache)
  v1/workspaces/[id]/lists          GET, POST (maxLists gate)
  v1/workspaces/[id]/tasks          GET filtered+paginated, POST
  v1/workspaces/[id]/board          GET (flow_board gate)
  v1/workspaces/[id]/calendar       GET ?view=month|week (week needs
                                     calendar_week_view)
  v1/workspaces/[id]/my-day         GET (Frame 1 dashboard)
  v1/workspaces/[id]/invites        GET, POST (owner/admin, maxMembers gate)
  v1/workspaces/[id]/invites/[id]   DELETE (revoke, owner/admin)
  v1/invites/[token]/accept         POST (session email must match invite)
  v1/tasks/[id]                     GET, PATCH, DELETE (status excluded from
                                     PATCH — only /complete and
                                     /board-position may transition it;
                                     assigneeId validated as a current member)
  v1/tasks/[id]/subtasks            POST
  v1/tasks/[id]/subtasks/[sid]      PATCH, DELETE
  v1/tasks/[id]/reminders           POST (maxRemindersPerTask gate)
  v1/tasks/[id]/reminders/[rid]     DELETE
  cron/reminders                    GET (shared-secret auth, not a session
                                     — meant for an external scheduler)
  v1/lists/[id]                     PATCH, DELETE (archives, never deletes)
  v1/workspaces/[id]/members/[uid]  DELETE (self = leave; others need
                                     owner/admin; owner can't be removed)
  v1/tasks/[id]/complete            POST (materialises recurrence)
  v1/tasks/[id]/board-position      PATCH (drag-and-drop)
  v1/billing/plans                  GET (server-driven pricing)
  webhooks/razorpay                 POST (signature + idempotency)
```

## Load-bearing decisions

**Entitlements are read from a cache, never computed per request.**
`EntitlementCache` is the only collection the request path reads to gate a
feature. No route queries `Subscription` to make an access decision.

**Degraded reads fail closed.** Missing or >48h-stale cache falls back to
Free, not permissive. Someone briefly seeing Free limits files a ticket;
someone silently getting Pro for free does not.

**Feature gates return 402, never 403.** The client distinguishes "needs
upgrade" from "not allowed" on status code alone, no message parsing.

**Webhook idempotency is atomic.** The `$ne: eventId` guard sits inside the
`findOneAndUpdate` filter, so concurrent duplicate deliveries cannot both
pass. Duplicates return 200 — a non-2xx makes Razorpay retry.

**Downgrade freezes, never deletes.** Lists past the new cap go read-only
and unfreeze on re-upgrade.

**Grace period is 7 days.** `past_due` keeps full access with a banner. An
expired card is the most common billing failure and the least deliberate.

**Invites are bound to an email, not a user ID.** Auth is magic-link only, so
the invitee may not have an account yet. The invite token carries the email;
accepting checks it against the signed-in session's email rather than
resolving to a pre-known user. The `maxMembers` gate counts existing members
plus other pending invites at send time — not re-checked on accept — so
capacity is reserved the moment an invite goes out.

**Every user gets a personal workspace automatically on signup.** A NextAuth
`events.createUser` hook (`src/lib/auth.ts`) creates it the moment the
adapter creates the User row — the same three calls `POST /api/v1/workspaces`
makes by hand. Without this, a brand-new magic-link user would hit the app
shell with zero workspaces.

**Magic-link signup never collects a name.** Unlike an OAuth profile, the
Email provider only gives NextAuth an address, so the same `createUser`
hook backfills `name` from the email's local part. Existing rows created
before this shipped were one-time-fixed via `scripts/backfill-user-names.ts`
(idempotent, safe to re-run); the read path (`lib/queries/team.ts`) also
falls back defensively regardless.

**A task's assignee must be a current member of its own workspace.** Both
create and PATCH validate `assigneeId` against `workspace.members` — an ID
that isn't a member (including someone since removed) is rejected, not
silently accepted. `assigneeId: null` unassigns.

**Completing a task has exactly one implementation.**
`src/lib/tasks/completion.ts`'s `completeTask()` (recurrence materialisation
included) is called from both `POST /complete` and `PATCH /board-position`
(dropping a card into Done) — a comment used to just *claim* this while the
board route actually reimplemented completion inline, so a recurring task
completed via drag-and-drop silently never generated its next instance.
Moving a card back out of Done calls the companion `uncompleteTask()`, which
uses `$unset` — `$set: { completedAt: undefined }` is a Mongoose no-op
(undefined keys are stripped during update casting), so it looked like it
cleared completion but didn't.

**Member-count seat caps require a paid plan.** `MEMBER_CAP_BY_TYPE` in
`matrix.ts` only overrides `maxMembers` when `plan !== "free"` — every
workspace starts on Free regardless of the `type` chosen at creation, so
without this a `business`-type workspace got a 50-member cap for free,
purely from its type.

**A webhook event ID always identifies one delivery.** The Razorpay handler
falls back to a hash of the raw request body when `x-razorpay-event-id` is
absent, never to the subscription's own (constant) ID — that fallback made
every event after the first on a given subscription look like a duplicate
of it and get silently dropped.

## Deviations from the design pack

- Free does **not** get Flow Board. Wireframe Frame 6 showed it included;
  BRD 9.1 does not. BRD wins — it is the main conversion trigger.
- `deep_work` exists in the schema, false on every plan. Nav ships locked so
  the layout does not shift when v1.1 enables it.
- Workspace `type` and billing `plan` are separate fields, which resolves the
  BRD 6.4 vs 9.2 contradiction over what "Team-tier" means.

## Not yet built

`/stats`, Billing & Upgrade UI (`/billing/checkout`, `/billing/verify-student`
— blocked on real Razorpay test-mode keys), attachments upload (Cloudflare
R2 — blocked on a bucket + API token), PWA icon/install polish. Comments
deferred to Phase 2 (BRD 5.1's MVP list omits them).

Shipped so far: full entitlement/billing-webhook backend, and five UI
slices — magic-link auth + app shell + My Day, Lists & Tasks (incl. subtask
CRUD, reminders, and list delete), Flow Board drag-and-drop, Calendar (month
for all plans, week for Pro+), and Team (members, invites, remove/leave,
workspace creation, and the public invite-accept landing page). Reminders
are end-to-end: add one from a task's edit panel, `GET /api/cron/reminders`
(shared-secret auth) finds due-and-unsent ones and emails whoever's
assigned (or the creator, if unassigned) — needs an external scheduler
pointed at it in any real deployment, since this app has no long-running
process of its own to host a cron inside.
