"use client";

import { useEffect, useState } from "react";
import { Users, UserCheck, CalendarClock, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiGet } from "@/lib/api";

type Stats = {
  totalEmployees:   number;
  totalLeaveRequests: number;
  activeCount:      number;
  employeesByStatus: { status: string; _count: { id: number } }[];
  leaveByType:       { type: string; _count: { id: number }; _sum: { days: number | null } }[];
};

const EMP_STATUS_COLOR: Record<string, string> = {
  active:     "bg-emerald-100 text-emerald-700",
  inactive:   "bg-slate-100 text-slate-700",
  terminated: "bg-red-100 text-red-700",
};

export default function HrOverviewPage() {
  const [stats, setStats]     = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<Stats>("/api/hr/stats")
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Employees",  value: stats?.totalEmployees,    icon: Users,         color: "text-blue-500"    },
          { label: "Active",           value: stats?.activeCount,       icon: UserCheck,     color: "text-emerald-500" },
          { label: "Leave Requests",   value: stats?.totalLeaveRequests, icon: CalendarClock, color: "text-amber-500"   },
          { label: "Departments",      value: "—",                      icon: Users,         color: "text-violet-500"  },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                <Icon className={cn("w-4 h-4", color)} />
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {loading ? "—" : (typeof value === "number" ? value.toLocaleString() : value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Employees by Status</CardTitle>
              <Link href="/dashboard/hr/employees" className="text-xs text-primary flex items-center gap-1 hover:underline">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="h-20 animate-pulse bg-muted rounded-lg" />
            ) : (stats?.employeesByStatus.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-4">No employees yet</p>
            ) : (
              (stats?.employeesByStatus ?? []).map((s) => (
                <div key={s.status} className="flex items-center justify-between text-sm">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", EMP_STATUS_COLOR[s.status] ?? "bg-muted")}>{s.status}</span>
                  <Badge variant="secondary" className="font-mono">{s._count.id}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Leave by Type</CardTitle>
              <Link href="/dashboard/hr/leave" className="text-xs text-primary flex items-center gap-1 hover:underline">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="h-20 animate-pulse bg-muted rounded-lg" />
            ) : (stats?.leaveByType.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-4">No leave requests yet</p>
            ) : (
              (stats?.leaveByType ?? []).map((l) => (
                <div key={l.type} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground capitalize">{l.type}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono">{l._count.id}</Badge>
                    <span className="text-xs text-muted-foreground">{(l._sum.days ?? 0).toLocaleString()} days</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
