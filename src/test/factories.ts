import { Types, type HydratedDocument } from "mongoose";
import { User } from "@/models/User";
import { Workspace, type WorkspaceDoc } from "@/models/Workspace";
import { Subscription } from "@/models/Subscription";
import { List } from "@/models/List";
import { Task } from "@/models/Task";
import { recomputeEntitlements } from "@/lib/entitlements/service";
import type { Plan } from "@/lib/entitlements/matrix";

let userCounter = 0;

export async function createUser(overrides: Partial<{ email: string; name: string }> = {}) {
  userCounter += 1;
  return User.create({
    email: overrides.email ?? `test-user-${userCounter}@example.com`,
    name: overrides.name ?? `Test User ${userCounter}`,
    passwordHash: "test-hash-not-used",
  });
}

/**
 * Creates a workspace + matching Subscription + populated EntitlementCache
 * (via recomputeEntitlements) so routes gated on getEntitlements() see the
 * intended plan rather than silently falling back to Free.
 */
export async function createWorkspace(
  owner: { _id: Types.ObjectId },
  opts: { type?: "personal" | "team" | "business"; plan?: Plan; name?: string } = {}
): Promise<HydratedDocument<WorkspaceDoc>> {
  const type = opts.type ?? "personal";
  const plan = opts.plan ?? "free";

  const workspace = await Workspace.create({
    name: opts.name ?? "Test Workspace",
    type,
    ownerId: owner._id,
    members: [{ userId: owner._id, role: "owner", joinedAt: new Date() }],
  });

  await Subscription.create({
    workspaceId: workspace._id,
    plan,
    status: "active",
    seats: 1,
  });

  await recomputeEntitlements(workspace._id.toString());

  return workspace;
}

export async function createList(
  workspaceId: Types.ObjectId,
  owner: { _id: Types.ObjectId },
  overrides: Partial<{ name: string; color: string; order: number }> = {}
) {
  return List.create({
    workspaceId,
    name: overrides.name ?? "Test List",
    color: overrides.color ?? "#000000",
    order: overrides.order ?? 0,
    createdBy: owner._id,
  });
}

export async function createTask(
  workspaceId: Types.ObjectId,
  listId: Types.ObjectId,
  owner: { _id: Types.ObjectId },
  overrides: Partial<{
    title: string;
    status: "todo" | "in_progress" | "done";
    dueDate: Date;
    priority: 0 | 1 | 2 | 3;
  }> = {}
) {
  return Task.create({
    workspaceId,
    listId,
    title: overrides.title ?? "Test Task",
    status: overrides.status,
    dueDate: overrides.dueDate,
    priority: overrides.priority,
    createdBy: owner._id,
  });
}

export async function addMember(
  workspace: HydratedDocument<WorkspaceDoc>,
  user: { _id: Types.ObjectId },
  role: "admin" | "member" = "member"
) {
  workspace.members.push({ userId: user._id, role, joinedAt: new Date() });
  await workspace.save();
  return workspace;
}
