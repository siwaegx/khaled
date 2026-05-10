"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, AlertTriangle, Package, Info, CheckCheck, Trash2, X, ExternalLink } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { apiGet, apiPatch, apiDelete } from "@/lib/api";

type RawNotification = {
  id: string;
  type: string;
  title: string;
  body?: string;
  href?: string;
  entityType?: string;
  readAt?: string | null;
  createdAt: string;
};

type AlertInvoice = { id: string; number: string; customerName: string; dueDate: string; total: number };
type AlertStock   = { id: string; quantity: number; minQuantity: number; product: { name: string; sku: string }; warehouse: { name: string } };

function typeIcon(type: string) {
  if (type.includes("lead") || type.includes("deal")) return <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />;
  if (type.includes("invoice")) return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />;
  if (type.includes("stock") || type.includes("inventory")) return <Package className="w-3.5 h-3.5 text-teal-500 shrink-0 mt-0.5" />;
  return <Bell className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)  return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NotificationPanel({ open, onClose }: Props) {
  const [notifications, setNotifications] = useState<RawNotification[]>([]);
  const [alerts, setAlerts] = useState<{ overdueInvoices: AlertInvoice[]; lowStock: AlertStock[] } | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [notifRes, alertRes] = await Promise.allSettled([
      apiGet<{ notifications: RawNotification[]; unreadCount: number }>("/api/notifications"),
      apiGet<{ overdueInvoices: AlertInvoice[]; lowStock: AlertStock[] }>("/api/reports/alerts"),
    ]);
    if (notifRes.status === "fulfilled") {
      setNotifications(notifRes.value.notifications);
      setUnread(notifRes.value.unreadCount);
    }
    if (alertRes.status === "fulfilled") setAlerts(alertRes.value);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Re-fetch when panel opens
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function markAllRead() {
    await apiPatch("/api/notifications/read-all", {}).catch(() => {});
    setNotifications((n) => n.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
    setUnread(0);
  }

  async function dismiss(id: string) {
    await apiDelete(`/api/notifications/${id}`).catch(() => {});
    setNotifications((n) => n.filter((x) => x.id !== id));
  }

  const alertCount = (alerts?.overdueInvoices.length ?? 0) + (alerts?.lowStock.length ?? 0);
  const totalBadge = unread + alertCount;

  return (
    <>
      {/* Bell trigger badge — rendered outside, exported as a data attribute */}
      <span data-badge={totalBadge > 0 ? (totalBadge > 9 ? "9+" : String(totalBadge)) : ""} />

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border bg-popover shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/20">
            <p className="text-sm font-semibold">Notifications</p>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[11px] text-primary font-medium hover:underline px-1"
                  title="Mark all read"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> All read
                </button>
              )}
              <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto divide-y divide-border/40">
            {loading && (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">Loading…</div>
            )}

            {/* System alerts */}
            {!loading && alertCount > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground px-4 py-1.5 bg-amber-50 border-b">
                  System Alerts
                </p>
                {alerts?.overdueInvoices.map((inv) => (
                  <Link
                    key={inv.id}
                    href="/dashboard/accounting/invoices"
                    onClick={onClose}
                    className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{inv.number} — {inv.customerName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        ${inv.total.toLocaleString()} overdue · {new Date(inv.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                    <ExternalLink className="w-3 h-3 text-muted-foreground/40 shrink-0 mt-1" />
                  </Link>
                ))}
                {alerts?.lowStock.map((sl) => (
                  <div key={sl.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                    <Package className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{sl.product.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {sl.quantity} / {sl.minQuantity} min · {sl.warehouse.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* User notifications */}
            {!loading && notifications.length > 0 && (
              <div>
                {alertCount > 0 && (
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground px-4 py-1.5 bg-muted/20 border-b">
                    Recent Activity
                  </p>
                )}
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors group",
                      !n.readAt && "bg-primary/[0.03] border-l-2 border-primary"
                    )}
                  >
                    {typeIcon(n.type)}
                    <div className="min-w-0 flex-1">
                      {n.href ? (
                        <Link href={n.href} onClick={onClose} className="text-xs font-medium hover:underline truncate block">
                          {n.title}
                        </Link>
                      ) : (
                        <p className="text-xs font-medium truncate">{n.title}</p>
                      )}
                      {n.body && <p className="text-[11px] text-muted-foreground truncate">{n.body}</p>}
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">{timeAgo(n.createdAt)}</p>
                    </div>
                    <button
                      onClick={() => dismiss(n.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10 hover:text-destructive"
                      title="Dismiss"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loading && notifications.length === 0 && alertCount === 0 && (
              <div className="px-4 py-8 text-center">
                <Bell className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">All clear — no notifications</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function useTotalBadgeCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function fetchCount() {
      const [notifRes, alertRes] = await Promise.allSettled([
        apiGet<{ unreadCount: number }>("/api/notifications"),
        apiGet<{ overdueInvoices: unknown[]; lowStock: unknown[] }>("/api/reports/alerts"),
      ]);
      let total = 0;
      if (notifRes.status === "fulfilled") total += notifRes.value.unreadCount;
      if (alertRes.status === "fulfilled") total += alertRes.value.overdueInvoices.length + alertRes.value.lowStock.length;
      setCount(total);
    }
    fetchCount();
  }, []);

  return count;
}
