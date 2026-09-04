import { cache } from "react";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { User } from "@/lib/models/User";
import { Workspace } from "@/lib/models/Workspace";
import { readEntitlements } from "@/lib/entitlements/compute";
import type { EntitlementSet, WorkspaceType } from "@/lib/types";

export interface HydratedUser {
  _id: Types.ObjectId;
  email: string;
  name: string;
  avatarUrl?: string;
  defaultWorkspaceId?: Types.ObjectId;
}

export interface HydratedWorkspace {
  _id: Types.ObjectId;
  name: string;
  type: WorkspaceType;
}

export interface Hydration {
  user: HydratedUser | null;
  workspaces: HydratedWorkspace[];
  activeWorkspaceId: Types.ObjectId | undefined;
  entitlements: EntitlementSet | null;
}

/**
 * User + workspaces + active entitlements, in one call. Backs both the
 * `/api/v1/me` route and the authenticated app shell's server layout.
 *
 * `preferredWorkspaceId` lets a caller override which workspace is "active"
 * for this render (the app shell's workspace switcher does this via a
 * cookie) without writing to `user.defaultWorkspaceId`.
 *
 * Wrapped in React's `cache()` below, keyed on these two string args, so the
 * layout and a page rendered under it share one DB round trip per request
 * instead of two — cache() keys on argument identity, which only works
 * reliably for primitives, hence string in, ObjectId out.
 */
async function getHydrationUncached(
  userIdRaw: string,
  preferredWorkspaceIdRaw?: string
): Promise<Hydration> {
  await connectDb();

  const userId = new Types.ObjectId(userIdRaw);

  const [user, workspaces] = await Promise.all([
    User.findById(userId).select("-__v").lean<HydratedUser | null>(),
    Workspace.find({ "members.userId": userId })
      .select("name type")
      .sort({ createdAt: 1 })
      .lean<HydratedWorkspace[]>(),
  ]);

  const preferred =
    preferredWorkspaceIdRaw && workspaces.some((w) => w._id.toString() === preferredWorkspaceIdRaw)
      ? new Types.ObjectId(preferredWorkspaceIdRaw)
      : undefined;

  const activeId = preferred ?? user?.defaultWorkspaceId ?? workspaces[0]?._id;

  const entitlements = activeId ? await readEntitlements(activeId) : null;

  return { user, workspaces, activeWorkspaceId: activeId, entitlements };
}

export const getHydration = cache(getHydrationUncached);

export interface ClientWorkspace {
  _id: string;
  name: string;
  type: WorkspaceType;
}

export interface ClientHydration {
  user: { _id: string; email: string; name: string; avatarUrl?: string } | null;
  workspaces: ClientWorkspace[];
  activeWorkspaceId: string | undefined;
  entitlements: EntitlementSet | null;
}

/**
 * Server Components can pass plain data to Client Components, but not class
 * instances like Mongoose's `ObjectId` — React's RSC serialization rejects
 * them. Anything crossing into `<AppShell>` (a Client Component) needs this;
 * server-only consumers (e.g. the My Day page) can keep using `Hydration`
 * directly since they never cross that boundary.
 */
export function toClientHydration(hydration: Hydration): ClientHydration {
  return {
    user: hydration.user
      ? {
          _id: hydration.user._id.toString(),
          email: hydration.user.email,
          name: hydration.user.name,
          avatarUrl: hydration.user.avatarUrl,
        }
      : null,
    workspaces: hydration.workspaces.map((w) => ({
      _id: w._id.toString(),
      name: w.name,
      type: w.type,
    })),
    activeWorkspaceId: hydration.activeWorkspaceId?.toString(),
    entitlements: hydration.entitlements,
  };
}
