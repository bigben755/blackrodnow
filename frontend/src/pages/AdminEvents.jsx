import React, { useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { formatDate, CategoryBadge } from "@/components/Cards";
import { CalendarDays, ChevronLeft, AlertTriangle, Download, ChevronRight } from "lucide-react";
import FacebookPublishingPanel from "@/components/admin/FacebookPublishingPanel";

const PAGE_SIZE_OPTIONS = [25, 50, 100];

function exportCsv(rows, orgNameBySlug) {
    const cols = ["title", "org", "date", "category", "venue", "status", "issues"];
    const lines = [
        cols.join(","),
        ...rows.map((ev) => {
            const issues = [
                !ev._hasVenue ? "missing_venue" : "",
                !ev._hasTime ? "missing_time" : "",
                !ev._hasImage ? "missing_image" : "",
                ev._isDuplicate ? "possible_duplicate" : "",
            ].filter(Boolean).join(" ");
            return [
                JSON.stringify(ev.title || ""),
                JSON.stringify(orgNameBySlug[ev.orgSlug] || ev.orgSlug || ""),
                JSON.stringify((ev.start || "").slice(0, 10)),
                JSON.stringify(ev.category || ""),
                JSON.stringify(ev.venue || ""),
                JSON.stringify(ev.status || "pending"),
                JSON.stringify(issues),
            ].join(",");
        }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `blackrod-events-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function parseDateSafe(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function normTitle(value) {
    return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export default function AdminEvents() {
    const { events, orgs, venues } = useApp();

    const [statusFilter, setStatusFilter] = useState("all");
    const [orgFilter, setOrgFilter] = useState("all");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [venueFilter, setVenueFilter] = useState("all");
    const [dateFilter, setDateFilter] = useState("");
    const [needsFilter, setNeedsFilter] = useState("all");
    const [search, setSearch] = useState("");

    const orgNameBySlug = useMemo(
        () => Object.fromEntries((orgs || []).map((o) => [o.slug, o.name || o.slug])),
        [orgs],
    );

    const duplicateKeyCounts = useMemo(() => {
        const map = new Map();
        (events || []).forEach((ev) => {
            const key = `${normTitle(ev.title)}|${(ev.start || "").slice(0, 10)}`;
            if (!normTitle(ev.title) || !(ev.start || "").slice(0, 10)) return;
            map.set(key, (map.get(key) || 0) + 1);
        });
        return map;
    }, [events]);

    const derived = useMemo(() => {
        const now = new Date();
        return (events || [])
            .filter((ev) => !ev.is_recurrence_instance)
            .map((ev) => {
            const start = parseDateSafe(ev.start);
            const end = parseDateSafe(ev.end) || start;
            const hasVenue = Boolean((ev.venue || "").trim());
            const hasImage = Boolean((ev.image || "").trim());
            const hasTime = Boolean(start && !(start.getHours() === 0 && start.getMinutes() === 0 && start.getSeconds() === 0));
            const duplicateKey = `${normTitle(ev.title)}|${(ev.start || "").slice(0, 10)}`;
            const isDuplicate = (duplicateKeyCounts.get(duplicateKey) || 0) > 1;
            const isPast = Boolean(end && end < now);
            const isUpcoming = Boolean(end && end >= now);
            const status = ev.status || "pending";
            const stillPublishedPast = status === "approved" && isPast;
            return {
                ...ev,
                _start: start,
                _end: end,
                _hasVenue: hasVenue,
                _hasImage: hasImage,
                _hasTime: hasTime,
                _isDuplicate: isDuplicate,
                _isPast: isPast,
                _isUpcoming: isUpcoming,
                _stillPublishedPast: stillPublishedPast,
            };
        });
    }, [events, duplicateKeyCounts]);

    const attentionCounts = useMemo(() => {
        const counts = {
            missingVenue: 0,
            missingTime: 0,
            missingImage: 0,
            duplicates: 0,
            pastPublished: 0,
        };
        const duplicateSeen = new Set();
        derived.forEach((ev) => {
            if (!ev._hasVenue) counts.missingVenue += 1;
            if (!ev._hasTime) counts.missingTime += 1;
            if (!ev._hasImage) counts.missingImage += 1;
            if (ev._isDuplicate) {
                const key = `${normTitle(ev.title)}|${(ev.start || "").slice(0, 10)}`;
                if (!duplicateSeen.has(key)) {
                    duplicateSeen.add(key);
                    counts.duplicates += 1;
                }
            }
            if (ev._stillPublishedPast) counts.pastPublished += 1;
        });
        return counts;
    }, [derived]);

    const filtered = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return derived.filter((ev) => {
            if (statusFilter !== "all") {
                if (statusFilter === "upcoming" && !ev._isUpcoming) return false;
                else if (statusFilter === "past" && !ev._isPast) return false;
                else if (!["upcoming", "past"].includes(statusFilter) && (ev.status || "pending") !== statusFilter) return false;
            }
            if (orgFilter !== "all" && ev.orgSlug !== orgFilter) return false;
            if (categoryFilter !== "all" && (ev.category || "") !== categoryFilter) return false;
            if (venueFilter !== "all" && (ev.venue || "") !== venueFilter) return false;
            if (dateFilter && (ev.start || "").slice(0, 10) !== dateFilter) return false;
            if (needsFilter !== "all") {
                if (needsFilter === "missing_venue" && ev._hasVenue) return false;
                if (needsFilter === "missing_time" && ev._hasTime) return false;
                if (needsFilter === "missing_image" && ev._hasImage) return false;
                if (needsFilter === "duplicates" && !ev._isDuplicate) return false;
                if (needsFilter === "past_published" && !ev._stillPublishedPast) return false;
            }
            if (needle) {
                const hay = [
                    ev.title,
                    ev.description,
                    ev.venue,
                    ev.address,
                    ev.orgSlug,
                    orgNameBySlug[ev.orgSlug] || "",
                    ev.category,
                ].filter(Boolean).join(" ").toLowerCase();
                if (!hay.includes(needle)) return false;
            }
            return true;
        }).sort((a, b) => (a.start || "").localeCompare(b.start || ""));
    }, [
        derived,
        statusFilter,
        orgFilter,
        categoryFilter,
        venueFilter,
        dateFilter,
        needsFilter,
        search,
        orgNameBySlug,
    ]);

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const paginated = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, page, pageSize]);
    // Reset to first page whenever filter changes.
    React.useEffect(() => { setPage(1); }, [statusFilter, orgFilter, categoryFilter, venueFilter, dateFilter, needsFilter, search]);

    const handleExport = useCallback(() => exportCsv(filtered, orgNameBySlug), [filtered, orgNameBySlug]);

    const categories = useMemo(() => [...new Set((events || []).map((e) => e.category).filter(Boolean))].sort(), [events]);
    const venuesList = useMemo(() => {
        const fromEvents = (events || []).map((e) => e.venue).filter(Boolean);
        const fromVenueRecords = (venues || []).map((v) => v.name).filter(Boolean);
        return [...new Set([...fromEvents, ...fromVenueRecords])].sort();
    }, [events, venues]);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" data-testid="admin-events-page">
            <div className="flex items-end justify-between gap-4 mb-6">
                <div>
                    <Link to="/admin" className="inline-flex items-center gap-1 text-xs uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground">
                        <ChevronLeft className="h-3.5 w-3.5" /> Back to admin
                    </Link>
                    <h1 className="font-display font-black text-4xl tracking-tight mt-2 inline-flex items-center gap-2">
                        <CalendarDays className="h-8 w-8 text-primary" /> Global event management
                    </h1>
                    <p className="text-sm text-muted-foreground mt-2">Filter all events, find issues fast, and keep the directory healthy.</p>
                </div>
                <Link to="/admin" className="inline-flex px-4 py-2 rounded-full border border-border text-xs font-semibold">Open dashboard</Link>
            </div>

            <FacebookPublishingPanel />

            <section className="rounded-3xl border border-border bg-surface p-5 mb-6">
                <h2 className="font-display font-bold text-xl inline-flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600" /> Events needing attention
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <button type="button" onClick={() => setNeedsFilter("missing_venue")} className="rounded-2xl border border-border bg-background p-3 text-left">
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">Missing venue</div>
                        <div className="text-2xl font-display font-bold">{attentionCounts.missingVenue}</div>
                    </button>
                    <button type="button" onClick={() => setNeedsFilter("missing_time")} className="rounded-2xl border border-border bg-background p-3 text-left">
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">Missing time</div>
                        <div className="text-2xl font-display font-bold">{attentionCounts.missingTime}</div>
                    </button>
                    <button type="button" onClick={() => setNeedsFilter("missing_image")} className="rounded-2xl border border-border bg-background p-3 text-left">
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">Missing image</div>
                        <div className="text-2xl font-display font-bold">{attentionCounts.missingImage}</div>
                    </button>
                    <button type="button" onClick={() => setNeedsFilter("duplicates")} className="rounded-2xl border border-border bg-background p-3 text-left">
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">Possible duplicate</div>
                        <div className="text-2xl font-display font-bold">{attentionCounts.duplicates}</div>
                    </button>
                    <button type="button" onClick={() => setNeedsFilter("past_published")} className="rounded-2xl border border-border bg-background p-3 text-left">
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">Past but published</div>
                        <div className="text-2xl font-display font-bold">{attentionCounts.pastPublished}</div>
                    </button>
                </div>
                <div className="mt-3">
                    <button type="button" onClick={() => setNeedsFilter("all")} className="text-xs font-semibold text-primary hover:underline">Clear attention filter</button>
                </div>
            </section>

            <section className="rounded-3xl border border-border bg-surface p-5">
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events, venue, org..." className="px-3 py-2 rounded-2xl border border-border bg-background text-sm" />
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-2xl border border-border bg-background text-sm">
                        <option value="all">All statuses</option>
                        <option value="upcoming">Upcoming</option>
                        <option value="past">Past</option>
                        <option value="draft">Draft</option>
                        <option value="pending">Pending</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                    <select value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)} className="px-3 py-2 rounded-2xl border border-border bg-background text-sm">
                        <option value="all">All organisations</option>
                        {orgs.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
                    </select>
                    <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3 py-2 rounded-2xl border border-border bg-background text-sm">
                        <option value="all">All categories</option>
                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={venueFilter} onChange={(e) => setVenueFilter(e.target.value)} className="px-3 py-2 rounded-2xl border border-border bg-background text-sm">
                        <option value="all">All venues</option>
                        {venuesList.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="px-3 py-2 rounded-2xl border border-border bg-background text-sm" />
                    <select value={needsFilter} onChange={(e) => setNeedsFilter(e.target.value)} className="px-3 py-2 rounded-2xl border border-border bg-background text-sm">
                        <option value="all">No issue filter</option>
                        <option value="missing_venue">Missing venue</option>
                        <option value="missing_time">Missing time</option>
                        <option value="missing_image">Missing image</option>
                        <option value="duplicates">Possible duplicates</option>
                        <option value="past_published">Date passed but published</option>
                    </select>
                    <button type="button" onClick={() => { setSearch(""); setStatusFilter("all"); setOrgFilter("all"); setCategoryFilter("all"); setVenueFilter("all"); setDateFilter(""); setNeedsFilter("all"); }} className="px-3 py-2 rounded-2xl border border-border text-sm font-semibold">Clear filters</button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <span className="text-xs text-muted-foreground" data-testid="admin-events-count">Showing {filtered.length} of {derived.length} events{filtered.length !== paginated.length ? ` · page ${page} of ${totalPages}` : ""}</span>
                    <div className="flex items-center gap-2">
                        <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="px-2 py-1 rounded-xl border border-border bg-background text-xs" data-testid="admin-events-page-size">
                            {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>Show {n}</option>)}
                        </select>
                        <button type="button" onClick={handleExport} data-testid="admin-events-export" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-semibold">
                            <Download className="h-3.5 w-3.5" /> Export CSV
                        </button>
                    </div>
                </div>

                <div className="rounded-2xl border border-border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted sticky top-0 z-10 text-xs uppercase tracking-wider text-muted-foreground">
                                <tr>
                                    <th className="px-3 py-2 text-left">Event</th>
                                    <th className="px-3 py-2 text-left">Org</th>
                                    <th className="px-3 py-2 text-left">Date</th>
                                    <th className="px-3 py-2 text-left">Category</th>
                                    <th className="px-3 py-2 text-left">Venue</th>
                                    <th className="px-3 py-2 text-left">Status</th>
                                    <th className="px-3 py-2 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody data-testid="admin-events-tbody">
                                {paginated.map((ev) => (
                                    <tr key={ev.id} className="border-t border-border">
                                        <td className="px-3 py-2">
                                            <div className="font-semibold">{ev.title || "Untitled"}</div>
                                            <div className="text-[11px] text-muted-foreground mt-0.5">
                                                {!ev._hasVenue ? "Missing venue · " : ""}
                                                {!ev._hasTime ? "Missing time · " : ""}
                                                {!ev._hasImage ? "Missing image · " : ""}
                                                {ev._isDuplicate ? "Possible duplicate" : ""}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-xs text-muted-foreground">{orgNameBySlug[ev.orgSlug] || ev.orgSlug}</td>
                                        <td className="px-3 py-2 text-xs">{formatDate(ev.start)}</td>
                                        <td className="px-3 py-2"><CategoryBadge category={ev.category} /></td>
                                        <td className="px-3 py-2 text-xs text-muted-foreground">{ev.venue || "-"}</td>
                                        <td className="px-3 py-2 text-xs uppercase tracking-wider">{ev.status || "pending"}</td>
                                        <td className="px-3 py-2 text-right">
                                            <Link to={`/edit-event/${ev.id}`} className="inline-flex px-2.5 py-1 rounded-full border border-border text-xs font-semibold">Edit</Link>
                                        </td>
                                    </tr>
                                ))}
                                {paginated.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">No events match these filters.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-1 mt-4" data-testid="admin-events-pagination">
                        <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="h-8 w-8 grid place-items-center rounded-full border border-border disabled:opacity-40">
                            <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                            .reduce((acc, p, idx, arr) => {
                                if (idx > 0 && arr[idx - 1] !== p - 1) acc.push("…");
                                acc.push(p);
                                return acc;
                            }, [])
                            .map((item, idx) =>
                                item === "…" ? (
                                    <span key={`ellipsis-${idx}`} className="px-1 text-xs text-muted-foreground">…</span>
                                ) : (
                                    <button key={item} type="button" onClick={() => setPage(item)}
                                        className={`h-8 w-8 grid place-items-center rounded-full text-xs font-semibold ${
                                            page === item ? "bg-primary text-primary-foreground" : "border border-border"
                                        }`}>
                                        {item}
                                    </button>
                                ),
                            )}
                        <button type="button" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="h-8 w-8 grid place-items-center rounded-full border border-border disabled:opacity-40">
                            <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}
            </section>
        </div>
    );
}
