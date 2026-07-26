import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { CategoryBadge, formatDate, formatTime, Stat } from "@/components/Cards";
import OrgAvatar from "@/components/OrgAvatar";
import {
    Wand2, Copy, Calendar, Megaphone, Bell, Sparkles, Loader2,
    Image as ImageIcon, FileText, UploadCloud,
    Send, Edit3, Trash2, Mail, ChevronRight,
    Eye, Users, BarChart3, Rocket,
} from "lucide-react";
import { toast } from "sonner";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import ShareButtons from "@/components/ShareButtons";
import PostNowDialog from "@/components/PostNowDialog";
import { buildRecurrencePayload } from "@/components/RecurrenceFields";

const EXAMPLE = `Summer Fair! Saturday 14 June, 11am-4pm at Blackrod Community Centre. Stalls, bouncy castles, raffle, hot food and live music. Free entry.

Also, Youth Football Open Day - Sunday 15 June, 10am-12:30pm at Aspull Common. Ages 5-14, free to try. Just turn up in trainers.

Community Clean-Up: Village Green, Saturday 21 June, 10am-12pm. Bags & brew provided.`;

export default function OrgDashboard() {
    const {
        orgs,
        events,
        addEvent,
        addFeedPost,
        activeOrgSlug,
        setActiveOrgSlug,
        refresh,
        role,
        hasOrgAccess,
        unlockOrgAccess,
        adminCodeSession,
    } = useApp();

    const [selectedOrgSlug, setSelectedOrgSlug] = useState(activeOrgSlug || orgs[0]?.slug || "");
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]); // multi-parse result
    const [notifications, setNotifications] = useState([]);
    const [docs, setDocs] = useState([]);
    const [contactOpen, setContactOpen] = useState(false);
    const [analytics, setAnalytics] = useState(null);
    const [orgPasswordInput, setOrgPasswordInput] = useState("");
    const [unlockBusy, setUnlockBusy] = useState(false);
    const [passwordBusy, setPasswordBusy] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ current: "", next: "" });
    const [postNowEvent, setPostNowEvent] = useState(null);

    useEffect(() => {
        if (!selectedOrgSlug && orgs.length) setSelectedOrgSlug(orgs[0].slug);
    }, [orgs, selectedOrgSlug]);
    useEffect(() => { if (selectedOrgSlug) setActiveOrgSlug(selectedOrgSlug); }, [selectedOrgSlug, setActiveOrgSlug]);

    const org = orgs.find((o) => o.slug === selectedOrgSlug);
    const myEvents = events.filter((e) => e.orgSlug === selectedOrgSlug);

    const loadNotifications = async () => {
        if (!selectedOrgSlug) return;
        try {
            const list = await api.orgNotifications(selectedOrgSlug);
            setNotifications(list);
        } catch {
            /* ignore */
        }
    };
    const loadDocs = async () => {
        if (!selectedOrgSlug) return;
        try {
            const list = await api.listDocs(selectedOrgSlug);
            setDocs(list);
        } catch {
            /* ignore */
        }
    };
    const loadAnalytics = async () => {
        if (!selectedOrgSlug) return;
        try {
            const result = await api.orgAnalytics(selectedOrgSlug);
            setAnalytics(result);
        } catch {
            setAnalytics(null);
        }
    };

    useEffect(() => {
        loadNotifications();
        loadDocs();
        loadAnalytics();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedOrgSlug]);

    const unreadCount = notifications.filter((n) => !n.read).length;
    const metrics = analytics?.overview || {};
    const sharePlatforms = analytics?.share_platforms_30d || [];
    const topEvents = analytics?.top_events_30d || [];
    const requiresOrgPassword = role === "org" && !!selectedOrgSlug && !hasOrgAccess(selectedOrgSlug);

    const parse = async () => {
        if (!text.trim()) return toast.error("Paste some content first");
        setLoading(true);
        try {
            const res = await api.parseContent(text);
            setItems(res.items || []);
            toast.success(`Parsed — ${res.items.length} item${res.items.length !== 1 ? "s" : ""} found`);
        } catch {
            toast.error("Couldn't parse — try again");
        } finally { setLoading(false); }
    };

    const copy = async (val, label) => {
        try { await navigator.clipboard.writeText(val); toast.success(`${label} copied`); }
        catch { toast.error("Copy failed"); }
    };

    const publishEvent = async (it, { recurrenceFreq = "none", recurrenceUntil = "" } = {}) => {
        let start;
        try {
            const d = it.date ? new Date(it.date) : new Date(Date.now() + 86400000);
            if (it.start_time) {
                const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(it.start_time || "");
                if (m) {
                    let h = parseInt(m[1], 10);
                    const min = m[2] ? parseInt(m[2], 10) : 0;
                    const ap = (m[3] || "").toLowerCase();
                    if (ap === "pm" && h < 12) h += 12;
                    if (ap === "am" && h === 12) h = 0;
                    d.setHours(h, min, 0, 0);
                }
            }
            start = d.toISOString();
        } catch { start = new Date(Date.now() + 86400000).toISOString(); }
        const end = new Date(new Date(start).getTime() + 2 * 60 * 60 * 1000).toISOString();
        try {
            await addEvent({
                title: it.title,
                orgSlug: selectedOrgSlug,
                category: it.category || "Community",
                start, end,
                venue: it.location || "TBC",
                address: it.location || "Blackrod",
                description: it.description,
                cost: "Free", age: "All ages",
                accessibility: "Please contact us for details",
                booking: "",
                contactEmail: org?.email || "",
                contactPhone: org?.phone || "",
                image: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&q=80",
                recurrence: buildRecurrencePayload(recurrenceFreq, recurrenceUntil),
            });
            toast.success(
                recurrenceFreq !== "none"
                    ? `Recurring event draft created (${recurrenceFreq}) — pending approval`
                    : "Event draft created — pending approval",
                { description: "Use the share buttons below to post it to your socials." }
            );
        } catch {
            toast.error("Couldn't create event");
        }
    };

    const publishUpdate = async (it) => {
        try {
            await addFeedPost({
                orgSlug: selectedOrgSlug,
                type: "Club update",
                title: it.title,
                body: it.description,
            });
            toast.success("Update published to Local Feed");
        } catch { toast.error("Couldn't publish"); }
    };

    const unlockOrganisation = async () => {
        if (!selectedOrgSlug) return;
        if (!orgPasswordInput.trim()) {
            toast.error("Enter the organisation password");
            return;
        }
        setUnlockBusy(true);
        try {
            const result = await api.loginOrgAccess(selectedOrgSlug, { password: orgPasswordInput.trim() });
            unlockOrgAccess(selectedOrgSlug, result?.token || "");
            setOrgPasswordInput("");
            toast.success("Organisation dashboard unlocked");
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not unlock organisation dashboard");
        } finally {
            setUnlockBusy(false);
        }
    };

    const changePassword = async () => {
        if (!selectedOrgSlug) return;
        if (!passwordForm.next.trim()) {
            toast.error("Enter a new password");
            return;
        }
        setPasswordBusy(true);
        try {
            if (role === "admin") {
                await api.changeOrgPassword(selectedOrgSlug, {
                    new_password: passwordForm.next.trim(),
                    admin_code: adminCodeSession,
                });
                toast.success("Organisation password updated by site admin");
            } else {
                await api.changeOrgPassword(selectedOrgSlug, {
                    current_password: passwordForm.current.trim(),
                    new_password: passwordForm.next.trim(),
                });
                toast.success("Organisation password changed");
            }
            setPasswordForm({ current: "", next: "" });
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Password update failed");
        } finally {
            setPasswordBusy(false);
        }
    };

    if (requiresOrgPassword) {
        return (
            <div data-testid="org-dashboard-lock" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="rounded-3xl border border-border bg-surface p-8">
                    <h1 className="font-display font-black text-3xl">Organisation access required</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Enter the organisation password to access this dashboard.
                    </p>
                    <div className="mt-5 grid gap-3">
                        <select
                            value={selectedOrgSlug}
                            onChange={(e) => setSelectedOrgSlug(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-2xl border border-border bg-background text-sm"
                        >
                            {orgs.map((o) => (
                                <option key={o.slug} value={o.slug}>{o.name}</option>
                            ))}
                        </select>
                        <input
                            type="password"
                            value={orgPasswordInput}
                            onChange={(e) => setOrgPasswordInput(e.target.value)}
                            placeholder="Organisation password"
                            className="w-full px-4 py-2.5 rounded-2xl border border-border bg-background text-sm"
                        />
                        <button
                            onClick={unlockOrganisation}
                            disabled={unlockBusy}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
                        >
                            {unlockBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Unlock dashboard
                        </button>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                        Default password for new organisations: Organisat10n!&
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div data-testid="org-dashboard" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <ImpersonationBanner selectedOrgSlug={selectedOrgSlug} orgName={org?.name} />
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
                <div className="flex items-start gap-4">
                    {org && <OrgAvatar org={org} size={64} rounded="rounded-2xl" className="shadow-sm" />}
                    <div>
                        <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                            Organisation dashboard
                        </span>
                        <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight mt-2">
                            Hi, {org?.name || "team"} 👋
                        </h1>
                        <p className="mt-2 text-muted-foreground text-sm max-w-xl">
                            Edit your profile, add events, post updates, and use our AI tool to publish
                            everywhere at once.
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <NotificationBell
                        count={unreadCount}
                        notifications={notifications}
                        org={org}
                        onRead={async (id) => {
                            await api.markNotificationRead(id);
                            setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
                        }}
                    />
                    <button
                        data-testid="contact-admin-open"
                        onClick={() => setContactOpen(true)}
                        className="inline-flex items-center gap-1 px-4 py-2 rounded-full border border-border bg-surface font-semibold text-xs"
                    >
                        <Send className="h-3.5 w-3.5" /> Contact admin
                    </button>
                    <select data-testid="org-switcher" value={selectedOrgSlug} onChange={(e) => setSelectedOrgSlug(e.target.value)}
                        className="flex-1 sm:flex-none min-w-0 max-w-full truncate px-4 py-2 rounded-full border border-border bg-surface text-sm">
                        {orgs.map((o) => (<option key={o.slug} value={o.slug}>{o.name}</option>))}
                    </select>
                </div>
            </div>

            {/* Quick actions row: profile, docs upload, share pack */}
            <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                <Link
                    to={`/edit-organisation/${selectedOrgSlug}`}
                    data-testid="qa-profile"
                    className="rounded-3xl border border-border bg-surface p-6 hover:-translate-y-1 transition-transform"
                >
                    <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary grid place-items-center"><Edit3 className="h-5 w-5" /></div>
                    <h3 className="font-display font-bold mt-3">Profile & branding</h3>
                    <p className="text-sm text-muted-foreground mt-1">Logo, cover, colour, about, contact and socials.</p>
                    <div className="mt-3 inline-flex items-center text-primary font-semibold text-sm">Edit profile →</div>
                </Link>

                <UploadDocsCard slug={selectedOrgSlug} docs={docs} onChange={loadDocs} />

                <SharePackCard slug={selectedOrgSlug} org={org} />
            </section>

            <section className="mb-8 rounded-3xl border border-border bg-surface p-6">
                <h3 className="font-display font-bold text-xl">Organisation password</h3>
                <p className="text-sm text-muted-foreground mt-1">
                    {role === "admin"
                        ? "Set or reset this organisation's password."
                        : "Change your organisation password. Default is Organisat10n!& until changed."}
                </p>
                <div className="mt-4 grid sm:grid-cols-2 gap-3">
                    {role !== "admin" && (
                        <input
                            type="password"
                            value={passwordForm.current}
                            onChange={(e) => setPasswordForm((prev) => ({ ...prev, current: e.target.value }))}
                            placeholder="Current password"
                            className="w-full px-4 py-2.5 rounded-2xl border border-border bg-background text-sm"
                        />
                    )}
                    <input
                        type="password"
                        value={passwordForm.next}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, next: e.target.value }))}
                        placeholder="New password"
                        className="w-full px-4 py-2.5 rounded-2xl border border-border bg-background text-sm"
                    />
                </div>
                <button
                    onClick={changePassword}
                    disabled={passwordBusy || (role === "admin" && !adminCodeSession)}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-60"
                >
                    {passwordBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Save password
                </button>
            </section>

            <section className="mb-8 space-y-4" data-testid="org-analytics-section">
                <div>
                    <h2 className="font-display font-black text-2xl">Your metrics</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Signals for how your page and events are performing over the last {analytics?.window_days || 30} days.
                    </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <Stat label="Profile views" value={metrics.page_views_30d || 0} icon={Eye} tone="primary" />
                    <Stat label="Event views" value={metrics.event_views_30d || 0} icon={BarChart3} />
                    <Stat label="Share clicks" value={metrics.share_clicks_30d || 0} icon={Sparkles} />
                    <Stat label="Followers" value={metrics.followers || 0} icon={Users} />
                    <Stat label="Upcoming events" value={metrics.upcoming_events || 0} icon={Calendar} />
                    <Stat label="Unread admin notes" value={metrics.notifications_unread || 0} icon={Bell} />
                </div>

                <div className="grid lg:grid-cols-3 gap-4">
                    <div className="rounded-3xl border border-border bg-surface p-5">
                        <h3 className="font-display font-bold text-lg">Audience mix</h3>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <MiniMetric label="Device followers" value={metrics.device_followers || 0} />
                            <MiniMetric label="Subscriber followers" value={metrics.subscriber_followers || 0} />
                            <MiniMetric label="Published events" value={metrics.published_events || 0} />
                            <MiniMetric label="Pending events" value={metrics.pending_events || 0} />
                            <MiniMetric label="Featured events" value={metrics.featured_events || 0} />
                            <MiniMetric label="Documents" value={metrics.documents || 0} />
                        </div>
                    </div>

                    <div className="rounded-3xl border border-border bg-surface p-5">
                        <h3 className="font-display font-bold text-lg">Share channels</h3>
                        {sharePlatforms.length === 0 ? (
                            <p className="mt-4 text-sm text-muted-foreground">Once people share your events, the channel mix appears here.</p>
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

                    <div className="rounded-3xl border border-border bg-surface p-5">
                        <h3 className="font-display font-bold text-lg">Top events</h3>
                        {topEvents.length === 0 ? (
                            <p className="mt-4 text-sm text-muted-foreground">Event engagement will populate here after visits and shares.</p>
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
                                        <div className="text-right text-xs text-muted-foreground">{eventItem.status}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* AI Feature */}
            <section
                data-testid="upload-once-section"
                className="relative overflow-hidden rounded-[2rem] border border-border bg-foreground text-background p-6 sm:p-10"
            >
                <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary blur-3xl opacity-30" />
                <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-secondary blur-3xl opacity-30" />
                <div className="relative grid lg:grid-cols-2 gap-8">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-[11px] font-bold tracking-wider uppercase">
                            <Wand2 className="h-3.5 w-3.5" /> Upload Once, Publish Everywhere
                        </div>
                        <h2 className="font-display font-black text-3xl sm:text-4xl mt-3 leading-tight">
                            Paste your flyer, newsletter or update.
                            <br />
                            We'll extract{" "}
                            <span className="text-secondary">every event</span> in it.
                        </h2>
                        <p className="mt-3 text-background/80 text-sm max-w-md">
                            Multiple events in a Word doc or newsletter? We'll break them out one by one —
                            each becomes a draft you can publish and share to your socials in one tap.
                        </p>
                        <textarea data-testid="ai-text-input" value={text} onChange={(e) => setText(e.target.value)}
                            placeholder="Paste your text here…" rows={7}
                            className="mt-5 w-full rounded-3xl bg-background/10 backdrop-blur border border-background/20 p-4 text-sm placeholder:text-background/40 text-background outline-none focus:ring-2 focus:ring-secondary" />
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button data-testid="ai-parse-btn" onClick={parse} disabled={loading}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary text-secondary-foreground font-semibold text-sm hover:scale-105 transition-transform disabled:opacity-60">
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                Generate drafts
                            </button>
                            <button onClick={() => setText(EXAMPLE)} data-testid="ai-example-btn"
                                className="inline-flex items-center gap-1 px-5 py-2.5 rounded-full text-sm font-semibold border-2 border-background/40 text-background">
                                Use an example
                            </button>
                        </div>
                    </div>

                    <div data-testid="ai-results" className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                        {!items.length && !loading && (
                            <div className="rounded-3xl border border-dashed border-background/30 p-8 text-center text-background/60 h-full grid place-items-center">
                                Drafts will appear here.
                            </div>
                        )}
                        {loading && (
                            <div className="rounded-3xl bg-background/10 backdrop-blur border border-background/20 p-8 text-center">
                                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                <p className="mt-3 text-sm text-background/70">Reading your text…</p>
                            </div>
                        )}
                        {items.map((it, idx) => (
                            <ParsedCard
                                key={idx} it={it}
                                onPublishEvent={(opts) => publishEvent(it, opts)}
                                onPublishUpdate={() => publishUpdate(it)}
                                onCopy={copy}
                            />
                        ))}
                    </div>
                </div>
            </section>

            <section className="mt-10">
                <OrgAnalyticsPanel slug={selectedOrgSlug} orgName={org?.name} />
            </section>

            {/* My events */}
            <section className="mt-10">
                <h2 className="font-display font-bold text-xl mb-3">Your events</h2>
                {myEvents.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-border p-8 text-sm text-muted-foreground text-center">
                        You haven't added any events yet.
                    </div>
                ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {myEvents.map((e) => (
                            <div key={e.id} className="rounded-3xl border border-border bg-surface p-5 flex flex-col" data-testid={`dash-event-${e.id}`}>
                                <div className="flex items-center gap-2">
                                    <CategoryBadge category={e.category} />
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                                        e.status === "approved" ? "bg-secondary text-secondary-foreground"
                                        : e.status === "pending" ? "bg-accent text-accent-foreground" : "bg-muted"
                                    }`}>{e.status}</span>
                                </div>
                                <h3 className="font-display font-bold mt-2">{e.title}</h3>
                                <p className="text-xs text-muted-foreground mt-1">{formatDate(e.start)} · {formatTime(e.start)}</p>
                                <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 mt-auto flex-wrap">
                                    <Link
                                        to={`/events/${e.id}`}
                                        className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                                    >
                                        View
                                    </Link>
                                    <a
                                        href={api.eventPosterPngUrl(e.id)}
                                        data-testid={`dash-event-poster-png-${e.id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-border text-[11px] font-semibold hover:bg-muted"
                                        title="Download 1080×1080 PNG poster"
                                    >
                                        PNG
                                    </a>
                                    <a
                                        href={api.eventPosterPdfUrl(e.id)}
                                        data-testid={`dash-event-poster-pdf-${e.id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-border text-[11px] font-semibold hover:bg-muted"
                                        title="Download A4 PDF poster"
                                    >
                                        PDF
                                    </a>
                                    <button
                                        type="button"
                                        data-testid={`dash-event-post-now-${e.id}`}
                                        onClick={() => setPostNowEvent(e)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold hover:brightness-110"
                                        title="One-click social bundle — poster + caption + share"
                                    >
                                        <Rocket className="h-3 w-3" /> Post Now
                                    </button>
                                    <button
                                        type="button"
                                        data-testid={`dash-event-duplicate-${e.id}`}
                                        onClick={async () => {
                                            try {
                                                const dup = await api.duplicateEvent(e.id);
                                                toast.success("Event duplicated — fill the new date and publish");
                                                await refresh();
                                                if (dup?.id) window.location.assign(`/edit-event/${dup.id}`);
                                            } catch (err) {
                                                toast.error(err?.response?.data?.detail || "Could not duplicate event");
                                            }
                                        }}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-border text-[11px] font-semibold hover:bg-muted"
                                    >
                                        Duplicate
                                    </button>
                                    <Link
                                        to={`/edit-event/${e.id}`}
                                        data-testid={`dash-event-edit-${e.id}`}
                                        className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold hover:brightness-110"
                                    >
                                        <Edit3 className="h-3 w-3" /> Edit
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <ContactAdminDialog
                open={contactOpen}
                onClose={() => setContactOpen(false)}
                fromOrgSlug={selectedOrgSlug}
                fromEmail={org?.email}
                fromName={org?.name}
            />

            <PostNowDialog
                event={postNowEvent}
                open={!!postNowEvent}
                onOpenChange={(v) => { if (!v) setPostNowEvent(null); }}
            />
        </div>
    );
}

/* Notification bell + full-message dialog */
function NotificationBell({ count, notifications, onRead, org }) {
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState(null);

    const openMessage = (n) => {
        setSelected(n);
        if (!n.read) onRead(n.id);
        setOpen(false); // close dropdown so the dialog isn't fighting for focus
    };

    return (
        <div className="relative">
            <button
                data-testid="notification-bell"
                onClick={() => setOpen((o) => !o)}
                className="relative h-10 w-10 grid place-items-center rounded-full border border-border bg-surface"
                aria-label="Notifications"
            >
                <Bell className="h-4 w-4" />
                {count > 0 && (
                    <span data-testid="notification-count" className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold grid place-items-center">
                        {count}
                    </span>
                )}
            </button>
            {open && (
                <div className="fixed left-4 right-4 top-auto mt-2 sm:absolute sm:left-auto sm:right-0 sm:w-80 rounded-2xl border border-border bg-surface shadow-xl z-50 max-h-[70vh] sm:max-h-96 overflow-y-auto">
                    <div className="p-3 border-b border-border font-semibold text-sm flex items-center gap-2">
                        <Bell className="h-3.5 w-3.5" /> Notifications from admin
                    </div>
                    {notifications.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground">No messages.</div>
                    ) : notifications.map((n) => (
                        <button
                            key={n.id}
                            data-testid={`notif-${n.id}`}
                            onClick={() => openMessage(n)}
                            className={`w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted transition ${n.read ? "" : "bg-primary/5"}`}
                        >
                            <div className="flex items-start gap-2">
                                {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-sm truncate">{n.title}</div>
                                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</div>
                                    <div className="text-[10px] text-muted-foreground mt-1 flex items-center justify-between gap-2">
                                        <span>
                                            {new Date(n.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                        <span className="inline-flex items-center gap-0.5 font-semibold text-primary uppercase tracking-wider text-[9px]">
                                            Open <ChevronRight className="h-2.5 w-2.5" />
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            <NotificationDialog
                notif={selected}
                org={org}
                onClose={() => setSelected(null)}
                onCopy={async (text) => {
                    try {
                        await navigator.clipboard.writeText(text);
                        toast.success("Message copied");
                    } catch {
                        toast.error("Copy failed");
                    }
                }}
            />
        </div>
    );
}

/* Full-message dialog for a single admin notification + reply thread */
function NotificationDialog({ notif, org, onClose, onCopy }) {
    const [replies, setReplies] = useState([]);
    const [replyBody, setReplyBody] = useState("");
    const [sending, setSending] = useState(false);
    const [loadingThread, setLoadingThread] = useState(false);

    useEffect(() => {
        if (!notif) {
            setReplies([]);
            setReplyBody("");
            return;
        }
        let cancelled = false;
        (async () => {
            setLoadingThread(true);
            try {
                const t = await api.notificationThread(notif.id);
                if (!cancelled) setReplies(t.replies || []);
            } catch {
                if (!cancelled) setReplies([]);
            } finally {
                if (!cancelled) setLoadingThread(false);
            }
        })();
        return () => { cancelled = true; };
        // Re-fetch only when the notification identity changes, not on parent re-renders.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [notif?.id]);

    const sendReply = async () => {
        if (!notif || !replyBody.trim()) return;
        setSending(true);
        try {
            const created = await api.contactAdmin({
                from_org_slug: org?.slug,
                from_email: org?.email,
                from_name: org?.name,
                subject: `Re: ${notif.title}`,
                body: replyBody.trim(),
                in_reply_to: notif.id,
            });
            setReplies((r) => [...r, created]);
            setReplyBody("");
            toast.success("Reply sent to admin");
        } catch {
            toast.error("Couldn't send reply");
        } finally {
            setSending(false);
        }
    };

    return (
        <Dialog open={!!notif} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-lg" data-testid="notification-dialog">
                {notif && (
                    <>
                        <DialogHeader>
                            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                                <Bell className="h-3 w-3" /> Admin message
                            </div>
                            <DialogTitle className="mt-1 text-xl leading-tight">
                                {notif.title}
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                Received {new Date(notif.created_at).toLocaleString("en-GB", {
                                    weekday: "short", day: "numeric", month: "short", year: "numeric",
                                    hour: "2-digit", minute: "2-digit",
                                })}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="rounded-2xl bg-muted/50 p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-[35vh] overflow-y-auto">
                            {notif.body}
                        </div>

                        {/* Reply thread */}
                        {replies.length > 0 && (
                            <div className="mt-1">
                                <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground mb-2">
                                    Conversation
                                </div>
                                <div className="space-y-2 max-h-[25vh] overflow-y-auto">
                                    {replies.map((r) => (
                                        <div
                                            key={r.id}
                                            data-testid={`notif-reply-${r.id}`}
                                            className="rounded-2xl border border-border bg-background p-3 text-sm"
                                        >
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-secondary-foreground/70">
                                                    {r.from_name || "Your reply"} → Admin
                                                </span>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {new Date(r.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                                </span>
                                            </div>
                                            <div className="whitespace-pre-wrap leading-relaxed">{r.body}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {loadingThread && <div className="text-xs text-muted-foreground">Loading conversation…</div>}

                        {/* Reply composer */}
                        <div className="mt-2 rounded-2xl border border-border bg-background p-3">
                            <label className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                                Reply to admin
                            </label>
                            <textarea
                                data-testid="notif-reply-input"
                                value={replyBody}
                                onChange={(e) => setReplyBody(e.target.value)}
                                placeholder="Add a quick reply — for example, 'Accessibility notes added, ready for review.'"
                                rows={3}
                                className="mt-1.5 w-full text-sm rounded-xl bg-muted/40 border border-border p-2.5 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                        e.preventDefault();
                                        sendReply();
                                    }
                                }}
                            />
                            <div className="mt-2 flex items-center justify-between">
                                <span className="text-[10px] text-muted-foreground">
                                    <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[9px]">⌘/Ctrl</kbd>+<kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[9px]">Enter</kbd> to send
                                </span>
                                <button
                                    data-testid="notif-reply-send"
                                    onClick={sendReply}
                                    disabled={sending || !replyBody.trim()}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
                                >
                                    {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                    Send reply
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                data-testid="notif-dialog-copy"
                                onClick={() => onCopy(`${notif.title}\n\n${notif.body}`)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-border text-xs font-semibold hover:bg-muted"
                            >
                                <Copy className="h-3.5 w-3.5" /> Copy
                            </button>
                            <button
                                data-testid="notif-dialog-close"
                                onClick={onClose}
                                className="inline-flex items-center px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold"
                            >
                                Close
                            </button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

/* Parsed AI card (single item) */
function ParsedCard({ it, onPublishEvent, onPublishUpdate, onCopy }) {
    const [recurrenceFreq, setRecurrenceFreq] = useState("none");
    const [recurrenceUntil, setRecurrenceUntil] = useState("");
    const shareUrl = typeof window !== "undefined"
        ? `${window.location.origin}/events`
        : "https://blackrodnow.local/events";
    return (
        <div className="rounded-3xl border border-background/20 bg-background/10 backdrop-blur p-5">
            <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold uppercase tracking-wider">
                    <Calendar className="h-3 w-3" /> {it.suggested_type === "event" ? "Event draft" : "Update draft"}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-background/60">{it.category}</span>
            </div>
            <div className="mt-2 font-display font-bold text-lg text-background">{it.title}</div>
            {it.suggested_type === "event" && (
                <div className="text-xs text-background/70 mt-1">
                    {it.date || "Date TBC"}
                    {it.start_time ? ` · ${it.start_time}` : ""}
                    {it.location ? ` · ${it.location}` : ""}
                </div>
            )}
            <p className="text-sm text-background/90 mt-2 line-clamp-3">{it.description}</p>
            <div className="mt-3 rounded-2xl bg-primary/15 border border-primary/30 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1"><Megaphone className="h-3 w-3" /> Social caption</div>
                <p className="mt-1 text-sm text-background/90 whitespace-pre-line">{it.social_caption}</p>
                <button onClick={() => onCopy(it.social_caption, "Caption")} className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-background/15 text-background text-[10px] uppercase tracking-wider">
                    <Copy className="h-3 w-3" /> Copy
                </button>
            </div>
            <div className="mt-2 rounded-2xl bg-accent/15 border border-accent/30 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-accent flex items-center gap-1"><Bell className="h-3 w-3" /> Notification</div>
                <p className="mt-1 text-sm text-background/90">{it.notification_text}</p>
            </div>
            {it.suggested_type === "event" && (
                <div className="mt-3 rounded-2xl bg-background/5 border border-background/20 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-background/70 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Repeat this event
                    </div>
                    <div className="mt-2 grid sm:grid-cols-2 gap-2">
                        <select
                            data-testid="parsed-recurrence-freq"
                            value={recurrenceFreq}
                            onChange={(e) => setRecurrenceFreq(e.target.value)}
                            className="w-full px-3 py-2 rounded-2xl border border-background/30 bg-background text-foreground text-xs"
                        >
                            <option value="none">Doesn&apos;t repeat</option>
                            <option value="daily">Every day</option>
                            <option value="weekly">Every week</option>
                            <option value="biweekly">Every 2 weeks</option>
                            <option value="monthly">Every month</option>
                            <option value="annually">Every year</option>
                        </select>
                        <input
                            data-testid="parsed-recurrence-until"
                            type="date"
                            value={recurrenceUntil}
                            onChange={(e) => setRecurrenceUntil(e.target.value)}
                            disabled={recurrenceFreq === "none"}
                            placeholder="Until"
                            className="w-full px-3 py-2 rounded-2xl border border-background/30 bg-background text-foreground text-xs disabled:opacity-60"
                        />
                    </div>
                </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
                <button
                    data-testid="parsed-publish-event"
                    onClick={() => onPublishEvent({ recurrenceFreq, recurrenceUntil })}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-secondary text-secondary-foreground font-semibold text-xs"
                >
                    <Calendar className="h-3.5 w-3.5" /> Create event
                </button>
                <button data-testid="parsed-publish-update" onClick={onPublishUpdate} className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-primary text-primary-foreground font-semibold text-xs">
                    <Megaphone className="h-3.5 w-3.5" /> Post to feed
                </button>
            </div>
            <div className="mt-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-background/60 mb-1.5">Share to socials</div>
                <ShareButtons text={it.social_caption || it.description} url={shareUrl} title={it.title} />
            </div>
        </div>
    );
}

/* Share Pack card */
function SharePackCard({ slug, org }) {
    const [busy, setBusy] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [pack, setPack] = useState(null);

    const openPreview = async () => {
        if (!slug) return;
        setBusy(true);
        try {
            const p = await api.getSharePack(slug);
            setPack(p);
            setPreviewOpen(true);
        } catch {
            toast.error("Couldn't load share pack");
        } finally { setBusy(false); }
    };

    const sendEmail = async () => {
        setBusy(true);
        try {
            const r = await api.emailSharePack(slug);
            if (r.email?.mocked) {
                toast.success("Share pack email queued (MOCKED)", {
                    description: `Recipient: ${r.to} · ${r.count} event${r.count === 1 ? "" : "s"}. Real send activates once Resend key is set.`,
                });
            } else {
                toast.success(`Share pack sent to ${r.to}`);
            }
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Send failed");
        } finally { setBusy(false); }
    };

    return (
        <>
            <div className="rounded-3xl border border-border bg-surface p-6">
                <div className="h-10 w-10 rounded-2xl bg-accent/15 text-accent-foreground grid place-items-center"><Mail className="h-5 w-5" /></div>
                <h3 className="font-display font-bold mt-3">Weekly share pack</h3>
                <p className="text-sm text-muted-foreground mt-1">
                    A ready-to-share pack of your upcoming events with copy-paste captions and 1-tap social links.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                    <button
                        data-testid="share-pack-preview"
                        onClick={openPreview}
                        disabled={busy}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-border text-xs font-semibold hover:bg-muted disabled:opacity-60"
                    >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Preview
                    </button>
                    <button
                        data-testid="share-pack-email"
                        onClick={sendEmail}
                        disabled={busy || !org?.email}
                        title={org?.email ? `Send to ${org.email}` : "Add an email on the org profile first"}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 disabled:opacity-60"
                    >
                        <Send className="h-3.5 w-3.5" /> Email me the pack
                    </button>
                </div>
                {!org?.email && (
                    <div className="mt-2 text-[11px] text-muted-foreground">
                        Add an email on your profile to enable emailing.
                    </div>
                )}
            </div>
            <SharePackPreviewDialog open={previewOpen} onClose={() => setPreviewOpen(false)} pack={pack} />
        </>
    );
}

function MiniMetric({ label, value }) {
    return (
        <div className="rounded-2xl bg-muted/50 px-3 py-3">
            <div className="text-lg font-display font-bold text-foreground">{value}</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
        </div>
    );
}

/* Share Pack preview dialog */
function SharePackPreviewDialog({ open, onClose, pack }) {
    if (!pack) return null;
    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Share pack — {pack.count} upcoming event{pack.count === 1 ? "" : "s"}</DialogTitle>
                </DialogHeader>
                {pack.events.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No upcoming events to include. Create some events first and they'll appear here.
                    </p>
                ) : (
                    <div className="space-y-4">
                        {pack.events.map((e) => (
                            <div key={e.id} className="rounded-2xl border border-border bg-background p-4">
                                <div className="flex items-start gap-3">
                                    {e.image && (
                                        <img src={e.image} alt="" className="h-16 w-16 rounded-xl object-cover shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[10px] font-bold tracking-wider uppercase text-primary">
                                            {e.start ? new Date(e.start).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                                        </div>
                                        <div className="font-display font-bold text-base leading-tight">{e.title}</div>
                                        <div className="text-xs text-muted-foreground">{e.venue}</div>
                                    </div>
                                </div>
                                <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{e.description}</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <a href={e.share_links.facebook} target="_blank" rel="noopener noreferrer" data-testid={`pack-fb-${e.id}`} className="inline-flex items-center px-3 py-1.5 rounded-full bg-[#1877F2] text-white text-[11px] font-semibold">Facebook</a>
                                    <a href={e.share_links.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-3 py-1.5 rounded-full bg-[#0A66C2] text-white text-[11px] font-semibold">LinkedIn</a>
                                    <a href={e.share_links.twitter} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-3 py-1.5 rounded-full bg-black text-white text-[11px] font-semibold">X</a>
                                    <a href={e.share_links.whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-3 py-1.5 rounded-full bg-[#25D366] text-white text-[11px] font-semibold">WhatsApp</a>
                                    <button
                                        onClick={async () => { try { await navigator.clipboard.writeText(`${e.share_text}\n${e.canonical_url}`); toast.success("Caption copied"); } catch { toast.error("Copy failed"); } }}
                                        className="inline-flex items-center px-3 py-1.5 rounded-full bg-muted text-foreground text-[11px] font-semibold"
                                    >Copy caption</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

/* Upload docs card */
function UploadDocsCard({ slug, docs, onChange }) {
    const [busy, setBusy] = useState(false);
    const upload = async (file) => {
        if (!file || !slug) return;
        setBusy(true);
        try {
            await api.uploadDoc(slug, file);
            toast.success(`Uploaded ${file.name}`);
            onChange?.();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Upload failed");
        } finally { setBusy(false); }
    };
    return (
        <div className="rounded-3xl border border-border bg-surface p-6">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary grid place-items-center"><UploadCloud className="h-5 w-5" /></div>
            <h3 className="font-display font-bold mt-3">Documents</h3>
            <p className="text-sm text-muted-foreground mt-1">Membership forms, kit lists, meeting minutes — up to 10MB (PDF, docx, images).</p>
            <label className="mt-3 inline-flex items-center gap-1 px-4 py-2 rounded-full bg-primary text-primary-foreground font-semibold text-xs cursor-pointer">
                <UploadCloud className="h-3.5 w-3.5" /> {busy ? "Uploading…" : "Upload file"}
                <input
                    type="file"
                    data-testid="doc-upload-input"
                    className="hidden"
                    disabled={busy}
                    onChange={(e) => upload(e.target.files?.[0])}
                />
            </label>
            {docs.length > 0 && (
                <ul className="mt-4 space-y-1 max-h-32 overflow-y-auto">
                    {docs.map((d) => (
                        <li key={d.id} className="flex items-center gap-2 text-xs">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <a href={api.docDownloadUrl(d.id)} target="_blank" rel="noreferrer" className="text-primary truncate flex-1">{d.name}</a>
                            <button
                                onClick={async () => { await api.deleteDoc(slug, d.id); onChange?.(); toast.info("Removed"); }}
                                className="h-6 w-6 grid place-items-center rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                aria-label="Delete"
                            ><Trash2 className="h-3 w-3" /></button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/* Contact admin dialog */
function ContactAdminDialog({ open, onClose, fromOrgSlug, fromEmail, fromName }) {
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const send = async () => {
        if (!subject || !body) return toast.error("Subject and message needed");
        try {
            await api.contactAdmin({ from_org_slug: fromOrgSlug, from_email: fromEmail, from_name: fromName, subject, body });
            toast.success("Message sent to Blackrod Now admins");
            setSubject(""); setBody(""); onClose();
        } catch { toast.error("Failed to send"); }
    };
    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Contact Blackrod Now admin</DialogTitle></DialogHeader>
                <input data-testid="contact-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="w-full px-3 py-2 rounded-2xl border border-border bg-background text-sm" />
                <textarea data-testid="contact-body" value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="Your message…" className="w-full px-3 py-2 rounded-2xl border border-border bg-background text-sm" />
                <button data-testid="contact-send" onClick={send} className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-primary text-primary-foreground font-semibold text-xs">
                    <Send className="h-3.5 w-3.5" /> Send message
                </button>
            </DialogContent>
        </Dialog>
    );
}

function ImpersonationBanner({ selectedOrgSlug, orgName }) {
    const { impersonatingOrgSlug, stopImpersonation } = useApp();
    if (!impersonatingOrgSlug || impersonatingOrgSlug !== selectedOrgSlug) return null;
    return (
        <div
            data-testid="impersonation-banner"
            className="mb-6 rounded-2xl border-2 border-primary/40 bg-primary/10 text-foreground px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        >
            <div className="flex items-center gap-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <div className="text-sm">
                    <div className="font-semibold">You&apos;re viewing as {orgName || selectedOrgSlug}</div>
                    <div className="text-xs text-muted-foreground">Site admin impersonation — actions here appear as if from this organisation.</div>
                </div>
            </div>
            <button
                type="button"
                data-testid="stop-impersonation-btn"
                onClick={() => {
                    stopImpersonation();
                    toast.success("Returned to admin");
                }}
                className="self-start sm:self-auto px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold whitespace-nowrap"
            >
                Return to admin
            </button>
        </div>
    );
}


function OrgAnalyticsPanel({ slug, orgName }) {
    const [data, setData] = useState(null);
    const [days, setDays] = useState(30);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!slug) return;
        setLoading(true);
        api.orgAnalyticsSeries(slug, days)
            .then((res) => setData(res))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [slug, days]);

    const series = data?.series || [];
    const totals = data?.totals || { event_views: 0, org_views: 0, share_clicks: 0 };
    const best = data?.best_event;
    const maxVal = Math.max(1, ...series.map((s) => s.event_views + s.org_views));

    // Simple SVG sparkline
    const W = 640;
    const H = 140;
    const pad = 8;
    const stepX = series.length > 1 ? (W - 2 * pad) / (series.length - 1) : 0;
    const points = series
        .map((s, i) => {
            const x = pad + i * stepX;
            const y = H - pad - ((s.event_views + s.org_views) / maxVal) * (H - 2 * pad);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");

    return (
        <div data-testid="org-analytics-panel" className="rounded-3xl border border-border bg-surface p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="font-display font-bold text-xl">Reach for {orgName || slug}</h2>
                    <p className="text-sm text-muted-foreground mt-1">Views, shares and volunteer clicks over the last {days} days.</p>
                </div>
                <div className="flex items-center gap-2">
                    {[7, 30, 90].map((d) => (
                        <button
                            key={d}
                            type="button"
                            data-testid={`org-analytics-range-${d}`}
                            onClick={() => setDays(d)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${days === d ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:bg-muted"}`}
                        >
                            {d}d
                        </button>
                    ))}
                </div>
            </div>

            <div className="mt-4 grid sm:grid-cols-3 gap-3">
                <Stat label="Event views" value={totals.event_views} />
                <Stat label="Org views" value={totals.org_views} />
                <Stat label="Share clicks" value={totals.share_clicks} />
            </div>

            {best ? (
                <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-2xl bg-primary text-primary-foreground grid place-items-center font-black">★</div>
                    <div className="flex-1">
                        <div className="text-[11px] uppercase tracking-wider text-primary font-black">Best performing event</div>
                        <div className="font-semibold text-sm mt-0.5">{best.title}</div>
                    </div>
                    <div className="text-right">
                        <div className="font-display font-black text-2xl leading-none">{best.views}</div>
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">views</div>
                    </div>
                </div>
            ) : (
                <div className="mt-4 text-xs text-muted-foreground">
                    {loading ? "Loading…" : "No analytics recorded yet in this window. Views + shares will start appearing here as people engage with your content."}
                </div>
            )}

            {series.length > 0 && (
                <div className="mt-4">
                    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32">
                        <defs>
                            <linearGradient id="orgAnalyticsFill" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor="rgb(0,82,255)" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="rgb(0,82,255)" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <polyline
                            fill="none"
                            stroke="rgb(0,82,255)"
                            strokeWidth="2"
                            points={points}
                        />
                        <polygon
                            fill="url(#orgAnalyticsFill)"
                            points={`${pad},${H - pad} ${points} ${W - pad},${H - pad}`}
                        />
                    </svg>
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                        <span>{series[0]?.day}</span>
                        <span>{series[series.length - 1]?.day}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

