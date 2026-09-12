import React from "react";
import { Link } from "react-router-dom";
import {
    AlertTriangle,
    Building2,
    CheckCircle2,
    Clock,
    Edit3,
    ExternalLink,
    Mail,
    RefreshCw,
    Search,
    Users,
} from "lucide-react";
import { toast } from "sonner";
import { getAdminOrganisationOverview } from "@/lib/communityActions";

const FILTERS = [
    { key: "all", label: "All organisations", countKey: "total" },
    { key: "claimed", label: "Claimed", countKey: "claimed" },
    { key: "unclaimed", label: "Unclaimed", countKey: "unclaimed" },
    { key: "with_admins", label: "With admins", countKey: "with_admins" },
    { key: "without_admins", label: "Without admins", countKey: "without_admins" },
];

const ATTENTION_FILTERS = [
    { key: "claimed_no_admin", label: "Claimed, no admin" },
    { key: "pending_claim", label: "Pending claim" },
    { key: "never_active", label: "Never active" },
    { key: "inactive_90", label: "Inactive 90+ days" },
];

const parseDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const exactDate = (value) => {
    const date = parseDate(value);
    if (!date) return "No activity recorded";
    return date.toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const relativeDate = (value) => {
    const date = parseDate(value);
    if (!date) return "Never";
    const diffMs = Date.now() - date.getTime();
    if (diffMs < 0) return exactDate(value);

    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);

    if (minutes < 2) return "Just now";
    if (minutes < 60) return `${minutes} mins ago`;
    if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
    if (days === 1) return "Yesterday";
    if (days < 30) return `${days} days ago`;
    if (days < 365) {
        const months = Math.floor(days / 30);
        return `${months} month${months === 1 ? "" : "s"} ago`;
    }
    const years = Math.floor(days / 365);
    return `${years} year${years === 1 ? "" : "s"} ago`;
};

const activityAgeClass = (value) => {
    const date = parseDate(value);
    if (!date) return "text-muted-foreground";
    const days = (Date.now() - date.getTime()) / 86400000;
    if (days > 90) return "text-red-700";
    if (days > 30) return "text-amber-700";
    return "text-emerald-700";
};

const inactiveFor90Days = (value) => {
    const date = parseDate(value);
    if (!date) return false;
    return (Date.now() - date.getTime()) / 86400000 >= 90;
};

