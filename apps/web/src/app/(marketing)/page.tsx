import Link from "next/link";
import {
  ArrowRight, CheckCircle2, LayoutGrid, ShieldCheck,
  Zap, TrendingUp, Users, BarChart3, Package, Calculator,
  UserCheck, Boxes, Sparkles,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* ─── Data ─────────────────────────────────────────────── */

const features = [
  {
    icon: LayoutGrid,
    iconClass: "bg-blue-50 text-blue-600 border-blue-200/60",
    strip: "from-blue-400/30 via-blue-500/20 to-transparent",
    title: "Modular by Design",
    description: "Install only the modules your business needs. Start with CRM, add Inventory later. Zero bloat, zero waste.",
  },
  {
    icon: ShieldCheck,
    iconClass: "bg-emerald-50 text-emerald-600 border-emerald-200/60",
    strip: "from-emerald-400/30 via-emerald-500/20 to-transparent",
    title: "Full Data Isolation",
    description: "Every organization gets its own database. Your data is never mixed with another company's.",
  },
  {
    icon: TrendingUp,
    iconClass: "bg-violet-50 text-violet-600 border-violet-200/60",
    strip: "from-violet-400/30 via-violet-500/20 to-transparent",
    title: "Scales With You",
    description: "From 1 user to 1,000+. Business360 grows alongside your team without re-platforming.",
  },
  {
    icon: Users,
    iconClass: "bg-orange-50 text-orange-500 border-orange-200/60",
    strip: "from-orange-400/30 via-orange-500/20 to-transparent",
    title: "Role-Based Access",
    description: "Owners, admins, members. Granular permissions so everyone sees only what they need.",
  },
  {
    icon: BarChart3,
    iconClass: "bg-rose-50 text-rose-500 border-rose-200/60",
    strip: "from-rose-400/30 via-rose-500/20 to-transparent",
    title: "Real-Time Insights",
    description: "Live dashboards and reports across every module. See your whole business at a glance.",
  },
  {
    icon: Zap,
    iconClass: "bg-amber-50 text-amber-500 border-amber-200/60",
    strip: "from-amber-400/30 via-amber-500/20 to-transparent",
    title: "AI-Ready Core",
    description: "The platform is built to accept an AI layer. Smart insights and automation ship in a future phase.",
  },
];

const modules = [
  { icon: Users,      bg: "bg-blue-500",    name: "CRM",        desc: "Leads · Deals · Customers",       plan: "Starter",    planColor: "text-blue-600 bg-blue-50 border-blue-200/60" },
  { icon: Boxes,      bg: "bg-emerald-500", name: "Inventory",  desc: "Stock · Warehouses · Transfers",  plan: "Growth",     planColor: "text-emerald-600 bg-emerald-50 border-emerald-200/60" },
  { icon: Calculator, bg: "bg-violet-500",  name: "Accounting", desc: "Invoices · Expenses · Reports",   plan: "Pro",        planColor: "text-violet-600 bg-violet-50 border-violet-200/60" },
  { icon: UserCheck,  bg: "bg-orange-500",  name: "HR",         desc: "Employees · Leave · Contracts",   plan: "Pro",        planColor: "text-orange-500 bg-orange-50 border-orange-200/60" },
  { icon: Package,    bg: "bg-rose-500",    name: "Projects",   desc: "Tasks · Milestones · Teams",      plan: "Enterprise", planColor: "text-rose-500 bg-rose-50 border-rose-200/60" },
  { icon: BarChart3,  bg: "bg-amber-500",   name: "Reports",    desc: "KPIs · Dashboards · Exports",     plan: "Enterprise", planColor: "text-amber-500 bg-amber-50 border-amber-200/60" },
];

const stats = [
  { value: "6+",   label: "Core Modules" },
  { value: "4",    label: "Subscription Plans" },
  { value: "100%", label: "Data Isolated" },
];

const steps = [
  { num: "01", title: "Create your account",    desc: "Sign up in 30 seconds. No credit card required." },
  { num: "02", title: "Choose your plan",       desc: "Pick Starter, Growth, Pro, or Enterprise. Upgrade anytime." },
  { num: "03", title: "Install your modules",   desc: "Activate CRM, Inventory, HR — only what you need." },
];

/* ─── Page ──────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-hero-pattern bg-grid py-28 md:py-40 px-4 sm:px-6 text-center">
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute top-20 right-0 w-96 h-96 rounded-full bg-violet-500/8 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 w-80 h-80 rounded-full bg-indigo-500/6 blur-3xl" />

        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-4 py-1.5 text-sm font-medium text-primary mb-8 shadow-glow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            Now in Beta — 14-day free trial, no card needed
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-[4.5rem] font-extrabold tracking-tight leading-[1.08] mb-6">
            The modular ERP<br />
            built for{" "}
            <span className="text-gradient">growing teams</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
            CRM, Inventory, Accounting, and HR — in one platform.
            Install only what you need. Pay only for what you use.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-xl bg-cta text-white text-sm font-semibold hover:opacity-90 transition-all shadow-cta cursor-pointer"
            >
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/pricing"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-12 px-8 rounded-xl border-border hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer"
              )}
            >
              View Pricing
            </Link>
          </div>

          <p className="text-sm text-muted-foreground/70">
            No credit card required &nbsp;·&nbsp; Cancel anytime &nbsp;·&nbsp; Free 14-day trial
          </p>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-brand py-10 px-4 sm:px-6">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-10" />
        <div className="relative max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-around gap-8 sm:gap-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-4xl font-extrabold tracking-tight text-white">{s.value}</p>
              <p className="text-sm text-white/65 mt-1 font-medium tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────── */}
      <section id="features" className="py-28 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 text-primary bg-primary/8 border-primary/20 font-medium">
              Why Business360
            </Badge>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
              Everything your business needs
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              One shared codebase. Multiple isolated organizations. Zero duplication.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ icon: Icon, iconClass, strip, title, description }) => (
              <div
                key={title}
                className="group rounded-2xl border border-border/70 bg-card p-6 card-hover overflow-hidden relative"
              >
                <div className={cn("absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r", strip)} />
                <div className={cn("w-10 h-10 rounded-xl border flex items-center justify-center mb-4", iconClass)}>
                  <Icon className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-base mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section className="py-28 px-4 sm:px-6 bg-muted/40">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 text-primary bg-primary/8 border-primary/20 font-medium">
              Get Started in Minutes
            </Badge>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
              How it works
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 relative">
            <div className="hidden md:block absolute top-6 left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />
            {steps.map((s) => (
              <div key={s.num} className="relative flex flex-col items-center text-center">
                <div className="relative w-12 h-12 rounded-full bg-gradient-brand flex items-center justify-center mb-5 shadow-glow-sm z-10">
                  <span className="text-white text-sm font-bold">{s.num}</span>
                </div>
                <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Modules ──────────────────────────────────────── */}
      <section id="modules" className="py-28 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 text-primary bg-primary/8 border-primary/20 font-medium">
              Module Library
            </Badge>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
              Install only what you need
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Each module is independent. Activate it, run it, remove it — without touching anything else.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map(({ icon: Icon, bg, planColor, name, desc, plan }) => (
              <div
                key={name}
                className="group rounded-2xl border border-border/70 bg-card p-5 flex items-center gap-4 card-hover"
              >
                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", bg)}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-sm">{name}</h3>
                    <span className={cn("text-xs font-medium border rounded-full px-2 py-0.5", planColor)}>{plan}+</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Gradient CTA ─────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-brand py-28 px-4 sm:px-6">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-10" />
        <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-white/10 blur-3xl" />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-5">
            Ready to run your<br />business smarter?
          </h2>
          <p className="text-white/70 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            Join the businesses already using Business360 to replace spreadsheets and fragmented tools.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-xl bg-white text-primary text-sm font-semibold hover:bg-white/90 transition-opacity shadow-lg cursor-pointer"
            >
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center h-12 px-8 rounded-xl border border-white/30 text-white text-sm font-medium hover:bg-white/10 transition-colors cursor-pointer"
            >
              View Plans
            </Link>
          </div>
          <p className="mt-6 text-sm text-white/50">
            No credit card required &nbsp;·&nbsp; 14-day free trial &nbsp;·&nbsp; Cancel anytime
          </p>
        </div>
      </section>

      {/* ── Benefits row ─────────────────────────────────── */}
      <section className="py-12 px-4 sm:px-6 border-t bg-muted/25">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            "No per-module pricing surprises",
            "14-day free trial, no credit card",
            "Migrate from Odoo or Spreadsheets",
            "API-first architecture",
            "Self-host or cloud ready",
            "Open module ecosystem",
          ].map((b) => (
            <div key={b} className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <span>{b}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
