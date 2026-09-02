# PROHIT Daily Task

A generic productivity/task-management platform (Phase 1 MVP), built per `PROHIT_Daily_Task_BRD.docx` and `PROHIT_Data_Model_and_API_Spec_v1.md`.

## Stack

Next.js 16 (App Router, TypeScript) · MongoDB + Mongoose · NextAuth.js (Credentials) · Tailwind CSS v4 · Razorpay Subscriptions · Cloudflare R2 (attachments) · Nodemailer

## Setup

1. **MongoDB** — already installed as a local Windows service (MongoDB Community 8.3). Verify it's running: `Get-Service MongoDB` in PowerShell.
2. **Environment** — copy `.env.local.example` to `.env.local` if you don't already have one (one exists with a working local Mongo URI and generated auth secrets). Fill in real values for:
   - `RAZORPAY_*` — from the [Razorpay dashboard](https://dashboard.razorpay.com/app/keys) (use Test Mode keys first). You also need to create three Plans in Razorpay (Subscriptions → Plans) for Pro/Pro-Student/Team and put their IDs in `RAZORPAY_PLAN_*`.
   - `SMTP_*` — any SMTP provider (Gmail app password, Resend, Brevo, etc.) — needed for reminder emails and student-verification emails.
   - `R2_*` — a [Cloudflare R2](https://developers.cloudflare.com/r2/) bucket + API token — needed for task attachments.
   - `ANTHROPIC_API_KEY` — from the [Anthropic Console](https://console.anthropic.com/settings/keys) — needed for Quick Recap (AI Add-on). `RAZORPAY_PLAN_AI_ADDON` needs its own Razorpay Plan (separate from the base-tier plans) since the add-on bills independently.
   Nothing else in the app requires these to run; features gracefully depend on them only when exercised (checkout, attachments, emails, Quick Recap).
3. **Install & run**:
   ```
   npm install
   npm run dev
   ```
   Visit http://localhost:3000 — it redirects to `/register`.
4. **Tests**: `npm test` (or `npm run test:watch`). Uses a separate local database (`prohit_daily_task_test`, same Mongo instance) — never touches dev data.

## What's built (Phase 1 MVP per BRD §5.1)

- Auth (NextAuth Credentials, bcrypt) + Personal workspace auto-provisioned on signup
- Core task engine: tasks, subtasks, priority, due dates, tags, recurring tasks (daily/weekly/monthly, completion- or schedule-anchored)
- Lists (Projects), Team/Business workspace creation + member invites
- My Day dashboard, month/week Calendar, Flow Board (Kanban, drag-and-drop, fractional ordering)
- Comments and link-free file attachments (via R2 presigned uploads) on tasks
- Sticky Alerts (reminders) — stored + a `/api/v1/reminders/dispatch` endpoint, fired every 5 min by the included `.github/workflows/reminder-dispatch.yml` once its secrets are set (see Deployment)
- Entitlement-gated Free/Pro/Pro-Student/Team plans, enforced server-side (402 responses) and reflected in the UI (locked nav items, upgrade prompts)
- Razorpay Subscriptions checkout + idempotent webhook handling (`/api/webhooks/razorpay`)
- Student discount verification flow (academic email → signed link → Pro-Student unlocked)
- PWA: manifest + hand-rolled service worker (app-shell caching, never caches `/api/*`)
- **Deep Work Sprint** (BRD's V1.1 fast-follow, §5.2) — Pomodoro-style focus timer (25/45/60 min presets, optional task link), gated Pro/Team like Flow Board. Sessions recorded in `focus_sessions`; "Sessions today" counter on the page.
- **AI Add-on — Quick Recap** (BRD §9.2 / Phase 2) — an AI-generated plain-language plan for the day (Claude Opus 5, `src/lib/ai/client.ts`), billed as its own ₹99/user/month Razorpay subscription on top of any base plan (not bundled into Pro, per the BRD). Toggled from `/settings/billing`; the `ai_assistant` entitlement is overlaid onto the base plan matrix from `subscriptions.addons.ai`, independent of plan/workspace type.
- **Calendar Bridge** (Google Calendar sync, Phase 2) — OAuth connect/disconnect from `/settings` (Pro/Team gated), `src/lib/calendar-bridge/` syncs a task's due date to an event on the *creator's* calendar (not every assignee's — see the scope note in `sync.ts`) whenever it's created, moved, completed, or deleted.

## Deliberate scope cuts (see the plan/spec for the full reasoning)

- No native mobile app (Phase 4 per BRD)
- Voice-to-task (the other half of the AI Add-on's BRD scope, alongside Quick Recap) is not built — needs speech-to-text, a separate integration from the text-only Quick Recap shipped here
- Vertical business modules (CA/Coaching/Clinic/...) have their schema (`VerticalModule` model) but no UI — Phase 3

## Testing

Vitest, 190 tests across two projects (`npm test` runs both):
- **api** (`src/**/*.test.ts`, node environment) — route handlers and the riskiest business logic, the stuff that's wrong in a way a screenshot won't catch
- **components** (`src/**/*.test.tsx`, jsdom + React Testing Library) — TaskRow, QuickAddTask, Modal, UpgradeGate, primitives, deep-work, flow-board drag targeting

Highlights from the **api** project:
- **Entitlement matrix** (`entitlements/matrix.test.ts`) — every plan's features/limits match BRD §9.1 exactly, including the D1 (type-vs-plan) and D2 (Free has no Flow Board) spec decisions
- **Gating** (`api/errors.test.ts`) — `requireFeature`/`requireLimit` return 402 with the right payload shape
- **Recurrence engine** (`tasks/recurrence.test.ts`) — schedule-anchored vs completion-anchored next-due-date math, `until`/`count` stop conditions
- **Board ordering** (`tasks/board-order.test.ts`) — fractional midpoint math, top/bottom-of-column edge cases, float-precision renormalization
- **Entitlement cache service** (`entitlements/service.test.ts`) — recompute-on-write, the degraded-read-falls-back-to-Free rule, and the AI Add-on overlay (on independent of plan, off by default even on Team)
- **Razorpay webhook** (`webhooks/razorpay/route.test.ts`) — signature verification, the idempotency guarantee BRD §7 requires (a redelivered event must not double-apply), and the AI Add-on's separate-subscription-id matching
- **Student verification tokens** (`student-verification.test.ts`) — sign/verify round-trip, tampering, TTL expiry

Writing these caught two real bugs, now fixed: `board-position` was swapping `beforeTask`/`afterTask` when calling `computeBoardOrder`, so dropping a card at the very top or bottom of a column misplaced it; and the fractional-order renormalization path recursed on stale pre-renormalization values, hanging forever once triggered.

## Deployment

Targets [Vercel](https://vercel.com) (Next.js) + [MongoDB Atlas](https://www.mongodb.com/atlas) (the BRD's low-cost hosting intent). No `vercel.json` is needed — Vercel auto-detects Next.js.

1. **Atlas** — create a free-tier cluster, add a database user, and allow network access from anywhere (`0.0.0.0/0`; Vercel's serverless functions don't have static IPs). Copy the connection string for `MONGODB_URI`.
2. **Import the repo** into Vercel from `PROHIT-CoreTech/PROHIT_Daily_Task`.
3. **Environment variables** — add every var from `.env.local.example` under Project → Settings → Environment Variables, with production values. Two that must point at the deployed domain, not `localhost`:
   - `NEXTAUTH_URL` → `https://<your-domain>`
   - `GOOGLE_REDIRECT_URI` → `https://<your-domain>/api/v1/integrations/google-calendar/callback` (and register that exact URL as an authorized redirect URI in Google Cloud Console)

   A handful of vars are read at *import* time (e.g. `RAZORPAY_KEY_ID` — the Razorpay SDK throws at construction if it's empty) — every var needs at least a non-empty placeholder for the build to succeed, even before you have real credentials for that integration.
4. **Reminder cron** — `/api/v1/reminders/dispatch` has no bundled scheduler; `.github/workflows/reminder-dispatch.yml` calls it every 5 minutes via GitHub Actions (chosen over Vercel Cron, whose Hobby tier caps schedules at once/day). Add two repo secrets under Settings → Secrets and variables → Actions:
   - `REMINDER_DISPATCH_URL` → `https://<your-domain>/api/v1/reminders/dispatch`
   - `REMINDER_DISPATCH_SECRET` → the same value set in the Vercel env var of that name

## Not yet done

- Real Razorpay/SMTP/R2/Anthropic/Google credentials (placeholders in `.env.local` — the integration code is complete and covered by tests/manual runs, but not exercised against live services)
