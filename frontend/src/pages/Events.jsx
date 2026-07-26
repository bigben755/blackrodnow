import React, { useEffect, useMemo, useState } from "react";
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
    const { events, orgs, savedEventIds } = useApp();
    const approved = events.filter((e) => e.status === "approved");

    // Rehydrate filters from localStorage on first render (lazy init avoids
    // a race with the write-LS effect on strict-mode double-mount).
    const _initialFilters = React.useMemo(() => {
        if (typeof window === "undefined") return null;
        try {
            const raw = localStorage.getItem("rn-events-filters");
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }, []);

    const [view, setView] = useState(_initialFilters?.view || "list"); // list | month
    const [query, setQuery] = useState(_initialFilters?.query || "");
    const [cat, setCat] = useState(_initialFilters?.cat || "All");
    const [orgFilter, setOrgFilter] = useState(_initialFilters?.orgFilter || "All");
    const [tags, setTags] = useState(Array.isArray(_initialFilters?.tags) ? _initialFilters.tags : []); // multi: Free | Kids | Wheelchair | Hearing | Quiet | StepFree
    const [dateWindow, setDateWindow] = useState(_initialFilters?.dateWindow || "all"); // all | today | tomorrow | weekend | evening
    const [savedOnly, setSavedOnly] = useState(typeof _initialFilters?.savedOnly === "boolean" ? _initialFilters.savedOnly : false);
    const [subOpen, setSubOpen] = useState(false);
    const [cursor, setCursor] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState(new Date().toDateString());

    const orgName = (slug) => orgs.find((o) => o.slug === slug)?.name;

    useEffect(() => {
        localStorage.setItem(
            "rn-events-filters",
            JSON.stringify({ query, cat, orgFilter, tags, view, dateWindow, savedOnly }),
        );
    }, [query, cat, orgFilter, tags, view, dateWindow, savedOnly]);

    const toggleTag = (t) =>
        setTags((current) => (current.includes(t) ? current.filter((v) => v !== t) : [...current, t]));

    const inDateWindow = (eventStart, mode) => {
        if (mode === "all") return true;
        const start = new Date(eventStart);
        const now = new Date();
        const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        if (mode === "today") return start >= dayStart && start <= dayEnd;

        if (mode === "tomorrow") {
            const tStart = new Date(dayStart);
            tStart.setDate(tStart.getDate() + 1);
            const tEnd = new Date(dayEnd);
            tEnd.setDate(tEnd.getDate() + 1);
            return start >= tStart && start <= tEnd;
        }

        if (mode === "weekend") {
            // "This weekend" = the coming Saturday + Sunday (rolling window).
            const day = start.getDay();
            const isWeekend = day === 0 || day === 6;
            if (!isWeekend) return false;
            const nextSunday = new Date(dayStart);
            nextSunday.setDate(nextSunday.getDate() + ((7 - nextSunday.getDay()) % 7));
            nextSunday.setHours(23, 59, 59, 999);
            const nextSaturday = new Date(nextSunday);
            nextSaturday.setDate(nextSaturday.getDate() - 1);
            nextSaturday.setHours(0, 0, 0, 0);
            return start >= nextSaturday && start <= nextSunday;
        }

        if (mode === "evening") {
            return start.getHours() >= 18;
        }

        return true;
    };

    const matchesTags = (e) => {
        if (!tags.length) return true;
        const cost = (e.cost || "").toLowerCase();
        const age = (e.age || "").toLowerCase();
        const acc = (e.accessibility || "").toLowerCase();
        const cat = (e.category || "").toLowerCase();
        return tags.every((t) => {
            if (t === "Free") return cost.includes("free") || cost === "" || cost.includes("£0");
            if (t === "Kids") return (
                age.includes("kids") ||
                age.includes("child") ||
                age.includes("family") ||
                age.includes("all") ||
                cat.includes("family") ||
                cat.includes("kids")
            );
            if (t === "Wheelchair") return acc.includes("wheelchair") || acc.includes("accessible");
            if (t === "Hearing") return acc.includes("hearing loop") || acc.includes("hearing-loop") || acc.includes("hearing");
            if (t === "Quiet") return acc.includes("quiet") || acc.includes("sensory") || acc.includes("low-sensory");
            if (t === "StepFree") return acc.includes("step-free") || acc.includes("step free") || acc.includes("level access");
            return true;
        });
    };

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
            .filter(matchesTags)
                .filter((e) => inDateWindow(e.start, dateWindow))
                .filter((e) => (savedOnly ? savedEventIds.includes(e.id) : true))
            .sort((a, b) => new Date(a.start) - new Date(b.start));
            }, [approved, query, cat, orgFilter, tags, dateWindow, savedOnly, savedEventIds]);

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
            .filter(matchesTags);
    }, [approved, query, cat, orgFilter, tags]);

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

    const hasActiveFilters = Boolean(query.trim()) || cat !== "All" || orgFilter !== "All" || tags.length > 0 || dateWindow !== "all" || savedOnly;

    const clearFilters = () => {
        setQuery("");
        setCat("All");
        setOrgFilter("All");
        setTags([]);
        setDateWindow("all");
        setSavedOnly(false);
        toast.success("Filters cleared");
    };

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
                    className="min-w-0 md:col-span-4 px-4 py-3 rounded-full border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="All">All orgs</option>
                    {orgs.map((o) => (
                        <option key={o.slug} value={o.slug}>
                            {o.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Date chips */}
            <div className="mb-3 flex flex-wrap items-center gap-2" data-testid="date-chip-row">
                {[
                    { key: "all", label: "Any date" },
                    { key: "today", label: "Today" },
                    { key: "tomorrow", label: "Tomorrow" },
                    { key: "weekend", label: "This weekend" },
                    { key: "evening", label: "Evening (after 6pm)" },
                ].map((opt) => (
                    <button
                        key={opt.key}
                        type="button"
                        data-testid={`chip-date-${opt.key}`}
                        onClick={() => setDateWindow(opt.key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${dateWindow === opt.key ? "border-foreground bg-foreground text-background" : "border-border bg-surface hover:bg-muted"}`}
                    >
                        {opt.label}
                    </button>
                ))}
                <button
                    type="button"
                    data-testid="chip-saved-only"
                    onClick={() => setSavedOnly((v) => !v)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${savedOnly ? "border-foreground bg-foreground text-background" : "border-border bg-surface hover:bg-muted"}`}
                >
                    Saved only ({savedEventIds.length})
                </button>
            </div>

            {/* Tag + Accessibility chips */}
            <div className="mb-6 flex flex-wrap items-center gap-2" data-testid="tag-chip-row">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground mr-1">Suitable for</span>
                {[
                    { key: "Free", label: "Free" },
                    { key: "Kids", label: "Kids-friendly" },
                ].map((opt) => (
                    <button
                        key={opt.key}
                        type="button"
                        data-testid={`chip-tag-${opt.key.toLowerCase()}`}
                        onClick={() => toggleTag(opt.key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${tags.includes(opt.key) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-muted"}`}
                    >
                        {opt.label}
                    </button>
                ))}
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground mx-1">Accessibility</span>
                {[
                    { key: "StepFree", label: "Step-free" },
                    { key: "Wheelchair", label: "Wheelchair" },
                    { key: "Hearing", label: "Hearing loop" },
                    { key: "Quiet", label: "Quiet / sensory" },
                ].map((opt) => (
                    <button
                        key={opt.key}
                        type="button"
                        data-testid={`chip-tag-${opt.key.toLowerCase()}`}
                        onClick={() => toggleTag(opt.key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${tags.includes(opt.key) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-muted"}`}
                    >
                        {opt.label}
                    </button>
                ))}
                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={clearFilters}
                        data-testid="clear-filters"
                        className="ml-auto px-3 py-1.5 rounded-full text-xs font-semibold border border-border bg-background hover:bg-muted"
                    >
                        Clear filters
                    </button>
                )}
            </div>

            <p className="mb-6 text-sm text-muted-foreground">
                {view === "list"
                    ? `Showing ${filtered.length} upcoming event${filtered.length === 1 ? "" : "s"}${hasActiveFilters ? " with your filters" : ""}.`
                    : `Showing ${filteredAll.length} event${filteredAll.length === 1 ? "" : "s"} across the calendar.`}
            </p>

            {view === "list" ? (
                filtered.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-border p-12 text-center text-muted-foreground">
                        <p>No events match those filters right now.</p>
                        <div className="mt-4 flex justify-center gap-2 flex-wrap">
                            {hasActiveFilters && (
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="px-4 py-2 rounded-full bg-foreground text-background text-sm font-semibold"
                                >
                                    Clear filters
                                </button>
                            )}
                            <Link
                                to="/submit-event"
                                className="px-4 py-2 rounded-full border border-border text-sm font-semibold"
                            >
                                Suggest an event
                            </Link>
                        </div>
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
