import { cache } from "react";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { List } from "@/lib/models/List";

export interface ListSummary {
  _id: string;
  name: string;
  color: string;
  icon?: string;
  readOnly: boolean;
}

/**
 * Cached per request (React `cache()`) so the `(app)/lists` layout and its
 * index page — both of which need the list of lists to decide what to
 * render — share one DB round trip.
 */
async function getListsUncached(workspaceId: string): Promise<ListSummary[]> {
  await connectDb();

  const lists = await List.find({ workspaceId, archivedAt: { $exists: false } })
    .select("name color icon readOnly")
    .sort({ order: 1, createdAt: 1 })
    .lean<{ _id: { toString(): string }; name: string; color: string; icon?: string; readOnly?: boolean }[]>();

  return lists.map((l) => ({
    _id: l._id.toString(),
    name: l.name,
    color: l.color,
    icon: l.icon,
    readOnly: Boolean(l.readOnly),
  }));
}

export const getLists = cache(getListsUncached);

export interface ListDetail extends ListSummary {
  workspaceId: string;
  archived: boolean;
}

/** Single-list lookup for the `/lists/:listId` page. Not cached — one caller. */
export async function getList(
  workspaceId: string,
  listId: string
): Promise<ListDetail | null> {
  if (!Types.ObjectId.isValid(listId)) return null;

  await connectDb();

  const list = await List.findOne({ _id: listId, workspaceId }).lean<{
    _id: { toString(): string };
    name: string;
    color: string;
    icon?: string;
    readOnly?: boolean;
    archivedAt?: Date;
  } | null>();
  if (!list) return null;

  return {
    _id: list._id.toString(),
    workspaceId,
    name: list.name,
    color: list.color,
    icon: list.icon,
    readOnly: Boolean(list.readOnly),
    archived: Boolean(list.archivedAt),
  };
}
