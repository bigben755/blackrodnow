import React, { useState } from "react";
import axios from "axios";
import { useApp } from "@/context/AppContext";
import { CategoryBadge, formatDate, formatTime } from "@/components/Cards";
import {
    Wand2,
    Copy,
    Calendar,
    Megaphone,
    Bell,
    Sparkles,
    Loader2,
    Share2,
    Facebook,
    Instagram,
    UploadCloud,
    Image as ImageIcon,
    HeartHandshake,
} from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const EXAMPLE = `Summer Fair! Saturday 14 June, 11am-4pm at Blackrod Community Centre. Stalls, bouncy castles, raffle, hot food and live music. Free entry — all proceeds to the food pantry. Bring your wellies (and the kids!).`;

export default function OrgDashboard() {
    const { orgs, events, addEvent, addFeedPost } = useApp();
    const [selectedOrgSlug, setSelectedOrgSlug] = useState(orgs[0]?.slug || "");
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(false);
    const [parsed, setParsed] = useState(null);

    const org = orgs.find((o) => o.slug === selectedOrgSlug);
    const myEvents = events.filter((e) => e.orgSlug === selectedOrgSlug);

    const parse = async () => {
        if (!text.trim()) {
            toast.error("Paste some content first");
            return;
        }

        setLoading(true);

        try {
            const res = await axios.post(`${API}/parse-content`, { text });
            setParsed(res.data);
            toast.success("Parsed!", { description: "Review and publish below." });
        } catch (e) {
            toast.error("Couldn't parse just now — try again");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const copy = async (val, label) => {
        try {
            await navigator.clipboard.writeText(val);
            toast.success(`${label} copied`);
        } catch {
            toast.error("Copy failed");
        }
    };

    const publishEvent = () => {
        if (!parsed) return;

        let start = null;

        try {
            const d = parsed.date ? new Date(parsed.date) : new Date(Date.now() + 86400000);

            if (parsed.start_time) {
                const [h, m] = parseTime(parsed.start_time);
                d.setHours(h, m || 0, 0, 0);
            }

            start = d.toISOString();
        } catch {
            start = new Date(Date.now() + 86400000).toISOString();
        }

        const end = new Date(new Date(start).getTime() + 2 * 60 * 60 * 1000).toISOString();

        addEvent({
            title: parsed.title,
            orgSlug: selectedOrgSlug,
            category: parsed.category || "Community",
            start,
            end,
            venue: parsed.location || "TBC",
            address: parsed.location || "Blackrod",
            description: parsed.description,
            cost: "Free",
            age: "All ages",
            accessibility: "Please contact us for details",
            booking: "",
            contactEmail: org?.email || "hello@blackrodnow.example",
            contactPhone: org?.phone || "",
            image: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&q=80",
        });

        toast.success("Event draft created (pending approval)");
    };

    const publishUpdate = () => {
        if (!parsed) return;

        addFeedPost({
            orgSlug: selectedOrgSlug,
            type: "Club update",
            title: parsed.title,
            body: parsed.description,
        });

        toast.success("Update published to Local Feed");
    };

    return (
        <div data-testid="org-dashboard" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
                <div>
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                        Organisation dashboard
                    </span>

                    <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight mt-2">
                        Hi, {org?.name || "team"} 👋
                    </h1>

                    <p className="mt-2 text-muted-foreground text-sm max-w-xl">
                        Edit your profile, add events, post updates, and use our AI tool to publish
                        everywhere at once. Free training available to support you getting set up.
                    </p>
                </div>

                <select
                    data-testid="org-switcher"
                    value={selectedOrgSlug}
                    onChange={(e) => setSelectedOrgSlug(e.target.value)}
                    className="px-4 py-2.5 rounded-full border border-border bg-surface text-sm"
                >
                    {orgs.map((o) => (
                        <option key={o.slug} value={o.slug}>
                            {o.name}
                        </option>
                    ))}
                </select>
            </div>

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
                            Paste your flyer or update.
                            <br />
                            We'll turn it into{" "}
                            <span className="text-secondary">five things</span>.
                        </h2>

                        <p className="mt-3 text-background/80 text-sm max-w-md">
                            Page update · Event draft · Local feed post · Social caption · Notification —
                            generated by AI in seconds.
                        </p>

                        <textarea
                            data-testid="ai-text-input"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Paste your text here…"
                            rows={6}
                            className="mt-5 w-full rounded-3xl bg-background/10 backdrop-blur border border-background/20 p-4 text-sm placeholder:text-background/40 text-background outline-none focus:ring-2 focus:ring-secondary"
                        />

                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                data-testid="ai-parse-btn"
                                onClick={parse}
                                disabled={loading}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary text-secondary-foreground font-semibold text-sm hover:scale-105 transition-transform disabled:opacity-60"
                            >
                                {loading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Sparkles className="h-4 w-4" />
                                )}
                                Generate drafts
                            </button>

                            <button
                                onClick={() => setText(EXAMPLE)}
                                data-testid="ai-example-btn"
                                className="inline-flex items-center gap-1 px-5 py-2.5 rounded-full text-sm font-semibold border-2 border-background/40 text-background"
                            >
                                Use an example
                            </button>
                        </div>
                    </div>

                    <div data-testid="ai-results" className="space-y-3">
                        {!parsed && !loading && (
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

                        {parsed && (
                            <>
                                <ResultCard
                                    tone="primary"
                                    icon={Calendar}
                                    title={parsed.suggested_type === "event" ? "Event draft" : "Update draft"}
                                    actionLabel={parsed.suggested_type === "event" ? "Create event draft" : "Create update"}
                                    onAction={parsed.suggested_type === "event" ? publishEvent : publishUpdate}
                                    testid="ai-card-event"
                                >
                                    <div className="font-display font-bold text-lg text-background">
                                        {parsed.title}
                                    </div>

                                    <div className="text-xs text-background/70 mt-1">
                                        {parsed.date || "Date TBC"} · {parsed.start_time || ""}{" "}
                                        {parsed.location ? `· ${parsed.location}` : ""} ·{" "}
                                        {parsed.category}
                                    </div>

                                    <p className="text-sm text-background/90 mt-2 line-clamp-3">
                                        {parsed.description}
                                    </p>
                                </ResultCard>

                                <ResultCard
                                    tone="secondary"
                                    icon={Megaphone}
                                    title="Social caption"
                                    actionLabel="Copy caption"
                                    onAction={() => copy(parsed.social_caption, "Caption")}
                                    extra={
                                        <div className="flex gap-2 mt-2">
                                            <button
                                                data-testid="ai-post-fb"
                                                onClick={() => toast.info("Facebook posting placeholder")}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-background/15 text-background text-xs"
                                            >
                                                <Facebook className="h-3 w-3" /> Post to Facebook
                                            </button>

                                            <button
                                                data-testid="ai-post-ig"
                                                onClick={() => toast.info("Instagram posting placeholder")}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-background/15 text-background text-xs"
                                            >
                                                <Instagram className="h-3 w-3" /> Post to Instagram
                                            </button>
                                        </div>
                                    }
                                    testid="ai-card-social"
                                >
                                    <p className="text-sm text-background/90 leading-relaxed whitespace-pre-line">
                                        {parsed.social_caption}
                                    </p>
                                </ResultCard>

                                <ResultCard
                                    tone="accent"
                                    icon={Bell}
                                    title="Push notification"
                                    actionLabel="Copy notification"
                                    onAction={() => copy(parsed.notification_text, "Notification")}
                                    testid="ai-card-notif"
                                >
                                    <p className="text-sm text-background/90">
                                        {parsed.notification_text}
                                    </p>
                                </ResultCard>
                            </>
                        )}
                    </div>
                </div>
            </section>

            {/* Quick actions */}
            <section className="mt-10 grid lg:grid-cols-3 gap-4">
                <QuickAction
                    icon={ImageIcon}
                    title="Profile & branding"
                    desc="Logo, cover, colour, about — keep it fresh."
                    cta="Edit profile"
                    onClick={() => toast.info("Profile editor placeholder")}
                    testid="qa-profile"
                />

                <QuickAction
                    icon={UploadCloud}
                    title="Upload documents"
                    desc="Membership forms, kit lists, year planners."
                    cta="Upload"
                    onClick={() => toast.info("File upload placeholder")}
                    testid="qa-upload"
                />

                <QuickAction
                    icon={Share2}
                    title="Add social links"
                    desc="Facebook, Instagram, TikTok and LinkedIn."
                    cta="Manage"
                    onClick={() => toast.info("Social links placeholder")}
                    testid="qa-social"
                />
            </section>

            {/* Engagement stats */}
            <section className="mt-10 grid lg:grid-cols-4 gap-4">
                <StatTile label="Profile views" value={1248} />
                <StatTile label="Followers" value={84} />
                <StatTile label="Event clicks" value={362} />
                <StatTile label="Newsletter mentions" value={6} />
            </section>

            <section className="mt-10">
                <div className="rounded-[2rem] border border-border bg-surface p-6">
                    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-[11px] font-bold tracking-wider uppercase">
                                <HeartHandshake className="h-3.5 w-3.5" /> Community funded
                            </div>

                            <h2 className="font-display font-black text-3xl sm:text-4xl tracking-tight mt-3">
                                Free for local organisations
                            </h2>

                            <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">
                                The Community Alliance Fund covers the hub so clubs and groups can manage events and updates without extra fees.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Upcoming events */}
            <section className="mt-10">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-3">
                    <div>
                        <h2 className="font-display font-bold text-xl">Your upcoming events</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Normal event listings are free. You can highlight key events through our community channels.
                        </p>
                    </div>
                </div>

                {myEvents.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-border p-8 text-sm text-muted-foreground text-center">
                        You haven't added any events yet.
                    </div>
                ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {myEvents.map((e) => (
                            <div
                                key={e.id}
                                className="rounded-3xl border border-border bg-surface p-5"
                                data-testid={`dash-event-${e.id}`}
                            >
                                <div className="flex items-center gap-2">
                                    <CategoryBadge category={e.category} />

                                    <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                                            e.status === "approved"
                                                ? "bg-secondary text-secondary-foreground"
                                                : e.status === "pending"
                                                ? "bg-accent text-accent-foreground"
                                                : "bg-muted"
                                        }`}
                                    >
                                        {e.status}
                                    </span>

                                    {e.featured && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-primary text-primary-foreground">
                                            Featured
                                        </span>
                                    )}
                                </div>

                                <h3 className="font-display font-bold mt-2">{e.title}</h3>

                                <p className="text-xs text-muted-foreground mt-1">
                                    {formatDate(e.start)} · {formatTime(e.start)}
                                </p>

                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

function parseTime(t) {
    const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(t || "");

    if (!m) return [10, 0];

    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const ap = (m[3] || "").toLowerCase();

    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;

    return [h, min];
}

const ResultCard = ({ tone, icon: Icon, title, actionLabel, onAction, children, extra, testid }) => {
    const accent =
        tone === "primary"
            ? "from-primary/30 to-primary/0 border-primary/30"
            : tone === "secondary"
            ? "from-secondary/30 to-secondary/0 border-secondary/40"
            : "from-accent/30 to-accent/0 border-accent/30";

    return (
        <div
            data-testid={testid}
            className={`rounded-3xl border bg-gradient-to-br ${accent} p-5 backdrop-blur`}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 text-background/90 text-[11px] font-bold uppercase tracking-wider">
                    <Icon className="h-3.5 w-3.5" /> {title}
                </div>

                <button
                    onClick={onAction}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground font-semibold text-[11px] uppercase tracking-wider"
                >
                    <Copy className="h-3 w-3" /> {actionLabel}
                </button>
            </div>

            <div className="mt-2">{children}</div>

            {extra}
        </div>
    );
};

const QuickAction = ({ icon: Icon, title, desc, cta, onClick, testid }) => (
    <button
        data-testid={testid}
        onClick={onClick}
        className="text-left rounded-3xl border border-border bg-surface p-6 hover:-translate-y-1 transition-transform"
    >
        <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary grid place-items-center">
            <Icon className="h-5 w-5" />
        </div>

        <h3 className="font-display font-bold mt-3">{title}</h3>

        <p className="text-sm text-muted-foreground mt-1">{desc}</p>

        <div className="mt-3 inline-flex items-center text-primary font-semibold text-sm">
            {cta} →
        </div>
    </button>
);

const StatTile = ({ label, value }) => (
    <div className="rounded-3xl border border-border bg-surface p-5">
        <div className="text-3xl font-display font-black">{value.toLocaleString()}</div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
            {label}
        </div>
    </div>
);

