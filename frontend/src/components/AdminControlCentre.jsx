import React from "react";
import {
    AlertTriangle,
    ArrowRight,
    Building2,
    CalendarDays,
    CheckCircle2,
    HandHeart,
    Inbox,
    Mail,
    MapPin,
    RefreshCw,
    ShieldCheck,
    Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { getAdminOrganisationOverview } from "@/lib/communityActions";

const isRealEvent = (event) => !event?.is_recurrence_instance;

export default function AdminControlCentre({
    pendingEventCount = 0,
    pendingClaimCount = 0,
    unreadMessageCount = 0,
    onOpenContent,
    onOpenAccuracy,
    onOpenMessages,
    onOpenClaims,
    onOpenOrganisations,
    onOpenAdvanced,
}) {
    const { events, orgs, venues, volunteerOpps, stats, refresh } = useApp();
    const [accuracy, setAccuracy] = React.useState({ pending: 0, running: false });
    const [orgOverview, setOrgOverview] = React.useState(null);
    const [loading, setLoading] = React.useState(false);

    const loadDashboardData = React.useCallback(async () => {
        try {
            const [status, proposals, organisationOverview] = await Promise.all([
                api.eventAuditStatus().catch(() => null),
                api.eventEditProposals("pending").catch(() => []),
                getAdminOrganisationOverview().catch(() => null),
            ]);
            setAccuracy({
                pending: Array.isArray(proposals) ? proposals.length : 0,
                running: ["queued", "running"].includes(status?.job?.status),
            });
            if (organisationOverview) setOrgOverview(organisationOverview);
        } catch {
            setAccuracy({ pending: 0, running: false });
        }
    }, []);

    React.useEffect(() => {
        loadDashboardData();
    }, [loadDashboardData]);

    const doRefresh = async () => {
        setLoading(true);
        try {
            await Promise.all([refresh(), loadDashboardData()]);
        } finally {
            setLoading(false);
        }
    };

    const realEvents = (events || []).filter(isRealEvent);
    const upcoming = realEvents.filter((event) => {
        if (event.status !== "approved") return false;
        const end = event.end || event.start;
        return end ? new Date(end) >= new Date() : false;
    });
    const unchecked = upcoming.filter((event) => !event.check_result).length;
    const needsAttention = upcoming.filter((event) =>
        ["needs_attention", "likely_outdated"].includes(event.check_result?.verdict)
    ).length;
    const activeOrgs = (orgs || []).filter((org) => !["rejected", "archived"].includes(org.status));
    const fallbackWithoutAdmins = activeOrgs.filter((org) => !org.owner_email && !(org.admin_emails || []).length).length;
    const withoutAdmins = Number.isFinite(Number(orgOverview?.counts?.without_admins))
        ? Number(orgOverview.counts.without_admins)
        : fallbackWithoutAdmins;

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="admin-control-centre-v2">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Control centre</div>
                    <h2 className="font-display font-black text-3xl mt-1">What needs your attention?</h2>
                    <p className="text-sm text-muted-foreground mt-2 max-w-3xl">
                        A clean operational view of Blackrod Now. The numbers below open the workspace where the work is actually done.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={doRefresh}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-surface text-xs font-bold disabled:opacity-50"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                    Refresh dashboard
                </button>
            </div>

            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-6">
                <AttentionCard
                    icon={Inbox}
                    value={pendingEventCount}
                    title="Events awaiting review"
                    detail={pendingEventCount ? "Approve, edit or reject submitted events." : "No submitted events are waiting."}
                    tone={pendingEventCount ? "warn" : "ok"}
                    onClick={() => onOpenContent?.("pending")}
                />
                <AttentionCard
                    icon={Building2}
                    value={pendingClaimCount}
                    title="Profile claims"
                    detail={pendingClaimCount ? "Verify the claimant's authority before granting access." : "No organisation claims are waiting."}
                    tone={pendingClaimCount ? "warn" : "ok"}
                    onClick={onOpenClaims}
                />
                <AttentionCard
                    icon={Mail}
                    value={unreadMessageCount}
                    title="Unread messages"
                    detail={unreadMessageCount ? "External email, website and organisation replies." : "Your admin inbox is clear."}
                    tone={unreadMessageCount ? "info" : "ok"}
                    onClick={() => onOpenMessages?.("inbox")}
                />
                <AttentionCard
                    icon={ShieldCheck}
                    value={needsAttention + accuracy.pending}
                    title="Accuracy attention"
                    detail={accuracy.running ? "An accuracy audit is currently running." : `${needsAttention} checked listing issue${needsAttention === 1 ? "" : "s"}; ${accuracy.pending} suggested edit${accuracy.pending === 1 ? "" : "s"}.`}
                    tone={needsAttention + accuracy.pending ? "warn" : "ok"}
                    onClick={onOpenAccuracy}
                />
            </div>

            <div className="grid lg:grid-cols-[1.35fr_1fr] gap-6 mt-6">
                <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Content health</div>
                            <h3 className="font-display font-bold text-xl mt-1">The public directory at a glance</h3>
                        </div>
                        <button type="button" onClick={() => onOpenContent?.("active")} className="text-xs font-bold text-primary inline-flex items-center gap-1">
                            Manage content <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                        <MiniStat icon={CalendarDays} value={realEvents.length} label="Real event records" />
                        <MiniStat icon={Building2} value={activeOrgs.length} label="Organisations" />
                        <MiniStat icon={MapPin} value={(venues || []).length} label="Venues" />
                        <MiniStat icon={HandHeart} value={(volunteerOpps || []).length} label="Volunteer opportunities" />
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3 mt-4">
                        <button type="button" onClick={() => onOpenContent?.("upcoming")} className="rounded-2xl border border-border p-4 text-left hover:bg-muted/40">
                            <div className="text-2xl font-black">{upcoming.length}</div>
                            <div className="text-xs font-bold mt-1">Upcoming published events</div>
                        </button>
                        <button type="button" onClick={onOpenAccuracy} className={`rounded-2xl border p-4 text-left ${unchecked ? "border-amber-300 bg-amber-50" : "border-border hover:bg-muted/40"}`}>
                            <div className="text-2xl font-black">{unchecked}</div>
                            <div className="text-xs font-bold mt-1">Upcoming events not yet checked</div>
                        </button>
                        <button
                            type="button"
                            onClick={() => onOpenOrganisations?.("without_admins")}
                            className={`rounded-2xl border p-4 text-left ${withoutAdmins ? "border-amber-300 bg-amber-50" : "border-border hover:bg-muted/40"}`}
                        >
                            <div className="text-2xl font-black">{withoutAdmins}</div>
                            <div className="text-xs font-bold mt-1">Organisations without admins</div>
                        </button>
                    </div>
                </div>

                <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Quick actions</div>
                    <h3 className="font-display font-bold text-xl mt-1">Common admin jobs</h3>
                    <div className="mt-4 grid gap-2">
                        <QuickAction icon={Mail} title="Message an organisation" detail="Pick an organisation and send from the admin inbox." onClick={() => onOpenMessages?.("single")} />
                        <QuickAction icon={Building2} title="Message all organisations" detail="One private email per organisation; addresses are not exposed." onClick={() => onOpenMessages?.("all")} />
                        <QuickAction icon={ShieldCheck} title="Run accuracy checks" detail="Review web checks, AI suggestions and organiser mismatches." onClick={onOpenAccuracy} />
                        <QuickAction icon={Sparkles} title="Advanced admin tools" detail="Quick create, broadcasts, subscribers, users, taxonomy and audit log." onClick={onOpenAdvanced} />
                    </div>
                </div>
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground flex gap-2">
                {needsAttention || unchecked ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
                <span>
                    Credibility status: {unchecked ? `${unchecked} upcoming event${unchecked === 1 ? "" : "s"} have not yet had a live-source check. ` : "All upcoming events currently carry a check record. "}
                    Use Accuracy for the evidence and organiser-attribution scan. Existing specialist admin tools remain available under Advanced.
                </span>
            </div>

            {stats?.analytics?.health?.last_event_at && (
                <div className="mt-3 text-[11px] text-muted-foreground">Latest recorded site activity: {String(stats.analytics.health.last_event_at).replace("T", " ").slice(0, 16)}</div>
            )}
        </section>
    );
}

function AttentionCard({ icon: Icon, value, title, detail, tone, onClick }) {
    const toneClass = tone === "warn"
        ? "border-amber-300 bg-amber-50"
        : tone === "info"
            ? "border-blue-300 bg-blue-50"
            : "border-border bg-surface";
    return (
        <button type="button" onClick={onClick} className={`rounded-3xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${toneClass}`}>
            <div className="flex items-start justify-between gap-3">
                <span className="h-10 w-10 rounded-2xl bg-background/80 border border-border grid place-items-center"><Icon className="h-4.5 w-4.5" /></span>
                <span className="text-3xl font-black">{value}</span>
            </div>
            <div className="font-bold mt-4">{title}</div>
            <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{detail}</div>
        </button>
    );
}

function MiniStat({ icon: Icon, value, label }) {
    return (
        <div className="rounded-2xl border border-border bg-background p-3">
            <Icon className="h-4 w-4 text-primary" />
            <div className="text-xl font-black mt-2">{value}</div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mt-1">{label}</div>
        </div>
    );
}

function QuickAction({ icon: Icon, title, detail, onClick }) {
    return (
        <button type="button" onClick={onClick} className="rounded-2xl border border-border p-3 text-left hover:bg-muted/40 flex items-center gap-3">
            <span className="h-9 w-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0"><Icon className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{title}</span>
                <span className="block text-[11px] text-muted-foreground mt-0.5">{detail}</span>
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </button>
    );
}
