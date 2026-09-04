import { Types } from "mongoose";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getHydration, type Hydration } from "@/lib/queries/hydrate";
import { ACTIVE_WORKSPACE_COOKIE } from "@/app/(app)/constants";

/**
 * Session + active-workspace resolution shared by every page/layout under
 * `(app)/`. Returns null when there's no session — callers under the (app)
 * group don't need to handle that themselves since the layout already
 * redirects to /login, but this stays defensive for anything called
 * directly (e.g. a future server action).
 */
export async function getActiveHydration(): Promise<Hydration | null> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return null;

  const cookieStore = await cookies();
  const preferredRaw = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const preferredWorkspaceId =
    preferredRaw && Types.ObjectId.isValid(preferredRaw) ? preferredRaw : undefined;

  return getHydration(userId, preferredWorkspaceId);
}
