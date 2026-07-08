import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { CategoryBadge, formatDate, formatTime } from "@/components/Cards";
import {
    Wand2, Copy, Calendar, Megaphone, Bell, Sparkles, Loader2, Share2,
    Facebook, Instagram, Image as ImageIcon, FileText, UploadCloud,
    Send, Edit3, Plug, Trash2, ChevronDown, Check,
} from "lucide-react";
import { toast } from "sonner";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const EXAMPLE = `Summer Fair! Saturday 14 June, 11am-4pm at Blackrod Community Centre. Stalls, bouncy castles, raffle, hot food and live music. Free entry.

Also, Youth Football Open Day - Sunday 15 June, 10am-12:30pm at Aspull Common. Ages 5-14, free to try. Just turn up in trainers.

Community Clean-Up: Village Green, Saturday 21 June, 10am-12pm. Bags & brew provided.`;

export default function OrgDashboard() {
    const { orgs, events, addEvent, addFeedPost, activeOrgSlug, setActiveOrgSlug, refresh } = useApp();

    const [selectedOrgSlug, setSelectedOrgSlug] = useState(activeOrgSlug || orgs[0]?.slug || "");
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]); // multi-parse result
    const [notifications, setNotifications] = useState([]);
    const [docs, setDocs] = useState([]);
    const [contactOpen, setContactOpen] = useState(false);
    const [fbOpen, setFbOpen] = useState(false);

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

    useEffect(() => {
        loadNotifications();
        loadDocs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedOrgSlug]);

    const unreadCount = notifications.filter((n) => !n.read).length;

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

    const publishEvent = async (it) => {
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
            });
            toast.success("Event draft created — pending approval");
            if (org?.fb_connected) {
                await api.fbPublish(selectedOrgSlug, {
                    message: it.social_caption || it.description,
                    link: window.location.origin + "/events",
                }).catch(() => {});
                toast.info("Auto-posted to Facebook (mocked)");
            }
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
            if (org?.fb_connected) {
                await api.fbPublish(selectedOrgSlug, { message: it.social_caption || it.description }).catch(() => {});
                toast.info("Auto-posted to Facebook (mocked)");
            }
        } catch { toast.error("Couldn't publish"); }
    };

    return (
        <div data-testid="org-dashboard" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {/* Header */}
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
                        everywhere at once.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <NotificationBell
                        count={unreadCount}
                        notifications={notifications}
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
                        className="px-4 py-2 rounded-full border border-border bg-surface text-sm">
                        {orgs.map((o) => (<option key={o.slug} value={o.slug}>{o.name}</option>))}
                    </select>
                </div>
            </div>

            {/* Quick actions row: profile, docs upload, Facebook connect */}
            <section className="grid lg:grid-cols-3 gap-4 mb-8">
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

                <FacebookCard org={org} onOpen={() => setFbOpen(true)} />
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
                            each becomes a draft you can publish (and auto-post to Facebook if connected).
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
                                onPublishEvent={() => publishEvent(it)}
                                onPublishUpdate={() => publishUpdate(it)}
                                onCopy={copy}
                            />
                        ))}
                    </div>
                </div>
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
                            <div key={e.id} className="rounded-3xl border border-border bg-surface p-5" data-testid={`dash-event-${e.id}`}>
                                <div className="flex items-center gap-2">
                                    <CategoryBadge category={e.category} />
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                                        e.status === "approved" ? "bg-secondary text-secondary-foreground"
                                        : e.status === "pending" ? "bg-accent text-accent-foreground" : "bg-muted"
                                    }`}>{e.status}</span>
                                </div>
                                <h3 className="font-display font-bold mt-2">{e.title}</h3>
                                <p className="text-xs text-muted-foreground mt-1">{formatDate(e.start)} · {formatTime(e.start)}</p>
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
            <FacebookDialog open={fbOpen} onClose={() => setFbOpen(false)} org={org} slug={selectedOrgSlug} refresh={refresh} />
        </div>
    );
}

/* Notification bell */
function NotificationBell({ count, notifications, onRead }) {
    const [open, setOpen] = useState(false);
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
                <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-border bg-surface shadow-xl z-50 max-h-96 overflow-y-auto">
                    <div className="p-3 border-b border-border font-semibold text-sm">Notifications from admin</div>
                    {notifications.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground">No messages.</div>
                    ) : notifications.map((n) => (
                        <button
                            key={n.id}
                            data-testid={`notif-${n.id}`}
                            onClick={() => { if (!n.read) onRead(n.id); }}
                            className={`w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted transition ${n.read ? "" : "bg-primary/5"}`}
                        >
                            <div className="flex items-start gap-2">
                                {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                                <div className="flex-1">
                                    <div className="font-semibold text-sm">{n.title}</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>
                                    <div className="text-[10px] text-muted-foreground mt-1">
                                        {new Date(n.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

/* Parsed AI card (single item) */
function ParsedCard({ it, onPublishEvent, onPublishUpdate, onCopy }) {
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
            <div className="mt-3 flex gap-2">
                <button onClick={onPublishEvent} className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-secondary text-secondary-foreground font-semibold text-xs">
                    <Calendar className="h-3.5 w-3.5" /> Create event
                </button>
                <button onClick={onPublishUpdate} className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-primary text-primary-foreground font-semibold text-xs">
                    <Megaphone className="h-3.5 w-3.5" /> Post to feed
                </button>
            </div>
        </div>
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

/* Facebook connect card */
function FacebookCard({ org, onOpen }) {
    return (
        <button
            data-testid="fb-card"
            onClick={onOpen}
            className="text-left rounded-3xl border border-border bg-surface p-6 hover:-translate-y-1 transition-transform"
        >
            <div className="h-10 w-10 rounded-2xl bg-[#1877F2]/10 text-[#1877F2] grid place-items-center"><Facebook className="h-5 w-5" /></div>
            <h3 className="font-display font-bold mt-3">Facebook sync</h3>
            <p className="text-sm text-muted-foreground mt-1">
                {org?.fb_connected
                    ? "Connected — new events auto-post to your Facebook page."
                    : "Connect once, then every new event auto-posts to your Facebook page. Facebook posts also flow back here."}
            </p>
            <div className={`mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                org?.fb_connected ? "bg-secondary text-secondary-foreground" : "bg-muted text-foreground"
            }`}>
                <Plug className="h-3 w-3" /> {org?.fb_connected ? "Connected" : "Not connected"}
            </div>
        </button>
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

/* Facebook dialog (mocked connect + explanation) */
function FacebookDialog({ open, onClose, org, slug }) {
    const [pageName, setPageName] = useState("");
    const [busy, setBusy] = useState(false);
    const connect = async () => {
        setBusy(true);
        try {
            await api.fbConnect(slug, { page_id: pageName.toLowerCase().replace(/\s+/g, "-"), page_name: pageName });
            toast.success(`${pageName} connected (mocked). Once your Meta app is approved, real posting will switch on automatically.`);
            await refresh?.();
            onClose();
        } catch { toast.error("Failed"); }
        finally { setBusy(false); }
    };
    const disconnect = async () => {
        await api.fbDisconnect(slug);
        toast.info("Disconnected");
        await refresh?.();
        onClose();
    };
    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Facebook sync</DialogTitle></DialogHeader>
                <p className="text-sm text-muted-foreground">
                    <b>What this does (once live):</b> when you publish an event or post here, we'll auto-post
                    to your Facebook page. Posts on your Facebook page will also appear on your Local Feed
                    here. No copy-pasting between the two.
                </p>
                <p className="text-xs text-muted-foreground">
                    <b>Setup right now:</b> the connection UI is ready. Full activation waits on Meta's app
                    review for our platform (needed to publish on your behalf). We'll email you the moment
                    it's approved — no action needed from you.
                </p>
                {org?.fb_connected ? (
                    <>
                        <div className="rounded-2xl bg-secondary/40 text-secondary-foreground p-3 text-sm">
                            <b>Connected:</b> {org.fb_page_id}
                        </div>
                        <button onClick={disconnect} data-testid="fb-disconnect" className="inline-flex items-center gap-1 px-4 py-2 rounded-full border-2 border-foreground font-semibold text-xs">
                            Disconnect
                        </button>
                    </>
                ) : (
                    <>
                        <input
                            data-testid="fb-page-name"
                            value={pageName}
                            onChange={(e) => setPageName(e.target.value)}
                            placeholder="Your Facebook page name (e.g. Blackrod Community Choir)"
                            className="w-full px-3 py-2 rounded-2xl border border-border bg-background text-sm"
                        />
                        <button
                            data-testid="fb-connect"
                            onClick={connect}
                            disabled={busy || !pageName}
                            className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-[#1877F2] text-white font-semibold text-xs disabled:opacity-60"
                        >
                            <Facebook className="h-3.5 w-3.5" /> Connect Facebook page
                        </button>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
