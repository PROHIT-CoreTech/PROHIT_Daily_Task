import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Types } from "mongoose";
import { setupTestDb, clearTestDb, teardownTestDb } from "@/test/db";
import { Task } from "@/models/Task";
import { computeBoardOrder } from "./board-order";

beforeAll(async () => {
  await setupTestDb();
});
afterAll(async () => {
  await teardownTestDb();
});
beforeEach(async () => {
  await clearTestDb();
});

const WORKSPACE_ID = new Types.ObjectId().toString();
const LIST_ID = new Types.ObjectId().toString();
const COLUMN = "todo";

describe("computeBoardOrder", () => {
  it("drops into an empty column at the base spacing value", async () => {
    const order = await computeBoardOrder(WORKSPACE_ID, LIST_ID, COLUMN, null, null);
    expect(order).toBe(1000);
  });

  it("dropping at the top of a column (no card before it) sorts before the current first card", async () => {
    const order = await computeBoardOrder(WORKSPACE_ID, LIST_ID, COLUMN, null, 1000);
    expect(order).toBeLessThan(1000);
  });

  it("dropping at the bottom of a column (no card after it) sorts after the current last card", async () => {
    const order = await computeBoardOrder(WORKSPACE_ID, LIST_ID, COLUMN, 5000, null);
    expect(order).toBeGreaterThan(5000);
  });

  it("dropping between two cards lands exactly on the midpoint", async () => {
    const order = await computeBoardOrder(WORKSPACE_ID, LIST_ID, COLUMN, 1000, 2000);
    expect(order).toBe(1500);
  });

  it("renormalises the column to integer spacing once the gap gets too small, then still returns a workable order", async () => {
    // Seed a column with cards whose orders have converged to a near-zero gap.
    await Task.create([
      {
        workspaceId: WORKSPACE_ID,
        listId: LIST_ID,
        title: "A",
        boardColumnId: COLUMN,
        boardOrder: 1000,
        createdBy: new Types.ObjectId(),
      },
      {
        workspaceId: WORKSPACE_ID,
        listId: LIST_ID,
        title: "B",
        boardColumnId: COLUMN,
        boardOrder: 1000.00005, // gap below the 0.0001 renormalize threshold
        createdBy: new Types.ObjectId(),
      },
    ]);

    const order = await computeBoardOrder(WORKSPACE_ID, LIST_ID, COLUMN, 1000, 1000.00005);

    // After renormalization the column is re-spaced to 1000/2000, so the
    // returned midpoint should be a sane, usable value again — not another
    // near-duplicate float.
    expect(order).toBeGreaterThan(100);
    const tasksAfter = await Task.find({ workspaceId: WORKSPACE_ID, listId: LIST_ID, boardColumnId: COLUMN }).sort({
      boardOrder: 1,
    });
    expect(tasksAfter.map((t) => t.boardOrder)).toEqual([1000, 2000]);
  });
});
