"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard/crm",           label: "Overview"   },
  { href: "/dashboard/crm/leads",     label: "Leads"      },
  { href: "/dashboard/crm/deals",     label: "Deals"      },
  { href: "/dashboard/crm/customers", label: "Customers"  },
];

export default function CrmLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-0 h-full flex flex-col">
      {/* Sub-nav */}
      <div className="border-b mb-6 -mt-2">
        <nav className="flex gap-1 px-0">
          {TABS.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
