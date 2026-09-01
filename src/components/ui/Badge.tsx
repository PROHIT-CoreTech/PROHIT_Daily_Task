import type { HTMLAttributes } from "react";

type Tone = "primary" | "accent" | "module" | "danger" | "muted";

const TONE_CLASSES: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/10 text-accent",
  module: "bg-module/20 text-[#8a5a2b]",
  danger: "bg-danger/10 text-danger",
  muted: "bg-black/5 text-muted",
};

export function Badge({ tone = "muted", className = "", ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]} ${className}`}
      {...props}
    />
  );
}
