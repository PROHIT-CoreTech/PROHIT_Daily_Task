// Dev-only utility: flips a workspace's plan/status directly in MongoDB and
// recomputes its entitlement cache, bypassing Razorpay entirely. Use this to
// test paid-tier features (Flow Board, unlimited lists, etc.) locally before
// the real checkout flow (Billing & Upgrade slice) exists.
//
// Usage:
//   npx tsx scripts/set-plan.ts <email-or-workspaceId> <plan> [status]
//   npx tsx scripts/set-plan.ts you@example.com pro
//   npx tsx scripts/set-plan.ts 66f1a2b3c4d5e6f7a8b9c0d1 team active

export {}; // forces module scope — see backfill-user-names.ts for why

process.loadEnvFile(".env");

const PLANS = ["free", "pro", "pro_student", "team"] as const;
const STATUSES = ["active", "past_due", "cancelled", "expired"] as const;
type PlanArg = (typeof PLANS)[number];
type StatusArg = (typeof STATUSES)[number];

async function main() {
  const [, , identifier, planArg, statusArg] = process.argv;

  if (!identifier || !planArg) {
    console.error("Usage: npx tsx scripts/set-plan.ts <email-or-workspaceId> <plan> [status]");
    console.error(`  plan:   ${PLANS.join(" | ")}`);
    console.error(`  status: ${STATUSES.join(" | ")} (default: active)`);
    process.exit(1);
  }
  if (!(PLANS as readonly string[]).includes(planArg)) {
    console.error(`Invalid plan "${planArg}". Must be one of: ${PLANS.join(", ")}`);
    process.exit(1);
  }
  const status = statusArg ?? "active";
  if (!(STATUSES as readonly string[]).includes(status)) {
    console.error(`Invalid status "${status}". Must be one of: ${STATUSES.join(", ")}`);
    process.exit(1);
  }
  const plan = planArg as PlanArg;

  // Deferred until after loadEnvFile — these modules read MONGODB_URI at
  // import time, so a static top-level import would run before .env loads.
  const { Types } = await import("mongoose");
  const { connectDb } = await import("../src/lib/db");
  const { User } = await import("../src/lib/models/User");
  const { Workspace } = await import("../src/lib/models/Workspace");
  const { Subscription } = await import("../src/lib/models/Subscription");
  const { recomputeEntitlements } = await import("../src/lib/entitlements/compute");

  await connectDb();

  let workspaceId: string;

  if (Types.ObjectId.isValid(identifier) && identifier.length === 24) {
    const workspace = await Workspace.findById(identifier).lean();
    if (!workspace) {
      console.error(`No workspace found with id ${identifier}`);
      process.exit(1);
    }
    workspaceId = identifier;
  } else {
    const user = await User.findOne({ email: identifier.toLowerCase() }).lean<{
      _id: { toString(): string };
    } | null>();
    if (!user) {
      console.error(`No user found with email ${identifier}`);
      process.exit(1);
    }
    const workspace = await Workspace.findOne({ ownerId: user._id })
      .sort({ createdAt: 1 })
      .lean<{ _id: { toString(): string }; name: string } | null>();
    if (!workspace) {
      console.error(`No workspace owned by ${identifier}`);
      process.exit(1);
    }
    workspaceId = workspace._id.toString();
    console.log(`Using workspace "${workspace.name}" (${workspaceId})`);
  }

  await Subscription.findOneAndUpdate(
    { workspaceId },
    { $set: { plan, status: status as StatusArg } },
    { upsert: true }
  );

  const entitlements = await recomputeEntitlements(workspaceId);

  console.log(`Workspace ${workspaceId} is now plan=${plan} status=${status}`);
  console.log("Entitlements:", entitlements);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
