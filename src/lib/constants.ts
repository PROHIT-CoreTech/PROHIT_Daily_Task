// Brand palette — BRD §10.1. Kept as the single source of truth referenced
// by both Tailwind (via globals.css @theme tokens) and anywhere JS needs
// the raw hex (e.g. list color pickers, emails).
export const BRAND_COLORS = {
  primary: "#1B2A4A", // Charcoal Navy
  accent: "#2A9D8F", // Emerald Teal
  secondary: "#5C7A99", // Slate Blue
  module: "#D4A373", // Warm Sand
  background: "#F7F7F5", // Off-white
} as const;

// Feature nomenclature — BRD §10.2. Use these labels in UI copy, never the
// generic industry term, to keep the brand distinct from TickTick et al.
export const NOMENCLATURE = {
  kanbanView: "Flow Board",
  todayDashboard: "My Day",
  focusTimer: "Deep Work Sprint",
  reminder: "Sticky Alert",
  calendarSync: "Calendar Bridge",
  smartLists: "Views",
  aiSummary: "Quick Recap",
  habitTracker: "Streaks",
} as const;

export const LIST_COLOR_SWATCHES = [
  BRAND_COLORS.primary,
  BRAND_COLORS.accent,
  BRAND_COLORS.secondary,
  BRAND_COLORS.module,
  "#B5495B",
  "#7C6BA0",
] as const;

export const PRIORITY = {
  0: { label: "None", color: "#9CA3AF" },
  1: { label: "Low", color: "#5C7A99" },
  2: { label: "Medium", color: "#D4A373" },
  3: { label: "High", color: "#C0392B" },
} as const;

export const BOARD_COLUMNS_DEFAULT = [
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "done", label: "Done" },
] as const;
