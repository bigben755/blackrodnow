import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { Stat, CategoryBadge, formatDate, formatTime } from "@/components/Cards";
import {
    CalendarDays,
    Building2,
    Inbox,
    Users,
    Star,
    Check,
    X,
    Trash2,
    BarChart3,
    Mail,
    UploadCloud,
    Plus,
    Edit3,
    Repeat,
    User,
} from "lucide-react";
import { toast } from "sonner";

const initialEventForm = {
    title: "",
    orgSlug: "",
    category: "Community",
    date: "",
    start: "10:00",
    end: "12:00",
    venue: "",
    address: "Blackrod",
    description: "",
    cost: "Free",
    age: "All ages",
    accessibility: "",
    booking: "",
    contactEmail: "",
    contactPhone: "",
    image: "",
};

export default function Admin() {
    const {
        events,
        orgs,
        updateEventStatus,
        toggleEventFeatured,
        deleteEvent,
        updateEvent,
        bulkAddEvents,
        addEvent,
        updateOrgStatus,
        updateOrg,
        deleteOrg,
        subscriberList,
        subscribers,
        addSubscriber,
        removeSubscriber,
        users,
        resetPassword,
        role,
    } = useApp();

    const [newSubscriberEmail, setNewSubscriberEmail] = useState("");
    const [eventForm, setEventForm] = useState({ ...initialEventForm, orgSlug: orgs[0]?.slug || "" });
    const [bulkUploadText, setBulkUploadText] = useState("");
    const [editEventId, setEditEventId] = useState(null);
    const [editEventForm, setEditEventForm] = useState(initialEventForm);
    const [orgEditSlug, setOrgEditSlug] = useState(orgs[0]?.slug || "");
    const [orgEditForm, setOrgEditForm] = useState(orgs[0] || {});

    useEffect(() => {
        const selectedOrg = orgs.find((o) => o.slug === orgEditSlug) || orgs[0] || {};
        setOrgEditForm(selectedOrg);
    }, [orgEditSlug, orgs]);

    const pendingEvents = events.filter((e) => e.status === "pending");
    const approvedEvents = events.filter((e) => e.status === "approved");
    const pendingOrgs = orgs.filter((o) => o.status === "pending");
    const upcomingOrgEvents = approvedEvents.filter((e) => new Date(e.start) <= new Date(new Date().setDate(new Date().getDate() + 7)));
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const upcomingWeek = approvedEvents.filter((e) => new Date(e.start) <= weekFromNow);

    const handleSubscriberAdd = () => {
        if (!newSubscriberEmail.trim()) {
            toast.error("Enter an email first");
            return;
        }
        if (subscriberList.some((s) => s.email.toLowerCase() === newSubscriberEmail.toLowerCase())) {
            toast.error("Subscriber already exists");
            return;
        }
        addSubscriber(newSubscriberEmail.trim());
        setNewSubscriberEmail("");
        toast.success("Subscriber added");
    };

    const handleEventFormChange = (field) => (e) =>
        setEventForm((prev) => ({ ...prev, [field]: e.target.value }));

    const handleAddEvent = (e) => {
        e.preventDefault();
        addEvent({
            ...eventForm,
            title: eventForm.title || "Untitled event",
            category: eventForm.category || "Community",
            start: new Date(`${eventForm.date}T${eventForm.start || "10:00"}`).toISOString(),
            end: new Date(`${eventForm.date}T${eventForm.end || eventForm.start || "12:00"}`).toISOString(),
            status: "approved",
            featured: false,
            image: eventForm.image || "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&q=80",
        });
        setEventForm({ ...initialEventForm, orgSlug: orgs[0]?.slug || "" });
        toast.success("Event created and approved");
    };

    const handleBulkUpload = () => {
        const lines = bulkUploadText
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
        if (!lines.length) {
            toast.error("Paste at least one line of event data");
            return;
        }
        const items = lines.map((line, index) => {
            const [title, orgName, category, date, start, venue, address, email] = line.split("|").map((item) => item.trim());
            const orgSlug = orgs.find((o) => o.name.toLowerCase() === (orgName || "").toLowerCase())?.slug || orgs[0]?.slug;
            const eventDate = date ? new Date(`${date}T${start || "10:00"}`) : new Date(Date.now() + 86400000 * (index + 1));
            const startTime = eventDate.toISOString();
            const endTime = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000).toISOString();
            return {
                title: title || `Bulk event ${index + 1}`,
                orgSlug,
                category: category || "Community",
                start: startTime,
                end: endTime,
                venue: venue || "TBC",
                address: address || "Blackrod",
                description: "Bulk uploaded event",
                cost: "Free",
                age: "All ages",
                accessibility: "Please contact us for access info",
                booking: "",
                contactEmail: email || "hello@blackrodnow.example",
                contactPhone: "",
                image: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&q=80",
                status: "approved",
            };
        });
        bulkAddEvents(items);
        setBulkUploadText("");
        toast.success(`${items.length} events uploaded`);
    };

    const handleEditEvent = (event) => {
        setEditEventId(event.id);
        setEditEventForm({
            title: event.title,
            orgSlug: event.orgSlug,
            category: event.category,
            date: event.start.split("T")[0],
            start: event.start.split("T")[1]?.slice(0, 5) || "10:00",
            end: event.end.split("T")[1]?.slice(0, 5) || "12:00",
            venue: event.venue,
            address: event.address,
            description: event.description,
            cost: event.cost,
            age: event.age,
            accessibility: event.accessibility,
            booking: event.booking,
            contactEmail: event.contactEmail,
            contactPhone: event.contactPhone,
            image: event.image,
        });
    };

    const handleEditEventChange = (field) => (e) =>
        setEditEventForm((prev) => ({ ...prev, [field]: e.target.value }));

    const saveEventEdits = () => {
        if (!editEventId) return;
        updateEvent(editEventId, {
            ...editEventForm,
            start: new Date(`${editEventForm.date}T${editEventForm.start || "10:00"}`).toISOString(),
            end: new Date(`${editEventForm.date}T${editEventForm.end || editEventForm.start || "12:00"}`).toISOString(),
        });
        setEditEventId(null);
        toast.success("Event updated");
    };

    const handleOrgEditChange = (field) => (e) =>
        setOrgEditForm((prev) => ({ ...prev, [field]: e.target.value }));

    const saveOrgEdits = () => {
        updateOrg(orgEditSlug, orgEditForm);
        toast.success("Organisation updated");
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
                <Stat label="This week" value={upcomingWeek.length} icon={BarChart3} />
                <Stat label="Subscribers" value={subscribers} icon={Mail} />
            </div>

            {/* Admin action panels */}
            <section data-testid="admin-subscriber-section" className="mt-10 grid lg:grid-cols-3 gap-4">
                <div className="rounded-3xl border border-border bg-surface p-6">
                    <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-primary">
                        <User className="h-4 w-4" /> Subscriber management
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                        View and manage the current subscriber list for the newsletter and digest.
                    </p>
                    <div className="mt-5 space-y-2">
                        {subscriberList.slice(0, 6).map((sub) => (
                            <div key={sub.id} className="flex items-center justify-between rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm">
                                <span>{sub.email}</span>
                                <button
                                    onClick={() => {
                                        removeSubscriber(sub.id);
                                        toast.success("Subscriber removed");
                                    }}
                                    className="text-xs font-semibold uppercase tracking-[0.25em] text-destructive"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 grid gap-2">
                        <input
                            value={newSubscriberEmail}
                            onChange={(e) => setNewSubscriberEmail(e.target.value)}
                            placeholder="new subscriber email"
                            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button
                            onClick={handleSubscriberAdd}
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                        >
                            <Plus className="h-4 w-4" /> Add subscriber
                        </button>
                    </div>
                </div>

                <div className="rounded-3xl border border-border bg-surface p-6">
                    <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-primary">
                        <Users className="h-4 w-4" /> User accounts
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                        Reset password links for site admins, organisation users, and contributors.
                    </p>
                    <div className="mt-5 space-y-3 text-sm">
                        {users.map((user) => (
                            <div key={user.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-background/80 p-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <div className="font-semibold">{user.name}</div>
                                        <div className="text-muted-foreground text-xs">{user.email} · {user.role}</div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            resetPassword(user.id);
                                            toast.success("Password reset requested");
                                        }}
                                        className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-semibold"
                                    >
                                        <Repeat className="h-4 w-4" /> Reset
                                    </button>
                                </div>
                                <div className="text-xs text-muted-foreground">Last reset: {user.lastReset}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-3xl border border-border bg-surface p-6">
                    <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-primary">
                        <UploadCloud className="h-4 w-4" /> Add events
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                        Create approved events directly or bulk upload multiple listings at once.
                    </p>
                    <form onSubmit={handleAddEvent} className="mt-5 space-y-3">
                        <div className="grid gap-3">
                            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Organisation
                                <select
                                    value={eventForm.orgSlug}
                                    onChange={handleEventFormChange("orgSlug")}
                                    className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none"
                                >
                                    {orgs.map((o) => (
                                        <option key={o.slug} value={o.slug}>
                                            {o.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Title
                                <input
                                    value={eventForm.title}
                                    onChange={handleEventFormChange("title")}
                                    placeholder="Event title"
                                    className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none"
                                />
                            </label>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                    Date
                                    <input
                                        type="date"
                                        value={eventForm.date}
                                        onChange={handleEventFormChange("date")}
                                        className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none"
                                    />
                                </label>
                                <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                    Time
                                    <input
                                        type="time"
                                        value={eventForm.start}
                                        onChange={handleEventFormChange("start")}
                                        className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none"
                                    />
                                </label>
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground"
                        >
                            <Plus className="h-4 w-4" /> Create event
                        </button>
                    </form>
                    <div className="mt-6 rounded-3xl border border-border bg-background/70 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            Bulk upload
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Paste lines using: title | org name | category | date | time | venue | address | email
                        </p>
                        <textarea
                            value={bulkUploadText}
                            onChange={(e) => setBulkUploadText(e.target.value)}
                            rows={5}
                            className="mt-3 w-full rounded-3xl border border-border bg-background px-4 py-3 text-sm outline-none"
                            placeholder="Summer fair | Horwich & Blackrod Community Events CIC | Community | 2026-06-14 | 11:00 | Blackrod Community Centre | Church Street | hello@blackrodnow.example"
                        />
                        <button
                            onClick={handleBulkUpload}
                            className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
                        >
                            <UploadCloud className="h-4 w-4" /> Upload events
                        </button>
                    </div>
                </div>
            </section>

            {/* Pending events */}
            <section data-testid="admin-pending-events-section" className="mt-10">
                <h2 className="font-display font-bold text-xl mb-3">
                    Pending events <span className="text-muted-foreground text-base">({pendingEvents.length})</span>
                </h2>
                {pendingEvents.length === 0 ? (
                    <Empty>No events waiting for approval.</Empty>
                ) : (
                    <div className="grid gap-3">
                        {pendingEvents.map((e) => (
                            <div
                                key={e.id}
                                data-testid={`admin-event-${e.id}`}
                                className="rounded-3xl border border-border bg-surface p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                            >
                                <div className="flex-1">
                                    <CategoryBadge category={e.category} />
                                    <h3 className="font-display font-bold text-lg mt-2">{e.title}</h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {formatDate(e.start)} · {formatTime(e.start)} · {e.venue}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        data-testid={`approve-event-${e.id}`}
                                        onClick={() => {
                                            updateEventStatus(e.id, "approved");
                                            toast.success("Event approved");
                                        }}
                                        className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-secondary text-secondary-foreground font-semibold text-xs"
                                    >
                                        <Check className="h-3.5 w-3.5" /> Approve
                                    </button>
                                    <button
                                        data-testid={`reject-event-${e.id}`}
                                        onClick={() => {
                                            updateEventStatus(e.id, "rejected");
                                            toast.info("Event rejected");
                                        }}
                                        className="inline-flex items-center gap-1 px-4 py-2 rounded-full border-2 border-foreground font-semibold text-xs"
                                    >
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
                            {approvedEvents.map((e) => (
                                <tr key={e.id} className="border-t border-border">
                                    <td className="px-4 py-3 font-medium">
                                        <Link to={`/events/${e.id}`} className="hover:text-primary">
                                            {e.title}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                                        {formatDate(e.start)}
                                    </td>
                                    <td className="px-4 py-3 hidden md:table-cell">
                                        <CategoryBadge category={e.category} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1 justify-end">
                                            <button
                                                data-testid={`feature-event-${e.id}`}
                                                onClick={() => {
                                                    toggleEventFeatured(e.id);
                                                    toast.success(e.featured ? "Unfeatured" : "Featured");
                                                }}
                                                className={`h-8 w-8 grid place-items-center rounded-full ${
                                                    e.featured ? "bg-secondary text-secondary-foreground" : "bg-muted"
                                                }`}
                                                title={e.featured ? "Unfeature" : "Feature on homepage"}
                                            >
                                                <Star className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleEditEvent(e)}
                                                className="h-8 w-8 grid place-items-center rounded-full bg-muted hover:bg-accent hover:text-accent-foreground"
                                                title="Edit event"
                                            >
                                                <Edit3 className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                data-testid={`delete-event-${e.id}`}
                                                onClick={() => {
                                                    deleteEvent(e.id);
                                                    toast.info("Event deleted");
                                                }}
                                                className="h-8 w-8 grid place-items-center rounded-full bg-muted hover:bg-destructive hover:text-destructive-foreground"
                                                title="Delete"
                                            >
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

            {editEventId && (
                <section className="mt-10 rounded-3xl border border-border bg-surface p-6">
                    <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-primary">
                        <Edit3 className="h-4 w-4" /> Edit event
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                        Update event fields and save changes directly as admin.
                    </p>
                    <div className="mt-5 grid gap-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Title
                                <input
                                    value={editEventForm.title}
                                    onChange={handleEditEventChange("title")}
                                    className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none"
                                />
                            </label>
                            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Organisation
                                <select
                                    value={editEventForm.orgSlug}
                                    onChange={handleEditEventChange("orgSlug")}
                                    className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none"
                                >
                                    {orgs.map((o) => (
                                        <option key={o.slug} value={o.slug}>
                                            {o.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Date
                                <input
                                    type="date"
                                    value={editEventForm.date}
                                    onChange={handleEditEventChange("date")}
                                    className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none"
                                />
                            </label>
                            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Time
                                <input
                                    type="time"
                                    value={editEventForm.start}
                                    onChange={handleEditEventChange("start")}
                                    className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none"
                                />
                            </label>
                        </div>
                        <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            Venue
                            <input
                                value={editEventForm.venue}
                                onChange={handleEditEventChange("venue")}
                                className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none"
                            />
                        </label>
                        <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            Description
                            <textarea
                                rows={3}
                                value={editEventForm.description}
                                onChange={handleEditEventChange("description")}
                                className="mt-2 w-full rounded-3xl border border-border bg-background px-4 py-3 text-sm outline-none"
                            />
                        </label>
                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={saveEventEdits}
                                className="inline-flex items-center justify-center gap-2 rounded-full bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground"
                            >
                                Save changes
                            </button>
                            <button
                                onClick={() => setEditEventId(null)}
                                className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-3 text-sm font-semibold"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {/* Pending orgs */}
            <section data-testid="admin-pending-orgs-section" className="mt-10">
                <h2 className="font-display font-bold text-xl mb-3">
                    Pending organisations{" "}
                    <span className="text-muted-foreground text-base">({pendingOrgs.length})</span>
                </h2>
                {pendingOrgs.length === 0 ? (
                    <Empty>No organisations waiting for approval.</Empty>
                ) : (
                    <div className="grid sm:grid-cols-2 gap-3">
                        {pendingOrgs.map((o) => (
                            <div
                                key={o.slug}
                                data-testid={`admin-org-${o.slug}`}
                                className="rounded-3xl border border-border bg-surface p-5"
                            >
                                <h3 className="font-display font-bold">{o.name}</h3>
                                <p className="text-xs text-muted-foreground mt-1">{o.category}</p>
                                <p className="text-sm mt-2 line-clamp-2">{o.short}</p>
                                <div className="flex gap-2 mt-3">
                                    <button
                                        data-testid={`approve-org-${o.slug}`}
                                        onClick={() => {
                                            updateOrgStatus(o.slug, "approved");
                                            toast.success("Organisation approved");
                                        }}
                                        className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-secondary text-secondary-foreground font-semibold text-xs"
                                    >
                                        <Check className="h-3.5 w-3.5" /> Approve
                                    </button>
                                    <button
                                        data-testid={`reject-org-${o.slug}`}
                                        onClick={() => {
                                            deleteOrg(o.slug);
                                            toast.info("Organisation rejected");
                                        }}
                                        className="inline-flex items-center gap-1 px-4 py-2 rounded-full border-2 border-foreground font-semibold text-xs"
                                    >
                                        <X className="h-3.5 w-3.5" /> Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="mt-10">
                <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                        <h2 className="font-display font-bold text-xl">Manage organisations</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Edit organisation details, status, and remove old or incorrect entries.
                        </p>
                    </div>
                </div>
                <div className="rounded-3xl border border-border bg-surface overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                            <tr>
                                <th className="text-left px-4 py-3">Organisation</th>
                                <th className="text-left px-4 py-3 hidden sm:table-cell">Status</th>
                                <th className="text-right px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orgs.map((o) => (
                                <tr key={o.slug} className="border-t border-border">
                                    <td className="px-4 py-3 font-medium">{o.name}</td>
                                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{o.status}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1 justify-end">
                                            <button
                                                onClick={() => setOrgEditSlug(o.slug)}
                                                className="h-8 rounded-full px-3 text-xs font-semibold bg-muted"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => {
                                                    deleteOrg(o.slug);
                                                    toast.info("Organisation removed");
                                                }}
                                                className="h-8 rounded-full px-3 text-xs font-semibold bg-destructive text-destructive-foreground"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-6 rounded-3xl border border-border bg-surface p-6">
                    <h3 className="font-display font-bold text-lg">Edit organisation</h3>
                    <div className="mt-4 grid gap-4">
                        <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            Name
                            <input
                                value={orgEditForm.name || ""}
                                onChange={handleOrgEditChange("name")}
                                className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none"
                            />
                        </label>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Category
                                <input
                                    value={orgEditForm.category || ""}
                                    onChange={handleOrgEditChange("category")}
                                    className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none"
                                />
                            </label>
                            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Status
                                <select
                                    value={orgEditForm.status || "approved"}
                                    onChange={handleOrgEditChange("status")}
                                    className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none"
                                >
                                    <option value="approved">approved</option>
                                    <option value="pending">pending</option>
                                    <option value="rejected">rejected</option>
                                </select>
                            </label>
                        </div>
                        <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            Short description
                            <input
                                value={orgEditForm.short || ""}
                                onChange={handleOrgEditChange("short")}
                                className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none"
                            />
                        </label>
                        <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            Website
                            <input
                                value={orgEditForm.website || ""}
                                onChange={handleOrgEditChange("website")}
                                className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none"
                            />
                        </label>
                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={saveOrgEdits}
                                className="inline-flex items-center justify-center gap-2 rounded-full bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground"
                            >
                                Save organisation
                            </button>
                            <button
                                onClick={() => setOrgEditSlug(orgs[0]?.slug || "")}
                                className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-3 text-sm font-semibold"
                            >
                                Reset
                            </button>
                        </div>
                    </div>
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
