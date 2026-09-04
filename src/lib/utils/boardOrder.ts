/**
 * Fractional ordering for Flow Board drag-and-drop. Inserting between two
 * cards writes one document instead of renumbering every sibling.
 */

export const ORDER_GAP = 1000;
/** Below this gap, float precision starts to degrade; renormalise the column. */
export const MIN_GAP = 0.0001;

export function midpoint(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return ORDER_GAP;
  if (before === undefined) return after! - ORDER_GAP;
  if (after === undefined) return before + ORDER_GAP;
  return (before + after) / 2;
}

export function needsRenormalise(before?: number, after?: number): boolean {
  if (before === undefined || after === undefined) return false;
  return Math.abs(after - before) < MIN_GAP;
}

/** Evenly respaced integers for a column that has subdivided too far. */
export function renormalise(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) * ORDER_GAP);
}
