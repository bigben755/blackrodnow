import React, { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { CATEGORIES } from "@/data/mockData";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import {
    Accessibility,
    AlertTriangle,
    ArrowLeft,
    Ban,
    Calendar,
    CalendarClock,
    Clock,
    Loader2,
    Mail,
    MapPin,
    PoundSterling,
    RotateCcw,
    Save,
    ShieldCheck,
    Trash2,
    Users,
} from "lucide-react";
import { toast } from "sonner";
import RecurrenceFields, {
    buildRecurrencePayload,
} from "@/components/RecurrenceFields";
import EventImageInput from "@/components/EventImageInput";
import { localIso } from "@/lib/localTime";

const eventStatusLabel = (status) => {
    if (status === "approved") return "Published";
    if (status === "pending") return "Awaiting approval";
    if (status === "rejected") return "Needs attention";
    if (status === "cancelled") return "Cancelled";
    return status || "Draft";
};

const eventStatusClass = (status) => {
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

export default function EventEdit() {
    const { id } = useParams();

    const {
        events,
        orgs,
        role,
        updateEvent,
        setEventStatus,
        deleteEvent,
        hasOrgAccess,
        refresh,
    } = useApp();

    const navigate = useNavigate();

    const [fetched, setFetched] = useState(null);

    // Recurring occurrences have virtual ids like `parent__2026-09-05` — always
    // edit the parent series (occurrence-level tweaks are done via skip dates).
    const baseId = id && id.includes("__") ? id.split("__")[0] : id;
    const isSeriesOccurrence = Boolean(id && id.includes("__"));

    const event = useMemo(
        () =>
            events.find(
                (item) => item.id === baseId && !item.is_recurrence_instance
            ) ||
            events.find((item) => item.id === baseId) ||
            fetched,
        [events, baseId, fetched]
    );

    useEffect(() => {
        if (!baseId || event) return;
        api.event(baseId)
            .then((data) => setFetched(data))
            .catch(() => {});
    }, [baseId, event]);

    const [form, setForm] = useState(null);
    const [busy, setBusy] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [statusBusy, setStatusBusy] = useState(false);
    const [showPostpone, setShowPostpone] = useState(false);

    const dateFieldRef = useRef(null);

    const isAdmin = role === "admin";

    const knownVenues = useMemo(() => {
        const map = new Map();

        events.forEach((item) => {
            if (!item.venue) return;

            const key = item.venue.trim().toLowerCase();

            if (!map.has(key)) {
                map.set(key, {
                    name: item.venue.trim(),
                    address: item.address || "",
                });
            } else if (!map.get(key).address && item.address) {
                map.set(key, {
                    name: item.venue.trim(),
                    address: item.address,
                });
            }
        });

        return Array.from(map.values()).sort((a, b) =>
            a.name.localeCompare(b.name)
        );
    }, [events]);

    useEffect(() => {
        if (!event) return;

        const startIso = String(event.start || "");
        const endIso = String(event.end || "");

        setForm({
            title: event.title || "",
            orgSlug: event.orgSlug || "",
            category: event.category || "Community",

            date: startIso.slice(0, 10),
            endDate:
                endIso && endIso.slice(0, 10) !== startIso.slice(0, 10)
                    ? endIso.slice(0, 10)
                    : "",
            startTime: startIso.slice(11, 16),
            endTime: endIso.slice(11, 16),

            venue: event.venue || "",
            address: event.address || "",

            description: event.description || "",

            cost: event.cost || "",
            age: event.age || "",
            accessibility: event.accessibility || "",

            booking: event.booking || "",
            contactEmail: event.contactEmail || "",
            contactPhone: event.contactPhone || "",

            image: event.image || "",

            status: event.status || "pending",

            recurrenceFreq: event.recurrence?.freq || "none",
            recurrenceUntil: event.recurrence?.until
                ? String(event.recurrence.until).slice(0, 10)
                : "",
            recurrenceInterval: event.recurrence?.interval || 1,
            recurrenceExtraDates: (
                event.recurrence?.extra_dates || []
            ).map((date) => String(date).slice(0, 10)),
            recurrenceExceptionDates: (
                event.recurrence?.exception_dates || []
            ).map((date) => String(date).slice(0, 10)),
            recurrenceTermTimeOnly: !!event.recurrence?.term_time_only,
        });
    }, [event]);

    if (!event) {
        return (
            <div className="max-w-2xl mx-auto px-6 py-24 text-center">
                <Calendar className="h-9 w-9 mx-auto text-muted-foreground" />

                <h1 className="font-display font-black text-3xl mt-4">
                    Event not found
                </h1>

                <Link
                    to="/events"
                    className="mt-5 inline-flex text-primary font-semibold"
                >
                    ← Back to What's On
                </Link>
            </div>
        );
    }

    if (role === "org" && !hasOrgAccess(event.orgSlug)) {
        return (
            <div className="max-w-2xl mx-auto px-6 py-24 text-center">
                <ShieldCheck className="h-9 w-9 mx-auto text-muted-foreground" />

                <h1 className="font-display font-black text-3xl mt-4">
                    Organisation access required
                </h1>

                <p className="mt-3 text-muted-foreground">
                    Unlock this organisation from your dashboard before editing
                    its events.
                </p>

                <Link
                    to="/organisation-dashboard"
                    className="mt-6 inline-flex text-primary font-semibold"
                >
                    Go to organisation dashboard
                </Link>
            </div>
        );
    }

    if (!form) return null;

    const set = (key) => (inputEvent) =>
        setForm((current) => ({
            ...current,
            [key]:
                inputEvent.target.type === "checkbox"
                    ? inputEvent.target.checked
                    : inputEvent.target.value,
        }));

    const onVenueChange = (inputEvent) => {
        const value = inputEvent.target.value;

        const known = knownVenues.find(
            (venue) =>
                venue.name.toLowerCase() === value.trim().toLowerCase()
        );

        setForm((current) => ({
            ...current,
            venue: value,
            address: known?.address || current.address,
        }));
    };

    const validate = () => {
        if (!form.title.trim()) {
            toast.error("Add an event title");
            return false;
        }

        if (!form.date) {
            toast.error("Please set a date");
            return false;
        }

        if (!form.startTime) {
            toast.error("Please set a start time");
            return false;
        }

        const multiDay = form.endDate && form.endDate !== form.date;

        if (form.endDate && form.endDate < form.date) {
            toast.error("The end date cannot be before the start date");
            return false;
        }

        if (
            !multiDay &&
            form.endTime &&
            form.startTime &&
            form.endTime <= form.startTime
        ) {
            toast.error("The end time must be later than the start time");
            return false;
        }

        return true;
    };

    const buildTimes = () => {
        // Stored as naive UK wall-clock strings — no timezone conversion.
        const start = `${form.date}T${form.startTime}:00`;

        const end = form.endTime
            ? `${form.endDate || form.date}T${form.endTime}:00`
            : localIso(
                  new Date(
                      new Date(`${form.date}T${form.startTime}`).getTime() +
                          60 * 60 * 1000
                  )
              );

        return { start, end };
    };

    const save = async (submitEvent) => {
        submitEvent.preventDefault();

        if (!validate()) return;

        setBusy(true);

        try {
            const { start, end } = buildTimes();

            await updateEvent(
                event.id,
                {
                    title: form.title.trim(),

                    orgSlug:
                        role === "admin" ? form.orgSlug : event.orgSlug,

                    category: form.category,

                    start,
                    end,

                    venue: form.venue.trim(),
                    address: form.address.trim(),

                    description: form.description.trim(),

                    cost: form.cost.trim(),
                    age: form.age.trim(),
                    accessibility: form.accessibility.trim(),

                    booking: form.booking.trim(),
                    contactEmail: form.contactEmail.trim(),
                    contactPhone: form.contactPhone.trim(),

                    image: form.image,

                    recurrence: buildRecurrencePayload(
                        form.recurrenceFreq,
                        form.recurrenceUntil,
                        {
                            interval: form.recurrenceInterval,
                            extraDates: form.recurrenceExtraDates,
                            exceptionDates: form.recurrenceExceptionDates,
                            termTimeOnly: form.recurrenceTermTimeOnly,
                        }
                    ),

                    ...(role === "admin"
                        ? {
                              status: form.status,
                          }
                        : {}),
                },
                event.orgSlug
            );

            await refresh?.();

            toast.success("Event updated");

            navigate("/organisation-dashboard");
        } catch (error) {
            toast.error(
                error?.response?.data?.detail || "Couldn't save changes"
            );
        } finally {
            setBusy(false);
        }
    };

    const applyStatus = async (nextStatus) => {
        setStatusBusy(true);

        try {
            if (typeof setEventStatus === "function") {
                await setEventStatus(event.id, nextStatus, event.orgSlug);
            } else {
                await updateEvent(
                    event.id,
                    {
                        status: nextStatus,
                    },
                    event.orgSlug
                );
            }

            await refresh?.();

            setForm((current) => ({
                ...current,
                status: nextStatus,
            }));

            toast.success(
                nextStatus === "cancelled"
                    ? "Event marked as cancelled"
                    : nextStatus === "pending"
                    ? "Event sent back for approval"
                    : "Event status updated"
            );
        } catch (error) {
            toast.error(
                error?.response?.data?.detail || "Couldn't update event status"
            );
        } finally {
            setStatusBusy(false);
        }
    };

    const cancelEvent = async () => {
        const confirmed = window.confirm(
            `Cancel "${event.title}"?\n\nThe event will be removed from the public What's On calendar but kept in your dashboard.`
        );

        if (!confirmed) return;

        await applyStatus("cancelled");
    };

    const restoreEvent = async () => {
        const nextStatus = isAdmin ? "approved" : "pending";

        await applyStatus(nextStatus);
    };

    const remove = async () => {
        if (!isAdmin) return;

        const confirmed = window.confirm(
            `Permanently delete "${event.title}"?\n\nThis cannot be undone.`
        );

        if (!confirmed) return;

        setDeleting(true);

        try {
            await deleteEvent(event.id);

            toast.success("Event permanently deleted");

            navigate("/organisation-dashboard");
        } catch {
            toast.error("Delete failed");
            setDeleting(false);
        }
    };

    const openPostpone = () => {
        setShowPostpone(true);

        window.setTimeout(() => {
            dateFieldRef.current?.focus();
            dateFieldRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
        }, 50);
    };

    const isRecurring =
        form.recurrenceFreq && form.recurrenceFreq !== "none";

    return (
        <div
            className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10"
            data-testid="edit-event-page"
        >
            {/* TOP BAR */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <Link
                    to="/organisation-dashboard"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Organisation dashboard
                </Link>

                <div className="flex flex-wrap items-center gap-2">
                    <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${eventStatusClass(
                            form.status
                        )}`}
                    >
                        {eventStatusLabel(form.status)}
                    </span>

                    {isAdmin && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                            <ShieldCheck className="h-3 w-3" />
                            Site admin
                        </span>
                    )}
                </div>
            </div>

            {/* HEADER */}
            <div className="mb-7">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                    Manage event
                </span>

                <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tight mt-2">
                    {event.title}
                </h1>

                <p className="mt-2 text-sm text-muted-foreground">
                    Update the information residents see on Blackrod Now.
                </p>
            </div>

            {/* EVENT STATE ACTIONS */}
            <section className="rounded-3xl border border-border bg-surface p-5 sm:p-6 mb-5">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <h2 className="font-display font-bold text-lg">
                            Event status
                        </h2>

                        <p className="mt-1 text-sm text-muted-foreground">
                            Keep the listing accurate if plans change.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {form.status !== "cancelled" ? (
                            <>
                                <button
                                    type="button"
                                    onClick={openPostpone}
                                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-border bg-background text-xs font-semibold hover:bg-muted"
                                >
                                    <CalendarClock className="h-3.5 w-3.5" />
                                    Change / postpone date
                                </button>

                                <button
                                    type="button"
                                    onClick={cancelEvent}
                                    disabled={statusBusy}
                                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-destructive/40 text-destructive text-xs font-semibold hover:bg-destructive/10 disabled:opacity-50"
                                >
                                    {statusBusy ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Ban className="h-3.5 w-3.5" />
                                    )}

                                    Cancel event
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={restoreEvent}
                                disabled={statusBusy}
                                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
                            >
                                {statusBusy ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <RotateCcw className="h-3.5 w-3.5" />
                                )}

                                {isAdmin
                                    ? "Restore event"
                                    : "Restore and send for approval"}
                            </button>
                        )}
                    </div>
                </div>

                {showPostpone && form.status !== "cancelled" && (
                    <div className="mt-4 rounded-2xl bg-primary/5 border border-primary/20 p-4 text-sm">
                        <div className="font-semibold">
                            Postponing an event
                        </div>

                        <p className="mt-1 text-muted-foreground">
                            Change the date and/or times below, then save. The
                            same event link will be retained with the updated
                            information.
                        </p>
                    </div>
                )}
            </section>

            {/* RECURRING EVENT NOTICE */}
            {isRecurring && (
                <section className="rounded-3xl border border-primary/20 bg-primary/5 p-5 sm:p-6 mb-5">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-primary mt-0.5 shrink-0" />

                        <div>
                            <h2 className="font-display font-bold">
                                This is a repeating event
                            </h2>

                            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                                Blackrod Now currently stores this as one
                                repeating listing. Changes to its date, time,
                                venue or recurrence settings affect the repeating
                                event definition. Editing one individual
                                occurrence separately is not yet supported by
                                the current event data model.
                            </p>
                        </div>
                    </div>
                </section>
            )}

            <form onSubmit={save} className="space-y-5">
                {/* BASICS */}
                <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8 space-y-5">
                    <div>
                        <h2 className="font-display font-black text-xl">
                            Event basics
                        </h2>

                        <p className="mt-1 text-sm text-muted-foreground">
                            Name, organiser and category.
                        </p>
                    </div>

                    <Field label="Event title" required>
                        <input
                            data-testid="ee-title"
                            required
                            value={form.title}
                            onChange={set("title")}
                            className={inp}
                        />
                    </Field>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <Field label="Organisation" required>
                            {role === "admin" ? (
                                <select
                                    data-testid="ee-org"
                                    required
                                    value={form.orgSlug}
                                    onChange={set("orgSlug")}
                                    className={inp}
                                >
                                    <option value="" disabled>
                                        Choose organisation…
                                    </option>
                                    {orgs.map((org) => (
                                        <option key={org.slug} value={org.slug}>
                                            {org.name}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    value={
                                        orgs.find(
                                            (org) =>
                                                org.slug === event.orgSlug
                                        )?.name || event.orgSlug
                                    }
                                    readOnly
                                    className={`${inp} opacity-70`}
                                />
                            )}
                        </Field>

                        <Field label="Category" required>
                            <select
                                data-testid="ee-category"
                                value={form.category}
                                onChange={set("category")}
                                className={inp}
                            >
                                {CATEGORIES.map((category) => (
                                    <option key={category}>{category}</option>
                                ))}
                            </select>
                        </Field>
                    </div>
                </section>

                {/* DATE / TIME */}
                <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />

                        <h2 className="font-display font-black text-xl">
                            Date & time
                        </h2>
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">
                        Times are entered and displayed in local UK time.
                    </p>

                    <div className="mt-5 grid sm:grid-cols-3 gap-4">
                        <Field label="Date" required>
                            <input
                                ref={dateFieldRef}
                                data-testid="ee-date"
                                type="date"
                                required
                                value={form.date}
                                onChange={set("date")}
                                className={inp}
                            />
                        </Field>

                        <Field label="Start time" required>
                            <input
                                data-testid="ee-start"
                                type="time"
                                required
                                value={form.startTime}
                                onChange={set("startTime")}
                                className={inp}
                            />
                        </Field>

                        <Field
                            label="End time"
                            hint="Leave blank to default to one hour."
                        >
                            <input
                                data-testid="ee-end"
                                type="time"
                                value={form.endTime}
                                onChange={set("endTime")}
                                className={inp}
                            />
                        </Field>
                        <Field
                            label="End date (multi-day events)"
                            hint="Leave blank for a single-day event."
                        >
                            <input
                                data-testid="ee-end-date"
                                type="date"
                                value={form.endDate || ""}
                                onChange={set("endDate")}
                                className={inp}
                            />
                        </Field>
                    </div>
                </section>

                {/* LOCATION */}
                <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
                    <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />

                        <h2 className="font-display font-black text-xl">
                            Location
                        </h2>
                    </div>

                    <div className="mt-5 grid sm:grid-cols-2 gap-4">
                        <Field
                            label="Venue"
                            hint="Existing Blackrod Now venues will be suggested."
                        >
                            <input
                                data-testid="ee-venue"
                                value={form.venue}
                                onChange={onVenueChange}
                                className={inp}
                                list="ee-known-venues"
                            />

                            <datalist id="ee-known-venues">
                                {knownVenues.map((venue) => (
                                    <option
                                        key={venue.name}
                                        value={venue.name}
                                    />
                                ))}
                            </datalist>
                        </Field>

                        <Field label="Address">
                            <input
                                data-testid="ee-address"
                                value={form.address}
                                onChange={set("address")}
                                className={inp}
                            />
                        </Field>
                    </div>
                </section>

                {/* DETAILS */}
                <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8 space-y-5">
                    <div>
                        <h2 className="font-display font-black text-xl">
                            Event details
                        </h2>

                        <p className="mt-1 text-sm text-muted-foreground">
                            Information residents need before attending.
                        </p>
                    </div>

                    <Field label="Description">
                        <textarea
                            data-testid="ee-desc"
                            rows={6}
                            value={form.description}
                            onChange={set("description")}
                            className={inp}
                        />
                    </Field>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <Field label="Cost" icon={PoundSterling}>
                            <input
                                data-testid="ee-cost"
                                value={form.cost}
                                onChange={set("cost")}
                                className={inp}
                                placeholder="Free, £5, donation…"
                            />
                        </Field>

                        <Field label="Suitable for" icon={Users}>
                            <input
                                data-testid="ee-age"
                                value={form.age}
                                onChange={set("age")}
                                className={inp}
                                placeholder="All ages, families, 18+…"
                            />
                        </Field>
                    </div>

                    <Field label="Accessibility" icon={Accessibility}>
                        <input
                            data-testid="ee-access"
                            value={form.accessibility}
                            onChange={set("accessibility")}
                            className={inp}
                            placeholder="Step-free access, hearing loop…"
                        />
                    </Field>

                    <Field label="Booking link">
                        <input
                            data-testid="ee-booking"
                            type="url"
                            value={form.booking}
                            onChange={set("booking")}
                            className={inp}
                            placeholder="https://"
                        />
                    </Field>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <Field label="Contact email" icon={Mail}>
                            <input
                                data-testid="ee-email"
                                type="email"
                                value={form.contactEmail}
                                onChange={set("contactEmail")}
                                className={inp}
                            />
                        </Field>

                        <Field label="Contact phone">
                            <input
                                data-testid="ee-phone"
                                type="tel"
                                value={form.contactPhone}
                                onChange={set("contactPhone")}
                                className={inp}
                            />
                        </Field>
                    </div>

                    <Field label="Poster / image">
                        <EventImageInput
                            value={form.image}
                            onChange={(url) =>
                                setForm((current) => ({
                                    ...current,
                                    image: url,
                                }))
                            }
                            testIdPrefix="ee-image"
                            inputClassName={inp}
                        />
                    </Field>
                </section>

                {/* RECURRENCE */}
                <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />

                        <h2 className="font-display font-black text-xl">
                            Repeating event
                        </h2>
                    </div>

                    <p className="mt-1 mb-5 text-sm text-muted-foreground">
                        Use this for weekly clubs, monthly meetings and other
                        recurring activities.
                    </p>

                    <RecurrenceFields
                        freq={form.recurrenceFreq}
                        until={form.recurrenceUntil}
                        interval={form.recurrenceInterval}
                        extraDates={form.recurrenceExtraDates}
                    exceptionDates={form.recurrenceExceptionDates || []}
                    termTimeOnly={form.recurrenceTermTimeOnly || false}
                    onExceptionDatesChange={(v) => setForm((f) => ({ ...f, recurrenceExceptionDates: v }))}
                    onTermTimeOnlyChange={(v) => setForm((f) => ({ ...f, recurrenceTermTimeOnly: v }))}
                        onFreqChange={(value) =>
                            setForm((current) => ({
                                ...current,
                                recurrenceFreq: value,
                            }))
                        }
                        onUntilChange={(value) =>
                            setForm((current) => ({
                                ...current,
                                recurrenceUntil: value,
                            }))
                        }
                        onIntervalChange={(value) =>
                            setForm((current) => ({
                                ...current,
                                recurrenceInterval: value,
                            }))
                        }
                        onExtraDatesChange={(value) =>
                            setForm((current) => ({
                                ...current,
                                recurrenceExtraDates: value,
                            }))
                        }
                        startDate={form.date}
                        testIdPrefix="ee-recurrence"
                        inputClassName={inp}
                    />
                </section>

                {/* ADMIN STATUS */}
                {isAdmin && (
                    <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-primary" />

                            <h2 className="font-display font-black text-xl">
                                Publication status
                            </h2>
                        </div>

                        <p className="mt-1 text-sm text-muted-foreground">
                            Site administrators can directly change moderation
                            status.
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                            {[
                                "approved",
                                "pending",
                                "rejected",
                                "cancelled",
                            ].map((status) => (
                                <button
                                    type="button"
                                    key={status}
                                    data-testid={`ee-status-${status}`}
                                    onClick={() =>
                                        setForm((current) => ({
                                            ...current,
                                            status,
                                        }))
                                    }
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                                        form.status === status
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted text-foreground"
                                    }`}
                                >
                                    {eventStatusLabel(status)}
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {/* SAVE / DELETE */}
                <section className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
                    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            {isAdmin ? (
                                <button
                                    type="button"
                                    data-testid="ee-delete"
                                    onClick={remove}
                                    disabled={deleting || busy}
                                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-destructive/40 text-destructive text-xs font-semibold hover:bg-destructive/10 disabled:opacity-50"
                                >
                                    {deleting ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-3.5 w-3.5" />
                                    )}

                                    Permanently delete
                                </button>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    Need to remove an event from the calendar?
                                    Use <strong>Cancel event</strong> above
                                    rather than deleting its history.
                                </p>
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                            <Link
                                to="/organisation-dashboard"
                                className="inline-flex items-center justify-center px-4 py-2.5 rounded-full border border-border text-xs font-semibold hover:bg-muted"
                            >
                                Back without saving
                            </Link>

                            <button
                                type="submit"
                                data-testid="ee-save"
                                disabled={busy || statusBusy}
                                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-60"
                            >
                                {busy ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Save className="h-3.5 w-3.5" />
                                )}

                                Save changes
                            </button>
                        </div>
                    </div>
                </section>
            </form>
        </div>
    );
}

const inp =
    "w-full px-4 py-2.5 rounded-2xl border border-border bg-background text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary";

const Field = ({
    label,
    required,
    hint,
    icon: Icon,
    children,
}) => (
    <label className="block">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase text-muted-foreground">
            {Icon && <Icon className="h-3.5 w-3.5" />}

            {label}

            {required && <span className="text-primary">*</span>}
        </span>

        {hint && (
            <span className="block mt-1 text-xs text-muted-foreground normal-case tracking-normal">
                {hint}
            </span>
        )}

        <div className="mt-1.5">{children}</div>
    </label>
);