"use client";

import { useEffect, useState } from "react";
import { Building2, Users, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet } from "@/lib/api";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Stats = { totalCompanies: number; totalContacts: number };

export default function ContactsOverviewPage() {
  const [stats, setStats]     = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<Stats>("/api/contacts/stats")
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const kpis = [
    {
      label: "Companies",
      value: stats?.totalCompanies ?? 0,
      icon: Building2,
      href: "/dashboard/contacts/companies",
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Total Contacts",
      value: stats?.totalContacts ?? 0,
      icon: Users,
      href: "/dashboard/contacts/contacts",
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
        {kpis.map(({ label, value, icon: Icon, href, color, bg }) => (
          <Card key={label} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <span className={cn("p-1.5 rounded-lg", bg)}>
                  <Icon className={cn("w-4 h-4", color)} />
                </span>
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {loading ? "…" : value.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-2 max-w-sm">
        <Link
          href="/dashboard/contacts/companies"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "justify-between")}
        >
          <span className="flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Manage Companies
          </span>
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/dashboard/contacts/contacts"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "justify-between")}
        >
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4" /> Browse All Contacts
          </span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
