import Link from "next/link";
import { cn } from "@/lib/utils";
import { addDays, dateKey, parseDateKey } from "@/lib/utils/calendarGrid";
import type { CalendarDay, CalendarViewMode } from "@/lib/queries/calendar";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE_TASKS = 3;

// All date arithmetic here goes through parseDateKey/dateKey rather than
// `new Date(dateString)` — a date-only string parses as UTC midnight, which
// local-time methods (getMonth, toLocaleDateString, ...) can then read as
// the previous calendar day in any timezone behind UTC. calendarGrid.ts's
// own tests cover this exact regression.

function shiftDate(key: string, view: CalendarViewMode, dir: 1 | -1): string {
  const d = parseDateKey(key);
  if (view === "month") {
    d.setMonth(d.getMonth() + dir);
    return dateKey(d);
  }
  return dateKey(addDays(d, dir * 7));
}

function periodLabel(anchorKey: string, view: CalendarViewMode, days: CalendarDay[]): string {
  if (view === "month") {
    return parseDateKey(anchorKey).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }
  const fmt = (key: string) =>
    parseDateKey(key).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(days[0].date)} – ${fmt(days[days.length - 1].date)}`;
}

export function CalendarView({
  view,
  anchor,
  days,
  canUseWeekView,
}: {
  view: CalendarViewMode;
  /** A "YYYY-MM-DD" date key (local), not an ISO instant. */
  anchor: string;
  days: CalendarDay[];
  canUseWeekView: boolean;
}) {
  const today = dateKey(new Date());
  const weekdayStart = parseDateKey(days[0].date).getDay();
  const weekdays = [...WEEKDAY_LABELS.slice(weekdayStart), ...WEEKDAY_LABELS.slice(0, weekdayStart)];

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href={`/calendar?view=${view}&date=${shiftDate(anchor, view, -1)}`}
            className="flex size-8 items-center justify-center rounded-md hover:bg-muted"
          >
            ‹
          </Link>
          <h1 className="min-w-40 text-lg font-semibold">{periodLabel(anchor, view, days)}</h1>
          <Link
            href={`/calendar?view=${view}&date=${shiftDate(anchor, view, 1)}`}
            className="flex size-8 items-center justify-center rounded-md hover:bg-muted"
          >
            ›
          </Link>
          <Link
            href={`/calendar?date=${today}`}
            className="ml-2 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
          >
            Today
          </Link>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-border p-1">
          <Link
            href={`/calendar?view=month&date=${anchor}`}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium",
              view === "month" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            Month
          </Link>
          {canUseWeekView ? (
            <Link
              href={`/calendar?view=week&date=${anchor}`}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium",
                view === "week" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              Week
            </Link>
          ) : (
            <span
              title="Week view is available on Pro and Team plans"
              className="flex items-center gap-1 rounded px-3 py-1 text-xs font-medium text-muted-foreground/60"
            >
              Week
              <span className="rounded-full bg-module px-1.5 text-[10px] text-module-foreground">
                Pro
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
        {weekdays.map((label) => (
          <div key={label} className="bg-muted px-2 py-1 text-center text-xs font-medium text-muted-foreground">
            {label}
          </div>
        ))}
        {days.map((day) => (
          <div
            key={day.date}
            className={cn(
              "flex min-h-24 flex-col gap-1 bg-card p-1.5",
              view === "month" && "min-h-24",
              view === "week" && "min-h-[60vh]",
              !day.inCurrentPeriod && "bg-muted/40"
            )}
          >
            <span
              className={cn(
                "self-start rounded-full px-1.5 text-xs",
                day.date === today && "bg-primary text-primary-foreground",
                !day.inCurrentPeriod && "text-muted-foreground/60"
              )}
            >
              {parseDateKey(day.date).getDate()}
            </span>
            <div className="flex flex-col gap-1">
              {day.tasks.slice(0, MAX_VISIBLE_TASKS).map((task) => (
                <span
                  key={task._id}
                  className={cn(
                    "truncate rounded bg-module/20 px-1.5 py-0.5 text-xs",
                    task.completedAt && "text-muted-foreground line-through"
                  )}
                  title={task.title}
                >
                  {task.title}
                </span>
              ))}
              {day.tasks.length > MAX_VISIBLE_TASKS && (
                <span className="px-1.5 text-xs text-muted-foreground">
                  +{day.tasks.length - MAX_VISIBLE_TASKS} more
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
