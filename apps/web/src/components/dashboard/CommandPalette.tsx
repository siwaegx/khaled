"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, Handshake, Package, Warehouse,
  FileText, Receipt, UserCheck, Calendar, FolderKanban,
  CheckSquare, BarChart3, Settings, Boxes, ClipboardList, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { id: string; label: string; group: string; href: string; icon: React.ElementType };

const ITEMS: Item[] = [
  { id: "dashboard",  label: "Dashboard",       group: "Navigation", href: "/dashboard",                       icon: LayoutDashboard },
  { id: "modules",    label: "My Modules",       group: "Navigation", href: "/dashboard/modules",               icon: Boxes           },
  { id: "settings",   label: "Settings",         group: "Navigation", href: "/dashboard/settings",              icon: Settings        },
  { id: "reports",    label: "Reports",          group: "Navigation", href: "/dashboard/reports",               icon: BarChart3       },
  { id: "leads",      label: "Leads",            group: "CRM",        href: "/dashboard/crm/leads",             icon: Users           },
  { id: "deals",      label: "Deals",            group: "CRM",        href: "/dashboard/crm/deals",             icon: Handshake       },
  { id: "customers",  label: "Customers",        group: "CRM",        href: "/dashboard/crm/customers",         icon: Users           },
  { id: "products",   label: "Products",         group: "Inventory",  href: "/dashboard/inventory/products",    icon: Package         },
  { id: "warehouses", label: "Warehouses",       group: "Inventory",  href: "/dashboard/inventory/warehouses",  icon: Warehouse       },
  { id: "po",         label: "Purchase Orders",  group: "Inventory",  href: "/dashboard/inventory/orders",      icon: ClipboardList   },
  { id: "invoices",   label: "Invoices",         group: "Accounting", href: "/dashboard/accounting/invoices",   icon: FileText        },
  { id: "expenses",   label: "Expenses",         group: "Accounting", href: "/dashboard/accounting/expenses",   icon: Receipt         },
  { id: "employees",  label: "Employees",        group: "HR",         href: "/dashboard/hr/employees",          icon: UserCheck       },
  { id: "leave",      label: "Leave Requests",   group: "HR",         href: "/dashboard/hr/leave",              icon: Calendar        },
  { id: "projects",   label: "Projects",         group: "Projects",   href: "/dashboard/projects",              icon: FolderKanban    },
  { id: "tasks",      label: "Tasks",            group: "Projects",   href: "/dashboard/projects/tasks",        icon: CheckSquare     },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);

  const filtered = ITEMS.filter((item) => {
    const q = query.toLowerCase();
    return item.label.toLowerCase().includes(q) || item.group.toLowerCase().includes(q);
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery("");
        setSelected(0);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  useEffect(() => { setSelected(0); }, [query]);

  function navigate(item: Item) {
    router.push(item.href);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selected]) {
      navigate(filtered[selected]);
    }
  }

  useEffect(() => {
    const el = listRef.current?.children[selected] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-xs"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg mx-4 rounded-xl border bg-popover shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border font-mono">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No results</p>
          ) : (() => {
            let lastGroup = "";
            return filtered.map((item, idx) => {
              const showGroup = item.group !== lastGroup;
              if (showGroup) lastGroup = item.group;
              const Icon = item.icon;
              return (
                <div key={item.id}>
                  {showGroup && (
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-4 py-1.5 mt-1">
                      {item.group}
                    </p>
                  )}
                  <button
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors",
                      idx === selected ? "bg-muted" : "hover:bg-muted/50"
                    )}
                    onMouseEnter={() => setSelected(idx)}
                    onClick={() => navigate(item)}
                  >
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>{item.label}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground/60">{item.group}</span>
                  </button>
                </div>
              );
            });
          })()}
        </div>

        <div className="border-t px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span><kbd className="font-mono bg-muted px-1 py-0.5 rounded border">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono bg-muted px-1 py-0.5 rounded border">↵</kbd> open</span>
          <span className="ml-auto"><kbd className="font-mono bg-muted px-1 py-0.5 rounded border">⌘K</kbd> toggle</span>
        </div>
      </div>
    </div>
  );
}
