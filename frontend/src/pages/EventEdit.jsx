import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { CATEGORIES } from "@/data/mockData";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Calendar, Loader2, Save, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Edit an existing event. Accessible to org admins (their own events) and
 * super admins (any event). We rely on the role switcher for gating in the
 * UI; the backend PATCH endpoint currently accepts all requests since real
 * auth isn't in place yet.
 */
export default function EventEdit() {
    const { id } = useParams();
    const { events, orgs, role, updateEvent, setEventStatus, deleteEvent, hasOrgAccess } = useApp();
    const navigate = useNavigate();

    const event = useMemo(() => events.find((e) => e.id === id), [events, id]);
    const [form, setForm] = useState(null);
    const [busy, setBusy] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (!event) return;
        const start = event.start ? new Date(event.start) : null;
        const end = event.end ? new Date(event.end) : null;
        const iso = (d) => (d ? d.toISOString() : "");
        const dateOnly = (d) => (d ? iso(d).slice(0, 10) : "");
        const timeOnly = (d) => (d ? iso(d).slice(11, 16) : "");
        setForm({
            title: event.title || "",
            orgSlug: event.orgSlug || "",
            category: event.category || "Community",
            date: dateOnly(start),
            startTime: timeOnly(start),
            endTime: timeOnly(end),
            venue: event.venue || "",
            address: event.address || "",
            description: event.description || "",
            cost: event.cost || "Free",
            age: event.age || "All ages",
            accessibility: event.accessibility || "",
            booking: event.booking || "",
            contactEmail: event.contactEmail || "",
            contactPhone: event.contactPhone || "",
            image: event.image || "",
            status: event.status || "pending",
            recurrenceFreq: event.recurrence?.freq || "none",
            recurrenceUntil: event.recurrence?.until ? String(event.recurrence.until).slice(0, 10) : "",
        });
    }, [event]);

    if (!event) {
        return (
            <div className="max-w-2xl mx-auto px-6 py-24 text-center">
                <h1 className="font-display font-black text-3xl">Event not found</h1>
                <Link to="/events" className="mt-4 inline-block text-primary font-semibold">
                    ← Back to events
                </Link>
            </div>
        );
    }
    if (role === "org" && !hasOrgAccess(event.orgSlug)) {
        return (
            <div className="max-w-2xl mx-auto px-6 py-24 text-center">
                <h1 className="font-display font-black text-3xl">Organisation access required</h1>
                <p className="mt-3 text-muted-foreground">Unlock this organisation from your dashboard before editing events.</p>
                <Link to="/organisation-dashboard" className="mt-6 inline-block text-primary font-semibold">
                    Go to organisation dashboard
                </Link>
            </div>
        );
    }
    if (!form) return null;

    const set = (k) => (e) =>
        setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

    const save = async (e) => {
        e.preventDefault();
        if (!form.date) {
            toast.error("Please set a date");
            return;
        }
        setBusy(true);
        try {
            const start = new Date(`${form.date}T${form.startTime || "10:00"}`).toISOString();
            const end = new Date(`${form.date}T${form.endTime || form.startTime || "11:00"}`).toISOString();
            await updateEvent(event.id, {
                title: form.title,
                orgSlug: role === "admin" ? form.orgSlug : event.orgSlug,
                category: form.category,
                start,
                end,
                venue: form.venue,
                address: form.address,
                description: form.description,
                cost: form.cost,
                age: form.age,
                accessibility: form.accessibility,
                booking: form.booking,
                contactEmail: form.contactEmail,
                contactPhone: form.contactPhone,
                image: form.image,
                recurrence: form.recurrenceFreq && form.recurrenceFreq !== "none"
                    ? {
                        freq: form.recurrenceFreq,
                        until: form.recurrenceUntil
                            ? new Date(`${form.recurrenceUntil}T23:59:59`).toISOString()
                            : null,
                    }
                    : null,
                ...(role === "admin" ? { status: form.status } : {}),
            }, event.orgSlug);
            toast.success("Event updated");
            navigate(`/events/${event.id}`);
        } catch (err) {
            toast.error(err?.response?.data?.detail || "Couldn't save changes");
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!window.confirm(`Delete "${event.title}"? This can't be undone.`)) return;
        setDeleting(true);
        try {
            await deleteEvent(event.id);
            toast.success("Event deleted");
            navigate("/events");
        } catch {
            toast.error("Delete failed");
            setDeleting(false);
        }
    };

    const isAdmin = role === "admin";

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10" data-testid="edit-event-page">
            <div className="flex items-center justify-between gap-3 mb-6">
                <Link
                    to={`/events/${event.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to event
                </Link>
                {isAdmin && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                        <ShieldCheck className="h-3 w-3" /> Super admin
                    </span>
                )}
            </div>
            <div className="mb-6">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Edit event</span>
                <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tight mt-2">{event.title}</h1>
            </div>

            <form onSubmit={save} className="rounded-3xl border border-border bg-surface p-6 sm:p-8 space-y-5">
                <Field label="Event title" required>
                    <input data-testid="ee-title" required value={form.title} onChange={set("title")} className={inp} />
                </Field>
                <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Organisation" required>
                        {role === "admin" ? (
                            <select data-testid="ee-org" required value={form.orgSlug} onChange={set("orgSlug")} className={inp}>
                                {orgs.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
                            </select>
                        ) : (
                            <input value={orgs.find((o) => o.slug === event.orgSlug)?.name || event.orgSlug} readOnly className={inp} />
                        )}
                    </Field>
                    <Field label="Category" required>
                        <select data-testid="ee-category" value={form.category} onChange={set("category")} className={inp}>
                            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                        </select>
                    </Field>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                    <Field label="Date" required>
                        <input data-testid="ee-date" type="date" required value={form.date} onChange={set("date")} className={inp} />
                    </Field>
                    <Field label="Start time">
                        <input data-testid="ee-start" type="time" value={form.startTime} onChange={set("startTime")} className={inp} />
                    </Field>
                    <Field label="End time">
                        <input data-testid="ee-end" type="time" value={form.endTime} onChange={set("endTime")} className={inp} />
                    </Field>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Venue" required>
                        <input data-testid="ee-venue" required value={form.venue} onChange={set("venue")} className={inp} />
                    </Field>
                    <Field label="Address">
                        <input data-testid="ee-address" value={form.address} onChange={set("address")} className={inp} />
                    </Field>
                </div>
                <Field label="Description">
                    <textarea data-testid="ee-desc" rows={5} value={form.description} onChange={set("description")} className={inp} />
                </Field>
                <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Cost"><input data-testid="ee-cost" value={form.cost} onChange={set("cost")} className={inp} /></Field>
                    <Field label="Age"><input data-testid="ee-age" value={form.age} onChange={set("age")} className={inp} /></Field>
                </div>
                <Field label="Accessibility notes">
                    <input data-testid="ee-access" value={form.accessibility} onChange={set("accessibility")} className={inp} />
                </Field>
                <Field label="Booking link">
                    <input data-testid="ee-booking" type="url" value={form.booking} onChange={set("booking")} className={inp} />
                </Field>
                <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Contact email"><input data-testid="ee-email" type="email" value={form.contactEmail} onChange={set("contactEmail")} className={inp} /></Field>
                    <Field label="Contact phone"><input data-testid="ee-phone" value={form.contactPhone} onChange={set("contactPhone")} className={inp} /></Field>
                </div>
                <Field label="Poster / image URL">
                    <input data-testid="ee-image" value={form.image} onChange={set("image")} className={inp} placeholder="https://" />
                </Field>

                {/* Recurrence — one entry that repeats (great for weekly clubs / bingo / prayer) */}
                <div className="rounded-2xl border border-border bg-surface p-4">
                    <div className="text-xs font-black uppercase tracking-wider text-primary">Repeat this event</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Set once, appears every week / fortnight / month in the calendar. Edit here to update all future instances.
                    </p>
                    <div className="mt-3 grid sm:grid-cols-2 gap-3">
                        <Field label="Frequency">
                            <select data-testid="ee-recurrence-freq" value={form.recurrenceFreq} onChange={set("recurrenceFreq")} className={inp}>
                                <option value="none">Doesn't repeat</option>
                                <option value="weekly">Every week</option>
                                <option value="biweekly">Every 2 weeks</option>
                                <option value="monthly">Every month (approx.)</option>
                            </select>
                        </Field>
                        <Field label="Repeat until (optional)">
                            <input
                                data-testid="ee-recurrence-until"
                                type="date"
                                value={form.recurrenceUntil}
                                onChange={set("recurrenceUntil")}
                                disabled={form.recurrenceFreq === "none"}
                                className={inp}
                            />
                        </Field>
                    </div>
                </div>

                {isAdmin && (
                    <Field label="Status (super admin only)">
                        <div className="flex gap-2">
                            {["approved", "pending", "rejected"].map((s) => (
                                <button
                                    type="button"
                                    key={s}
                                    data-testid={`ee-status-${s}`}
                                    onClick={() => setForm((f) => ({ ...f, status: s }))}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize ${
                                        form.status === s ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                                    }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </Field>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <button
                        type="button"
                        data-testid="ee-delete"
                        onClick={remove}
                        disabled={deleting || busy}
                        className="inline-flex items-center gap-1 px-4 py-2 rounded-full border border-destructive/40 text-destructive text-xs font-semibold hover:bg-destructive/10 disabled:opacity-50"
                    >
                        {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete
                    </button>
                    <div className="flex gap-2">
                        <Link
                            to={`/events/${event.id}`}
                            className="inline-flex items-center px-4 py-2 rounded-full border border-border text-xs font-semibold hover:bg-muted"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            data-testid="ee-save"
                            disabled={busy}
                            className="inline-flex items-center gap-1 px-5 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-60"
                        >
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save changes
                        </button>
                    </div>
                </div>
                <p className="text-[11px] text-muted-foreground pt-2 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Edits to date/time are reflected in the live calendar feed and per-event share previews within a minute.
                </p>
            </form>
        </div>
    );
}

const inp =
    "w-full px-4 py-2.5 rounded-2xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary";

const Field = ({ label, required, children }) => (
    <label className="block">
        <span className="text-xs font-bold tracking-wider uppercase text-muted-foreground">
            {label} {required && <span className="text-accent">*</span>}
        </span>
        <div className="mt-1.5">{children}</div>
    </label>
);
