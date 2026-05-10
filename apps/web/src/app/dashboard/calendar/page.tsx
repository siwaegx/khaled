"use client";

import { useState, useEffect } from "react";
import {
  ChevronLeft, ChevronRight, Plus, Calendar, Clock,
  Users, FileText, CheckSquare, Circle, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";

type CalendarEvent = {
  id: string;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  type: "meeting" | "deadline" | "reminder" | "task" | "other";
  color?: string;
  createdBy: string;
};

const EVENT_COLORS: Record<string, string> = {
  meeting:  "bg-blue-500",
  deadline: "bg-red-500",
  reminder: "bg-amber-500",
  task:     "bg-violet-500",
  other:    "bg-slate-400",
};

const EVENT_ICONS: Record<string, React.ElementType> = {
  meeting:  Users,
  deadline: Clock,
  reminder: Circle,
  task:     CheckSquare,
  other:    Calendar,
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

type NewEventForm = {
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  type: "meeting" | "deadline" | "reminder" | "task" | "other";
};

function toLocalDatetime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function CalendarPage() {
  const [today] = useState(() => new Date());
  const [viewDate, setViewDate] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<NewEventForm>({
    title: "", description: "", startAt: "", endAt: "", allDay: false, type: "meeting",
  });

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  useEffect(() => {
    const from = new Date(year, month, 1).toISOString();
    const to   = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    setLoading(true);
    apiGet<{ events: CalendarEvent[] }>(`/api/calendar/events?from=${from}&to=${to}`)
      .then((r) => setEvents(r.events))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [year, month]);

  function prevMonth() { setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)); }
  function nextMonth() { setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)); }
  function goToday()   { setViewDate(new Date()); }

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function eventsOnDay(day: number) {
    return events.filter((e) => {
      const d = new Date(e.startAt);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  }

  function openNewForm(day?: number) {
    const base = day ? new Date(year, month, day, 9, 0) : new Date();
    const end  = new Date(base.getTime() + 60 * 60_000);
    setForm({
      title: "", description: "",
      startAt: toLocalDatetime(base),
      endAt:   toLocalDatetime(end),
      allDay: false, type: "meeting",
    });
    setSelectedEvent(null);
    setShowForm(true);
  }

  async function saveEvent() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        startAt: new Date(form.startAt).toISOString(),
        endAt:   new Date(form.endAt).toISOString(),
      };
      if (selectedEvent) {
        const r = await apiPatch<{ event: CalendarEvent }>(`/api/calendar/events/${selectedEvent.id}`, payload);
        setEvents((ev) => ev.map((e) => e.id === selectedEvent.id ? r.event : e));
      } else {
        const r = await apiPost<{ event: CalendarEvent }>("/api/calendar/events", payload);
        setEvents((ev) => [...ev, r.event]);
      }
      setShowForm(false);
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(id: string) {
    await apiDelete(`/api/calendar/events/${id}`).catch(() => {});
    setEvents((ev) => ev.filter((e) => e.id !== id));
    setSelectedEvent(null);
    setShowForm(false);
  }

  function openEdit(event: CalendarEvent) {
    setForm({
      title:       event.title,
      description: event.description ?? "",
      startAt:     toLocalDatetime(new Date(event.startAt)),
      endAt:       toLocalDatetime(new Date(event.endAt)),
      allDay:      event.allDay,
      type:        event.type,
    });
    setSelectedEvent(event);
    setShowForm(true);
  }

  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Team schedule and events</p>
        </div>
        <Button onClick={() => openNewForm()} className="gap-2">
          <Plus className="w-4 h-4" /> New Event
        </Button>
      </div>

      {/* Month nav */}
      <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-2.5">
        <button onClick={prevMonth} className="p-1 rounded hover:bg-muted transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 text-center font-semibold text-sm">
          {MONTHS[month]} {year}
        </div>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-muted transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
        <button onClick={goToday} className="text-xs text-primary font-medium hover:underline ml-2">Today</button>
      </div>

      {/* Grid */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b">
          {DAYS.map((d) => (
            <div key={d} className="py-2 text-center text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
              {d}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground animate-pulse">Loading events…</div>
        ) : (
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const dayEvents = day ? eventsOnDay(day) : [];
              return (
                <div
                  key={i}
                  onClick={() => day && (setSelectedDay(new Date(year, month, day)), openNewForm(day))}
                  className={cn(
                    "min-h-[90px] p-1.5 border-b border-r border-border/50 transition-colors",
                    day ? "cursor-pointer hover:bg-muted/30" : "bg-muted/10",
                    isToday(day ?? 0) && "bg-primary/5",
                    i % 7 === 6 && "border-r-0",
                  )}
                >
                  {day && (
                    <>
                      <div className={cn(
                        "text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full",
                        isToday(day) ? "bg-primary text-white" : "text-foreground"
                      )}>
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((e) => {
                          const Icon = EVENT_ICONS[e.type];
                          return (
                            <button
                              key={e.id}
                              onClick={(ev) => { ev.stopPropagation(); openEdit(e); }}
                              className={cn(
                                "w-full flex items-center gap-1 text-[10px] text-white font-medium rounded px-1 py-0.5 truncate",
                                EVENT_COLORS[e.type],
                              )}
                            >
                              <Icon className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{e.title}</span>
                            </button>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <p className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} more</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {Object.entries(EVENT_COLORS).map(([type, color]) => {
          const Icon = EVENT_ICONS[type];
          return (
            <div key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground capitalize">
              <span className={cn("w-3 h-3 rounded-sm flex items-center justify-center", color)}>
                <Icon className="w-2 h-2 text-white" />
              </span>
              {type}
            </div>
          );
        })}
      </div>

      {/* Event form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-card rounded-2xl border shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold">{selectedEvent ? "Edit Event" : "New Event"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5">Title *</label>
                <input
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Event title"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Start</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={form.startAt}
                    onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5">End</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={form.endAt}
                    onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">Type</label>
                <div className="flex flex-wrap gap-2">
                  {(["meeting", "deadline", "reminder", "task", "other"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setForm((f) => ({ ...f, type: t }))}
                      className={cn(
                        "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium capitalize transition-all",
                        form.type === t
                          ? cn("text-white border-transparent", EVENT_COLORS[t])
                          : "border-border text-muted-foreground hover:border-primary/40"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">Description (optional)</label>
                <textarea
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[70px] resize-none"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Add details…"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allDay"
                  checked={form.allDay}
                  onChange={(e) => setForm((f) => ({ ...f, allDay: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="allDay" className="text-xs font-medium cursor-pointer">All day event</label>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-6">
              {selectedEvent && (
                <button
                  onClick={() => deleteEvent(selectedEvent.id)}
                  className="text-xs text-destructive hover:underline mr-auto"
                >
                  Delete event
                </button>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)} className="ml-auto">
                Cancel
              </Button>
              <Button size="sm" onClick={saveEvent} disabled={saving || !form.title.trim()}>
                {saving ? "Saving…" : selectedEvent ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
