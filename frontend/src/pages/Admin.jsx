import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { Stat, CategoryBadge, formatDate, formatTime } from "@/components/Cards";
import {
    CalendarDays, Building2, Inbox, Users, Star, Check, X, Trash2, BarChart3, Mail,
    Send, Edit3, Eye, MessageSquare, Bell, Pencil, UploadCloud, FileText, Sparkles, RefreshCw, Newspaper, HandHeart,
    LogIn, MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import AdminEmailCompose from "@/components/AdminEmailCompose";

export default function Admin() {
    const {
        events, orgs, stats, refresh,
        setEventStatus, toggleEventFeatured, deleteEvent,
        setOrgStatus, deleteOrg,
        role,
        adminCodeSession,
        impersonateOrg,
    } = useApp();

    const [requests, setRequests] = useState([]);
    const [queueFilter, setQueueFilter] = useState(() => localStorage.getItem("rn-admin-queue-filter") || "all");
    const [query, setQuery] = useState(() => localStorage.getItem("rn-admin-queue-query") || "");
    const [selectedEventIds, setSelectedEventIds] = useState([]);
    const [selectedOrgSlugs, setSelectedOrgSlugs] = useState([]);
    const [selectedRequestIds, setSelectedRequestIds] = useState([]);
    const [activeTarget, setActiveTarget] = useState(null);
    const navigate = useNavigate();

    const loginAsOrg = async (slug, name) => {
        try {
            // Navigate BEFORE flipping role so Admin's RequireRole guard doesn't
            // race-redirect to '/' when it re-renders with role='org'.
            navigate("/organisation-dashboard");
            await impersonateOrg(slug);
            toast.success(`Logged in as ${name}`);
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Impersonation failed. Check admin code.");
        }
    };

    useEffect(() => {
        localStorage.setItem("rn-admin-queue-filter", queueFilter);
    }, [queueFilter]);

    useEffect(() => {
        localStorage.setItem("rn-admin-queue-query", query);
    }, [query]);

    useEffect(() => {
        api.orgEditRequests("pending").then(setRequests).catch(() => setRequests([]));
    }, []);

    const approvedEvents = events.filter((e) => e.status === "approved");
    const pendingEvents = events.filter((e) => e.status === "pending");
    const pendingOrgs = orgs.filter((o) => o.status === "pending");
    const analytics = stats?.analytics || {};
    const siteOverview = analytics.overview || {};
    const siteEngagement = analytics.engagement || {};
    const siteHealth = analytics.health || {};
    const topOrgs = analytics.top_orgs_30d || [];
    const topEvents = analytics.top_events_30d || [];
    const sharePlatforms = analytics.share_platforms_30d || [];

    const normalize = (value) => (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const pendingEventDuplicates = new Map();
    approvedEvents.forEach((event) => {
        pendingEventDuplicates.set(`${normalize(event.title)}|${(event.start || "").slice(0, 10)}`, event);
    });
    const pendingOrgDuplicates = new Map();
    orgs.filter((o) => o.status === "approved").forEach((org) => pendingOrgDuplicates.set(normalize(org.name), org));

    const queryMatches = (value) => normalize(value).includes(normalize(query));
    const matchesFilter = (kind) => queueFilter === "all" || queueFilter === kind || (queueFilter === "duplicates" && kind === "duplicates");

    const visiblePendingEvents = pendingEvents.filter((event) => {
        const dup = pendingEventDuplicates.get(`${normalize(event.title)}|${(event.start || "").slice(0, 10)}`);
        const kind = dup ? "duplicates" : "events";
        return matchesFilter(kind) && (!query || queryMatches(`${event.title} ${event.venue} ${event.category}`));
    });
    const visiblePendingOrgs = pendingOrgs.filter((org) => {
        const dup = pendingOrgDuplicates.get(normalize(org.name));
        const kind = dup ? "duplicates" : "orgs";
        return matchesFilter(kind) && (!query || queryMatches(`${org.name} ${org.short} ${org.category}`));
    });
    const visibleRequests = requests.filter((request) => {
        const kind = request.request_type === "claim" ? "claims" : "requests";
        return matchesFilter(kind) && (!query || queryMatches(`${request.org_name} ${request.contact_name} ${request.message}`));
    });

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
            const key = event.key.toLowerCase();
            if (!["a", "r"].includes(key)) return;
            const target = activeTarget || (
                visiblePendingEvents[0]
                    ? { kind: "event", id: visiblePendingEvents[0].id }
                    : visiblePendingOrgs[0]
                        ? { kind: "org", id: visiblePendingOrgs[0].slug }
                        : visibleRequests[0]
                            ? { kind: "request", id: visibleRequests[0].id }
                            : null
            );
            if (!target) return;
            event.preventDefault();
            if (target.kind === "event") {
                key === "a" ? approveEvent(target.id) : rejectEvent(target.id);
            } else if (target.kind === "org") {
                key === "a" ? approveOrg(target.id) : rejectOrg(target.id);
            } else if (target.kind === "request") {
                key === "a" ? reviewRequest(target.id, "approved") : reviewRequest(target.id, "rejected");
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [activeTarget, visiblePendingEvents, visiblePendingOrgs, visibleRequests]);

    const approveEvent = async (id) => {
        await setEventStatus(id, "approved");
        setSelectedEventIds((current) => current.filter((value) => value !== id));
        toast.success("Event approved");
    };

    const rejectEvent = async (id) => {
        await setEventStatus(id, "rejected");
        setSelectedEventIds((current) => current.filter((value) => value !== id));
        toast.info("Event rejected");
    };

    const approveOrg = async (slug) => {
        await setOrgStatus(slug, "approved");
        setSelectedOrgSlugs((current) => current.filter((value) => value !== slug));
        toast.success("Organisation approved");
    };

    const rejectOrg = async (slug) => {
        await deleteOrg(slug);
        setSelectedOrgSlugs((current) => current.filter((value) => value !== slug));
        toast.info("Organisation rejected");
    };

    const reviewRequest = async (id, status) => {
        await api.reviewOrgEditRequest(id, { status });
        setRequests((current) => current.filter((request) => request.id !== id));
        setSelectedRequestIds((current) => current.filter((value) => value !== id));
        await refresh();
        toast.success(status === "approved" ? "Request approved" : "Request rejected");
    };

    const bulkReview = async (kind, status) => {
        const ids = kind === "event" ? selectedEventIds : kind === "org" ? selectedOrgSlugs : selectedRequestIds;
        if (!ids.length) return;
        await Promise.all(ids.map((id) => {
            if (kind === "event") return setEventStatus(id, status);
            if (kind === "org") return status === "approved" ? setOrgStatus(id, status) : deleteOrg(id);
            return api.reviewOrgEditRequest(id, { status });
        }));
        if (kind === "event") setSelectedEventIds([]);
        if (kind === "org") setSelectedOrgSlugs([]);
        if (kind === "request") setSelectedRequestIds([]);
        toast.success(`${status === "approved" ? "Approved" : "Rejected"} ${ids.length} ${kind}${ids.length === 1 ? "" : "s"}`);
        if (kind === "request") {
            setRequests((current) => current.filter((request) => !ids.includes(request.id)));
            await refresh();
        }
    };

    const resetOrgPassword = async (slug, name) => {
        if (!adminCodeSession) {
            toast.error("Admin session code missing. Re-enter admin code from the top-right menu.");
            return;
        }
        const value = window.prompt(`Set a new password for ${name}. Leave blank to reset to default Organisat10n!&`, "");
        if (value === null) return;
        try {
            await api.adminResetOrgPassword(slug, {
                admin_code: adminCodeSession,
                ...(value.trim() ? { password: value.trim() } : {}),
            });
            toast.success(`Password reset for ${name}`);
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Password reset failed");
        }
    };

    return (
        <div data-testid="admin-page" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-end justify-between gap-3 mb-8">
                <div>
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
                        Admin · {role === "guest" ? "Demo mode" : role}
                    </span>
                    <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight mt-2">
                        Admin dashboard
                    </h1>
                </div>
                <Link to="/" className="hidden sm:inline-flex px-4 py-2 rounded-full border-2 border-foreground font-semibold text-xs">
                    View site
                </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <Stat label="Total events" value={events.length} icon={CalendarDays} tone="primary" />
                <Stat label="Pending events" value={pendingEvents.length} icon={Inbox} />
                <Stat label="Total orgs" value={orgs.length} icon={Building2} />
                <Stat label="Pending orgs" value={pendingOrgs.length} icon={Inbox} />
                <Stat label="Edit requests" value={stats?.org_edit_requests_pending || 0} icon={Sparkles} />
                <Stat label="Unread messages" value={stats?.messages_unread || 0} icon={MessageSquare} />
            </div>

            <section className="mt-8 space-y-4" data-testid="admin-analytics-section">
                <div>
                    <h2 className="font-display font-black text-2xl">Success metrics</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Reach, engagement and content health for the last {analytics.window_days || 30} days.
                    </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <Stat label="Event views" value={siteEngagement.event_views_30d || 0} icon={Eye} tone="primary" />
                    <Stat label="Org views" value={siteEngagement.org_views_30d || 0} icon={BarChart3} />
                    <Stat label="Share clicks" value={siteEngagement.share_clicks_30d || 0} icon={RefreshCw} />
                    <Stat label="Follower links" value={siteOverview.org_follow_links || 0} icon={Users} />
                    <Stat label="Digest subs" value={siteOverview.digest_subscribers || 0} icon={Mail} />
                    <Stat label="Active orgs" value={siteOverview.orgs_with_upcoming_events || 0} icon={HandHeart} />
                </div>

                <div className="grid lg:grid-cols-3 gap-4">
                    <div className="rounded-3xl border border-border bg-surface p-5">
                        <h3 className="font-display font-bold text-lg">Health snapshot</h3>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <MiniMetric label="Upcoming events" value={siteOverview.upcoming_events || 0} />
                            <MiniMetric label="Approved orgs" value={siteOverview.approved_orgs || 0} />
                            <MiniMetric label="Avg event views" value={siteHealth.avg_event_views_30d || 0} />
                            <MiniMetric label="Share rate" value={`${Math.round((siteHealth.share_click_rate || 0) * 100)}%`} />
                            <MiniMetric label="Orgs with upcoming" value={`${Math.round((siteHealth.orgs_with_upcoming_rate || 0) * 100)}%`} />
                            <MiniMetric label="Pending content" value={`${Math.round((siteHealth.pending_content_ratio || 0) * 100)}%`} />
                        </div>
                    </div>

                    <div className="rounded-3xl border border-border bg-surface p-5">
                        <h3 className="font-display font-bold text-lg">Top organisations</h3>
                        {topOrgs.length === 0 ? (
                            <p className="mt-4 text-sm text-muted-foreground">No engagement data yet.</p>
                        ) : (
                            <div className="mt-4 space-y-3">
                                {topOrgs.map((orgItem) => (
                                    <div key={orgItem.slug} className="flex items-start justify-between gap-3 text-sm">
                                        <div>
                                            <Link to={`/organisations/${orgItem.slug}`} className="font-semibold hover:text-primary">{orgItem.name}</Link>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {orgItem.page_views} profile views · {orgItem.event_views} event views · {orgItem.share_clicks} shares
                                            </div>
                                        </div>
                                        <div className="text-right text-xs text-muted-foreground">
                                            <div>{orgItem.followers} followers</div>
                                            <div>{orgItem.upcoming_events} upcoming</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded-3xl border border-border bg-surface p-5">
                        <h3 className="font-display font-bold text-lg">Top events</h3>
                        {topEvents.length === 0 ? (
                            <p className="mt-4 text-sm text-muted-foreground">No event engagement data yet.</p>
                        ) : (
                            <div className="mt-4 space-y-3">
                                {topEvents.map((eventItem) => (
                                    <div key={eventItem.id} className="flex items-start justify-between gap-3 text-sm">
                                        <div>
                                            <Link to={`/events/${eventItem.id}`} className="font-semibold hover:text-primary">{eventItem.title}</Link>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {eventItem.views} views · {eventItem.shares} shares
                                            </div>
                                        </div>
                                        <div className="text-right text-xs text-muted-foreground">{eventItem.org_slug}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-3xl border border-border bg-surface p-5">
                    <h3 className="font-display font-bold text-lg">Share channels</h3>
                    {sharePlatforms.length === 0 ? (
                        <p className="mt-4 text-sm text-muted-foreground">Share data will appear once residents or admins use the share buttons.</p>
                    ) : (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {sharePlatforms.map((item) => (
                                <span key={item.platform} className="px-3 py-2 rounded-full bg-muted text-sm">
                                    {item.platform} · {item.count}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            <section className="mt-8">
                <QuickAddContentCard orgs={orgs} onCreated={refresh} />
            </section>

            <section className="mt-8 rounded-[2rem] border border-border bg-surface p-5 sm:p-6">
                <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
                    <div>
                        <h2 className="font-display font-black text-2xl">Triage queue</h2>
                        <p className="text-sm text-muted-foreground mt-1">Search, filter, bulk-approve and use `a` / `r` on the focused item.</p>
                    </div>
                    <div className="grid sm:grid-cols-[1fr_220px] gap-3 w-full lg:w-auto">
                        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search queue…" className="w-full px-4 py-2.5 rounded-2xl border border-border bg-background text-sm" />
                        <select value={queueFilter} onChange={(e) => setQueueFilter(e.target.value)} className="w-full px-4 py-2.5 rounded-2xl border border-border bg-background text-sm">
                            <option value="all">All items</option>
                            <option value="events">Events</option>
                            <option value="orgs">Organisations</option>
                            <option value="claims">Claim requests</option>
                            <option value="requests">Edit requests</option>
                            <option value="duplicates">Duplicates only</option>
                        </select>
                    </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <span className="px-2.5 py-1 rounded-full bg-muted">Keyboard: `a` approve, `r` reject</span>
                    <span className="px-2.5 py-1 rounded-full bg-muted">Saved filter: {queueFilter}</span>
                    <span className="px-2.5 py-1 rounded-full bg-muted">Search saved locally</span>
                </div>
            </section>

            <section className="mt-10" data-testid="admin-bulk-import-section">
                <BulkDocumentImportCard orgs={orgs} />
            </section>

            <section className="mt-10 grid lg:grid-cols-2 gap-4">
                <BroadcastCard onSent={refresh} />
                <NewsletterCard />
            </section>

            <section className="mt-10">
                <AdminEmailCompose />
            </section>

            <section className="mt-10 grid lg:grid-cols-2 gap-4">
                <AdminInbox onChange={refresh} />
                <NotifyOrgCard orgs={orgs} />
            </section>

            <section className="mt-10">
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <h2 className="font-display font-bold text-xl">Pending events <span className="text-muted-foreground text-base">({visiblePendingEvents.length})</span></h2>
                    {selectedEventIds.length > 0 && (
                        <div className="flex gap-2">
                            <button onClick={() => bulkReview("event", "approved")} className="px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold">Approve selected</button>
                            <button onClick={() => bulkReview("event", "rejected")} className="px-4 py-2 rounded-full border border-foreground text-xs font-semibold">Reject selected</button>
                        </div>
                    )}
                </div>
                {visiblePendingEvents.length === 0 ? (
                    <Empty>No events waiting for approval.</Empty>
                ) : (
                    <div className="grid gap-3">
                        {visiblePendingEvents.map((e) => {
                            const duplicate = approvedEvents.find((approved) => normalize(approved.title) === normalize(e.title) && (approved.start || "").slice(0, 10) === (e.start || "").slice(0, 10));
                            const selected = selectedEventIds.includes(e.id);
                            return (
                                <div key={e.id} data-testid={`admin-event-${e.id}`} onClick={() => setActiveTarget({ kind: "event", id: e.id })}
                                    className={`rounded-3xl border bg-surface p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${selected ? "border-primary ring-1 ring-primary/30" : "border-border"}`}>
                                    <label className="flex items-center gap-2 shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        <input type="checkbox" checked={selected} onChange={(ev) => {
                                            ev.stopPropagation();
                                            setSelectedEventIds((current) => current.includes(e.id) ? current.filter((value) => value !== e.id) : [...current, e.id]);
                                        }} />
                                        Select
                                    </label>
                                    <div className="flex-1">
                                        <CategoryBadge category={e.category} />
                                        <h3 className="font-display font-bold text-lg mt-2">{e.title}</h3>
                                        <p className="text-xs text-muted-foreground mt-1">{formatDate(e.start)} · {formatTime(e.start)} · {e.venue || "No venue yet"}</p>
                                        {duplicate && <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">Possible duplicate: {duplicate.title}</p>}
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                        <Link to={`/edit-event/${e.id}`} data-testid={`admin-edit-event-${e.id}`} className="inline-flex items-center gap-1 px-4 py-2 rounded-full border border-border font-semibold text-xs hover:bg-muted" onClick={(ev) => ev.stopPropagation()}>
                                            <Pencil className="h-3.5 w-3.5" /> Edit
                                        </Link>
                                        <button data-testid={`approve-event-${e.id}`} onClick={(ev) => { ev.stopPropagation(); approveEvent(e.id); }} className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-secondary text-secondary-foreground font-semibold text-xs">
                                            <Check className="h-3.5 w-3.5" /> Approve
                                        </button>
                                        <button data-testid={`reject-event-${e.id}`} onClick={(ev) => { ev.stopPropagation(); rejectEvent(e.id); }} className="inline-flex items-center gap-1 px-4 py-2 rounded-full border-2 border-foreground font-semibold text-xs">
                                            <X className="h-3.5 w-3.5" /> Reject
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className="mt-10">
                <h2 className="font-display font-bold text-xl mb-3">Manage events</h2>
                <div className="rounded-3xl border border-border bg-surface overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                            <tr>
                                <th className="text-left px-4 py-3">Event</th>
                                <th className="text-left px-4 py-3 hidden sm:table-cell">Date</th>
                                <th className="text-left px-4 py-3 hidden md:table-cell">Category</th>
                                <th className="text-right px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {approvedEvents.slice(0, 30).map((e) => (
                                <tr key={e.id} className="border-t border-border">
                                    <td className="px-4 py-3 font-medium"><Link to={`/events/${e.id}`} className="hover:text-primary">{e.title}</Link></td>
                                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{formatDate(e.start)}</td>
                                    <td className="px-4 py-3 hidden md:table-cell"><CategoryBadge category={e.category} /></td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1 justify-end">
                                            <Link to={`/edit-event/${e.id}`} data-testid={`admin-edit-approved-${e.id}`} className="h-8 w-8 grid place-items-center rounded-full bg-muted hover:bg-primary hover:text-primary-foreground" title="Edit event"><Pencil className="h-3.5 w-3.5" /></Link>
                                            <button data-testid={`feature-event-${e.id}`} onClick={async () => { await toggleEventFeatured(e.id); toast.success(e.featured ? "Unfeatured" : "Featured"); }} className={`h-8 w-8 grid place-items-center rounded-full ${e.featured ? "bg-secondary text-secondary-foreground" : "bg-muted"}`} title={e.featured ? "Unfeature" : "Feature on homepage"}><Star className="h-3.5 w-3.5" /></button>
                                            <button data-testid={`delete-event-${e.id}`} onClick={async () => { await deleteEvent(e.id); toast.info("Event deleted"); }} className="h-8 w-8 grid place-items-center rounded-full bg-muted hover:bg-destructive hover:text-destructive-foreground" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="mt-10">
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <h2 className="font-display font-bold text-xl">Pending organisations <span className="text-muted-foreground text-base">({visiblePendingOrgs.length})</span></h2>
                    {selectedOrgSlugs.length > 0 && (
                        <div className="flex gap-2">
                            <button onClick={() => bulkReview("org", "approved")} className="px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold">Approve selected</button>
                            <button onClick={() => bulkReview("org", "rejected")} className="px-4 py-2 rounded-full border border-foreground text-xs font-semibold">Reject selected</button>
                        </div>
                    )}
                </div>
                {visiblePendingOrgs.length === 0 ? (
                    <Empty>No organisations waiting for approval.</Empty>
                ) : (
                    <div className="grid sm:grid-cols-2 gap-3">
                        {visiblePendingOrgs.map((o) => {
                            const duplicate = pendingOrgDuplicates.get(normalize(o.name));
                            const selected = selectedOrgSlugs.includes(o.slug);
                            return (
                                <div key={o.slug} data-testid={`admin-org-${o.slug}`} onClick={() => setActiveTarget({ kind: "org", id: o.slug })} className={`rounded-3xl border bg-surface p-5 ${selected ? "border-primary ring-1 ring-primary/30" : "border-border"}`}>
                                    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        <input type="checkbox" checked={selected} onChange={(ev) => {
                                            ev.stopPropagation();
                                            setSelectedOrgSlugs((current) => current.includes(o.slug) ? current.filter((value) => value !== o.slug) : [...current, o.slug]);
                                        }} />
                                        Select
                                    </label>
                                    <h3 className="font-display font-bold mt-2">{o.name}</h3>
                                    <p className="text-xs text-muted-foreground mt-1">{o.category}</p>
                                    <p className="text-sm mt-2 line-clamp-2">{o.short}</p>
                                    {duplicate && <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">Possible duplicate: {duplicate.name}</p>}
                                    <div className="flex gap-2 mt-3 flex-wrap">
                                        <button data-testid={`approve-org-${o.slug}`} onClick={(ev) => { ev.stopPropagation(); approveOrg(o.slug); }} className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-secondary text-secondary-foreground font-semibold text-xs"><Check className="h-3.5 w-3.5" /> Approve</button>
                                        <button data-testid={`reject-org-${o.slug}`} onClick={(ev) => { ev.stopPropagation(); rejectOrg(o.slug); }} className="inline-flex items-center gap-1 px-4 py-2 rounded-full border-2 border-foreground font-semibold text-xs"><X className="h-3.5 w-3.5" /> Reject</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className="mt-10">
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <h2 className="font-display font-bold text-xl">Claim and edit requests <span className="text-muted-foreground text-base">({visibleRequests.length})</span></h2>
                    {selectedRequestIds.length > 0 && (
                        <div className="flex gap-2">
                            <button onClick={() => bulkReview("request", "approved")} className="px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold">Approve selected</button>
                            <button onClick={() => bulkReview("request", "rejected")} className="px-4 py-2 rounded-full border border-foreground text-xs font-semibold">Reject selected</button>
                        </div>
                    )}
                </div>
                {visibleRequests.length === 0 ? (
                    <Empty>No claim or edit requests waiting.</Empty>
                ) : (
                    <div className="grid gap-3">
                        {visibleRequests.map((request) => {
                            const selected = selectedRequestIds.includes(request.id);
                            return (
                                <div key={request.id} onClick={() => setActiveTarget({ kind: "request", id: request.id })} className={`rounded-3xl border bg-surface p-5 ${selected ? "border-primary ring-1 ring-primary/30" : "border-border"}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                            <input type="checkbox" checked={selected} onChange={(ev) => {
                                                ev.stopPropagation();
                                                setSelectedRequestIds((current) => current.includes(request.id) ? current.filter((value) => value !== request.id) : [...current, request.id]);
                                            }} />
                                            Select
                                        </label>
                                        <span className="px-2.5 py-1 rounded-full bg-muted text-[11px] font-bold uppercase tracking-wider">{request.request_type === "claim" ? "Claim" : "Suggest edit"}</span>
                                    </div>
                                    <h3 className="font-display font-bold text-lg mt-2">{request.org_name}</h3>
                                    <p className="text-sm text-muted-foreground mt-1">{request.contact_name} {request.contact_email ? `· ${request.contact_email}` : ""}</p>
                                    {request.message && <p className="text-sm mt-3">{request.message}</p>}
                                    {request.request_type === "suggest_edit" && Object.keys(request.payload || {}).length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                                            {Object.entries(request.payload).slice(0, 6).map(([key, value]) => (
                                                <span key={key} className="px-2.5 py-1 rounded-full bg-muted">{key}: {typeof value === "string" ? value : "updated"}</span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex gap-2 mt-3 flex-wrap">
                                        <button onClick={(ev) => { ev.stopPropagation(); reviewRequest(request.id, "approved"); }} className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-secondary text-secondary-foreground font-semibold text-xs"><Check className="h-3.5 w-3.5" /> Approve</button>
                                        <button onClick={(ev) => { ev.stopPropagation(); reviewRequest(request.id, "rejected"); }} className="inline-flex items-center gap-1 px-4 py-2 rounded-full border-2 border-foreground font-semibold text-xs"><X className="h-3.5 w-3.5" /> Reject</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className="mt-10">
                <h2 className="font-display font-bold text-xl mb-3">Manage organisations</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {orgs.filter((o) => o.status !== "pending").slice(0, 30).map((o) => (
                        <div key={o.slug} className="min-w-0 rounded-3xl border border-border bg-surface p-4 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-muted grid place-items-center text-xl shrink-0">{o.logo}</div>
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm truncate">{o.name}</div>
                                <div className="text-xs text-muted-foreground truncate">{o.category}</div>
                            </div>
                            <div className="shrink-0 flex items-center gap-1">
                                <button
                                    data-testid={`impersonate-org-${o.slug}`}
                                    onClick={() => loginAsOrg(o.slug, o.name)}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold uppercase tracking-wider"
                                    title={`Log in as ${o.name}`}
                                >
                                    <LogIn className="h-3 w-3" /> Log in as
                                </button>
                                <button
                                    onClick={() => resetOrgPassword(o.slug, o.name)}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-border text-[11px] font-semibold uppercase tracking-wider"
                                    title="Reset organisation password"
                                >
                                    <RefreshCw className="h-3 w-3" /> Reset pwd
                                </button>
                                <Link to={`/edit-organisation/${o.slug}`} data-testid={`edit-org-${o.slug}`} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-border text-[11px] font-semibold uppercase tracking-wider"><Edit3 className="h-3 w-3" /> Edit</Link>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}

const Empty = ({ children }) => (
    <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        {children}
    </div>
);

const MiniMetric = ({ label, value }) => (
    <div className="rounded-2xl bg-muted/50 px-3 py-3">
        <div className="text-lg font-display font-bold">{value}</div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
    </div>
);

const ACTION_LABELS = {
    new_event: "New event",
    update_event: "Update event",
    new_volunteer: "New volunteering",
    update_volunteer: "Update volunteering",
    new_organisation: "New organisation",
    update_organisation: "Update organisation",
    new_venue: "New venue",
    update_venue: "Update venue",
    unclear: "Needs review",
};

const DESTINATION_LABELS = {
    events: "Events",
    organisations: "Organisations",
    local_feed: "Local feed",
    volunteering: "Volunteering",
    venues: "Venues",
};

const inp = "w-full px-3 py-2 rounded-2xl border border-border bg-background text-sm";
const LOW_CONFIDENCE_THRESHOLD = 0.75;

const Field = ({ label, children }) => (
    <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="mt-1">{children}</div>
    </label>
);

function BulkDocumentImportCard({ orgs }) {
    const [files, setFiles] = useState([]);
    const [linkSources, setLinkSources] = useState("");
    const [textSources, setTextSources] = useState("");
    const [sourceOrgSlug, setSourceOrgSlug] = useState("");
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);
    const [reviewDocs, setReviewDocs] = useState([]);
    const [confirmPost, setConfirmPost] = useState(null);
    const [selectedReviewIds, setSelectedReviewIds] = useState([]);
    const [batchReport, setBatchReport] = useState(null);
    const [reviewStatusFilter, setReviewStatusFilter] = useState("all");
    const [reviewOwnerFilter, setReviewOwnerFilter] = useState("all");
    const REVIEWER_NAME = "Admin";

    const isUpdateAction = (action) => ["update_event", "update_volunteer", "update_organisation", "update_venue"].includes(action);

    const inferDestination = (draft) => {
        const manual = (draft.publish_target || "").toLowerCase();
        if (["events", "organisations", "local_feed", "volunteering", "venues"].includes(manual)) {
            return manual;
        }

        const isVolunteerAction = ["new_volunteer", "update_volunteer"].includes(draft.action) || draft.suggested_type === "volunteer";
        const isOrgAction = ["new_organisation", "update_organisation"].includes(draft.action) || draft.suggested_type === "organisation";
        const isVenueAction = ["new_venue", "update_venue"].includes(draft.action) || draft.suggested_type === "venue";
        const isEventAction = ["new_event", "update_event"].includes(draft.action) || (!isVolunteerAction && !isOrgAction && draft.suggested_type === "event");
        if (isEventAction) return "events";
        if (isOrgAction) return "organisations";
        if (isVolunteerAction) return "volunteering";
        if (isVenueAction) return "venues";

        const title = (draft.title || "").toLowerCase();
        const description = (draft.description || "").toLowerCase();
        const merged = `${title} ${description}`;
        const looksLikePublicUpdate = /\b(consultation|survey|consult|announcement|update|notice|news|community update|public meeting)\b/.test(merged);
        const looksLikeVenue = /\b(venue|hall|community centre|community center|sports centre|sports center|facility|facilities|room hire|booking)\b/.test(merged);

        if (looksLikeVenue) {
            return "venues";
        }

        if (draft.suggested_type === "update" && (!draft.matched_org_slug || looksLikePublicUpdate)) {
            return "local_feed";
        }
        if (looksLikePublicUpdate && !draft.date) {
            return "local_feed";
        }
        return "organisations";
    };

    const destinationLabel = (draft) => DESTINATION_LABELS[inferDestination(draft)] || DESTINATION_LABELS.organisations;

    const detectFeedType = (draft) => {
        const text = `${draft.title || ""} ${draft.description || ""}`.toLowerCase();
        if (/\b(news|press release|breaking)\b/.test(text)) return "news";
        if (/\b(consultation|survey|deadline|important|alert|warning|notice|road closure)\b/.test(text)) return "announcement";
        return "update";
    };

    const extractFirstUrl = (draft, doc) => {
        const text = [
            draft.description || "",
            draft.title || "",
            doc?.text_excerpt || "",
            ...(doc?.warnings || []),
        ].join("\n");
        const qrMatch = text.match(/QR\s*code\s*link:\s*(https?:\/\/[^\s)]+)/i);
        if (qrMatch?.[1]) return qrMatch[1].replace(/[.,;!?]+$/, "");
        const m = text.match(/https?:\/\/[^\s)]+/i);
        return m ? m[0].replace(/[.,;!?]+$/, "") : "";
    };

    const normalizeDocs = (documents) =>
        documents.map((doc, docIndex) => ({
            ...doc,
            items: (doc.items || []).map((item, itemIndex) => ({
                ...item,
                reviewId: `${docIndex}-${itemIndex}`,
                isEditing: false,
                draft: {
                    ...item,
                    review_status: item.review_status || "open",
                    review_owner: item.review_owner || "",
                },
            })),
        }));

    const setItemMeta = (reviewId, patch) => {
        setReviewDocs((current) =>
            current.map((doc) => ({
                ...doc,
                items: doc.items.map((item) =>
                    item.reviewId === reviewId
                        ? { ...item, draft: { ...(item.draft || item), ...patch } }
                        : item,
                ),
            })),
        );
    };

    const bulkPatchSelected = (patch) => {
        if (!selectedReviewIds.length) return;
        selectedReviewIds.forEach((id) => setItemMeta(id, patch));
        toast.success(`Updated ${selectedReviewIds.length} selected item${selectedReviewIds.length === 1 ? "" : "s"}`);
    };

    const visibleReviewDocs = reviewDocs
        .map((doc) => ({
            ...doc,
            items: (doc.items || []).filter((item) => {
                const draft = item.draft || item;
                const status = draft.review_status || "open";
                const owner = draft.review_owner || "";
                const statusOk = reviewStatusFilter === "all" || status === reviewStatusFilter;
                const ownerOk = reviewOwnerFilter === "all"
                    || (reviewOwnerFilter === "assigned" && Boolean(owner))
                    || (reviewOwnerFilter === "unassigned" && !owner)
                    || (reviewOwnerFilter === "mine" && owner === REVIEWER_NAME);
                return statusOk && ownerOk;
            }),
        }))
        .filter((doc) => doc.items.length > 0);

    const updateItem = (filename, reviewId, patch) => {
        setReviewDocs((current) =>
            current.map((doc) => {
                if (doc.filename !== filename) return doc;
                return {
                    ...doc,
                    items: doc.items.map((item) =>
                        item.reviewId === reviewId
                            ? { ...item, draft: { ...item.draft, ...patch } }
                            : item,
                    ),
                };
            }),
        );
    };

    const toggleSelectedItem = (reviewId) => {
        setSelectedReviewIds((current) =>
            current.includes(reviewId)
                ? current.filter((id) => id !== reviewId)
                : [...current, reviewId],
        );
    };

    const toggleEdit = (filename, reviewId) => {
        setReviewDocs((current) =>
            current.map((doc) => {
                if (doc.filename !== filename) return doc;
                return {
                    ...doc,
                    items: doc.items.map((item) =>
                        item.reviewId === reviewId
                            ? { ...item, isEditing: !item.isEditing }
                            : item,
                    ),
                };
            }),
        );
    };

    const removeItemFromDocs = (docs, filename, reviewId) =>
        docs
            .map((doc) =>
                doc.filename !== filename
                    ? doc
                    : { ...doc, items: doc.items.filter((item) => item.reviewId !== reviewId) },
            )
            .filter((doc) => doc.items.length > 0);

    const deleteItem = (filename, reviewId) => {
        setReviewDocs((current) => removeItemFromDocs(current, filename, reviewId));
        setSelectedReviewIds((current) => current.filter((id) => id !== reviewId));
    };

    const deleteItemWithUndo = (doc, item) => {
        const snapshot = {
            filename: doc.filename,
            source_type: doc.source_type,
            text_excerpt: doc.text_excerpt,
            warnings: doc.warnings,
            item,
            index: doc.items.findIndex((it) => it.reviewId === item.reviewId),
        };
        deleteItem(doc.filename, item.reviewId);
        toast("Item removed from review", {
            action: {
                label: "Undo",
                onClick: () => {
                    setReviewDocs((current) => {
                        const existing = current.find((d) => d.filename === snapshot.filename);
                        if (existing) {
                            return current.map((d) => {
                                if (d.filename !== snapshot.filename) return d;
                                if (d.items.some((it) => it.reviewId === snapshot.item.reviewId)) return d;
                                const items = [...d.items];
                                const idx = Math.max(0, Math.min(snapshot.index, items.length));
                                items.splice(idx, 0, snapshot.item);
                                return { ...d, items };
                            });
                        }
                        return [...current, {
                            filename: snapshot.filename,
                            source_type: snapshot.source_type,
                            text_excerpt: snapshot.text_excerpt,
                            warnings: snapshot.warnings,
                            items: [snapshot.item],
                        }];
                    });
                },
            },
        });
    };

    const parseDateTime = (date, startTime, endTime) => {
        if (!date) return null;
        const start = new Date(`${date}T${startTime || "10:00"}`);
        const end = new Date(`${date}T${endTime || startTime || "11:00"}`);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
        return { start: start.toISOString(), end: end.toISOString() };
    };

    const validateItem = (doc, item) => {
        const draft = item.draft || item;
        const destination = inferDestination(draft);
        const errors = [];
        const orgSlug = draft.matched_org_slug || sourceOrgSlug || orgs[0]?.slug;

        if (!draft.title) errors.push("Missing title");

        if (destination === "events") {
            if (!draft.date) errors.push("Missing event date");
            if (!draft.start_time) errors.push("Missing event start time");
            if (!orgSlug) errors.push("Missing source organisation");
            if (draft.action === "update_event" && !draft.matched_event_id) errors.push("Update event has no matched event ID");
        }

        if (destination === "volunteering") {
            if (!orgSlug) errors.push("Missing source organisation");
            if (!draft.description) errors.push("Missing volunteering description");
            if (draft.action === "update_volunteer" && !draft.matched_volunteer_id) errors.push("Update volunteering has no matched volunteering ID");
        }

        if (destination === "local_feed") {
            if (!orgSlug) errors.push("Missing source organisation");
            if (!draft.description && !draft.title) errors.push("Missing feed content");
        }

        if (destination === "organisations") {
            if (!draft.description) errors.push("Missing organisation summary/description");
            if (draft.action === "update_organisation" && !draft.matched_org_slug) errors.push("Update organisation has no matched organisation slug");
        }

        if (destination === "venues") {
            if (draft.action === "update_venue" && !draft.matched_venue_id) errors.push("Update venue has no matched venue ID");
        }

        return { destination, errors };
    };

    const flattenReviewItems = () =>
        reviewDocs.flatMap((doc) => (doc.items || []).map((item) => ({ doc, item })));

    const runDryValidation = (scope = "all") => {
        const pool = flattenReviewItems();
        const targets = scope === "selected"
            ? pool.filter(({ item }) => selectedReviewIds.includes(item.reviewId))
            : pool;
        const rows = targets.map(({ doc, item }) => {
            const result = validateItem(doc, item);
            return {
                reviewId: item.reviewId,
                filename: doc.filename,
                title: (item.draft || item).title || "Untitled",
                destination: result.destination,
                errors: result.errors,
            };
        });
        const valid = rows.filter((row) => row.errors.length === 0);
        const invalid = rows.filter((row) => row.errors.length > 0);
        const report = {
            scope,
            total: rows.length,
            valid: valid.length,
            invalid: invalid.length,
            invalidRows: invalid,
        };
        setBatchReport(report);
        if (invalid.length === 0) {
            toast.success(`Validation passed: ${valid.length}/${rows.length} ready to publish`);
        } else {
            toast.warning(`Validation found ${invalid.length} issue${invalid.length === 1 ? "" : "s"}`);
        }
        return { report, validRows: valid };
    };

    const publishBatch = async (scope = "all") => {
        const { report, validRows } = runDryValidation(scope);
        if (!report.total) {
            toast.error(scope === "selected" ? "Select items first" : "No parsed items to publish");
            return;
        }
        if (!validRows.length) {
            toast.error("No valid items to publish");
            return;
        }

        let successCount = 0;
        for (const row of validRows) {
            const pair = flattenReviewItems().find(({ item }) => item.reviewId === row.reviewId);
            if (!pair) continue;
            try {
                // postItem removes the item from the review list on success.
                // Keep item-level success toasts for transparency during batch operations.
                // eslint-disable-next-line no-await-in-loop
                await postItem(pair.doc, pair.item);
                successCount += 1;
            } catch {
                // postItem already surfaces the error toast.
            }
        }
        toast.success(`Batch publish complete: ${successCount}/${validRows.length} posted`);
        await refresh();
    };

    const postItem = async (doc, item) => {
        const draft = item.draft || item;
        try {
            const destination = inferDestination(draft);

            if (destination === "events") {
                const timing = parseDateTime(draft.date, draft.start_time, draft.end_time);
                if (!timing) {
                    toast.error("Add a date and time before posting this event");
                    return false;
                }
                const orgSlug = draft.matched_org_slug || sourceOrgSlug || orgs[0]?.slug;
                if (!orgSlug) {
                    toast.error("Pick a source organisation first");
                    return false;
                }
                const payload = {
                    title: draft.title,
                    orgSlug,
                    category: draft.category || "Community",
                    start: timing.start,
                    end: timing.end,
                    venue: draft.location || "",
                    address: draft.location || "",
                    description: draft.description || draft.title,
                    cost: "Free",
                    age: "",
                    accessibility: "",
                    booking: "",
                    contactEmail: "",
                    contactPhone: "",
                    image: "",
                    status: "approved",
                };
                if (draft.action === "update_event" && draft.matched_event_id) {
                    await api.updateEvent(draft.matched_event_id, payload);
                } else {
                    await api.createEvent(payload);
                }
            } else if (destination === "volunteering") {
                const orgSlug = draft.matched_org_slug || sourceOrgSlug || orgs[0]?.slug;
                if (!orgSlug) {
                    toast.error("Pick a source organisation first");
                    return false;
                }
                const volunteerPayload = {
                    title: draft.title,
                    orgSlug,
                    description: draft.description || draft.title,
                    age: draft.category === "Youth" ? "Youth" : "",
                    time: [draft.date, draft.start_time].filter(Boolean).join(" ").trim(),
                    skills: "",
                };
                if (draft.action === "update_volunteer" && draft.matched_volunteer_id) {
                    await api.updateVolunteer(draft.matched_volunteer_id, volunteerPayload);
                } else {
                    await api.createVolunteer(volunteerPayload);
                }
            } else if (destination === "local_feed") {
                const orgSlug = draft.matched_org_slug || sourceOrgSlug || orgs[0]?.slug;
                if (!orgSlug) {
                    toast.error("Pick a source organisation first");
                    return false;
                }
                const feedUrl = extractFirstUrl(draft, doc);
                const body = [
                    draft.description || draft.title,
                    feedUrl ? `More info: ${feedUrl}` : "",
                ].filter(Boolean).join("\n\n");
                await api.createFeedPost({
                    orgSlug,
                    type: detectFeedType(draft),
                    title: draft.title,
                    body,
                    image: "",
                });
            } else if (destination === "venues") {
                const venuePayload = {
                    name: draft.title,
                    address: draft.location || "",
                    facilities: [],
                    accessibility: "",
                    capacity: 0,
                    booking: draft.description || "",
                    image: "",
                };
                if (draft.action === "update_venue" && draft.matched_venue_id) {
                    await api.updateVenue(draft.matched_venue_id, venuePayload);
                } else {
                    await api.createVenue(venuePayload);
                }
            } else {
                const payload = {
                    slug: (draft.matched_org_slug || draft.title || doc.filename)
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/(^-|-$)/g, ""),
                    name: draft.title,
                    category: draft.category || "Community groups",
                    short: draft.description || draft.title,
                    about: draft.description || draft.title,
                    does: draft.description || draft.title,
                    forWho: "",
                    meeting: "",
                    address: draft.location || "",
                    location: "Blackrod",
                    email: "",
                    phone: "",
                    website: "",
                    socials: { facebook: "", instagram: "", tiktok: "", linkedin: "" },
                    brandColor: "#0052FF",
                    logo: "✨",
                    cover: "",
                    status: "approved",
                };
                if (draft.action === "update_organisation" && draft.matched_org_slug) {
                    await api.patchOrg(draft.matched_org_slug, {
                        name: draft.title,
                        short: draft.description || draft.title,
                        about: draft.description || draft.title,
                        does: draft.description || draft.title,
                        address: draft.location || "",
                    });
                    await api.setOrgStatus(draft.matched_org_slug, "approved");
                } else {
                    const created = await api.submitOrg(payload);
                    await api.setOrgStatus(created.slug, "approved");
                }
            }
            toast.success("Posted to the site");
            deleteItem(doc.filename, item.reviewId);
            await refresh();
            return true;
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Couldn't post this item");
            return false;
        }
    };

    const requestPost = (doc, item) => {
        const draft = item.draft || item;
        if (isUpdateAction(draft.action)) {
            setConfirmPost({ doc, item });
            return;
        }
        postItem(doc, item);
    };

    const confirmAndPost = async () => {
        if (!confirmPost) return;
        await postItem(confirmPost.doc, confirmPost.item);
        setConfirmPost(null);
    };

    const onSelectFiles = (event) => {
        setFiles(Array.from(event.target.files || []));
    };

    const clear = () => {
        setFiles([]);
        setLinkSources("");
        setTextSources("");
        setResult(null);
        setReviewDocs([]);
        setSelectedReviewIds([]);
        setBatchReport(null);
    };

    const parse = async () => {
        const links = linkSources
            .split(/\n+/)
            .map((value) => value.trim())
            .filter(Boolean);
        const textBlocks = textSources
            .split(/\n\s*\n+/)
            .map((value) => value.trim())
            .filter(Boolean);
        if (!files.length && !links.length && !textBlocks.length) return toast.error("Add files, links or pasted text first");
        setBusy(true);
        try {
            const res = await api.adminParseDocuments(files, sourceOrgSlug, { links, textBlocks });
            setResult(res);
            setReviewDocs(normalizeDocs(res.documents || []));
            setSelectedReviewIds([]);
            setBatchReport(null);
            toast.success(`Parsed ${res.documents.length} document${res.documents.length !== 1 ? "s" : ""}`);
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Bulk parse failed");
        } finally {
            setBusy(false);
        }
    };

    const hasSources = files.length > 0 || linkSources.trim().length > 0 || textSources.trim().length > 0;

    return (
        <div className="rounded-[2rem] border border-border bg-surface p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-[11px] font-bold uppercase tracking-wider">
                        <Sparkles className="h-3.5 w-3.5" /> Bulk document import
                    </div>
                    <h2 className="font-display font-black text-2xl sm:text-3xl mt-3">Upload documents, links or text and route them to the right place</h2>
                    <p className="text-sm text-muted-foreground mt-2 max-w-3xl">
                        Add PDFs, Word files, spreadsheets, images, Facebook page links or pasted text in one go. The parser will extract text, flag whether each source looks like an event, organisation, local feed update, volunteering opportunity, venue, or an update to something existing, and show the best match for review.
                    </p>
                </div>
                <div className="min-w-full lg:min-w-[280px] space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Optional source organisation hint</label>
                    <select
                        value={sourceOrgSlug}
                        onChange={(e) => setSourceOrgSlug(e.target.value)}
                        className="w-full px-3 py-2 rounded-2xl border border-border bg-background text-sm"
                    >
                        <option value="">No hint</option>
                        {orgs.map((org) => (
                            <option key={org.slug} value={org.slug}>{org.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-3xl border border-dashed border-border p-5 bg-background/60">
                    <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
                            <UploadCloud className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-semibold">Choose one or more files</div>
                            <p className="text-sm text-muted-foreground mt-1">Best results: PDF, DOCX, XLSX, TXT, CSV or image files. Screenshots and flyer scans will be OCR’d before classification.</p>
                        </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold cursor-pointer">
                            <UploadCloud className="h-3.5 w-3.5" /> {busy ? "Parsing…" : "Select files"}
                            <input
                                type="file"
                                multiple
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg,.webp,.bmp,.gif,.tif,.tiff"
                                className="hidden"
                                onChange={onSelectFiles}
                                disabled={busy}
                                data-testid="admin-bulk-file-input"
                            />
                        </label>
                        <button
                            onClick={parse}
                            disabled={busy || !hasSources}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 border-foreground text-xs font-semibold disabled:opacity-60"
                            data-testid="admin-bulk-parse-btn"
                        >
                            {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                            Parse documents
                        </button>
                        <button
                            onClick={clear}
                            disabled={busy && !files.length}
                            className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-muted text-xs font-semibold disabled:opacity-60"
                        >
                            Clear
                        </button>
                    </div>
                    <div className="mt-4 grid gap-3">
                        <Field label="Page links or Facebook URLs, one per line">
                            <textarea
                                value={linkSources}
                                onChange={(e) => setLinkSources(e.target.value)}
                                placeholder="https://www.facebook.com/...\nhttps://example.org/page"
                                rows={4}
                                className={inp}
                            />
                        </Field>
                        <Field label="Pasted text, one source per blank-line block">
                            <textarea
                                value={textSources}
                                onChange={(e) => setTextSources(e.target.value)}
                                placeholder="Paste flyer text, copied email content or article copy here.\n\nUse a blank line to separate the next source."
                                rows={5}
                                className={inp}
                            />
                        </Field>
                    </div>
                    {files.length > 0 && (
                        <ul className="mt-4 grid gap-2 text-sm">
                            {files.map((file) => (
                                <li key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-3 rounded-2xl border border-border px-3 py-2 bg-surface">
                                    <span className="flex items-center gap-2 min-w-0">
                                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <span className="truncate">{file.name}</span>
                                    </span>
                                    <span className="text-xs text-muted-foreground shrink-0">{Math.max(1, Math.ceil(file.size / 1024))} KB</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="rounded-3xl border border-border p-5 bg-muted/30">
                    <h3 className="font-display font-bold text-lg">What the parser looks for</h3>
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                        <li>• Event dates, times and venue clues</li>
                        <li>• Volunteering keywords, helper roles and recruitment language</li>
                        <li>• Organisational names and update language</li>
                        <li>• Venue names, addresses, halls and facility/booking cues</li>
                        <li>• Existing org, event, volunteer and venue matches from current site data</li>
                        <li>• Review hints when the parser is not certain</li>
                    </ul>
                </div>
            </div>

            {result && (
                <div className="mt-6 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="font-display font-bold text-xl">Parsed results</h3>
                        <span className="text-xs text-muted-foreground">{result.mocked ? "Fallback parser" : "AI-assisted parser"}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <select value={reviewStatusFilter} onChange={(e) => setReviewStatusFilter(e.target.value)} className="px-3 py-2 rounded-full border border-border bg-background text-xs font-semibold">
                            <option value="all">All statuses</option>
                            <option value="open">Open</option>
                            <option value="in_review">In review</option>
                            <option value="blocked">Blocked</option>
                        </select>
                        <select value={reviewOwnerFilter} onChange={(e) => setReviewOwnerFilter(e.target.value)} className="px-3 py-2 rounded-full border border-border bg-background text-xs font-semibold">
                            <option value="all">All owners</option>
                            <option value="mine">Assigned to me</option>
                            <option value="assigned">Assigned</option>
                            <option value="unassigned">Unassigned</option>
                        </select>
                        <button type="button" onClick={() => bulkPatchSelected({ review_owner: REVIEWER_NAME, review_status: "in_review" })} className="px-3 py-2 rounded-full border border-border text-xs font-semibold disabled:opacity-60" disabled={!selectedReviewIds.length}>Assign selected to me</button>
                        <button type="button" onClick={() => bulkPatchSelected({ review_status: "blocked" })} className="px-3 py-2 rounded-full border border-border text-xs font-semibold disabled:opacity-60" disabled={!selectedReviewIds.length}>Mark selected blocked</button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => runDryValidation("all")} className="px-3 py-2 rounded-full border border-border text-xs font-semibold">Validate all</button>
                        <button type="button" onClick={() => publishBatch("all")} className="px-3 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold">Post all valid</button>
                        <button type="button" onClick={() => runDryValidation("selected")} className="px-3 py-2 rounded-full border border-border text-xs font-semibold disabled:opacity-60" disabled={!selectedReviewIds.length}>Validate selected</button>
                        <button type="button" onClick={() => publishBatch("selected")} className="px-3 py-2 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold disabled:opacity-60" disabled={!selectedReviewIds.length}>Post selected valid</button>
                        <span className="text-xs text-muted-foreground">{selectedReviewIds.length} selected</span>
                    </div>
                    {batchReport && (
                        <div className="rounded-2xl border border-border bg-muted/30 p-3 text-xs">
                            <div className="font-semibold">Validation summary ({batchReport.scope})</div>
                            <div className="mt-1 text-muted-foreground">{batchReport.valid}/{batchReport.total} valid · {batchReport.invalid} with issues</div>
                            {batchReport.invalidRows.length > 0 && (
                                <ul className="mt-2 space-y-1 text-amber-700 dark:text-amber-300">
                                    {batchReport.invalidRows.slice(0, 6).map((row) => (
                                        <li key={row.reviewId}>- {row.title} ({row.destination}): {row.errors.join(", ")}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                    <div className="grid gap-4">
                        {visibleReviewDocs.map((doc) => (
                            <div key={doc.filename} className="rounded-3xl border border-border bg-background p-5">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                    <div>
                                        <div className="font-semibold">{doc.filename}</div>
                                        <div className="text-xs text-muted-foreground mt-1">{doc.source_type.toUpperCase() || "UNKNOWN"}</div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {doc.items.map((item, index) => (
                                            <span key={`${doc.filename}-${index}`} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-wider">
                                                {ACTION_LABELS[item.action] || ACTION_LABELS.unclear}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                {doc.warnings.length > 0 && (
                                    <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">{doc.warnings.join(" · ")}</p>
                                )}
                                {doc.text_excerpt && <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{doc.text_excerpt}</p>}
                                <div className="mt-4 grid gap-3">
                                    {doc.items.map((item, index) => (
                                        <div key={`${doc.filename}-item-${index}`} className="rounded-2xl border border-border p-4 bg-surface">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <label className="inline-flex items-center gap-2 text-xs text-muted-foreground mr-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedReviewIds.includes(item.reviewId)}
                                                        onChange={() => toggleSelectedItem(item.reviewId)}
                                                    />
                                                    Select
                                                </label>
                                                <span className="text-xs font-bold uppercase tracking-wider text-primary">{item.suggested_type}</span>
                                                <span className="text-xs text-muted-foreground">{item.title}</span>
                                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted">Owner: {(item.draft || item).review_owner || "Unassigned"}</span>
                                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted">Status: {(item.draft || item).review_status || "open"}</span>
                                                {typeof item.entity_confidence === "number" && <span className="text-xs text-muted-foreground">{Math.round(item.entity_confidence * 100)}% entity match</span>}
                                                {typeof item.confidence === "number" && typeof item.entity_confidence !== "number" && <span className="text-xs text-muted-foreground">{Math.round(item.confidence * 100)}% match</span>}
                                            </div>
                                            {item.isEditing ? (
                                                <div className="mt-3 grid gap-3">
                                                    <Field label="Post to">
                                                        <select value={inferDestination(item.draft || item)} onChange={(e) => updateItem(doc.filename, item.reviewId, { publish_target: e.target.value })} className={inp}>
                                                            <option value="events">Events</option>
                                                            <option value="organisations">Organisations</option>
                                                            <option value="local_feed">Local feed</option>
                                                            <option value="volunteering">Volunteering</option>
                                                            <option value="venues">Venues</option>
                                                        </select>
                                                    </Field>
                                                    <div className="grid sm:grid-cols-2 gap-3">
                                                        <Field label="Review owner">
                                                            <input value={(item.draft || item).review_owner || ""} onChange={(e) => updateItem(doc.filename, item.reviewId, { review_owner: e.target.value })} placeholder="e.g. Admin" className={inp} />
                                                        </Field>
                                                        <Field label="Review status">
                                                            <select value={(item.draft || item).review_status || "open"} onChange={(e) => updateItem(doc.filename, item.reviewId, { review_status: e.target.value })} className={inp}>
                                                                <option value="open">Open</option>
                                                                <option value="in_review">In review</option>
                                                                <option value="blocked">Blocked</option>
                                                            </select>
                                                        </Field>
                                                    </div>
                                                    <Field label="Title">
                                                        <input value={item.draft.title || ""} onChange={(e) => updateItem(doc.filename, item.reviewId, { title: e.target.value })} className={inp} />
                                                    </Field>
                                                    <Field label="Description">
                                                        <textarea rows={3} value={item.draft.description || ""} onChange={(e) => updateItem(doc.filename, item.reviewId, { description: e.target.value })} className={inp} />
                                                    </Field>
                                                    {item.suggested_type === "event" ? (
                                                        <div className="grid sm:grid-cols-3 gap-3">
                                                            <Field label="Date">
                                                                <input type="date" value={item.draft.date || ""} onChange={(e) => updateItem(doc.filename, item.reviewId, { date: e.target.value })} className={inp} />
                                                            </Field>
                                                            <Field label="Start">
                                                                <input type="time" value={item.draft.start_time || ""} onChange={(e) => updateItem(doc.filename, item.reviewId, { start_time: e.target.value })} className={inp} />
                                                            </Field>
                                                            <Field label="End">
                                                                <input type="time" value={item.draft.end_time || ""} onChange={(e) => updateItem(doc.filename, item.reviewId, { end_time: e.target.value })} className={inp} />
                                                            </Field>
                                                        </div>
                                                    ) : (
                                                        <Field label="Location">
                                                            <input value={item.draft.location || ""} onChange={(e) => updateItem(doc.filename, item.reviewId, { location: e.target.value })} className={inp} />
                                                        </Field>
                                                    )}
                                                    <div className="flex gap-2 flex-wrap">
                                                        <button type="button" onClick={() => toggleEdit(doc.filename, item.reviewId)} className="px-3 py-2 rounded-full bg-muted text-xs font-semibold">Done</button>
                                                        <button type="button" onClick={() => deleteItemWithUndo(doc, item)} className="px-3 py-2 rounded-full border border-foreground text-xs font-semibold">Delete</button>
                                                        <button type="button" onClick={() => requestPost(doc, item)} className="px-3 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold">Post</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="mt-2 text-sm text-muted-foreground">{item.description}</div>
                                            )}
                                            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                                                <span className="px-2.5 py-1 rounded-full bg-muted font-semibold">{ACTION_LABELS[item.action] || ACTION_LABELS.unclear}</span>
                                                <span className="px-2.5 py-1 rounded-full bg-muted">Destination: {destinationLabel(item.draft || item)}</span>
                                                {item.matched_org_name && <span className="px-2.5 py-1 rounded-full bg-muted">Org: {item.matched_org_name}</span>}
                                                {item.matched_event_title && <span className="px-2.5 py-1 rounded-full bg-muted">Event: {item.matched_event_title}</span>}
                                                {item.matched_volunteer_title && <span className="px-2.5 py-1 rounded-full bg-muted">Volunteer: {item.matched_volunteer_title}</span>}
                                                {item.matched_venue_name && <span className="px-2.5 py-1 rounded-full bg-muted">Venue: {item.matched_venue_name}</span>}
                                                {item.location && <span className="px-2.5 py-1 rounded-full bg-muted">{item.location}</span>}
                                                {item.date && <span className="px-2.5 py-1 rounded-full bg-muted">{item.date}</span>}
                                                {item.start_time && <span className="px-2.5 py-1 rounded-full bg-muted">{item.start_time}{item.end_time ? `-${item.end_time}` : ""}</span>}
                                            </div>
                                            {(typeof item.date_confidence === "number" && item.date_confidence < LOW_CONFIDENCE_THRESHOLD) && (
                                                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                                                    Low date confidence ({Math.round(item.date_confidence * 100)}%). Raw date text: {item.raw_date_text || "unknown"}
                                                </p>
                                            )}
                                            {(typeof item.time_confidence === "number" && item.time_confidence < LOW_CONFIDENCE_THRESHOLD) && (
                                                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                                                    Low time confidence ({Math.round(item.time_confidence * 100)}%). Raw time text: {item.raw_time_text || "unknown"}
                                                </p>
                                            )}
                                            {(typeof item.entity_confidence === "number" && item.entity_confidence < LOW_CONFIDENCE_THRESHOLD) && (
                                                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                                                    Low entity confidence ({Math.round(item.entity_confidence * 100)}%). Double-check match before posting.
                                                </p>
                                            )}
                                            <div className="mt-3 flex gap-2 flex-wrap">
                                                <button type="button" onClick={() => toggleEdit(doc.filename, item.reviewId)} className="px-3 py-2 rounded-full border border-border text-xs font-semibold">
                                                    Edit
                                                </button>
                                                <button type="button" onClick={() => setItemMeta(item.reviewId, { review_owner: REVIEWER_NAME, review_status: "in_review" })} className="px-3 py-2 rounded-full border border-border text-xs font-semibold">
                                                    Assign to me
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        updateItem(doc.filename, item.reviewId, { publish_target: "local_feed" });
                                                        requestPost(doc, item);
                                                    }}
                                                    className="px-3 py-2 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold"
                                                >
                                                    Post to local feed
                                                </button>
                                                <button type="button" onClick={() => deleteItemWithUndo(doc, item)} className="px-3 py-2 rounded-full border border-foreground text-xs font-semibold">
                                                    Delete
                                                </button>
                                                <button type="button" onClick={() => requestPost(doc, item)} className="px-3 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                                                    Post to site
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <Dialog open={Boolean(confirmPost)} onOpenChange={(open) => !open && setConfirmPost(null)}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Confirm update publish</DialogTitle>
                    </DialogHeader>
                    {confirmPost && (
                        <div className="space-y-3 text-sm">
                            <p>
                                This will update an existing item in the <b>{destinationLabel(confirmPost.item.draft || confirmPost.item)}</b> section.
                            </p>
                            <div className="rounded-2xl border border-border bg-muted/30 p-3">
                                <div className="font-semibold">{(confirmPost.item.draft || confirmPost.item).title}</div>
                                <div className="text-xs text-muted-foreground mt-1">Action: {ACTION_LABELS[(confirmPost.item.draft || confirmPost.item).action] || "Update"}</div>
                            </div>
                            <p className="text-muted-foreground">Proceed only if this matched existing record is correct.</p>
                        </div>
                    )}
                    <DialogFooter>
                        <button type="button" onClick={() => setConfirmPost(null)} className="px-4 py-2 rounded-full border border-border text-sm font-semibold">Cancel</button>
                        <button type="button" onClick={confirmAndPost} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold">Confirm and publish</button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function QuickAddContentCard({ orgs, onCreated }) {
    const [eventOpen, setEventOpen] = useState(false);
    const [feedOpen, setFeedOpen] = useState(false);
    const [volOpen, setVolOpen] = useState(false);
    const [orgOpen, setOrgOpen] = useState(false);
    const [venueOpen, setVenueOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const firstOrgSlug = orgs[0]?.slug || "";
    const [eventForm, setEventForm] = useState({
        title: "", orgSlug: firstOrgSlug, category: "Community",
        date: "", start: "", end: "",
        venue: "", address: "",
        description: "", cost: "Free", age: "All ages",
        accessibility: "", booking: "",
        contactEmail: "", contactPhone: "", image: "",
        status: "approved",
    });
    const [feedForm, setFeedForm] = useState({
        orgSlug: firstOrgSlug, type: "update", title: "", body: "", image: "",
    });
    const [volForm, setVolForm] = useState({
        orgSlug: firstOrgSlug, title: "", description: "",
        age: "", time: "", skills: "",
    });
    const [orgForm, setOrgForm] = useState({
        name: "", category: "Community groups", short: "", about: "",
        logo: "✨", cover: "", brandColor: "#0052FF",
        email: "", phone: "", website: "",
        facebook: "", instagram: "", tiktok: "", linkedin: "",
        address: "", meeting: "",
    });
    const [venueForm, setVenueForm] = useState({
        name: "", address: "", facilities: "",
        accessibility: "", capacity: 0, booking: "", image: "",
    });

    useEffect(() => {
        const slug = orgs[0]?.slug || "";
        if (!slug) return;
        setEventForm((prev) => (prev.orgSlug ? prev : { ...prev, orgSlug: slug }));
        setFeedForm((prev) => (prev.orgSlug ? prev : { ...prev, orgSlug: slug }));
        setVolForm((prev) => (prev.orgSlug ? prev : { ...prev, orgSlug: slug }));
    }, [orgs]);

    const createEvent = async () => {
        if (!eventForm.title || !eventForm.orgSlug || !eventForm.date) {
            return toast.error("Title, organisation and date are required");
        }
        setBusy(true);
        try {
            const startISO = new Date(`${eventForm.date}T${eventForm.start || "10:00"}`).toISOString();
            const endISO = new Date(`${eventForm.date}T${eventForm.end || eventForm.start || "11:00"}`).toISOString();
            await api.createEvent({
                title: eventForm.title,
                orgSlug: eventForm.orgSlug,
                category: eventForm.category,
                start: startISO,
                end: endISO,
                venue: eventForm.venue,
                address: eventForm.address,
                description: eventForm.description,
                cost: eventForm.cost,
                age: eventForm.age,
                accessibility: eventForm.accessibility,
                booking: eventForm.booking,
                contactEmail: eventForm.contactEmail,
                contactPhone: eventForm.contactPhone,
                image: eventForm.image || "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&q=80",
                status: eventForm.status,
            });
            toast.success("Event published");
            setEventForm((prev) => ({
                ...prev,
                title: "", date: "", start: "", end: "",
                venue: "", address: "", description: "",
                accessibility: "", booking: "", contactEmail: "",
                contactPhone: "", image: "",
            }));
            setEventOpen(false);
            onCreated?.();
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Failed to publish event");
        } finally {
            setBusy(false);
        }
    };

    const createFeedPost = async () => {
        if (!feedForm.orgSlug || !feedForm.title || !feedForm.body) {
            return toast.error("Pick an organisation, title and message");
        }
        setBusy(true);
        try {
            await api.createFeedPost(feedForm);
            toast.success("Feed post published");
            setFeedForm((prev) => ({ ...prev, title: "", body: "", image: "", type: "update" }));
            setFeedOpen(false);
            onCreated?.();
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Failed to publish feed post");
        } finally {
            setBusy(false);
        }
    };

    const createVolunteer = async () => {
        if (!volForm.orgSlug || !volForm.title || !volForm.description) {
            return toast.error("Pick an organisation, title and description");
        }
        setBusy(true);
        try {
            const payload = {
                id: `vol-${Date.now()}`,
                ...volForm,
            };
            await api.createVolunteer(payload);
            toast.success("Volunteering opportunity published");
            setVolForm((prev) => ({ ...prev, title: "", description: "", age: "", time: "", skills: "" }));
            setVolOpen(false);
            onCreated?.();
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Failed to publish volunteering opportunity");
        } finally {
            setBusy(false);
        }
    };

    const createOrgQuick = async () => {
        if (!orgForm.name || !orgForm.short) {
            return toast.error("Name and short description are required");
        }
        const slug = orgForm.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        setBusy(true);
        try {
            const created = await api.submitOrg({
                slug,
                name: orgForm.name,
                category: orgForm.category,
                short: orgForm.short,
                about: orgForm.about || orgForm.short,
                does: orgForm.about || orgForm.short,
                forWho: "",
                meeting: orgForm.meeting,
                address: orgForm.address,
                location: "Blackrod",
                email: orgForm.email,
                phone: orgForm.phone,
                website: orgForm.website,
                socials: {
                    facebook: orgForm.facebook,
                    instagram: orgForm.instagram,
                    tiktok: orgForm.tiktok,
                    linkedin: orgForm.linkedin,
                },
                brandColor: orgForm.brandColor,
                logo: orgForm.logo || "✨",
                cover: orgForm.cover,
            });
            await api.setOrgStatus(created.slug, "approved");
            toast.success("Organisation published");
            setOrgForm({
                name: "", category: "Community groups", short: "", about: "",
                logo: "✨", cover: "", brandColor: "#0052FF",
                email: "", phone: "", website: "",
                facebook: "", instagram: "", tiktok: "", linkedin: "",
                address: "", meeting: "",
            });
            setOrgOpen(false);
            onCreated?.();
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Failed to create organisation");
        } finally {
            setBusy(false);
        }
    };

    const createVenue = async () => {
        if (!venueForm.name || !venueForm.address) {
            return toast.error("Venue name and address are required");
        }
        setBusy(true);
        try {
            const facilities = venueForm.facilities
                .split(/[,\n]/)
                .map((v) => v.trim())
                .filter(Boolean);
            await api.createVenue({
                id: `ven-${Date.now()}`,
                name: venueForm.name,
                address: venueForm.address,
                facilities,
                accessibility: venueForm.accessibility,
                capacity: Number(venueForm.capacity) || 0,
                booking: venueForm.booking,
                image: venueForm.image || "https://images.unsplash.com/photo-1571260899304-425eee4c7efc?w=1200&q=80",
            });
            toast.success("Venue published");
            setVenueForm({
                name: "", address: "", facilities: "",
                accessibility: "", capacity: 0, booking: "", image: "",
            });
            setVenueOpen(false);
            onCreated?.();
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Failed to publish venue");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="rounded-[2rem] border border-border bg-surface p-6 sm:p-8">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h2 className="font-display font-black text-2xl">Quick add content</h2>
                    <p className="text-sm text-muted-foreground mt-1">Create items across all main categories without leaving the admin dashboard. Fields match each destination page so posts display fully-populated.</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-wider">Events · Organisations · Local feed · Volunteering · Venues</span>
            </div>

            <div className="mt-4 grid sm:grid-cols-2 xl:grid-cols-5 gap-3">
                {/* Add Event */}
                <Dialog open={eventOpen} onOpenChange={setEventOpen}>
                    <DialogTrigger asChild>
                        <button type="button" className="text-left rounded-3xl border border-border bg-background p-4 hover:border-primary/50 transition-colors" data-testid="admin-quick-add-event">
                            <div className="h-9 w-9 rounded-2xl bg-primary/10 text-primary grid place-items-center"><CalendarDays className="h-4 w-4" /></div>
                            <div className="font-semibold mt-3">Add event</div>
                            <p className="text-xs text-muted-foreground mt-1">Publish an event straight into the calendar.</p>
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader><DialogTitle>Create event</DialogTitle></DialogHeader>
                        <div className="grid gap-3">
                            <Field label="Title">
                                <input data-testid="qc-ev-title" value={eventForm.title} onChange={(e) => setEventForm((p) => ({ ...p, title: e.target.value }))} className={inp} />
                            </Field>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <Field label="Organisation">
                                    <select data-testid="qc-ev-org" value={eventForm.orgSlug} onChange={(e) => setEventForm((p) => ({ ...p, orgSlug: e.target.value }))} className={inp}>
                                        {orgs.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
                                    </select>
                                </Field>
                                <Field label="Category">
                                    <input value={eventForm.category} onChange={(e) => setEventForm((p) => ({ ...p, category: e.target.value }))} className={inp} placeholder="Community, Sports…" />
                                </Field>
                            </div>
                            <div className="grid sm:grid-cols-3 gap-3">
                                <Field label="Date">
                                    <input data-testid="qc-ev-date" type="date" value={eventForm.date} onChange={(e) => setEventForm((p) => ({ ...p, date: e.target.value }))} className={inp} />
                                </Field>
                                <Field label="Start">
                                    <input type="time" value={eventForm.start} onChange={(e) => setEventForm((p) => ({ ...p, start: e.target.value }))} className={inp} />
                                </Field>
                                <Field label="End">
                                    <input type="time" value={eventForm.end} onChange={(e) => setEventForm((p) => ({ ...p, end: e.target.value }))} className={inp} />
                                </Field>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <Field label="Venue">
                                    <input value={eventForm.venue} onChange={(e) => setEventForm((p) => ({ ...p, venue: e.target.value }))} className={inp} />
                                </Field>
                                <Field label="Address">
                                    <input value={eventForm.address} onChange={(e) => setEventForm((p) => ({ ...p, address: e.target.value }))} className={inp} />
                                </Field>
                            </div>
                            <Field label="Description">
                                <textarea rows={4} value={eventForm.description} onChange={(e) => setEventForm((p) => ({ ...p, description: e.target.value }))} className={inp} />
                            </Field>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <Field label="Cost">
                                    <input value={eventForm.cost} onChange={(e) => setEventForm((p) => ({ ...p, cost: e.target.value }))} className={inp} />
                                </Field>
                                <Field label="Age suitability">
                                    <input value={eventForm.age} onChange={(e) => setEventForm((p) => ({ ...p, age: e.target.value }))} className={inp} />
                                </Field>
                            </div>
                            <Field label="Accessibility">
                                <input value={eventForm.accessibility} onChange={(e) => setEventForm((p) => ({ ...p, accessibility: e.target.value }))} className={inp} />
                            </Field>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <Field label="Contact email">
                                    <input type="email" value={eventForm.contactEmail} onChange={(e) => setEventForm((p) => ({ ...p, contactEmail: e.target.value }))} className={inp} />
                                </Field>
                                <Field label="Contact phone">
                                    <input value={eventForm.contactPhone} onChange={(e) => setEventForm((p) => ({ ...p, contactPhone: e.target.value }))} className={inp} />
                                </Field>
                            </div>
                            <Field label="Booking link">
                                <input type="url" value={eventForm.booking} onChange={(e) => setEventForm((p) => ({ ...p, booking: e.target.value }))} className={inp} placeholder="https://" />
                            </Field>
                            <Field label="Image URL">
                                <input value={eventForm.image} onChange={(e) => setEventForm((p) => ({ ...p, image: e.target.value }))} className={inp} placeholder="https://" />
                            </Field>
                            <Field label="Publish status">
                                <select value={eventForm.status} onChange={(e) => setEventForm((p) => ({ ...p, status: e.target.value }))} className={inp}>
                                    <option value="approved">Publish now (approved)</option>
                                    <option value="pending">Save as pending</option>
                                </select>
                            </Field>
                        </div>
                        <DialogFooter>
                            <button type="button" onClick={() => setEventOpen(false)} className="px-4 py-2 rounded-full border border-border text-sm font-semibold">Cancel</button>
                            <button type="button" data-testid="qc-ev-submit" disabled={busy} onClick={createEvent} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">Publish event</button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Add Feed post */}
                <Dialog open={feedOpen} onOpenChange={setFeedOpen}>
                    <DialogTrigger asChild>
                        <button type="button" className="text-left rounded-3xl border border-border bg-background p-4 hover:border-primary/50 transition-colors" data-testid="admin-quick-add-feed">
                            <div className="h-9 w-9 rounded-2xl bg-accent/10 text-accent grid place-items-center"><Newspaper className="h-4 w-4" /></div>
                            <div className="font-semibold mt-3">Add feed update</div>
                            <p className="text-xs text-muted-foreground mt-1">Publish a local feed update immediately.</p>
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader><DialogTitle>Create feed post</DialogTitle></DialogHeader>
                        <div className="grid gap-3">
                            <Field label="Organisation">
                                <select value={feedForm.orgSlug} onChange={(e) => setFeedForm((prev) => ({ ...prev, orgSlug: e.target.value }))} className={inp}>
                                    {orgs.map((org) => <option key={org.slug} value={org.slug}>{org.name}</option>)}
                                </select>
                            </Field>
                            <Field label="Type">
                                <select value={feedForm.type} onChange={(e) => setFeedForm((prev) => ({ ...prev, type: e.target.value }))} className={inp}>
                                    <option value="update">Update</option>
                                    <option value="announcement">Announcement</option>
                                    <option value="news">News</option>
                                </select>
                            </Field>
                            <Field label="Title">
                                <input data-testid="qc-feed-title" value={feedForm.title} onChange={(e) => setFeedForm((prev) => ({ ...prev, title: e.target.value }))} className={inp} />
                            </Field>
                            <Field label="Message">
                                <textarea rows={4} value={feedForm.body} onChange={(e) => setFeedForm((prev) => ({ ...prev, body: e.target.value }))} className={inp} />
                            </Field>
                            <Field label="Image URL (optional)">
                                <input value={feedForm.image} onChange={(e) => setFeedForm((prev) => ({ ...prev, image: e.target.value }))} className={inp} />
                            </Field>
                        </div>
                        <DialogFooter>
                            <button type="button" onClick={() => setFeedOpen(false)} className="px-4 py-2 rounded-full border border-border text-sm font-semibold">Cancel</button>
                            <button type="button" disabled={busy} onClick={createFeedPost} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">Publish feed post</button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Add Volunteering */}
                <Dialog open={volOpen} onOpenChange={setVolOpen}>
                    <DialogTrigger asChild>
                        <button type="button" className="text-left rounded-3xl border border-border bg-background p-4 hover:border-primary/50 transition-colors" data-testid="admin-quick-add-volunteer">
                            <div className="h-9 w-9 rounded-2xl bg-secondary/40 text-secondary-foreground grid place-items-center"><HandHeart className="h-4 w-4" /></div>
                            <div className="font-semibold mt-3">Add volunteering</div>
                            <p className="text-xs text-muted-foreground mt-1">Create a volunteering opportunity from admin.</p>
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader><DialogTitle>Create volunteering opportunity</DialogTitle></DialogHeader>
                        <div className="grid gap-3">
                            <Field label="Organisation">
                                <select value={volForm.orgSlug} onChange={(e) => setVolForm((prev) => ({ ...prev, orgSlug: e.target.value }))} className={inp}>
                                    {orgs.map((org) => <option key={org.slug} value={org.slug}>{org.name}</option>)}
                                </select>
                            </Field>
                            <Field label="Title">
                                <input value={volForm.title} onChange={(e) => setVolForm((prev) => ({ ...prev, title: e.target.value }))} className={inp} />
                            </Field>
                            <Field label="Description">
                                <textarea rows={4} value={volForm.description} onChange={(e) => setVolForm((prev) => ({ ...prev, description: e.target.value }))} className={inp} />
                            </Field>
                            <div className="grid sm:grid-cols-3 gap-3">
                                <Field label="Time">
                                    <input value={volForm.time} onChange={(e) => setVolForm((prev) => ({ ...prev, time: e.target.value }))} className={inp} placeholder="e.g. Sat 10-12" />
                                </Field>
                                <Field label="Age">
                                    <input value={volForm.age} onChange={(e) => setVolForm((prev) => ({ ...prev, age: e.target.value }))} className={inp} placeholder="14+, 18+, DofE" />
                                </Field>
                                <Field label="Skills">
                                    <input value={volForm.skills} onChange={(e) => setVolForm((prev) => ({ ...prev, skills: e.target.value }))} className={inp} />
                                </Field>
                            </div>
                        </div>
                        <DialogFooter>
                            <button type="button" onClick={() => setVolOpen(false)} className="px-4 py-2 rounded-full border border-border text-sm font-semibold">Cancel</button>
                            <button type="button" disabled={busy} onClick={createVolunteer} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">Publish volunteering</button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Add Organisation */}
                <Dialog open={orgOpen} onOpenChange={setOrgOpen}>
                    <DialogTrigger asChild>
                        <button type="button" className="text-left rounded-3xl border border-border bg-background p-4 hover:border-primary/50 transition-colors" data-testid="admin-quick-add-org">
                            <div className="h-9 w-9 rounded-2xl bg-primary/10 text-primary grid place-items-center"><Building2 className="h-4 w-4" /></div>
                            <div className="font-semibold mt-3">Add organisation</div>
                            <p className="text-xs text-muted-foreground mt-1">Create and approve an organisation in one step.</p>
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader><DialogTitle>Create organisation</DialogTitle></DialogHeader>
                        <div className="grid gap-3">
                            <Field label="Name">
                                <input data-testid="qc-org-name" value={orgForm.name} onChange={(e) => setOrgForm((p) => ({ ...p, name: e.target.value }))} className={inp} />
                            </Field>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <Field label="Category">
                                    <input value={orgForm.category} onChange={(e) => setOrgForm((p) => ({ ...p, category: e.target.value }))} className={inp} placeholder="Community groups, Sports, Faith…" />
                                </Field>
                                <Field label="Brand colour">
                                    <input type="color" value={orgForm.brandColor} onChange={(e) => setOrgForm((p) => ({ ...p, brandColor: e.target.value }))} className="h-10 w-full rounded-2xl border border-border bg-background" />
                                </Field>
                            </div>
                            <Field label="Short description">
                                <input value={orgForm.short} onChange={(e) => setOrgForm((p) => ({ ...p, short: e.target.value }))} className={inp} placeholder="One line summary" />
                            </Field>
                            <Field label="Full description">
                                <textarea rows={4} value={orgForm.about} onChange={(e) => setOrgForm((p) => ({ ...p, about: e.target.value }))} className={inp} />
                            </Field>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <Field label="Logo (emoji)">
                                    <input value={orgForm.logo} onChange={(e) => setOrgForm((p) => ({ ...p, logo: e.target.value }))} className={inp} placeholder="⚽" />
                                </Field>
                                <Field label="Cover image URL">
                                    <input value={orgForm.cover} onChange={(e) => setOrgForm((p) => ({ ...p, cover: e.target.value }))} className={inp} placeholder="https://" />
                                </Field>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <Field label="Email">
                                    <input type="email" value={orgForm.email} onChange={(e) => setOrgForm((p) => ({ ...p, email: e.target.value }))} className={inp} />
                                </Field>
                                <Field label="Phone">
                                    <input value={orgForm.phone} onChange={(e) => setOrgForm((p) => ({ ...p, phone: e.target.value }))} className={inp} />
                                </Field>
                            </div>
                            <Field label="Website">
                                <input type="url" value={orgForm.website} onChange={(e) => setOrgForm((p) => ({ ...p, website: e.target.value }))} className={inp} placeholder="https://" />
                            </Field>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <Field label="Facebook URL">
                                    <input value={orgForm.facebook} onChange={(e) => setOrgForm((p) => ({ ...p, facebook: e.target.value }))} className={inp} placeholder="https://facebook.com/…" />
                                </Field>
                                <Field label="Instagram URL">
                                    <input value={orgForm.instagram} onChange={(e) => setOrgForm((p) => ({ ...p, instagram: e.target.value }))} className={inp} />
                                </Field>
                                <Field label="TikTok URL">
                                    <input value={orgForm.tiktok} onChange={(e) => setOrgForm((p) => ({ ...p, tiktok: e.target.value }))} className={inp} />
                                </Field>
                                <Field label="LinkedIn URL">
                                    <input value={orgForm.linkedin} onChange={(e) => setOrgForm((p) => ({ ...p, linkedin: e.target.value }))} className={inp} />
                                </Field>
                            </div>
                            <Field label="Address">
                                <input value={orgForm.address} onChange={(e) => setOrgForm((p) => ({ ...p, address: e.target.value }))} className={inp} />
                            </Field>
                            <Field label="Meeting / opening times">
                                <input value={orgForm.meeting} onChange={(e) => setOrgForm((p) => ({ ...p, meeting: e.target.value }))} className={inp} placeholder="e.g. Tuesdays 7pm" />
                            </Field>
                        </div>
                        <DialogFooter>
                            <button type="button" onClick={() => setOrgOpen(false)} className="px-4 py-2 rounded-full border border-border text-sm font-semibold">Cancel</button>
                            <button type="button" data-testid="qc-org-submit" disabled={busy} onClick={createOrgQuick} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">Publish organisation</button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Add Venue */}
                <Dialog open={venueOpen} onOpenChange={setVenueOpen}>
                    <DialogTrigger asChild>
                        <button type="button" className="text-left rounded-3xl border border-border bg-background p-4 hover:border-primary/50 transition-colors" data-testid="admin-quick-add-venue">
                            <div className="h-9 w-9 rounded-2xl bg-accent/10 text-accent grid place-items-center"><MapPin className="h-4 w-4" /></div>
                            <div className="font-semibold mt-3">Add venue</div>
                            <p className="text-xs text-muted-foreground mt-1">Add a bookable venue to the Spaces to hire page.</p>
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader><DialogTitle>Create venue</DialogTitle></DialogHeader>
                        <div className="grid gap-3">
                            <Field label="Name">
                                <input data-testid="qc-venue-name" value={venueForm.name} onChange={(e) => setVenueForm((p) => ({ ...p, name: e.target.value }))} className={inp} />
                            </Field>
                            <Field label="Address">
                                <input value={venueForm.address} onChange={(e) => setVenueForm((p) => ({ ...p, address: e.target.value }))} className={inp} />
                            </Field>
                            <Field label="Facilities (comma or newline separated)">
                                <textarea rows={2} value={venueForm.facilities} onChange={(e) => setVenueForm((p) => ({ ...p, facilities: e.target.value }))} className={inp} placeholder="Main hall, Kitchen, Outdoor pitches" />
                            </Field>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <Field label="Capacity">
                                    <input type="number" min="0" value={venueForm.capacity} onChange={(e) => setVenueForm((p) => ({ ...p, capacity: e.target.value }))} className={inp} />
                                </Field>
                                <Field label="Accessibility">
                                    <input value={venueForm.accessibility} onChange={(e) => setVenueForm((p) => ({ ...p, accessibility: e.target.value }))} className={inp} placeholder="Step-free, hearing loop…" />
                                </Field>
                            </div>
                            <Field label="Booking (URL or mailto:)">
                                <input value={venueForm.booking} onChange={(e) => setVenueForm((p) => ({ ...p, booking: e.target.value }))} className={inp} placeholder="https:// or mailto:" />
                            </Field>
                            <Field label="Image URL">
                                <input value={venueForm.image} onChange={(e) => setVenueForm((p) => ({ ...p, image: e.target.value }))} className={inp} placeholder="https://" />
                            </Field>
                        </div>
                        <DialogFooter>
                            <button type="button" onClick={() => setVenueOpen(false)} className="px-4 py-2 rounded-full border border-border text-sm font-semibold">Cancel</button>
                            <button type="button" data-testid="qc-venue-submit" disabled={busy} onClick={createVenue} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">Publish venue</button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}

// ─────────── Broadcast card ───────────
function BroadcastCard() {
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [busy, setBusy] = useState(false);

    const send = async () => {
        if (!subject || !body) return toast.error("Subject and body needed");
        setBusy(true);
        try {
            const res = await api.broadcast({
                subject,
                html: `<div style="font-family:Helvetica,Arial;color:#0F172A;font-size:15px;line-height:1.5">${body.replace(/\n/g, "<br/>")}</div>`,
            });
            toast.success(`Broadcast queued — ${res.sent} sent${res.mocked ? " (mocked, add RESEND_API_KEY)" : ""}`);
            setSubject(""); setBody("");
        } catch {
            toast.error("Broadcast failed");
        } finally { setBusy(false); }
    };

    return (
        <div className="rounded-3xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2 mb-2">
                <div className="h-9 w-9 rounded-2xl bg-accent/10 text-accent grid place-items-center"><Send className="h-4 w-4" /></div>
                <h3 className="font-display font-bold">Ad-hoc broadcast</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Sends an email to every active subscriber. Unsubscribe link added automatically.</p>
            <input data-testid="broadcast-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="w-full mb-2 px-3 py-2 rounded-2xl border border-border bg-background text-sm" />
            <textarea data-testid="broadcast-body" value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Your announcement…" className="w-full mb-2 px-3 py-2 rounded-2xl border border-border bg-background text-sm" />
            <button data-testid="broadcast-send" disabled={busy} onClick={send}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-accent text-accent-foreground font-semibold text-xs disabled:opacity-60">
                <Send className="h-3.5 w-3.5" /> Send to all subscribers
            </button>
        </div>
    );
}

// ─────────── Newsletter card ───────────
function NewsletterCard() {
    const [subject, setSubject] = useState("Your Blackrod Now digest 📬");
    const [intro, setIntro] = useState("");
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(false);
    const [open, setOpen] = useState(false);

    const previewIt = async () => {
        try {
            const res = await api.newsletterPreview();
            setPreview(res); setOpen(true);
        } catch { toast.error("Preview failed"); }
    };
    const send = async () => {
        setBusy(true);
        try {
            const res = await api.sendNewsletter({ subject, body_intro: intro });
            toast.success(`Newsletter sent — ${res.sent} delivered${res.mocked ? " (mocked)" : ""}`);
        } catch { toast.error("Send failed"); }
        finally { setBusy(false); }
    };

    return (
        <div className="rounded-3xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2 mb-2">
                <div className="h-9 w-9 rounded-2xl bg-primary/10 text-primary grid place-items-center"><Mail className="h-4 w-4" /></div>
                <h3 className="font-display font-bold">Weekly newsletter</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Personalised digest — each subscriber gets events matching the orgs and categories they follow.</p>
            <input data-testid="newsletter-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="w-full mb-2 px-3 py-2 rounded-2xl border border-border bg-background text-sm" />
            <textarea data-testid="newsletter-intro" value={intro} onChange={(e) => setIntro(e.target.value)} rows={2} placeholder="Optional intro line…" className="w-full mb-2 px-3 py-2 rounded-2xl border border-border bg-background text-sm" />
            <div className="flex gap-2">
                <button data-testid="newsletter-preview" onClick={previewIt} className="inline-flex items-center gap-1 px-4 py-2 rounded-full border-2 border-foreground font-semibold text-xs">
                    <Eye className="h-3.5 w-3.5" /> Preview
                </button>
                <button data-testid="newsletter-send" disabled={busy} onClick={send} className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-primary text-primary-foreground font-semibold text-xs disabled:opacity-60">
                    <Send className="h-3.5 w-3.5" /> Send digest
                </button>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>Newsletter preview</DialogTitle></DialogHeader>
                    {preview && (
                        <div>
                            <div className="text-xs text-muted-foreground mb-3">
                                Preview shown with no personalisation — real emails will be tailored per subscriber.
                                Matched events: <b>{preview.matched_events}</b>, updates: <b>{preview.matched_updates}</b>
                            </div>
                            <iframe title="preview" srcDoc={preview.html} className="w-full h-[500px] rounded-2xl border border-border" />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ─────────── Admin inbox (org → super admin) ───────────
function AdminInbox({ onChange }) {
    const [msgs, setMsgs] = useState([]);
    const [tab, setTab] = useState("inbox");
    const [query, setQuery] = useState("");
    useEffect(() => { api.adminMessages().then(setMsgs).catch(() => {}); }, []);

    const normalizedQuery = query.trim().toLowerCase();
    const visible = msgs
        .filter((m) => (tab === "archive" ? m.read : !m.read))
        .filter((m) => {
            if (!normalizedQuery) return true;
            const haystack = `${m.from_org_slug || ""} ${m.from_name || ""} ${m.from_email || ""} ${m.subject || ""} ${m.body || ""}`.toLowerCase();
            return haystack.includes(normalizedQuery);
        });

    const inboxCount = msgs.filter((m) => !m.read).length;
    const archiveCount = msgs.filter((m) => m.read).length;

    const markRead = async (id) => {
        await api.markMessageRead(id);
        setMsgs((prev) => prev.map((x) => x.id === id ? { ...x, read: true } : x));
        onChange?.();
    };

    return (
        <div className="rounded-3xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2 mb-2">
                <div className="h-9 w-9 rounded-2xl bg-secondary/40 text-secondary-foreground grid place-items-center"><MessageSquare className="h-4 w-4" /></div>
                <h3 className="font-display font-bold">Contact admin inbox</h3>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => setTab("inbox")}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold ${tab === "inbox" ? "bg-foreground text-background" : "bg-muted text-foreground"}`}
                >
                    Inbox ({inboxCount})
                </button>
                <button
                    type="button"
                    onClick={() => setTab("archive")}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold ${tab === "archive" ? "bg-foreground text-background" : "bg-muted text-foreground"}`}
                >
                    Archive ({archiveCount})
                </button>
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={`Search ${tab}...`}
                    className="ml-auto w-full sm:w-56 px-3 py-2 rounded-2xl border border-border bg-background text-xs"
                />
            </div>

            {visible.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-3">{tab === "archive" ? "No archived messages yet." : "No unread messages."}</p>
            ) : (
                <ul className="space-y-2 max-h-72 overflow-y-auto mt-3">
                    {visible.map((m) => (
                        <li key={m.id} data-testid={`msg-${m.id}`} className={`p-3 rounded-2xl border border-border ${m.read ? "bg-background" : "bg-primary/5"}`}>
                            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                                <b className="text-foreground">{m.from_org_slug || m.from_name || m.from_email || "Anonymous"}</b>
                                <span>· {new Date(m.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                                {m.in_reply_to && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/40 text-secondary-foreground text-[10px] font-bold uppercase tracking-wider">
                                        Reply
                                    </span>
                                )}
                            </div>
                            <div className="font-semibold text-sm mt-1">{m.subject}</div>
                            <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{m.body}</div>
                            {!m.read && tab !== "archive" && (
                                <button
                                    onClick={async () => { await markRead(m.id); }}
                                    className="mt-2 text-xs text-primary font-semibold"
                                >
                                    Mark as read (move to archive)
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// ─────────── Notify specific org ───────────
function NotifyOrgCard({ orgs }) {
    const [slug, setSlug] = useState(orgs[0]?.slug || "");
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");

    useEffect(() => { if (!slug && orgs.length) setSlug(orgs[0].slug); }, [orgs, slug]);

    const send = async () => {
        if (!slug || !title) return toast.error("Pick an organisation and give it a title");
        try {
            await api.sendNotification({ org_slug: slug, title, body });
            toast.success("Notification sent");
            setTitle(""); setBody("");
        } catch { toast.error("Failed"); }
    };

    return (
        <div className="rounded-3xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2 mb-2">
                <div className="h-9 w-9 rounded-2xl bg-primary/10 text-primary grid place-items-center"><Bell className="h-4 w-4" /></div>
                <h3 className="font-display font-bold">Notify an organisation</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Appears in their dashboard bell.</p>
            <select data-testid="notify-org" value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full mb-2 px-3 py-2 rounded-2xl border border-border bg-background text-sm">
                {orgs.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
            </select>
            <input data-testid="notify-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full mb-2 px-3 py-2 rounded-2xl border border-border bg-background text-sm" />
            <textarea data-testid="notify-body" value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Message…" className="w-full mb-2 px-3 py-2 rounded-2xl border border-border bg-background text-sm" />
            <button data-testid="notify-send" onClick={send} className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-primary text-primary-foreground font-semibold text-xs">
                <Send className="h-3.5 w-3.5" /> Send notification
            </button>
        </div>
    );
}
