import React, { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { EventCard, CategoryBadge, formatTime } from "@/components/Cards";
import NewsletterSection from "@/components/NewsletterSection";
import { CATEGORIES } from "@/data/mockData";
import { Search, LayoutGrid, CalendarDays, ChevronLeft, ChevronRight, Rss } from "lucide-react";
import { Link } from "react-router-dom";
import { downloadICS } from "@/lib/ics";
import SubscribeCalendarDialog from "@/components/SubscribeCalendarDialog";
import { toast } from "sonner";

const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

export default function Events() {
    const { events, orgs } = useApp();
    const approved = events.filter((e) => e.status === "approved");

    const [view, setView] = useState("list"); // list | month
    const [query, setQuery] = useState("");
    const [cat, setCat] = useState("All");
    const [orgFilter, setOrgFilter] = useState("All");
    const [tag, setTag] = useState("All"); // Free | Family | Accessible | All
    const [subOpen, setSubOpen] = useState(false);
    const [cursor, setCursor] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState(new Date().toDateString());

    const orgName = (slug) => orgs.find((o) => o.slug === slug)?.name;

    const filtered = useMemo(() => {
        const now = new Date();
        return approved
            .filter((e) => new Date(e.end || e.start) >= now)
            .filter((e) =>
                query
                    ? `${e.title} ${e.venue} ${e.description}`.toLowerCase().includes(query.toLowerCase())
                    : true,
            )
            .filter((e) => (cat === "All" ? true : e.category === cat))
            .filter((e) => (orgFilter === "All" ? true : e.orgSlug === orgFilter))
            .filter((e) => {
                if (tag === "Free") return e.cost?.toLowerCase().includes("free");
                if (tag === "Family") return e.age?.toLowerCase().includes("family") || e.age?.toLowerCase().includes("all");
                if (tag === "Accessible") return e.accessibility?.toLowerCase().includes("step-free");
                return true;
            })
            .sort((a, b) => new Date(a.start) - new Date(b.start));
    }, [approved, query, cat, orgFilter, tag]);

    // Month grid
    const monthDays = useMemo(() => {
        const first = startOfMonth(cursor);
        const last = endOfMonth(cursor);
        const days = [];
        const startWeekday = (first.getDay() + 6) % 7; // Monday start
        for (let i = 0; i < startWeekday; i++) days.push(null);
        for (let d = 1; d <= last.getDate(); d++)
            days.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
        return days;
    }, [cursor]);

    // For month view: all approved events (no time filter) but with category/org/tag filters
    const filteredAll = useMemo(() => {
        return approved
            .filter((e) =>
                query
                    ? `${e.title} ${e.venue} ${e.description}`.toLowerCase().includes(query.toLowerCase())
                    : true,
            )
            .filter((e) => (cat === "All" ? true : e.category === cat))
            .filter((e) => (orgFilter === "All" ? true : e.orgSlug === orgFilter))
            .filter((e) => {
                if (tag === "Free") return e.cost?.toLowerCase().includes("free");
                if (tag === "Family") return e.age?.toLowerCase().includes("family") || e.age?.toLowerCase().includes("all");
                if (tag === "Accessible") return e.accessibility?.toLowerCase().includes("step-free");
                return true;
            });
    }, [approved, query, cat, orgFilter, tag]);

    const eventsByDay = useMemo(() => {
        const map = {};
        filteredAll.forEach((e) => {
            const d = new Date(e.start);
            const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            map[k] ??= [];
            map[k].push(e);
        });
        return map;
    }, [filteredAll]);

    return (
        <div data-testid="events-page" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
                <div>
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Calendar</span>
                    <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight mt-2">
                        What's on in Blackrod
                    </h1>
                    <p className="mt-2 text-muted-foreground text-sm">
                        Filter by category, day or organisation — find your next thing.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-full border border-border bg-surface p-1">
                        <button
                            data-testid="view-list"
                            onClick={() => setView("list")}
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition ${
                                view === "list" ? "bg-foreground text-background" : "text-foreground/70"
                            }`}
                        >
                            <LayoutGrid className="h-3.5 w-3.5" /> List
                        </button>
                        <button
                            data-testid="view-month"
                            onClick={() => setView("month")}
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition ${
                                view === "month" ? "bg-foreground text-background" : "text-foreground/70"
                            }`}
                        >
                            <CalendarDays className="h-3.5 w-3.5" /> Month
                        </button>
                    </div>
                    <button
                        data-testid="sync-calendar"
                        onClick={() => setSubOpen(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-surface text-xs font-semibold uppercase tracking-wider hover:bg-muted"
                    >
                        <Rss className="h-3.5 w-3.5" /> Sync calendar
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="grid md:grid-cols-12 gap-3 mb-8">
                <div className="min-w-0 md:col-span-5 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        data-testid="events-search"
                        placeholder="Search events…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-full border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
                <select
                    data-testid="events-category"
                    value={cat}
                    onChange={(e) => setCat(e.target.value)}
                    className="min-w-0 md:col-span-3 px-4 py-3 rounded-full border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="All">All categories</option>
                    {CATEGORIES.map((c) => (
                        <option key={c}>{c}</option>
                    ))}
                </select>
                <select
                    data-testid="events-org-filter"
                    value={orgFilter}
                    onChange={(e) => setOrgFilter(e.target.value)}
                    className="min-w-0 md:col-span-2 px-4 py-3 rounded-full border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="All">All orgs</option>
                    {orgs.map((o) => (
                        <option key={o.slug} value={o.slug}>
                            {o.name}
                        </option>
                    ))}
                </select>
                <select
                    data-testid="events-tag-filter"
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    className="min-w-0 md:col-span-2 px-4 py-3 rounded-full border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="All">Any tag</option>
                    <option value="Free">Free</option>
                    <option value="Family">Family</option>
                    <option value="Accessible">Accessible</option>
                </select>
            </div>

            {view === "list" ? (
                filtered.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-border p-12 text-center text-muted-foreground">
                        No events match those filters. Try clearing them.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filtered.map((e) => (
                            <EventCard key={e.id} event={e} orgName={orgName(e.orgSlug)} />
                        ))}
                    </div>
                )
            ) : (
                <div data-testid="events-month-view" className="rounded-3xl border border-border bg-surface p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                        <button
                            data-testid="month-prev"
                            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
                            className="h-9 w-9 grid place-items-center rounded-full border border-border"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <h2 className="font-display font-bold text-xl">
                            {cursor.toLocaleString("en-GB", { month: "long", year: "numeric" })}
                        </h2>
                        <button
                            data-testid="month-next"
                            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
                            className="h-9 w-9 grid place-items-center rounded-full border border-border"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 sm:gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                            <div key={d} className="text-center">
                                {d[0]}<span className="hidden sm:inline">{d.slice(1)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1 sm:gap-2">
                        {monthDays.map((d, idx) => {
                            if (!d)
                                return (
                                    <div
                                        key={idx}
                                        className="aspect-square sm:aspect-auto sm:h-28 rounded-xl sm:rounded-2xl bg-transparent"
                                    />
                                );
                            const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                            const ev = eventsByDay[k] || [];
                            const isToday = d.toDateString() === new Date().toDateString();
                            const isSelected = d.toDateString() === selectedDay;
                            return (
                                <button
                                    key={idx}
                                    data-testid={`month-day-${d.getDate()}`}
                                    onClick={() => setSelectedDay(d.toDateString())}
                                    className={`aspect-square sm:aspect-auto sm:h-28 rounded-xl sm:rounded-2xl border p-1.5 sm:p-2 flex flex-col overflow-hidden text-left transition ${
                                        isSelected
                                            ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                                            : isToday
                                            ? "border-primary bg-primary/5"
                                            : "border-border bg-background hover:border-primary/40"
                                    }`}
                                >
                                    <div className="text-xs sm:text-xs font-bold flex items-center justify-between">
                                        <span>{d.getDate()}</span>
                                        {ev.length > 0 && (
                                            <span className="sm:hidden text-[9px] font-bold text-primary">
                                                {ev.length}
                                            </span>
                                        )}
                                    </div>
                                    {/* Mobile: dots. Desktop: chips */}
                                    <div className="sm:hidden mt-auto flex flex-wrap gap-0.5 justify-center pb-0.5">
                                        {ev.slice(0, 3).map((e) => (
                                            <span
                                                key={e.id}
                                                className="h-1.5 w-1.5 rounded-full bg-primary"
                                            />
                                        ))}
                                    </div>
                                    <div className="hidden sm:flex flex-col gap-1 overflow-hidden mt-1">
                                        {ev.slice(0, 2).map((e) => (
                                            <Link
                                                key={e.id}
                                                to={`/events/${e.id}`}
                                                onClick={(evt) => evt.stopPropagation()}
                                                className="truncate text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                                                title={e.title}
                                            >
                                                {e.title}
                                            </Link>
                                        ))}
                                        {ev.length > 2 && (
                                            <span className="text-[10px] text-muted-foreground px-1.5">
                                                +{ev.length - 2} more
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Selected-day agenda (great on mobile, useful on desktop too) */}
                    <div
                        data-testid="month-day-agenda"
                        className="mt-5 sm:mt-6 rounded-2xl border border-border bg-background p-4 sm:p-5"
                    >
                        <h3 className="font-display font-bold text-base sm:text-lg">
                            {new Date(selectedDay).toLocaleDateString("en-GB", {
                                weekday: "long",
                                day: "numeric",
                                month: "long",
                            })}
                        </h3>
                        {(() => {
                            const d = new Date(selectedDay);
                            const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                            const dayEvents = eventsByDay[k] || [];
                            if (dayEvents.length === 0) {
                                return (
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        Nothing scheduled on this day.
                                    </p>
                                );
                            }
                            return (
                                <ul className="mt-3 space-y-2">
                                    {dayEvents.map((e) => (
                                        <li key={e.id}>
                                            <Link
                                                to={`/events/${e.id}`}
                                                data-testid={`agenda-${e.id}`}
                                                className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-surface hover:border-primary/40 transition"
                                            >
                                                <div className="text-xs font-bold text-primary min-w-14">
                                                    {formatTime(e.start)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-semibold text-sm truncate">
                                                        {e.title}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground truncate">
                                                        {e.venue}
                                                    </div>
                                                </div>
                                                <CategoryBadge category={e.category} />
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            );
                        })()}
                    </div>
                </div>
            )}
            
            {/* NEWSLETTER */}
            <NewsletterSection />
            <SubscribeCalendarDialog
                open={subOpen}
                onClose={() => setSubOpen(false)}
                allCategories={CATEGORIES}
                onDownloadIcs={() => {
                    downloadICS(filtered.length ? filtered : filteredAll, "blackrod-now.ics");
                    toast.success("Downloaded blackrod-now.ics");
                }}
            />
        </div>
    );
}
