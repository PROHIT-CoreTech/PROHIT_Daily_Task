"use server";

import { Types } from "mongoose";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { Workspace } from "@/lib/models/Workspace";
import { ACTIVE_WORKSPACE_COOKIE } from "./constants";

/**
 * Switches which workspace the shell treats as active. Stored in a cookie
 * rather than written to `user.defaultWorkspaceId` — this is a per-browser
 * UI preference, not a durable account setting.
 */
export async function setActiveWorkspace(workspaceId: string): Promise<void> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId || !Types.ObjectId.isValid(workspaceId)) return;

  await connectDb();
  const isMember = await Workspace.exists({
    _id: workspaceId,
    "members.userId": new Types.ObjectId(userId),
  });
  if (!isMember) return;

  const store = await cookies();
  store.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
}
