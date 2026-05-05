"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Zap, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Plan = "starter" | "growth" | "pro" | "enterprise";

const PLAN_LABELS: Record<Plan, string> = {
  starter: "Starter — $29/mo",
  growth: "Growth — $79/mo",
  pro: "Pro — $149/mo",
  enterprise: "Enterprise — $299/mo",
};

const PLAN_MODULES: Record<Plan, string[]> = {
  starter: ["CRM"],
  growth: ["CRM", "Inventory"],
  pro: ["CRM", "Inventory", "Accounting", "HR"],
  enterprise: ["CRM", "Inventory", "Accounting", "HR", "Projects", "Purchasing"],
};

const USER_OPTIONS = [1, 5, 10, 25, 50, 100];

export function OnboardingFlow() {
  const params = useSearchParams();
  const plan = (params.get("plan") ?? "starter") as Plan;
  const { refresh } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [orgName, setOrgName] = useState("");
  const [userCount, setUserCount] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setError("");
    setLoading(true);
    try {
      await apiPost("/api/organizations", { name: orgName, plan, userCount });
      // Refresh auth context so the new JWT cookie (with orgId) is loaded before /dashboard
      await refresh();
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-muted/20">
      <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary mb-8">
        <Zap className="w-6 h-6" />
        Business360
      </Link>

      <div className="flex items-center gap-2 mb-8">
        {([1, 2] as const).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {s}
            </div>
            {s < 2 && <div className={`w-12 h-px ${step > s ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      <div className="w-full max-w-md">
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Your selected plan</CardTitle>
              <CardDescription>Review and confirm before setting up your organization.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold capitalize">{plan}</p>
                  <Badge variant="secondary">{PLAN_LABELS[plan]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">Included modules:</p>
                <div className="flex flex-wrap gap-2">
                  {PLAN_MODULES[plan].map((m) => (
                    <div key={m} className="flex items-center gap-1 text-xs">
                      <CheckCircle2 className="w-3 h-3 text-primary" />
                      {m}
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                14-day free trial included. No credit card required until trial ends.
              </p>
            </CardContent>
            <CardFooter>
              <Button className="w-full" onClick={() => setStep(2)}>
                Continue <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Set up your organization</CardTitle>
              <CardDescription>Create your workspace. You can change this later.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                  {error}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="orgName">Organization name</Label>
                <Input
                  id="orgName"
                  placeholder="Acme Corp"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Number of users</Label>
                <div className="grid grid-cols-3 gap-2">
                  {USER_OPTIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setUserCount(n)}
                      className={`rounded-md border py-2 text-sm font-medium transition-colors ${
                        userCount === n
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      {n === 100 ? "100+" : n}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
              <Button
                className="flex-1"
                disabled={!orgName.trim() || loading}
                onClick={handleCreate}
              >
                {loading ? "Creating…" : "Create organization"}
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 3 && (
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">You&apos;re all set!</CardTitle>
              <CardDescription>
                <strong>{orgName}</strong> has been created on the <strong className="capitalize">{plan}</strong> plan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your 14-day free trial has started. Explore your modules and get your team set up.
              </p>
            </CardContent>
            <CardFooter className="justify-center">
              <Link href="/dashboard" className={cn(buttonVariants({ size: "lg" }))}>
                Go to Dashboard <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
