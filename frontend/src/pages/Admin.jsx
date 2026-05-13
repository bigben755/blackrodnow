import React from "react";
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
} from "lucide-react";
import { toast } from "sonner";

export default function Admin() {
    const {
        events,
        orgs,
        updateEventStatus,
        toggleEventFeatured,
        deleteEvent,
        updateOrgStatus,
        deleteOrg,
        subscribers,
        role,
    } = useApp();

    const pendingEvents = events.filter((e) => e.status === "pending");
    const approvedEvents = events.filter((e) => e.status === "approved");
    const pendingOrgs = orgs.filter((o) => o.status === "pending");
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const upcomingWeek = approvedEvents.filter((e) => new Date(e.start) <= weekFromNow);

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

            {/* Pending orgs */}
            <section className="mt-10">
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
        </div>
    );
}

const Empty = ({ children }) => (
    <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        {children}
    </div>
);
