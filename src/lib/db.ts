import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is not set. Copy .env.example to .env and fill it in.");
}

/**
 * Next.js dev mode hot-reloads modules on every edit. Without caching the
 * connection on globalThis, each reload opens a new pool and Mongo runs out
 * of connections within a few minutes of editing.
 */
type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as unknown as { _mongoose?: MongooseCache };

const cached: MongooseCache = globalForMongoose._mongoose ?? { conn: null, promise: null };
globalForMongoose._mongoose = cached;

export async function connectDb(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI!, {
      bufferCommands: false,
      maxPoolSize: 10,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    // Clear the promise so the next request retries instead of awaiting a
    // permanently-rejected promise forever.
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}
