// One-off data-fix: accounts created via magic-link sign-in before the
// auth.ts createUser backfill shipped have no `name` (NextAuth's Email
// provider never collects one, unlike an OAuth profile). Idempotent —
// safe to re-run; only touches rows where name is missing/empty.
//
// Usage: npx tsx scripts/backfill-user-names.ts

export {}; // no top-level import/export otherwise -> TS treats this as a
// global script, not a module, so this file's `main` collides with any
// other script's top-level `main` (e.g. set-plan.ts) in the same tsc run.

process.loadEnvFile(".env");

async function main() {
  const { connectDb } = await import("../src/lib/db");
  const { User } = await import("../src/lib/models/User");

  await connectDb();

  const affected = await User.find({
    $or: [{ name: { $exists: false } }, { name: null }, { name: "" }],
  }).lean<{ _id: { toString(): string }; email: string }[]>();

  for (const user of affected) {
    const name = user.email.split("@")[0];
    await User.updateOne({ _id: user._id }, { $set: { name } });
    console.log(`Backfilled ${user.email} -> name="${name}"`);
  }

  console.log(`${affected.length} user(s) updated.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
