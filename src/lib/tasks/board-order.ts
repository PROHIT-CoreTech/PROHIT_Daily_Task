import { Task } from "@/models/Task";

const RENORMALIZE_THRESHOLD = 0.0001;
const RENORMALIZE_SPACING = 1000;

/**
 * Fractional ordering (spec §3): moving a card between neighbours a and b
 * sets its order to the midpoint. After ~50 subdivisions floats lose
 * precision, so renormalise the column to integer spacing when the gap
 * drops below the threshold, then compute the new order from the
 * *renormalized* indices — recursing on the stale pre-renormalization
 * values would find the same collapsed gap forever.
 */
export async function computeBoardOrder(
  workspaceId: string,
  listId: string,
  boardColumnId: string,
  beforeOrder: number | null,
  afterOrder: number | null
): Promise<number> {
  if (beforeOrder === null && afterOrder === null) return RENORMALIZE_SPACING;
  if (beforeOrder === null) return (afterOrder as number) - RENORMALIZE_SPACING;
  if (afterOrder === null) return beforeOrder + RENORMALIZE_SPACING;

  const gap = afterOrder - beforeOrder;
  if (gap >= RENORMALIZE_THRESHOLD) {
    return (beforeOrder + afterOrder) / 2;
  }

  const tasks = await Task.find({ workspaceId, listId, boardColumnId }).sort({ boardOrder: 1 });
  const beforeIndex = tasks.findIndex((t) => t.boardOrder === beforeOrder);
  const afterIndex = tasks.findIndex((t) => t.boardOrder === afterOrder);

  await Promise.all(
    tasks.map((t, i) => Task.updateOne({ _id: t._id }, { $set: { boardOrder: (i + 1) * RENORMALIZE_SPACING } }))
  );

  if (beforeIndex === -1 || afterIndex === -1) {
    // beforeOrder/afterOrder should always match tasks already in this
    // column — but if a caller passes a stale value, don't hang or throw.
    return ((tasks.length + 1) * RENORMALIZE_SPACING) / 2;
  }

  return ((beforeIndex + 1) * RENORMALIZE_SPACING + (afterIndex + 1) * RENORMALIZE_SPACING) / 2;
}
