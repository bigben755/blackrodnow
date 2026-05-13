import React, { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { EventCard, CategoryBadge } from "@/components/Cards";
import { CATEGORIES } from "@/data/mockData";
import { Search, LayoutGrid, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

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
    const [cursor, setCursor] = useState(new Date());

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
            </div>

            {/* Filters */}
            <div className="grid md:grid-cols-12 gap-3 mb-8">
                <div className="md:col-span-5 relative">
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
                    className="md:col-span-3 px-4 py-3 rounded-full border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
                    className="md:col-span-2 px-4 py-3 rounded-full border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
                    className="md:col-span-2 px-4 py-3 rounded-full border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
                    <div className="grid grid-cols-7 gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                            <div key={d} className="text-center">
                                {d}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                        {monthDays.map((d, idx) => {
                            if (!d) return <div key={idx} className="h-24 sm:h-28 rounded-2xl bg-transparent" />;
                            const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                            const ev = eventsByDay[k] || [];
                            const isToday =
                                d.toDateString() === new Date().toDateString();
                            return (
                                <div
                                    key={idx}
                                    className={`h-24 sm:h-28 rounded-2xl border p-2 flex flex-col gap-1 overflow-hidden ${
                                        isToday
                                            ? "border-primary bg-primary/5"
                                            : "border-border bg-background"
                                    }`}
                                >
                                    <div className="text-xs font-bold">{d.getDate()}</div>
                                    <div className="flex flex-col gap-1 overflow-hidden">
                                        {ev.slice(0, 2).map((e) => (
                                            <Link
                                                key={e.id}
                                                to={`/events/${e.id}`}
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
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
