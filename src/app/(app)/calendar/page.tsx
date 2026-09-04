import { getActiveHydration } from "@/lib/queries/activeWorkspace";
import { getCalendar, getWeekStartsOn } from "@/lib/queries/calendar";
import { dateKey, parseDateKey } from "@/lib/utils/calendarGrid";
import { CalendarView } from "@/components/app/calendar-view";

type SearchParams = { view?: string; date?: string };

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const hydration = await getActiveHydration();
  if (!hydration?.activeWorkspaceId) return null;

  const canUseWeekView = Boolean(hydration.entitlements?.features.calendar_week_view);
  // Free gets month only (BRD 9.1) — silently fall back rather than error,
  // since this is a stale/shared link case, not a user action to block.
  const view = sp.view === "week" && canUseWeekView ? "week" : "month";

  // parseDateKey, not `new Date(sp.date)` — a date-only string parses as
  // UTC midnight, and monthGridDays/weekDays read it back with local Date
  // methods; in any timezone behind UTC that silently shifts the grid (and
  // "today") by a day. See calendarGrid.ts's own header comment.
  const anchor = sp.date && DATE_KEY_RE.test(sp.date) ? parseDateKey(sp.date) : new Date();
  const workspaceId = hydration.activeWorkspaceId.toString();

  const weekStartsOn = await getWeekStartsOn(workspaceId);
  const days = await getCalendar(workspaceId, view, anchor, weekStartsOn);

  return (
    <CalendarView view={view} anchor={dateKey(anchor)} days={days} canUseWeekView={canUseWeekView} />
  );
}
