import { Lock } from "lucide-react";

/**
 * Page-level equivalent of the API's 402 contract (see src/lib/api/guard.ts
 * requireFeature) — same "needs upgrade" condition, rendered in place of an
 * error toast since there's no request here to fail. No CTA button yet:
 * the billing/upgrade slice hasn't landed, so there's nowhere to send it.
 */
export function UpgradePrompt({ feature, message }: { feature: string; message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-module/20">
        <Lock className="size-5 text-module-foreground" />
      </div>
      <h1 className="text-lg font-semibold">{feature} is a paid feature</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
