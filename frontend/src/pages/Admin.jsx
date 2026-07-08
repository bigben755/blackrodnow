import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { Stat, CategoryBadge, formatDate, formatTime } from "@/components/Cards";
import {
    CalendarDays, Building2, Inbox, Users, Star, Check, X, Trash2, BarChart3, Mail,
    Send, Edit3, Eye, MessageSquare, Bell,
} from "lucide-react";
import { toast } from "sonner";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";

export default function Admin() {
    const {
        events, orgs, stats, refresh,
        setEventStatus, toggleEventFeatured, deleteEvent,
        setOrgStatus, deleteOrg,
        role,
    } = useApp();

    const pendingEvents = events.filter((e) => e.status === "pending");
    const approvedEvents = events.filter((e) => e.status === "approved");
    const pendingOrgs = orgs.filter((o) => o.status === "pending");

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
                <Link
                    to="/"
                    className="hidden sm:inline-flex px-4 py-2 rounded-full border-2 border-foreground font-semibold text-xs"
                >
                    View site
                </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <Stat label="Total events" value={events.length} icon={CalendarDays} tone="primary" />
                <Stat label="Pending events" value={pendingEvents.length} icon={Inbox} />
                <Stat label="Total orgs" value={orgs.length} icon={Building2} />
                <Stat label="Pending orgs" value={pendingOrgs.length} icon={Inbox} />
                <Stat label="Subscribers" value={stats?.subscribers || 0} icon={Mail} />
                <Stat label="Unread messages" value={stats?.messages_unread || 0} icon={MessageSquare} />
            </div>

            {/* Broadcast + newsletter row */}
            <section className="mt-10 grid lg:grid-cols-2 gap-4">
                <BroadcastCard onSent={refresh} />
                <NewsletterCard />
            </section>

            {/* Contact admin inbox + Notify orgs */}
            <section className="mt-10 grid lg:grid-cols-2 gap-4">
                <AdminInbox onChange={refresh} />
                <NotifyOrgCard orgs={orgs} />
            </section>

            {/* Pending events */}
            <section className="mt-10">
                <h2 className="font-display font-bold text-xl mb-3">
                    Pending events <span className="text-muted-foreground text-base">({pendingEvents.length})</span>
                </h2>
                {pendingEvents.length === 0 ? (
                    <Empty>No events waiting for approval.</Empty>
                ) : (
                    <div className="grid gap-3">
                        {pendingEvents.map((e) => (
                            <div key={e.id} data-testid={`admin-event-${e.id}`}
                                className="rounded-3xl border border-border bg-surface p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                                <div className="flex-1">
                                    <CategoryBadge category={e.category} />
                                    <h3 className="font-display font-bold text-lg mt-2">{e.title}</h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {formatDate(e.start)} · {formatTime(e.start)} · {e.venue}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button data-testid={`approve-event-${e.id}`}
                                        onClick={async () => { await setEventStatus(e.id, "approved"); toast.success("Event approved"); }}
                                        className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-secondary text-secondary-foreground font-semibold text-xs">
                                        <Check className="h-3.5 w-3.5" /> Approve
                                    </button>
                                    <button data-testid={`reject-event-${e.id}`}
                                        onClick={async () => { await setEventStatus(e.id, "rejected"); toast.info("Event rejected"); }}
                                        className="inline-flex items-center gap-1 px-4 py-2 rounded-full border-2 border-foreground font-semibold text-xs">
                                        <X className="h-3.5 w-3.5" /> Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Manage approved events */}
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
                                    <td className="px-4 py-3 font-medium">
                                        <Link to={`/events/${e.id}`} className="hover:text-primary">{e.title}</Link>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{formatDate(e.start)}</td>
                                    <td className="px-4 py-3 hidden md:table-cell"><CategoryBadge category={e.category} /></td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1 justify-end">
                                            <button data-testid={`feature-event-${e.id}`}
                                                onClick={async () => { await toggleEventFeatured(e.id); toast.success(e.featured ? "Unfeatured" : "Featured"); }}
                                                className={`h-8 w-8 grid place-items-center rounded-full ${e.featured ? "bg-secondary text-secondary-foreground" : "bg-muted"}`}
                                                title={e.featured ? "Unfeature" : "Feature on homepage"}>
                                                <Star className="h-3.5 w-3.5" />
                                            </button>
                                            <button data-testid={`delete-event-${e.id}`}
                                                onClick={async () => { await deleteEvent(e.id); toast.info("Event deleted"); }}
                                                className="h-8 w-8 grid place-items-center rounded-full bg-muted hover:bg-destructive hover:text-destructive-foreground"
                                                title="Delete">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Pending orgs */}
            <section className="mt-10">
                <h2 className="font-display font-bold text-xl mb-3">
                    Pending organisations <span className="text-muted-foreground text-base">({pendingOrgs.length})</span>
                </h2>
                {pendingOrgs.length === 0 ? (
                    <Empty>No organisations waiting for approval.</Empty>
                ) : (
                    <div className="grid sm:grid-cols-2 gap-3">
                        {pendingOrgs.map((o) => (
                            <div key={o.slug} data-testid={`admin-org-${o.slug}`}
                                className="rounded-3xl border border-border bg-surface p-5">
                                <h3 className="font-display font-bold">{o.name}</h3>
                                <p className="text-xs text-muted-foreground mt-1">{o.category}</p>
                                <p className="text-sm mt-2 line-clamp-2">{o.short}</p>
                                <div className="flex gap-2 mt-3">
                                    <button data-testid={`approve-org-${o.slug}`}
                                        onClick={async () => { await setOrgStatus(o.slug, "approved"); toast.success("Organisation approved"); }}
                                        className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-secondary text-secondary-foreground font-semibold text-xs">
                                        <Check className="h-3.5 w-3.5" /> Approve
                                    </button>
                                    <button data-testid={`reject-org-${o.slug}`}
                                        onClick={async () => { await deleteOrg(o.slug); toast.info("Organisation rejected"); }}
                                        className="inline-flex items-center gap-1 px-4 py-2 rounded-full border-2 border-foreground font-semibold text-xs">
                                        <X className="h-3.5 w-3.5" /> Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Manage orgs (edit) */}
            <section className="mt-10">
                <h2 className="font-display font-bold text-xl mb-3">Manage organisations</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {orgs.filter((o) => o.status !== "pending").slice(0, 30).map((o) => (
                        <div key={o.slug} className="rounded-3xl border border-border bg-surface p-4 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-muted grid place-items-center text-xl">{o.logo}</div>
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm truncate">{o.name}</div>
                                <div className="text-xs text-muted-foreground truncate">{o.category}</div>
                            </div>
                            <Link
                                to={`/edit-organisation/${o.slug}`}
                                data-testid={`edit-org-${o.slug}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold uppercase tracking-wider"
                            >
                                <Edit3 className="h-3 w-3" /> Edit
                            </Link>
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
    useEffect(() => { api.adminMessages().then(setMsgs).catch(() => {}); }, []);
    return (
        <div className="rounded-3xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2 mb-2">
                <div className="h-9 w-9 rounded-2xl bg-secondary/40 text-secondary-foreground grid place-items-center"><MessageSquare className="h-4 w-4" /></div>
                <h3 className="font-display font-bold">Contact admin inbox</h3>
            </div>
            {msgs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages yet.</p>
            ) : (
                <ul className="space-y-2 max-h-72 overflow-y-auto">
                    {msgs.map((m) => (
                        <li key={m.id} data-testid={`msg-${m.id}`} className={`p-3 rounded-2xl border border-border ${m.read ? "bg-background" : "bg-primary/5"}`}>
                            <div className="text-xs text-muted-foreground">
                                <b className="text-foreground">{m.from_org_slug || m.from_name || m.from_email || "Anonymous"}</b> · {new Date(m.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </div>
                            <div className="font-semibold text-sm mt-1">{m.subject}</div>
                            <div className="text-sm text-muted-foreground mt-1">{m.body}</div>
                            {!m.read && (
                                <button
                                    onClick={async () => { await api.markMessageRead(m.id); setMsgs((prev) => prev.map((x) => x.id === m.id ? { ...x, read: true } : x)); onChange?.(); }}
                                    className="mt-2 text-xs text-primary font-semibold"
                                >
                                    Mark as read
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
