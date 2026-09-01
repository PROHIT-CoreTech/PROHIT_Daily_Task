"use client";

import { Suspense, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Check, Lock, Sparkles } from "lucide-react";
import { fetcher, api, ApiClientError } from "@/lib/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
import { TopNav } from "@/components/layout/TopNav";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { RazorpayScript } from "@/components/billing/RazorpayScript";
import { NOMENCLATURE } from "@/lib/constants";
import type { PlanInfo } from "@/types/api";
import type { Plan } from "@/lib/entitlements/matrix";

const PLAN_LABEL: Record<Plan, string> = { free: "Free", pro: "Pro", pro_student: "Pro (Student)", team: "Team" };
const FEATURE_ROWS: { key: keyof PlanInfo["features"]; label: string }[] = [
  { key: "flow_board", label: "Flow Board" },
  { key: "calendar_week_view", label: "Week/day calendar views" },
  { key: "unlimited_attachments", label: "Attachments" },
  { key: "multiple_reminders", label: "Multiple Sticky Alerts" },
  { key: "team_dashboard", label: "Team dashboard" },
  { key: "deep_work", label: "Deep Work Sprint" },
];

function BillingPageContent() {
  const { data: session } = useSession();
  const { activeWorkspace, refresh } = useWorkspace();
  const { data } = useSWR<{ plans: PlanInfo[] }>("/api/v1/billing/plans", fetcher);
  const searchParams = useSearchParams();
  const studentVerificationResult = searchParams.get("studentVerification");

  const [checkingOut, setCheckingOut] = useState<Plan | null>(null);
  const [addonCheckingOut, setAddonCheckingOut] = useState(false);
  const [collegeEmail, setCollegeEmail] = useState("");
  const [studentMsg, setStudentMsg] = useState<string | null>(null);

  if (!activeWorkspace) return null;

  const availablePlans =
    data?.plans.filter((p) => (activeWorkspace.type === "personal" ? p.plan !== "team" : p.plan === "team")) ?? [];

  async function startCheckout(plan: Plan) {
    setCheckingOut(plan);
    try {
      const res = await api.post<{ razorpaySubscriptionId: string; keyId: string }>("/api/v1/billing/checkout", {
        workspaceId: activeWorkspace!.id,
        plan,
      });

      const rzp = new window.Razorpay({
        key: res.keyId,
        subscription_id: res.razorpaySubscriptionId,
        name: "PROHIT Daily Task",
        theme: { color: "#1B2A4A" },
        prefill: { email: session?.user?.email ?? "" },
        // Never unlock features on this callback — it's spoofable and fires
        // before the webhook lands. We just refetch /me; the entitlement
        // cache updates once Razorpay's webhook is processed (spec §4.1).
        handler: () => refresh(),
      });
      rzp.open();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : "Could not start checkout.");
    } finally {
      setCheckingOut(null);
    }
  }

  async function cancelPlan() {
    if (!confirm("Cancel your subscription? You'll keep access until the end of the billing period.")) return;
    await api.post("/api/v1/billing/cancel", { workspaceId: activeWorkspace!.id });
    await refresh();
  }

  async function startAddonCheckout() {
    setAddonCheckingOut(true);
    try {
      const res = await api.post<{ razorpaySubscriptionId: string; keyId: string }>("/api/v1/billing/ai-addon/checkout", {
        workspaceId: activeWorkspace!.id,
      });
      const rzp = new window.Razorpay({
        key: res.keyId,
        subscription_id: res.razorpaySubscriptionId,
        name: "PROHIT Daily Task — AI Add-on",
        theme: { color: "#1B2A4A" },
        prefill: { email: session?.user?.email ?? "" },
        handler: () => refresh(),
      });
      rzp.open();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : "Could not start checkout.");
    } finally {
      setAddonCheckingOut(false);
    }
  }

  async function cancelAddon() {
    if (!confirm("Remove the AI Add-on? Quick Recap will stop working at the end of the billing period.")) return;
    await api.post("/api/v1/billing/ai-addon/cancel", { workspaceId: activeWorkspace!.id });
    await refresh();
  }

  async function requestStudentVerification(e: React.FormEvent) {
    e.preventDefault();
    setStudentMsg(null);
    try {
      const res = await api.post<{ message: string }>("/api/v1/billing/verify-student", { collegeEmail });
      setStudentMsg(res.message);
    } catch (err) {
      setStudentMsg(err instanceof ApiClientError ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <RazorpayScript />
      <TopNav title="Billing" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {studentVerificationResult === "success" && (
          <div className="rounded-lg bg-accent/10 text-accent text-sm px-4 py-2">
            Student email verified! You can now subscribe to Pro (Student) pricing.
          </div>
        )}
        {studentVerificationResult === "invalid" && (
          <div className="rounded-lg bg-danger/10 text-danger text-sm px-4 py-2">
            That verification link is invalid or expired. Request a new one below.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {availablePlans.map((plan) => {
            const isCurrent = activeWorkspace.entitlements.plan === plan.plan;
            return (
              <Card key={plan.plan} className={`p-5 flex flex-col ${isCurrent ? "ring-2 ring-accent" : ""}`}>
                <h3 className="text-base font-semibold text-primary">{PLAN_LABEL[plan.plan]}</h3>
                <p className="mt-1 text-2xl font-semibold text-accent">
                  {plan.amountInr === 0 ? "Free" : `₹${plan.amountInr}`}
                  {plan.amountInr > 0 && <span className="text-xs text-muted font-normal">/{plan.interval}</span>}
                </p>
                <ul className="mt-4 space-y-2 flex-1">
                  {FEATURE_ROWS.map((row) => (
                    <li key={row.key} className="flex items-center gap-2 text-sm">
                      {plan.features[row.key] ? (
                        <Check size={14} className="text-accent shrink-0" />
                      ) : (
                        <Lock size={12} className="text-muted shrink-0" />
                      )}
                      <span className={plan.features[row.key] ? "" : "text-muted"}>{row.label}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  {isCurrent ? (
                    plan.plan !== "free" ? (
                      <Button variant="ghost" className="w-full" onClick={cancelPlan}>
                        Cancel plan
                      </Button>
                    ) : (
                      <Button variant="ghost" className="w-full" disabled>
                        Current plan
                      </Button>
                    )
                  ) : plan.plan === "free" ? null : (
                    <Button className="w-full" onClick={() => startCheckout(plan.plan)} disabled={checkingOut === plan.plan}>
                      {checkingOut === plan.plan ? "Starting…" : "Upgrade Now"}
                    </Button>
                  )}
                </div>
                {plan.plan === "pro_student" && !isCurrent && (
                  <p className="mt-2 text-[11px] text-muted text-center">Requires a verified college email — see below.</p>
                )}
              </Card>
            );
          })}
        </div>

        <Card className="p-5 max-w-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Sparkles size={15} className="text-module" />
                {NOMENCLATURE.aiSummary} (AI Add-on)
              </h3>
              <p className="mt-1 text-xs text-muted">
                Voice-to-task and AI planning, sold separately from your plan — ₹99/user/month.
              </p>
            </div>
          </div>
          <div className="mt-4">
            {activeWorkspace.entitlements.features.ai_assistant ? (
              <Button variant="ghost" className="w-full" onClick={cancelAddon}>
                Remove add-on
              </Button>
            ) : (
              <Button className="w-full" onClick={startAddonCheckout} disabled={addonCheckingOut}>
                {addonCheckingOut ? "Starting…" : "Add for ₹99/mo"}
              </Button>
            )}
          </div>
        </Card>

        {activeWorkspace.type === "personal" && (
          <Card className="p-5 max-w-md">
            <h3 className="text-sm font-semibold text-primary mb-2">Student discount</h3>
            <p className="text-xs text-muted mb-3">Verify your .edu / .ac.in email to unlock Pro (Student) pricing.</p>
            <form onSubmit={requestStudentVerification} className="flex gap-2">
              <Input type="email" placeholder="you@college.ac.in" value={collegeEmail} onChange={(e) => setCollegeEmail(e.target.value)} required />
              <Button type="submit">Verify</Button>
            </form>
            {studentMsg && <p className="mt-2 text-xs text-muted">{studentMsg}</p>}
          </Card>
        )}
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense>
      <BillingPageContent />
    </Suspense>
  );
}
