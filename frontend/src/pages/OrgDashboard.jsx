import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { CategoryBadge, formatDate, formatTime, Stat } from "@/components/Cards";
import { localIso } from "@/lib/localTime";
import OrgAvatar from "@/components/OrgAvatar";
import {
    Wand2,
    Copy,
    Calendar,
    Megaphone,
    Bell,
    Sparkles,
    Loader2,
    FileText,
    UploadCloud,
    Send,
    Edit3,
    Trash2,
    Mail,
    ChevronRight,
    Eye,
    Users,
    BarChart3,
    Rocket,
    Plus,
    Settings,
    Building2,
    ExternalLink,
    Search,
    CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import ShareButtons from "@/components/ShareButtons";
import PostNowDialog from "@/components/PostNowDialog";
import { buildRecurrencePayload } from "@/components/RecurrenceFields";

const EXAMPLE = `Summer Fair! Saturday 14 June, 11am-4pm at Blackrod Community Centre. Stalls, bouncy castles, raffle, hot food and live music. Free entry.

Also, Youth Football Open Day - Sunday 15 June, 10am-12:30pm at Aspull Common. Ages 5-14, free to try. Just turn up in trainers.

Community Clean-Up: Village Green, Saturday 21 June, 10am-12pm. Bags & brew provided.`;

const EVENT_FILTERS = [
    { key: "upcoming", label: "Upcoming" },
    { key: "pending", label: "Pending" },
    { key: "past", label: "Past" },
    { key: "all", label: "All" },
];

const eventIsFuture = (event) =>
    new Date(event.end || event.start) >= new Date();

const statusLabel = (status) => {
    if (status === "approved") return "Published";
    if (status === "pending") return "Awaiting approval";
    if (status === "cancelled") return "Cancelled";
    if (status === "rejected") return "Needs attention";
    return status || "Draft";
};

const statusClass = (status) => {
    if (status === "approved") {
        return "bg-secondary text-secondary-foreground";
    }

    if (status === "pending") {
        return "bg-accent text-accent-foreground";
    }

    if (status === "cancelled" || status === "rejected") {
        return "bg-destructive/10 text-destructive";
    }

    return "bg-muted text-foreground";
};

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

    const [selectedOrgSlug, setSelectedOrgSlug] = useState(
        activeOrgSlug || ""
    );

    const [text, setText] = useState("");
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);

    const [notifications, setNotifications] = useState([]);
    const [docs, setDocs] = useState([]);
    const [contactOpen, setContactOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

    const [analytics, setAnalytics] = useState(null);

    const [orgPasswordInput, setOrgPasswordInput] = useState("");
    const [unlockBusy, setUnlockBusy] = useState(false);

    const [passwordBusy, setPasswordBusy] = useState(false);
    const [passwordForm, setPasswordForm] = useState({
        current: "",
        next: "",
    });

    const [postNowEvent, setPostNowEvent] = useState(null);

    const [eventFilter, setEventFilter] = useState("upcoming");
    const [eventSearch, setEventSearch] = useState("");
    const [duplicatingId, setDuplicatingId] = useState("");

    useEffect(() => {
        if (selectedOrgSlug || !orgs.length) return;

        const accessibleOrg = orgs.find((item) =>
            hasOrgAccess(item.slug)
        );

        if (accessibleOrg) {
            setSelectedOrgSlug(accessibleOrg.slug);
        }
    }, [orgs, selectedOrgSlug, hasOrgAccess]);

    useEffect(() => {
        if (selectedOrgSlug) {
            setActiveOrgSlug(selectedOrgSlug);
        }
    }, [selectedOrgSlug, setActiveOrgSlug]);

    useEffect(() => {
        setEventFilter("upcoming");
        setEventSearch("");
    }, [selectedOrgSlug]);

    const org = orgs.find((item) => item.slug === selectedOrgSlug);

    const myEvents = useMemo(
        () => events.filter((event) => event.orgSlug === selectedOrgSlug),
        [events, selectedOrgSlug]
    );

    const eventCounts = useMemo(() => {
        const upcoming = myEvents.filter(
            (event) => event.status === "approved" && eventIsFuture(event)
        ).length;

        const pending = myEvents.filter(
            (event) => event.status === "pending"
        ).length;

        const past = myEvents.filter(
            (event) => !eventIsFuture(event)
        ).length;

        return {
            upcoming,
            pending,
            past,
            all: myEvents.length,
        };
    }, [myEvents]);

    const visibleEvents = useMemo(() => {
        const query = eventSearch.trim().toLowerCase();

        return [...myEvents]
            .filter((event) => {
                if (!query) return true;

                return [
                    event.title,
                    event.venue,
                    event.category,
                    event.description,
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase()
                    .includes(query);
            })
            .filter((event) => {
                if (eventFilter === "upcoming") {
                    return event.status === "approved" && eventIsFuture(event);
                }

                if (eventFilter === "pending") {
                    return event.status === "pending";
                }

                if (eventFilter === "past") {
                    return !eventIsFuture(event);
                }

                return true;
            })
            .sort((a, b) => {
                if (eventFilter === "past") {
                    return new Date(b.start) - new Date(a.start);
                }

                return new Date(a.start) - new Date(b.start);
            });
    }, [myEvents, eventFilter, eventSearch]);

    const loadNotifications = async () => {
        if (!selectedOrgSlug) return;

        try {
            const list = await api.orgNotifications(selectedOrgSlug);
            setNotifications(list);
        } catch {
            // Keep the dashboard usable if messages cannot be loaded.
        }
    };

    const loadDocs = async () => {
        if (!selectedOrgSlug) return;

        try {
            const list = await api.listDocs(selectedOrgSlug);
            setDocs(list);
        } catch {
            // Keep the dashboard usable if documents cannot be loaded.
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

    const unreadCount = notifications.filter((item) => !item.read).length;

    const metrics = analytics?.overview || {};
    const sharePlatforms = analytics?.share_platforms_30d || [];
    const topEvents = analytics?.top_events_30d || [];

    const requiresOrgPassword =
        role === "org" &&
        Boolean(selectedOrgSlug) &&
        !hasOrgAccess(selectedOrgSlug);

    const parse = async () => {
        if (!text.trim()) {
            toast.error("Paste some content first");
            return;
        }

        setLoading(true);

        try {
            const result = await api.parseContent(text);
            const parsedItems = result.items || [];

            setItems(parsedItems);

            toast.success(
                `Parsed — ${parsedItems.length} item${
                    parsedItems.length === 1 ? "" : "s"
                } found`
            );
        } catch {
            toast.error("Couldn't parse — try again");
        } finally {
            setLoading(false);
        }
    };

    const copy = async (value, label) => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success(`${label} copied`);
        } catch {
            toast.error("Copy failed");
        }
    };

    const localDateFromParser = (value) => {
        if (!value) return null;

        const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

        if (isoDate) {
            return new Date(
                Number(isoDate[1]),
                Number(isoDate[2]) - 1,
                Number(isoDate[3])
            );
        }

        const parsed = new Date(value);

        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const publishEvent = async (
        item,
        { recurrenceFreq = "none", recurrenceUntil = "" } = {}
    ) => {
        if (!selectedOrgSlug) {
            toast.error("Choose an organisation first");
            return;
        }

        let start;

        try {
            let date = localDateFromParser(item.date);

            if (!date && item.recurrence_weekday) {
                const weekdayIndex = {
                    Sunday: 0,
                    Monday: 1,
                    Tuesday: 2,
                    Wednesday: 3,
                    Thursday: 4,
                    Friday: 5,
                    Saturday: 6,
                }[item.recurrence_weekday];

                date = new Date();

                if (typeof weekdayIndex === "number") {
                    const daysAhead =
                        (weekdayIndex - date.getDay() + 7) % 7 || 7;

                    date.setDate(date.getDate() + daysAhead);
                }
            }

            if (!date) {
                date = new Date(Date.now() + 86400000);
            }

            if (item.start_time) {
                const match = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(
                    item.start_time || ""
                );

                if (match) {
                    let hour = parseInt(match[1], 10);
                    const minute = match[2] ? parseInt(match[2], 10) : 0;
                    const period = (match[3] || "").toLowerCase();

                    if (period === "pm" && hour < 12) hour += 12;
                    if (period === "am" && hour === 12) hour = 0;

                    date.setHours(hour, minute, 0, 0);
                }
            }

            start = localIso(date);
        } catch {
            start = localIso(new Date(Date.now() + 86400000));
        }

        const end = localIso(
            new Date(new Date(start).getTime() + 2 * 60 * 60 * 1000)
        );

        try {
            const created = await addEvent({
                title: item.title,
                orgSlug: selectedOrgSlug,
                category: item.category || "Community",
                start,
                end,
                venue: item.location || "TBC",
                address: "",
                description: item.description,
                cost: "",
                age: "All ages",
                accessibility: "",
                booking: "",
                contactEmail: org?.email || "",
                contactPhone: org?.phone || "",
                image: "",
                recurrence: buildRecurrencePayload(
                    recurrenceFreq,
                    recurrenceUntil
                ),
            });

            await refresh();

            setEventFilter("pending");
            if (created?.id) {
                setPostNowEvent(created);
            }

            toast.success(
                recurrenceFreq !== "none"
                    ? `Recurring event draft created (${recurrenceFreq})`
                    : "Event draft created",
                {
                    description:
                        "Review the event details while it is awaiting approval.",
                }
            );
        } catch {
            toast.error("Couldn't create event");
        }
    };

    const publishUpdate = async (item) => {
        if (!selectedOrgSlug) {
            toast.error("Choose an organisation first");
            return;
        }

        try {
            await addFeedPost({
                orgSlug: selectedOrgSlug,
                type: "Club update",
                title: item.title,
                body: item.description,
            });

            toast.success("Update published to Community Updates");
        } catch {
            toast.error("Couldn't publish");
        }
    };

    const unlockOrganisation = async () => {
        if (!selectedOrgSlug) return;

        if (!orgPasswordInput.trim()) {
            toast.error("Enter the organisation password");
            return;
        }

        setUnlockBusy(true);

        try {
            const result = await api.loginOrgAccess(selectedOrgSlug, {
                password: orgPasswordInput.trim(),
            });

            unlockOrgAccess(selectedOrgSlug, result?.token || "");
            setOrgPasswordInput("");

            toast.success("Organisation dashboard unlocked");
        } catch (error) {
            toast.error(
                error?.response?.data?.detail ||
                    "Could not unlock organisation dashboard"
            );
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
                if (!passwordForm.current.trim()) {
                    toast.error("Enter your current password");
                    setPasswordBusy(false);
                    return;
                }

                await api.changeOrgPassword(selectedOrgSlug, {
                    current_password: passwordForm.current.trim(),
                    new_password: passwordForm.next.trim(),
                });

                toast.success("Organisation password changed");
            }

            setPasswordForm({
                current: "",
                next: "",
            });

            setSettingsOpen(false);
        } catch (error) {
            toast.error(
                error?.response?.data?.detail || "Password update failed"
            );
        } finally {
            setPasswordBusy(false);
        }
    };

    const duplicateEvent = async (event) => {
        setDuplicatingId(event.id);

        try {
            const duplicate = await api.duplicateEvent(event.id);

            toast.success("Event duplicated", {
                description:
                    "Update the new event's date and details before publishing.",
            });

            await refresh();

            if (duplicate?.id) {
                window.location.assign(`/edit-event/${duplicate.id}`);
            }
        } catch (error) {
            toast.error(
                error?.response?.data?.detail || "Could not duplicate event"
            );
        } finally {
            setDuplicatingId("");
        }
    };

    if (requiresOrgPassword) {
        return (
            <div
                data-testid="org-dashboard-lock"
                className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16"
            >
                <div className="rounded-3xl border border-border bg-surface p-7 sm:p-8">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary grid place-items-center">
                        <Building2 className="h-5 w-5" />
                    </div>

                    <h1 className="font-display font-black text-3xl mt-5">
                        Organisation access
                    </h1>

                    <p className="mt-2 text-sm text-muted-foreground">
                        Choose your organisation and enter the password provided
                        for its Blackrod Now dashboard.
                    </p>

                    <div className="mt-6 grid gap-3">
                        <select
                            value={selectedOrgSlug}
                            onChange={(event) =>
                                setSelectedOrgSlug(event.target.value)
                            }
                            className="w-full px-4 py-2.5 rounded-2xl border border-border bg-background text-base sm:text-sm"
                        >
                            <option value="">Choose organisation…</option>
                            {orgs.map((item) => (
                                <option key={item.slug} value={item.slug}>
                                    {item.name}
                                </option>
                            ))}
                        </select>

                        <input
                            type="password"
                            value={orgPasswordInput}
                            onChange={(event) =>
                                setOrgPasswordInput(event.target.value)
                            }
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    unlockOrganisation();
                                }
                            }}
                            placeholder="Organisation password"
                            className="w-full px-4 py-2.5 rounded-2xl border border-border bg-background text-base sm:text-sm"
                        />

                        <button
                            type="button"
                            onClick={unlockOrganisation}
                            disabled={unlockBusy}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
                        >
                            {unlockBusy && (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            )}

                            Open dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            data-testid="org-dashboard"
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12"
        >
            <ImpersonationBanner
                selectedOrgSlug={selectedOrgSlug}
                orgName={org?.name}
            />

            {/* HEADER */}
            <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-8">
                <div className="flex items-start gap-4">
                    {org && (
                        <OrgAvatar
                            org={org}
                            size={64}
                            rounded="rounded-2xl"
                            className="shadow-sm"
                        />
                    )}

                    <div>
                        <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                            Organisation dashboard
                        </span>

                        <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tight mt-2">
                            {org?.name || "Your organisation"}
                        </h1>

                        <p className="mt-2 text-muted-foreground text-sm max-w-xl">
                            Manage your events, public profile and community
                            content from one place.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <NotificationBell
                        count={unreadCount}
                        notifications={notifications}
                        org={org}
                        onRead={async (id) => {
                            await api.markNotificationRead(id);

                            setNotifications((previous) =>
                                previous.map((item) =>
                                    item.id === id
                                        ? {
                                              ...item,
                                              read: true,
                                          }
                                        : item
                                )
                            );
                        }}
                    />

                    <button
                        data-testid="contact-admin-open"
                        type="button"
                        onClick={() => setContactOpen(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-border bg-surface font-semibold text-xs"
                    >
                        <Send className="h-3.5 w-3.5" />
                        Contact admin
                    </button>

                    <button
                        type="button"
                        onClick={() => setSettingsOpen(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-border bg-surface font-semibold text-xs"
                    >
                        <Settings className="h-3.5 w-3.5" />
                        Settings
                    </button>

                    <select
                        data-testid="org-switcher"
                        value={selectedOrgSlug}
                        onChange={(event) =>
                            setSelectedOrgSlug(event.target.value)
                        }
                        className="min-w-0 max-w-full px-4 py-2.5 rounded-full border border-border bg-surface text-sm"
                    >
                        <option value="">Choose organisation…</option>
                        {orgs.map((item) => (
                            <option key={item.slug} value={item.slug}>
                                {item.name}
                            </option>
                        ))}
                    </select>
                </div>
            </header>

            {/* PRIMARY ACTIONS */}
            <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
                <Link
                    to="/submit-event"
                    className="rounded-3xl border border-primary bg-primary text-primary-foreground p-5 hover:-translate-y-0.5 transition-transform"
                >
                    <div className="h-10 w-10 rounded-2xl bg-primary-foreground/15 grid place-items-center">
                        <Plus className="h-5 w-5" />
                    </div>

                    <h2 className="font-display font-bold text-lg mt-3">
                        Add an event
                    </h2>

                    <p className="text-sm text-primary-foreground/80 mt-1">
                        Create a new one-off or recurring event.
                    </p>
                </Link>

                <Link
                    to={`/edit-organisation/${selectedOrgSlug}`}
                    data-testid="qa-profile"
                    className="rounded-3xl border border-border bg-surface p-5 hover:-translate-y-0.5 transition-transform"
                >
                    <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary grid place-items-center">
                        <Edit3 className="h-5 w-5" />
                    </div>

                    <h2 className="font-display font-bold text-lg mt-3">
                        Edit profile
                    </h2>

                    <p className="text-sm text-muted-foreground mt-1">
                        Update your page, contact details and branding.
                    </p>
                </Link>

                <Link
                    to={`/organisations/${selectedOrgSlug}`}
                    className="rounded-3xl border border-border bg-surface p-5 hover:-translate-y-0.5 transition-transform"
                >
                    <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary grid place-items-center">
                        <ExternalLink className="h-5 w-5" />
                    </div>

                    <h2 className="font-display font-bold text-lg mt-3">
                        View public page
                    </h2>

                    <p className="text-sm text-muted-foreground mt-1">
                        See what residents currently see.
                    </p>
                </Link>

                <a
                    href="#smart-import"
                    className="rounded-3xl border border-border bg-surface p-5 hover:-translate-y-0.5 transition-transform"
                >
                    <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary grid place-items-center">
                        <Wand2 className="h-5 w-5" />
                    </div>

                    <h2 className="font-display font-bold text-lg mt-3">
                        Create from text
                    </h2>

                    <p className="text-sm text-muted-foreground mt-1">
                        Turn newsletter or flyer text into event drafts.
                    </p>
                </a>
            </section>

            {/* AT-A-GLANCE */}
            <section
                className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10"
                data-testid="org-analytics-section"
            >
                <Stat
                    label="Profile views"
                    value={metrics.page_views_30d || 0}
                    icon={Eye}
                    tone="primary"
                />

                <Stat
                    label="Event views"
                    value={metrics.event_views_30d || 0}
                    icon={BarChart3}
                />

                <Stat
                    label="Followers"
                    value={metrics.followers || 0}
                    icon={Users}
                />

                <Stat
                    label="Upcoming events"
                    value={eventCounts.upcoming}
                    icon={Calendar}
                />
            </section>

            {/* EVENT MANAGEMENT */}
            <section className="mb-10">
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
                    <div>
                        <span className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                            Event management
                        </span>

                        <h2 className="font-display font-black text-2xl sm:text-3xl mt-2">
                            Your events
                        </h2>

                        <p className="mt-1 text-sm text-muted-foreground">
                            Create, update, duplicate and promote your Blackrod
                            Now listings.
                        </p>
                    </div>

                    <Link
                        to="/submit-event"
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
                    >
                        <Plus className="h-4 w-4" />
                        Add event
                    </Link>
                </div>

                <div className="rounded-3xl border border-border bg-surface overflow-hidden">
                    <div className="p-4 sm:p-5 border-b border-border space-y-4">
                        <div className="flex flex-wrap gap-2">
                            {EVENT_FILTERS.map((filter) => (
                                <button
                                    key={filter.key}
                                    type="button"
                                    onClick={() => setEventFilter(filter.key)}
                                    className={`px-3 py-2 rounded-full text-xs font-semibold border transition ${
                                        eventFilter === filter.key
                                            ? "border-foreground bg-foreground text-background"
                                            : "border-border bg-background hover:bg-muted"
                                    }`}
                                >
                                    {filter.label}
                                    <span className="ml-1 opacity-70">
                                        {eventCounts[filter.key]}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <div className="relative max-w-lg">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

                            <input
                                type="search"
                                value={eventSearch}
                                onChange={(event) =>
                                    setEventSearch(event.target.value)
                                }
                                placeholder="Search your events…"
                                className="w-full pl-10 pr-4 py-2.5 rounded-full border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                    </div>

                    {visibleEvents.length === 0 ? (
                        <div className="p-10 text-center">
                            <CalendarClock className="h-8 w-8 mx-auto text-muted-foreground" />

                            <h3 className="font-display font-bold text-lg mt-3">
                                No {eventFilter === "all" ? "" : eventFilter} events
                            </h3>

                            <p className="mt-1 text-sm text-muted-foreground">
                                {eventFilter === "upcoming"
                                    ? "Create an event and it will appear here once approved."
                                    : eventFilter === "pending"
                                    ? "You don't currently have any events awaiting approval."
                                    : eventFilter === "past"
                                    ? "Past events will be kept here for reference."
                                    : "No events match your search."}
                            </p>

                            {eventFilter === "upcoming" && (
                                <Link
                                    to="/submit-event"
                                    className="mt-4 inline-flex items-center gap-1 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add your first event
                                </Link>
                            )}
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {visibleEvents.map((event) => {
                                const recurring =
                                    event.recurrence &&
                                    event.recurrence.freq &&
                                    event.recurrence.freq !== "none";

                                return (
                                    <div
                                        key={event.id}
                                        data-testid={`dash-event-${event.id}`}
                                        className="p-4 sm:p-5"
                                    >
                                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                            <div className="flex items-start gap-4 flex-1 min-w-0">
                                                <div className="w-16 rounded-2xl border border-border bg-background px-2 py-3 text-center shrink-0">
                                                    <div className="text-[10px] font-bold uppercase tracking-wider text-primary">
                                                        {new Date(
                                                            event.start
                                                        ).toLocaleDateString(
                                                            "en-GB",
                                                            {
                                                                month: "short",
                                                            }
                                                        )}
                                                    </div>

                                                    <div className="font-display font-black text-2xl leading-none mt-1">
                                                        {new Date(
                                                            event.start
                                                        ).getDate()}
                                                    </div>
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <CategoryBadge
                                                            category={
                                                                event.category
                                                            }
                                                        />

                                                        <span
                                                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${statusClass(
                                                                event.status
                                                            )}`}
                                                        >
                                                            {statusLabel(
                                                                event.status
                                                            )}
                                                        </span>

                                                        {recurring && (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-primary/10 text-primary">
                                                                Repeating
                                                            </span>
                                                        )}
                                                    </div>

                                                    <h3 className="font-display font-bold text-lg mt-2 truncate">
                                                        {event.title}
                                                    </h3>

                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {formatDate(event.start)} ·{" "}
                                                        {formatTime(event.start)}
                                                        {event.venue
                                                            ? ` · ${event.venue}`
                                                            : ""}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                                <Link
                                                    to={`/events/${event.id}`}
                                                    className="inline-flex items-center gap-1 px-3 py-2 rounded-full border border-border bg-background text-xs font-semibold hover:bg-muted"
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                    View
                                                </Link>

                                                <button
                                                    type="button"
                                                    data-testid={`dash-event-post-now-${event.id}`}
                                                    onClick={() =>
                                                        setPostNowEvent(event)
                                                    }
                                                    className="inline-flex items-center gap-1 px-3 py-2 rounded-full border border-border bg-background text-xs font-semibold hover:bg-muted"
                                                >
                                                    <Rocket className="h-3.5 w-3.5" />
                                                    Promote
                                                </button>

                                                <button
                                                    type="button"
                                                    data-testid={`dash-event-duplicate-${event.id}`}
                                                    disabled={
                                                        duplicatingId === event.id
                                                    }
                                                    onClick={() =>
                                                        duplicateEvent(event)
                                                    }
                                                    className="inline-flex items-center gap-1 px-3 py-2 rounded-full border border-border bg-background text-xs font-semibold hover:bg-muted disabled:opacity-50"
                                                >
                                                    {duplicatingId === event.id ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <Copy className="h-3.5 w-3.5" />
                                                    )}
                                                    Duplicate
                                                </button>

                                                <Link
                                                    to={`/edit-event/${event.id}`}
                                                    data-testid={`dash-event-edit-${event.id}`}
                                                    className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold"
                                                >
                                                    <Edit3 className="h-3.5 w-3.5" />
                                                    Edit
                                                </Link>
                                            </div>
                                        </div>

                                        <div className="mt-3 ml-0 lg:ml-20 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                                            <a
                                                href={api.eventPosterPngUrl(event.id)}
                                                data-testid={`dash-event-poster-png-${event.id}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="hover:text-primary"
                                            >
                                                Download social poster
                                            </a>

                                            <a
                                                href={api.eventPosterPdfUrl(event.id)}
                                                data-testid={`dash-event-poster-pdf-${event.id}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="hover:text-primary"
                                            >
                                                Download print poster
                                            </a>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* SMART IMPORT */}
            <section
                id="smart-import"
                data-testid="upload-once-section"
                className="relative overflow-hidden rounded-[2rem] border border-border bg-foreground text-background p-6 sm:p-9 scroll-mt-24"
            >
                <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary blur-3xl opacity-30" />
                <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-secondary blur-3xl opacity-30" />

                <div className="relative">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-[11px] font-bold tracking-wider uppercase">
                        <Wand2 className="h-3.5 w-3.5" />
                        Smart import
                    </div>

                    <div className="grid lg:grid-cols-2 gap-8 mt-4">
                        <div>
                            <h2 className="font-display font-black text-3xl sm:text-4xl leading-tight">
                                Paste once. Create several drafts.
                            </h2>

                            <p className="mt-3 text-background/80 text-sm max-w-lg">
                                Paste text from a newsletter, flyer or programme.
                                Blackrod Now will identify events and community
                                updates so you can review them individually.
                            </p>

                            <textarea
                                data-testid="ai-text-input"
                                value={text}
                                onChange={(event) => setText(event.target.value)}
                                placeholder="Paste your text here…"
                                rows={7}
                                className="mt-5 w-full rounded-3xl bg-background/10 backdrop-blur border border-background/20 p-4 text-sm placeholder:text-background/40 text-background outline-none focus:ring-2 focus:ring-secondary"
                            />

                            <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                    data-testid="ai-parse-btn"
                                    type="button"
                                    onClick={parse}
                                    disabled={loading}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary text-secondary-foreground font-semibold text-sm disabled:opacity-60"
                                >
                                    {loading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Sparkles className="h-4 w-4" />
                                    )}

                                    Generate drafts
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setText(EXAMPLE)}
                                    data-testid="ai-example-btn"
                                    className="inline-flex items-center gap-1 px-5 py-2.5 rounded-full text-sm font-semibold border border-background/40 text-background"
                                >
                                    Use example
                                </button>
                            </div>
                        </div>

                        <div
                            data-testid="ai-results"
                            className="space-y-3 max-h-[600px] overflow-y-auto pr-1"
                        >
                            {!items.length && !loading && (
                                <div className="rounded-3xl border border-dashed border-background/30 p-8 text-center text-background/60 min-h-64 grid place-items-center">
                                    Drafts will appear here for review.
                                </div>
                            )}

                            {loading && (
                                <div className="rounded-3xl bg-background/10 backdrop-blur border border-background/20 p-8 text-center">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />

                                    <p className="mt-3 text-sm text-background/70">
                                        Reading your text…
                                    </p>
                                </div>
                            )}

                            {items.map((item, index) => (
                                <ParsedCard
                                    key={index}
                                    it={item}
                                    onPublishEvent={(options) =>
                                        publishEvent(item, options)
                                    }
                                    onPublishUpdate={() =>
                                        publishUpdate(item)
                                    }
                                    onCopy={copy}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ORGANISATION TOOLS */}
            <section className="mt-10">
                <div className="mb-5">
                    <span className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                        Organisation tools
                    </span>

                    <h2 className="font-display font-black text-2xl sm:text-3xl mt-2">
                        Manage your presence
                    </h2>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Link
                        to={`/edit-organisation/${selectedOrgSlug}`}
                        className="rounded-3xl border border-border bg-surface p-6"
                    >
                        <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary grid place-items-center">
                            <Building2 className="h-5 w-5" />
                        </div>

                        <h3 className="font-display font-bold mt-3">
                            Profile & branding
                        </h3>

                        <p className="text-sm text-muted-foreground mt-1">
                            Logo, cover, description, contacts and social links.
                        </p>

                        <div className="mt-3 text-primary font-semibold text-sm">
                            Edit profile →
                        </div>
                    </Link>

                    <UploadDocsCard
                        slug={selectedOrgSlug}
                        docs={docs}
                        onChange={loadDocs}
                    />

                    <SharePackCard slug={selectedOrgSlug} org={org} />
                </div>
            </section>

            {/* INSIGHTS */}
            <section className="mt-10">
                <div className="mb-5">
                    <span className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                        Insights
                    </span>

                    <h2 className="font-display font-black text-2xl sm:text-3xl mt-2">
                        See what is reaching people
                    </h2>
                </div>

                <div className="grid lg:grid-cols-2 gap-4 mb-4">
                    <div className="rounded-3xl border border-border bg-surface p-5">
                        <h3 className="font-display font-bold text-lg">
                            Top events
                        </h3>

                        {topEvents.length === 0 ? (
                            <p className="mt-4 text-sm text-muted-foreground">
                                Event engagement will appear here after people
                                start viewing and sharing your listings.
                            </p>
                        ) : (
                            <div className="mt-4 space-y-3">
                                {topEvents.slice(0, 5).map((eventItem) => (
                                    <div
                                        key={eventItem.id}
                                        className="flex items-start justify-between gap-3 text-sm"
                                    >
                                        <div>
                                            <Link
                                                to={`/events/${eventItem.id}`}
                                                className="font-semibold hover:text-primary"
                                            >
                                                {eventItem.title}
                                            </Link>

                                            <div className="text-xs text-muted-foreground mt-1">
                                                {eventItem.views} views ·{" "}
                                                {eventItem.shares} shares
                                            </div>
                                        </div>

                                        <span className="text-xs text-muted-foreground">
                                            {statusLabel(eventItem.status)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded-3xl border border-border bg-surface p-5">
                        <h3 className="font-display font-bold text-lg">
                            Share channels
                        </h3>

                        {sharePlatforms.length === 0 ? (
                            <p className="mt-4 text-sm text-muted-foreground">
                                Once people share your events, the channel mix
                                will appear here.
                            </p>
                        ) : (
                            <div className="mt-4 flex flex-wrap gap-2">
                                {sharePlatforms.map((item) => (
                                    <span
                                        key={item.platform}
                                        className="px-3 py-2 rounded-full bg-muted text-sm"
                                    >
                                        {item.platform} · {item.count}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <OrgAnalyticsPanel
                    slug={selectedOrgSlug}
                    orgName={org?.name}
                />
            </section>

            <ContactAdminDialog
                open={contactOpen}
                onClose={() => setContactOpen(false)}
                fromOrgSlug={selectedOrgSlug}
                fromEmail={org?.email}
                fromName={org?.name}
            />

            <Dialog
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Organisation settings</DialogTitle>

                        <DialogDescription>
                            Change the password used to access this organisation's
                            Blackrod Now dashboard.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        {role !== "admin" && (
                            <label className="block">
                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Current password
                                </span>

                                <input
                                    type="password"
                                    value={passwordForm.current}
                                    onChange={(event) =>
                                        setPasswordForm((previous) => ({
                                            ...previous,
                                            current: event.target.value,
                                        }))
                                    }
                                    className="mt-1.5 w-full px-4 py-2.5 rounded-2xl border border-border bg-background text-base sm:text-sm"
                                />
                            </label>
                        )}

                        <label className="block">
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                New password
                            </span>

                            <input
                                type="password"
                                value={passwordForm.next}
                                onChange={(event) =>
                                    setPasswordForm((previous) => ({
                                        ...previous,
                                        next: event.target.value,
                                    }))
                                }
                                className="mt-1.5 w-full px-4 py-2.5 rounded-2xl border border-border bg-background text-base sm:text-sm"
                            />
                        </label>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setSettingsOpen(false)}
                            className="px-4 py-2 rounded-full border border-border text-sm font-semibold"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            onClick={changePassword}
                            disabled={
                                passwordBusy ||
                                (role === "admin" && !adminCodeSession)
                            }
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
                        >
                            {passwordBusy && (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            )}

                            Save password
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            <PostNowDialog
                event={postNowEvent}
                open={Boolean(postNowEvent)}
                onOpenChange={(open) => {
                    if (!open) {
                        setPostNowEvent(null);
                    }
                }}
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
    const detectedFreq = it.recurrence_freq && it.recurrence_freq !== "none" ? it.recurrence_freq : "none";
    const [recurrenceFreq, setRecurrenceFreq] = useState(detectedFreq);
    const [recurrenceUntil, setRecurrenceUntil] = useState("");
    const detectedWeekday = it.recurrence_weekday || null;
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
                    <div className="flex items-center justify-between gap-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-background/70 flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> Repeat this event
                        </div>
                        {detectedFreq !== "none" && (
                            <span
                                data-testid="parsed-recurrence-detected"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/25 text-secondary-foreground text-[9px] font-black uppercase tracking-wider"
                                title={`Detected "${it.recurrence_raw_text || ""}" in the source text`}
                            >
                                <Sparkles className="h-2.5 w-2.5" /> Auto-detected
                                {detectedWeekday ? ` · ${detectedWeekday}s` : ""}
                            </span>
                        )}
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
                            <option value="monthly_weekday">Same weekday each month (e.g. 1st Thursday)</option>
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
                {it.matched_event_id ? (
                    <ShareButtons
                        text={it.social_caption || it.description}
                        url={`${window.location.origin}/events/${it.matched_event_id}`}
                        ogUrl={`${window.location.origin}/api/events/${it.matched_event_id}/og`}
                        title={it.title}
                    />
                ) : (
                    <p className="text-[11px] text-background/70" data-testid="parsed-share-hint">
                        Hit <strong>Create event</strong> first — you'll then get a ready-made post with
                        your organisation's details, an event poster and the correct link preview.
                    </p>
                )}
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
