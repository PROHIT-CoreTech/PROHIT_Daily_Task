import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { Workspace } from "@/lib/models/Workspace";
import { readEntitlements } from "@/lib/entitlements/compute";
import { requiredPlanFor } from "@/lib/entitlements/matrix";
import type { EntitlementSet, FeatureFlag, LimitKey, MemberRole } from "@/lib/types";
import { UNLIMITED } from "@/lib/types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown>
  ) {
    super(String(body.error ?? "error"));
  }
}

export interface Ctx {
  userId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  role: MemberRole;
  entitlements: EntitlementSet;
}

async function requireUserId(): Promise<Types.ObjectId> {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) throw new ApiError(401, { error: "unauthenticated" });
  return new Types.ObjectId(id);
}

/**
 * Resolves session, confirms workspace membership, and loads entitlements.
 * Every workspace-scoped route runs this first.
 */
export async function requireWorkspaceCtx(workspaceIdRaw: string): Promise<Ctx> {
  const userId = await requireUserId();

  if (!Types.ObjectId.isValid(workspaceIdRaw)) {
    throw new ApiError(400, { error: "invalid_workspace_id" });
  }
  const workspaceId = new Types.ObjectId(workspaceIdRaw);

  await connectDb();
  // Entitlements depend only on workspaceId, not on the membership result,
  // so it's safe to fetch alongside the membership check rather than after
  // it — this is on every workspace-scoped request in the app.
  const [workspace, entitlements] = await Promise.all([
    Workspace.findOne({
      _id: workspaceId,
      "members.userId": userId,
    }).lean<{ members: { userId: Types.ObjectId; role: MemberRole }[] } | null>(),
    readEntitlements(workspaceId),
  ]);

  // 404 rather than 403: a non-member should not be able to probe which
  // workspace IDs exist.
  if (!workspace) throw new ApiError(404, { error: "workspace_not_found" });

  const role =
    workspace.members.find((m) => m.userId.toString() === userId.toString())?.role ??
    "member";

  return { userId, workspaceId, role, entitlements };
}

/**
 * Feature gate. Returns 402 Payment Required, never 403 — this is what lets
 * the client show an upgrade sheet instead of an error toast without
 * string-matching the message.
 */
export function requireFeature(ctx: Ctx, feature: FeatureFlag): void {
  if (ctx.entitlements.features[feature]) return;

  throw new ApiError(402, {
    error: "entitlement_required",
    feature,
    currentPlan: ctx.entitlements.plan,
    requiredPlan: requiredPlanFor(feature),
    message: `${humanise(feature)} is not available on your current plan.`,
  });
}

export function requireLimit(ctx: Ctx, limit: LimitKey, current: number): void {
  const max = ctx.entitlements.limits[limit];
  if (max === UNLIMITED || current < max) return;

  throw new ApiError(402, {
    error: "limit_exceeded",
    limit,
    current,
    max,
    currentPlan: ctx.entitlements.plan,
    requiredPlan: "pro",
  });
}

export function requireRole(ctx: Ctx, roles: MemberRole[]): void {
  if (!roles.includes(ctx.role)) {
    throw new ApiError(403, { error: "insufficient_role", required: roles });
  }
}

function humanise(feature: string): string {
  return feature
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Wraps a route handler so thrown ApiErrors become proper JSON responses. */
export function handle(
  fn: () => Promise<NextResponse | Response>
): Promise<NextResponse | Response> {
  return fn().catch((err: unknown) => {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body, { status: err.status });
    }
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  });
}
