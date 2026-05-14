import Link from "next/link";
import { CheckCircle2, X, ArrowRight, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PlanFeature = { text: string; included: boolean };
type ApiPlan = {
  key: string;
  name: string;
  description: string;
  price: number;
  yearlyPrice: number;
  memberLimit: number;
  isPopular: boolean;
  ctaText: string;
  features: PlanFeature[];
};

// Per-key style map — keys are stable identifiers that never change
const PLAN_STYLE: Record<string, { accent: string; badgeColor: string }> = {
  starter:    { accent: "border-blue-200/60 bg-blue-50/50",    badgeColor: "text-blue-600 bg-blue-50 border-blue-200/60" },
  growth:     { accent: "",                                     badgeColor: "text-primary bg-primary/8 border-primary/20" },
  pro:        { accent: "border-violet-200/60 bg-violet-50/50", badgeColor: "text-violet-600 bg-violet-50 border-violet-200/60" },
  enterprise: { accent: "border-amber-200/60 bg-amber-50/50",  badgeColor: "text-amber-600 bg-amber-50 border-amber-200/60" },
};

const DEFAULT_PLANS: ApiPlan[] = [
  {
    key: "starter", name: "Starter", price: 29, yearlyPrice: 23, memberLimit: 3,
    isPopular: false, ctaText: "Get Started",
    description: "Perfect for small teams getting started.",
    features: [
      { text: "CRM module",        included: true  },
      { text: "Up to 3 users",     included: true  },
      { text: "1 organization",    included: true  },
      { text: "Email support",     included: true  },
      { text: "Inventory module",  included: false },
      { text: "Accounting module", included: false },
      { text: "HR module",         included: false },
      { text: "API access",        included: false },
    ],
  },
  {
    key: "growth", name: "Growth", price: 79, yearlyPrice: 63, memberLimit: 15,
    isPopular: true, ctaText: "Get Started",
    description: "For growing businesses that need more.",
    features: [
      { text: "CRM module",        included: true  },
      { text: "Inventory module",  included: true  },
      { text: "Up to 15 users",    included: true  },
      { text: "3 organizations",   included: true  },
      { text: "Priority support",  included: true  },
      { text: "Accounting module", included: false },
      { text: "HR module",         included: false },
      { text: "API access",        included: false },
    ],
  },
  {
    key: "pro", name: "Pro", price: 149, yearlyPrice: 119, memberLimit: 50,
    isPopular: false, ctaText: "Get Started",
    description: "All core modules for serious operations.",
    features: [
      { text: "CRM module",              included: true },
      { text: "Inventory module",        included: true },
      { text: "Accounting module",       included: true },
      { text: "HR module",               included: true },
      { text: "Up to 50 users",          included: true },
      { text: "Unlimited organizations", included: true },
      { text: "API access",              included: true },
      { text: "Priority support",        included: true },
    ],
  },
  {
    key: "enterprise", name: "Enterprise", price: 299, yearlyPrice: 239, memberLimit: 0,
    isPopular: false, ctaText: "Contact Sales",
    description: "Advanced features for large organizations.",
    features: [
      { text: "All Pro features",    included: true },
      { text: "Unlimited users",     included: true },
      { text: "Advanced modules",    included: true },
      { text: "Custom integrations", included: true },
      { text: "Dedicated support",   included: true },
      { text: "SLA guarantee",       included: true },
      { text: "On-premise option",   included: true },
      { text: "Custom branding",     included: true },
    ],
  },
];

async function fetchPlans(): Promise<ApiPlan[]> {
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    const res = await fetch(`${apiBase}/api/platform/plans`, { cache: "no-store" });
    if (!res.ok) return DEFAULT_PLANS;
    const data = (await res.json()) as { plans?: ApiPlan[] };
    return Array.isArray(data.plans) && data.plans.length > 0 ? data.plans : DEFAULT_PLANS;
  } catch {
    return DEFAULT_PLANS;
  }
}

export default async function PricingPage() {
  const plans = await fetchPlans();

  return (
    <div className="py-20 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <div className="text-center mb-14">
          <Badge variant="secondary" className="mb-4 text-primary bg-primary/8 border-primary/20 font-medium">
            Pricing
          </Badge>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Start free for 14 days. No credit card required. Cancel anytime.
          </p>
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((plan) => {
            const style = PLAN_STYLE[plan.key] ?? { accent: "", badgeColor: "" };
            return (
              <div
                key={plan.key}
                className={cn(
                  "relative flex flex-col rounded-2xl border overflow-hidden",
                  plan.isPopular
                    ? "border-primary shadow-glow bg-card"
                    : cn("border-border/70 bg-card", style.accent)
                )}
              >
                {plan.isPopular && (
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-brand" />
                )}

                {plan.isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-cta text-white rounded-full px-3 py-1 shadow-cta-sm">
                      <Zap className="w-3 h-3" /> Most Popular
                    </span>
                  </div>
                )}

                <div className="p-5 pb-4 pt-6">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-base font-bold">{plan.name}</h2>
                    <span className={cn("text-xs font-semibold border rounded-full px-2 py-0.5", style.badgeColor)}>
                      {plan.name}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-4xl font-extrabold tracking-tight">${plan.price}</span>
                    <span className="text-muted-foreground text-sm">/user/mo</span>
                  </div>
                </div>

                <div className="flex-1 px-5 pb-4">
                  <ul className="space-y-2.5">
                    {plan.features.map(({ text, included }) => (
                      <li key={text} className="flex items-center gap-2.5 text-sm">
                        {included ? (
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                        ) : (
                          <X className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                        )}
                        <span className={included ? "font-medium" : "text-muted-foreground/60"}>{text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-5 pt-3">
                  <Link
                    href={`/register?plan=${plan.key}`}
                    className={cn(
                      "w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold transition-all cursor-pointer",
                      plan.isPopular
                        ? "bg-cta text-white hover:opacity-90 shadow-cta-sm"
                        : "border border-border/80 hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                    )}
                  >
                    {plan.ctaText} <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-14 text-center">
          <p className="text-muted-foreground text-sm">
            All plans include a 14-day free trial. No credit card required.{" "}
            <Link href="/register" className="text-primary underline underline-offset-4 font-medium">
              Start today
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
