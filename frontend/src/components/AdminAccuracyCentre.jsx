import React from "react";
import { Link } from "react-router-dom";
import {
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    ExternalLink,
    RefreshCw,
    Search,
    ShieldCheck,
    Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import AiAuditCard from "@/components/AiAuditCard";

const normalise = (value) => String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const domainOfEmail = (value) => {
    const text = String(value || "").trim().toLowerCase();
    return text.includes("@") ? text.split("@").pop() : "";
};

const hostOfUrl = (value) => {
    const text = String(value || "").trim();
    if (!text) return "";
    try {
        const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
        return url.hostname.toLowerCase().replace(/^www\./, "");
    } catch {
        return "";
    }
};

const organisationSignals = (event, org) => {
    const orgName = normalise(org?.name);
    if (!orgName || orgName.length < 5) return { score: 0, reasons: [] };

    const title = normalise(event?.title);
    const description = normalise(event?.description);
    const venue = normalise(event?.venue);
    const eventEmail = String(event?.contactEmail || event?.contact_email || event?.email || "").trim().toLowerCase();
    const eventEmailDomain = domainOfEmail(eventEmail);
    const orgEmail = String(org?.email || "").trim().toLowerCase();
    const orgEmailDomain = domainOfEmail(orgEmail);
    const orgHost = hostOfUrl(org?.website);
    const bookingHost = hostOfUrl(event?.booking || event?.booking_url);
    const sourceHost = hostOfUrl(event?.source_url || event?.source || event?.url);

    let score = 0;
    const reasons = [];

    if (title.includes(orgName)) {
        score += 10;
        reasons.push("organisation name appears in the event title");
    }
    if (description.includes(orgName)) {
        score += 5;
        reasons.push("organisation name appears in the description");
    }
    if (eventEmail && orgEmail && eventEmail === orgEmail) {
        score += 9;
        reasons.push("event contact email matches this organisation");
    } else if (eventEmailDomain && orgEmailDomain && eventEmailDomain === orgEmailDomain) {
        score += 7;
        reasons.push("event email domain matches this organisation");
    }
    if (orgHost && bookingHost && orgHost === bookingHost) {
        score += 6;
        reasons.push("booking link uses this organisation's website");
    }
    if (orgHost && sourceHost && orgHost === sourceHost) {
        score += 6;
        reasons.push("source link uses this organisation's website");
    }
    if (venue.includes(orgName)) {
        score += 1;
        reasons.push("organisation name appears as the venue (weak signal only)");
    }

    return { score, reasons };
};

const findAttributionIssues = (events, orgs) => {
    const realEvents = (events || []).filter((event) => !event.is_recurrence_instance && !["archived", "rejected", "cancelled"].includes(event.status));
    const activeOrgs = (orgs || []).filter((org) => org.status !== "rejected");

    return realEvents.flatMap((event) => {
        const current = activeOrgs.find((org) => org.slug === event.orgSlug);
        const currentSignals = current ? organisationSignals(event, current) : { score: 0, reasons: [] };
        let best = null;

        activeOrgs.forEach((org) => {
            if (org.slug === event.orgSlug) return;
            const signals = organisationSignals(event, org);
            if (!best || signals.score > best.score) {
                best = { org, ...signals };
            }
        });

        if (!best || best.score < 7 || best.score < currentSignals.score + 3) return [];
        return [{
            event,
            current,
            suggested: best.org,
            score: best.score,
            currentScore: currentSignals.score,
            reasons: best.reasons,
            confidence: best.score >= 10 && best.score >= currentSignals.score + 5 ? "high" : "review",
        }];
    }).sort((a, b) => b.score - a.score || String(a.event.start || "").localeCompare(String(b.event.start || "")));
};

const verdictTone = (verdict) => {
    if (verdict === "looks_accurate") return "bg-emerald-100 text-emerald-900";
    if (verdict === "needs_attention") return "bg-amber-100 text-amber-900";
    if (verdict === "likely_outdated") return "bg-red-100 text-red-900";
    return "bg-muted text-muted-foreground";
};

export default function AdminAccuracyCentre({ focusEventId = "", onFocusHandled }) {
    const { events, orgs, refresh } = useApp();
    const [scope, setScope] = React.useState("upcoming");
    const [query, setQuery] = React.useState("");
    const [busyId, setBusyId] = React.useState("");
    const [liveResults, setLiveResults] = React.useState({});
    const [highlightEventId, setHighlightEventId] = React.useState("");
    const focusRef = React.useRef(null);

    const realEvents = React.useMemo(
        () => (events || []).filter((event) => !event.is_recurrence_instance),
        [events]
    );
    const now = new Date();
    const publishedUpcoming = realEvents.filter((event) => event.status === "approved" && (!event.end && !event.start ? false : new Date(event.end || event.start) >= now));
    const checked = publishedUpcoming.filter((event) => event.check_result);
    const attention = checked.filter((event) => ["needs_attention", "likely_outdated"].includes(event.check_result?.verdict));
    const attributionIssues = React.useMemo(() => findAttributionIssues(realEvents, orgs), [realEvents, orgs]);

    const orgBySlug = React.useMemo(
        () => Object.fromEntries((orgs || []).map((org) => [org.slug, org])),
        [orgs]
    );

    const filteredEvents = React.useMemo(() => {
        const needle = query.trim().toLowerCase();
        return realEvents
            .filter((event) => {
                if (scope === "upcoming" && !(event.status === "approved" && new Date(event.end || event.start) >= new Date())) return false;
                if (scope === "attention" && !["needs_attention", "likely_outdated"].includes(event.check_result?.verdict)) return false;
                if (scope === "unchecked" && event.check_result) return false;
                if (scope === "pending" && event.status !== "pending") return false;
                if (!needle) return true;
                const orgName = orgBySlug[event.orgSlug]?.name || event.orgSlug || "";
                return [event.id, event.title, event.venue, event.description, orgName]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase()
                    .includes(needle);
            })
            .sort((a, b) => String(a.start || "").localeCompare(String(b.start || "")));
    }, [orgBySlug, query, realEvents, scope]);

    React.useEffect(() => {
        if (!focusEventId) return;
        const event = realEvents.find((item) => item.id === focusEventId);
        setHighlightEventId(focusEventId);
        setQuery(event?.title || focusEventId);
        setScope("all");
        window.setTimeout(() => focusRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
        window.setTimeout(() => setHighlightEventId(""), 5000);
        if (onFocusHandled) onFocusHandled();
    }, [focusEventId, onFocusHandled, realEvents]);

    const checkEvent = async (event) => {
        setBusyId(event.id);
        try {
            const result = await api.adminCheckEntity("event", event.id);
            setLiveResults((current) => ({ ...current, [event.id]: result }));
            await refresh();
            toast.success(result?.summary || "Live web check complete");
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not verify event");
        } finally {
            setBusyId("");
        }
    };

    const moveEvent = async (issue) => {
        const event = issue.event;
        const target = issue.suggested;
        if (!window.confirm(`Move “${event.title}” from ${issue.current?.name || event.orgSlug || "its current organisation"} to ${target.name}?\n\nThis changes the organiser only; the venue remains unchanged.`)) return;
        setBusyId(event.id);
        try {
            await api.updateEvent(event.id, { orgSlug: target.slug }, event.orgSlug);
            await refresh();
            toast.success(`Event moved to ${target.name}`);
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not reassign event");
        } finally {
            setBusyId("");
        }
    };

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="admin-accuracy-centre">
            <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Accuracy & credibility</div>
                <h2 className="font-display font-black text-3xl mt-1">Keep Blackrod Now trustworthy</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-3xl">
                    Check current listings against public sources, review AI-suggested corrections and detect events that appear to be attached to the wrong organisation. Venue and organiser are treated as separate fields.
                </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-6">
                <Metric value={publishedUpcoming.length} label="Upcoming published" />
                <Metric value={checked.length} label="Already checked" />
                <Metric value={Math.max(0, publishedUpcoming.length - checked.length)} label="Unchecked" />
                <Metric value={attention.length} label="Needs attention" tone={attention.length ? "warn" : ""} />
                <Metric value={attributionIssues.length} label="Possible organiser mismatches" tone={attributionIssues.length ? "warn" : ""} />
            </div>

            <div className="mt-6">
                <AiAuditCard onApplied={refresh} />
            </div>

            <div className="mt-6 rounded-3xl border border-border bg-surface p-5 sm:p-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                            <Sparkles className="h-3.5 w-3.5" /> Organisation attribution scan
                        </div>
                        <h3 className="font-display font-bold text-xl mt-1">Does each event belong to the right organisation?</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
                            This local scan compares titles, descriptions, contact emails, booking links and source domains against every organisation. A venue-name match is deliberately only a weak signal, preventing meetings held at St Katharines from automatically being treated as St Katharines events.
                        </p>
                    </div>
                    <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${attributionIssues.length ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>
                        {attributionIssues.length ? `${attributionIssues.length} to review` : "No obvious mismatches"}
                    </div>
                </div>

                <div className="mt-4 space-y-3">
                    {attributionIssues.slice(0, 100).map((issue) => (
                        <div key={issue.event.id} className="rounded-2xl border border-border p-4" data-testid={`attribution-${issue.event.id}`}>
                            <div className="flex flex-col xl:flex-row xl:items-center gap-4">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-black ${issue.confidence === "high" ? "bg-red-100 text-red-900" : "bg-amber-100 text-amber-900"}`}>
                                            {issue.confidence === "high" ? "High confidence" : "Review"}
                                        </span>
                                        <span className="font-bold">{issue.event.title}</span>
                                    </div>
                                    <div className="mt-2 text-sm flex flex-wrap items-center gap-2">
                                        <span className="px-2 py-1 rounded-lg bg-muted">{issue.current?.name || issue.event.orgSlug || "No organiser"}</span>
                                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                        <span className="px-2 py-1 rounded-lg bg-primary/10 text-primary font-semibold">{issue.suggested.name}</span>
                                    </div>
                                    <div className="mt-2 text-xs text-muted-foreground">
                                        Evidence: {issue.reasons.join("; ")}.
                                    </div>
                                    {issue.event.venue && <div className="mt-1 text-xs text-muted-foreground">Venue stays: <strong className="text-foreground">{issue.event.venue}</strong></div>}
                                </div>
                                <div className="flex flex-wrap gap-2 shrink-0">
                                    <Link to={`/events/${issue.event.id}`} target="_blank" className="acc-action"><ExternalLink className="h-3.5 w-3.5" /> Open</Link>
                                    <button type="button" onClick={() => checkEvent(issue.event)} disabled={busyId === issue.event.id} className="acc-action"><ShieldCheck className={`h-3.5 w-3.5 ${busyId === issue.event.id ? "animate-spin" : ""}`} /> Web check</button>
                                    <button type="button" onClick={() => moveEvent(issue)} disabled={busyId === issue.event.id} className="acc-action bg-primary text-primary-foreground border-primary"><ArrowRight className="h-3.5 w-3.5" /> Move event</button>
                                </div>
                            </div>
                            {liveResults[issue.event.id] && (
                                <div className="mt-3 rounded-xl bg-muted/60 p-3 text-xs">
                                    <div className={`inline-flex px-2 py-1 rounded-full font-bold ${verdictTone(liveResults[issue.event.id].verdict)}`}>{String(liveResults[issue.event.id].verdict || "checked").replaceAll("_", " ")}</div>
                                    <div className="mt-2">{liveResults[issue.event.id].summary}</div>
                                    {(liveResults[issue.event.id].sources || []).length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {liveResults[issue.event.id].sources.map((source, index) => (
                                                <a key={index} href={source.url || source} target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-1">Source {index + 1}<ExternalLink className="h-3 w-3" /></a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                    {!attributionIssues.length && (
                        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-950 flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" /> No strong cross-organisation attribution conflicts were found in the current data.
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-6 rounded-3xl border border-border bg-surface p-5 sm:p-6">
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Listing register</div>
                        <h3 className="font-display font-bold text-xl mt-1">Check individual events</h3>
                    </div>
                    <div className="relative w-full lg:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events or organisation…" className="w-full rounded-2xl border border-border bg-background pl-9 pr-3 py-2.5 text-sm" />
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    {[["upcoming", "Upcoming published"], ["unchecked", "Unchecked"], ["attention", "Needs attention"], ["pending", "Pending"], ["all", "All real events"]].map(([key, label]) => (
                        <button key={key} type="button" onClick={() => setScope(key)} className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${scope === key ? "bg-foreground text-background border-foreground" : "border-border"}`}>{label}</button>
                    ))}
                </div>

                <div className="mt-4 divide-y divide-border border border-border rounded-2xl overflow-hidden">
                    {filteredEvents.slice(0, 250).map((event) => {
                        const result = liveResults[event.id] || event.check_result;
                        return (
                            <div key={event.id} ref={highlightEventId === event.id ? focusRef : null} className={`p-4 flex flex-col lg:flex-row lg:items-center gap-3 ${highlightEventId === event.id ? "bg-primary/5 ring-1 ring-inset ring-primary/30" : ""}`}>
                                <div className="min-w-0 flex-1">
                                    <div className="font-bold">{event.title}</div>
                                    <div className="text-xs text-muted-foreground mt-1">{String(event.start || "").slice(0, 16).replace("T", " · ")} · {orgBySlug[event.orgSlug]?.name || event.orgSlug || "No organiser"} · {event.venue || "No venue"}</div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${verdictTone(result?.verdict)}`}>{result?.verdict ? result.verdict.replaceAll("_", " ") : "not checked"}</span>
                                    <button type="button" onClick={() => checkEvent(event)} disabled={busyId === event.id} className="acc-action"><RefreshCw className={`h-3.5 w-3.5 ${busyId === event.id ? "animate-spin" : ""}`} /> Check live web</button>
                                    <Link to={`/edit-event/${event.id}`} className="acc-action">Edit</Link>
                                </div>
                            </div>
                        );
                    })}
                    {!filteredEvents.length && <div className="p-10 text-center text-sm text-muted-foreground">No events match this view.</div>}
                </div>
            </div>

            <style>{`.acc-action{display:inline-flex;align-items:center;gap:.3rem;border:1px solid hsl(var(--border));border-radius:9999px;padding:.45rem .7rem;font-size:.72rem;font-weight:700;white-space:nowrap}.acc-action:hover{background:hsl(var(--muted))}`}</style>
        </section>
    );
}

function Metric({ value, label, tone = "" }) {
    return (
        <div className={`rounded-2xl border p-4 ${tone === "warn" ? "border-amber-300 bg-amber-50" : "border-border bg-surface"}`}>
            <div className="text-2xl font-black">{value}</div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mt-1">{label}</div>
        </div>
    );
}