export default function AdminOrganisationOverview({
    onMessageOrg,
    initialFilter = "",
    onInitialFilterHandled,
}) {
    const [data, setData] = React.useState({ counts: {}, organisations: [] });
    const [loading, setLoading] = React.useState(true);
    const [query, setQuery] = React.useState("");
    const [filter, setFilter] = React.useState("all");
    const [sort, setSort] = React.useState("recent");

    const load = React.useCallback(async () => {
        setLoading(true);
        try {
            const result = await getAdminOrganisationOverview();
            setData({
                counts: result?.counts || {},
                organisations: Array.isArray(result?.organisations) ? result.organisations : [],
            });
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not load organisation overview");
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        load();
    }, [load]);

    React.useEffect(() => {
        if (!initialFilter) return;
        const valid = [...FILTERS, ...ATTENTION_FILTERS].some((item) => item.key === initialFilter);
        setFilter(valid ? initialFilter : "all");
        if (onInitialFilterHandled) onInitialFilterHandled();
    }, [initialFilter, onInitialFilterHandled]);

    const attentionCounts = React.useMemo(() => {
        const organisations = data.organisations || [];
        return {
            claimed_no_admin: organisations.filter((org) => org.claimed && !org.has_admins).length,
            pending_claim: organisations.filter((org) => Number(org.pending_claims || 0) > 0).length,
            never_active: organisations.filter((org) => !org.last_activity_at).length,
            inactive_90: organisations.filter((org) => inactiveFor90Days(org.last_activity_at)).length,
        };
    }, [data.organisations]);

    const rows = React.useMemo(() => {
        const needle = query.trim().toLowerCase();
        const filtered = (data.organisations || [])
            .filter((org) => {
                if (filter === "claimed" && !org.claimed) return false;
                if (filter === "unclaimed" && org.claimed) return false;
                if (filter === "with_admins" && !org.has_admins) return false;
                if (filter === "without_admins" && org.has_admins) return false;
                if (filter === "claimed_no_admin" && !(org.claimed && !org.has_admins)) return false;
                if (filter === "pending_claim" && !(Number(org.pending_claims || 0) > 0)) return false;
                if (filter === "never_active" && org.last_activity_at) return false;
                if (filter === "inactive_90" && !inactiveFor90Days(org.last_activity_at)) return false;
                if (!needle) return true;

                const adminText = (org.admins || [])
                    .map((admin) => `${admin.email || ""} ${admin.role || ""}`)
                    .join(" ");
                return [
                    org.name,
                    org.slug,
                    org.category,
                    org.email,
                    org.claim_contact_email,
                    adminText,
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase()
                    .includes(needle);
            });

        return filtered.sort((a, b) => {
            if (sort === "name") return String(a.name || "").localeCompare(String(b.name || ""));
            const aTime = parseDate(a.last_activity_at)?.getTime() || 0;
            const bTime = parseDate(b.last_activity_at)?.getTime() || 0;
            if (sort === "oldest") return aTime - bTime;
            return bTime - aTime;
        });
    }, [data.organisations, filter, query, sort]);

    const counts = data.counts || {};

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="admin-organisation-overview">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Organisation access</div>
                    <h2 className="font-display font-black text-3xl mt-1">Organisation overview</h2>
                    <p className="text-sm text-muted-foreground mt-2 max-w-3xl">
                        See which profiles have actually been claimed, which have administrator coverage, and when an organisation representative last used Blackrod Now.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={load}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-bold disabled:opacity-50"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mt-6">
                {FILTERS.map((item) => {
                    const active = filter === item.key;
                    return (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setFilter(item.key)}
                            className={`rounded-2xl border p-4 text-left transition ${active ? "border-primary bg-primary/5" : "border-border bg-surface hover:bg-muted/40"}`}
                        >
                            <div className="text-2xl font-black">{Number(counts[item.countKey] || 0)}</div>
                            <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mt-1">{item.label}</div>
                        </button>
                    );
                })}
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-muted/20 p-3">
                <div className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">Attention views</div>
                <div className="mt-2 flex flex-wrap gap-2">
                    {ATTENTION_FILTERS.map((item) => {
                        const active = filter === item.key;
                        const count = Number(attentionCounts[item.key] || 0);
                        return (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => setFilter(item.key)}
                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition ${active ? "bg-foreground text-background border-foreground" : "bg-background border-border hover:bg-muted"}`}
                            >
                                {item.label}
                                <span className={`min-w-5 h-5 px-1.5 rounded-full grid place-items-center text-[10px] ${active ? "bg-background text-foreground" : "bg-muted text-foreground"}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="mt-5 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search organisations or admin emails…"
                        className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-2.5 text-sm"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{rows.length} shown</span>
                    <select
                        value={sort}
                        onChange={(event) => setSort(event.target.value)}
                        className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
                    >
                        <option value="recent">Last active first</option>
                        <option value="oldest">Least recently active</option>
                        <option value="name">Name A–Z</option>
                    </select>
                </div>
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-surface overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1040px] text-sm">
                        <thead className="bg-muted/50 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                            <tr>
                                <th className="p-3">Organisation</th>
                                <th className="p-3">Claim status</th>
                                <th className="p-3">Admins</th>
                                <th className="p-3">Last organisation activity</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((org) => (
                                <tr key={org.slug} className="border-t border-border align-top hover:bg-muted/20">
                                    <td className="p-3">
                                        <div className="flex gap-3">
                                            <span className="h-9 w-9 rounded-xl bg-muted grid place-items-center shrink-0">
                                                <Building2 className="h-4 w-4" />
                                            </span>
                                            <div className="min-w-0">
                                                <div className="font-bold text-foreground">{org.name}</div>
                                                <div className="text-xs text-muted-foreground mt-0.5">{org.category || "No category"} · {org.status || "approved"}</div>
                                                <div className="text-[10px] text-muted-foreground mt-1">{org.slug}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        {org.claimed ? (
                                            <div>
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-black uppercase">
                                                    <CheckCircle2 className="h-3 w-3" /> Claimed
                                                </span>
                                                {org.claimed_at && <div className="text-[11px] text-muted-foreground mt-1">{exactDate(org.claimed_at)}</div>}
                                            </div>
                                        ) : (
                                            <div>
                                                <span className="inline-flex px-2 py-1 rounded-full bg-muted text-muted-foreground text-[10px] font-black uppercase">Unclaimed</span>
                                                {org.pending_claims > 0 && (
                                                    <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                                                        <AlertTriangle className="h-3 w-3" /> {org.pending_claims} claim awaiting review
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3 max-w-xs">
                                        {org.has_admins ? (
                                            <div>
                                                <div className="inline-flex items-center gap-1 font-bold text-xs">
                                                    <Users className="h-3.5 w-3.5" /> {org.admin_count} admin{org.admin_count === 1 ? "" : "s"}
                                                </div>
                                                <div className="mt-1 space-y-0.5">
                                                    {(org.admins || []).slice(0, 3).map((admin) => (
                                                        <div key={`${admin.email}-${admin.role}`} className="text-[11px] text-muted-foreground truncate max-w-[240px]">
                                                            {admin.email} · {admin.role}
                                                        </div>
                                                    ))}
                                                    {(org.admins || []).length > 3 && <div className="text-[11px] text-muted-foreground">+{org.admins.length - 3} more</div>}
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700">
                                                <AlertTriangle className="h-3.5 w-3.5" /> No admins
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        <div className={`font-bold text-xs inline-flex items-center gap-1 ${activityAgeClass(org.last_activity_at)}`} title={exactDate(org.last_activity_at)}>
                                            <Clock className="h-3.5 w-3.5" /> {relativeDate(org.last_activity_at)}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground mt-1">{org.last_activity_source || "No organisation-side activity recorded"}</div>
                                        {org.last_activity_at && <div className="text-[10px] text-muted-foreground mt-0.5">{exactDate(org.last_activity_at)}</div>}
                                    </td>
                                    <td className="p-3">
                                        <div className="flex justify-end flex-wrap gap-1.5">
                                            <Link
                                                to={`/edit-organisation/${org.slug}`}
                                                className="org-overview-action bg-primary text-primary-foreground border-primary"
                                            >
                                                <Edit3 className="h-3.5 w-3.5" /> Manage
                                            </Link>
                                            <Link
                                                to={`/organisations/${org.slug}`}
                                                target="_blank"
                                                className="org-overview-action"
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" /> Open
                                            </Link>
                                            {onMessageOrg && (
                                                <button
                                                    type="button"
                                                    onClick={() => onMessageOrg(org.slug)}
                                                    className="org-overview-action"
                                                >
                                                    <Mail className="h-3.5 w-3.5" /> Message
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!rows.length && !loading && (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-muted-foreground">No organisations match this view.</td>
                                </tr>
                            )}
                            {loading && !(data.organisations || []).length && (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-muted-foreground">Loading organisation overview…</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <p className="mt-3 text-[11px] text-muted-foreground">
                Claimed means an organisation profile has an approved profile claim or is marked as managed by the organisation. “With admins” counts recorded owner/admin addresses and active owner/admin member accounts. Last activity uses organisation/member sign-ins and claim activity, rather than routine site-admin edits.
            </p>

            <style>{`.org-overview-action{display:inline-flex;align-items:center;gap:.3rem;border:1px solid hsl(var(--border));border-radius:9999px;padding:.4rem .65rem;font-size:.7rem;font-weight:700;white-space:nowrap}.org-overview-action:hover{background:hsl(var(--muted))}`}</style>
        </section>
    );
}
