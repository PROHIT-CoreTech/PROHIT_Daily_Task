import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";

/** Connects to the local test database (see vitest.config.ts) and clears it. */
export async function setupTestDb() {
  await connectToDatabase();
  await clearTestDb();
}

/** Drops every collection — call between tests that share a connection. */
export async function clearTestDb() {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export async function teardownTestDb() {
  await mongoose.connection.close();
}
