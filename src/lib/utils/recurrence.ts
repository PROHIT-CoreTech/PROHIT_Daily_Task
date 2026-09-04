export interface Recurrence {
  freq: "daily" | "weekly" | "monthly";
  interval: number;
  byWeekday?: number[];
  byMonthDay?: number;
  until?: Date;
  count?: number;
  completionAnchored: boolean;
}

/**
 * Computes the next due date for a recurring task, or null when the series
 * has ended.
 *
 * Instances are materialised one at a time on completion rather than
 * pre-generated: an unbounded daily recurrence would otherwise write
 * thousands of documents up front.
 */
export function nextDueDate(
  rec: Recurrence,
  scheduledDate: Date,
  completedAt: Date,
  occurrencesSoFar = 1
): Date | null {
  if (rec.count !== undefined && occurrencesSoFar >= rec.count) return null;

  const anchor = rec.completionAnchored ? completedAt : scheduledDate;
  let next: Date;

  switch (rec.freq) {
    case "daily":
      next = addDays(anchor, rec.interval);
      break;

    case "weekly":
      next = rec.byWeekday?.length
        ? nextWeekday(anchor, rec.byWeekday, rec.interval)
        : addDays(anchor, 7 * rec.interval);
      break;

    case "monthly":
      next = addMonths(anchor, rec.interval, rec.byMonthDay);
      break;
  }

  if (rec.until && next > rec.until) return null;
  return next;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function nextWeekday(from: Date, weekdays: number[], interval: number): Date {
  const sorted = [...weekdays].sort((a, b) => a - b);
  const current = from.getDay();

  const upcoming = sorted.find((d) => d > current);
  if (upcoming !== undefined) return addDays(from, upcoming - current);

  // Wrap to the first selected weekday of the next active week.
  const daysToWeekStart = 7 - current;
  return addDays(from, daysToWeekStart + sorted[0] + 7 * (interval - 1));
}

/**
 * Month arithmetic clamps rather than overflowing: "31st monthly" starting in
 * January lands on 28/29 Feb, not 3 March, which is what JavaScript's native
 * setMonth would do.
 */
function addMonths(d: Date, n: number, byMonthDay?: number): Date {
  const out = new Date(d);
  const targetDay = byMonthDay ?? d.getDate();

  out.setDate(1);
  out.setMonth(out.getMonth() + n);

  const lastDay = new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate();
  out.setDate(Math.min(targetDay, lastDay));

  return out;
}
