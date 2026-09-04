/**
 * Pure date-grid math for the Calendar view. Deliberately uses local Date
 * components (getFullYear/getMonth/getDate), not UTC, to match the rest of
 * the app's "server-local time" convention (see getMyDay's startOfDay) —
 * mixing UTC and local here would misplace tasks near midnight by a day.
 */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Inverse of dateKey. Deliberately builds the Date from local Y/M/D
 * components rather than `new Date("2026-03-01")` — a date-only ISO string
 * parses as UTC midnight, which display/arithmetic via local Date methods
 * (getMonth, setMonth, toLocaleDateString, ...) can then read as the wrong
 * calendar day in any timezone behind UTC.
 */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

/** All days for a month's calendar grid, padded to full weeks on both ends. */
export function monthGridDays(anchor: Date, weekStartsOn: 0 | 1): Date[] {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const lastOfMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);

  const leadingOffset = (firstOfMonth.getDay() - weekStartsOn + 7) % 7;
  const trailingOffset = (weekStartsOn + 6 - lastOfMonth.getDay() + 7) % 7;

  const start = addDays(firstOfMonth, -leadingOffset);
  const end = addDays(lastOfMonth, trailingOffset);

  const days: Date[] = [];
  for (let d = start; d.getTime() <= end.getTime(); d = addDays(d, 1)) days.push(d);
  return days;
}

/** The 7 days of the week containing `anchor`. */
export function weekDays(anchor: Date, weekStartsOn: 0 | 1): Date[] {
  const offset = (anchor.getDay() - weekStartsOn + 7) % 7;
  const start = addDays(anchor, -offset);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
