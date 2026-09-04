import type { NextAuthOptions } from "next-auth";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import EmailProvider from "next-auth/providers/email";
import nodemailer from "nodemailer";
import { MongoClient, ObjectId } from "mongodb";
import { connectDb } from "@/lib/db";
import { User } from "@/lib/models/User";
import { Workspace } from "@/lib/models/Workspace";
import { Subscription } from "@/lib/models/Subscription";
import { recomputeEntitlements } from "@/lib/entitlements/compute";

/**
 * NextAuth chosen over Clerk: no MAU ceiling and no recurring cost, which
 * matters against the self-build budget. Trade-off is that workspace
 * membership logic is ours (see lib/api/guard.ts) rather than provided.
 */
const uri = process.env.MONGODB_URI!;
const globalForMongo = globalThis as unknown as { _mongoClient?: Promise<MongoClient> };
const clientPromise =
  globalForMongo._mongoClient ?? new MongoClient(uri).connect();
globalForMongo._mongoClient = clientPromise;

export const authOptions: NextAuthOptions = {
  adapter: MongoDBAdapter(clientPromise),
  session: { strategy: "jwt" },
  providers: [
    EmailProvider({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
      // Default sendVerificationRequest always opens an SMTP transport and
      // throws if it can't — which is correct in production, but means
      // local dev without EMAIL_SERVER configured hard-fails "Send magic
      // link" instead of degrading. Log-the-link locally, same fallback
      // src/lib/mail.ts already uses for invite email.
      async sendVerificationRequest({ identifier, url, provider }) {
        if (!provider.server) {
          console.warn(`[auth] EMAIL_SERVER not set; sign-in link for ${identifier}: ${url}`);
          return;
        }
        const transport = nodemailer.createTransport(provider.server);
        await transport.sendMail({
          to: identifier,
          from: provider.from,
          subject: "Sign in to PROHIT Daily Task",
          text: `Sign in: ${url}`,
          html: `<p><a href="${url}">Sign in to PROHIT Daily Task</a></p>`,
        });
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
  events: {
    // Spec (workspaces §1.2): every user gets a personal workspace on
    // signup, automatically. The adapter creates the User row on first
    // magic-link verification; this is the one place that fires exactly
    // once per new user, so it is where that workspace gets seeded —
    // mirrors the three calls POST /api/v1/workspaces makes by hand.
    async createUser({ user }) {
      await connectDb();

      const ownerId = new ObjectId(user.id);

      // The magic-link flow never collects a name (unlike an OAuth
      // provider's profile payload), and the adapter writes this row via
      // the raw driver — bypassing the Mongoose schema's `required: true`.
      // Backfill from the email so every account has a real display name.
      if (!user.name) {
        await User.updateOne({ _id: ownerId }, { $set: { name: user.email!.split("@")[0] } });
      }

      const workspace = await Workspace.create({
        name: "Personal",
        type: "personal",
        ownerId,
        members: [{ userId: ownerId, role: "owner", joinedAt: new Date() }],
      });

      await Subscription.create({
        workspaceId: workspace._id,
        plan: "free",
        status: "active",
        seats: 1,
      });

      await recomputeEntitlements(workspace._id);
    },
  },
  pages: { signIn: "/login" },
};
