import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import {
    EventCard,
    CategoryBadge,
    formatTime,
} from "@/components/Cards";
import NewsletterSection from "@/components/NewsletterSection";
import { CATEGORIES } from "@/data/mockData";
import {
    Search,
    LayoutGrid,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Rss,
    SlidersHorizontal,
    X,
    Heart,
    Clock,
} from "lucide-react";
import { downloadICS } from "@/lib/ics";
import SubscribeCalendarDialog from "@/components/SubscribeCalendarDialog";
import { toast } from "sonner";

const startOfMonth = (date) =>
    new Date(date.getFullYear(), date.getMonth(), 1);

const endOfMonth = (date) =>
    new Date(date.getFullYear(), date.getMonth() + 1, 0);

const startOfDay = (date = new Date()) =>
    new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    );

const endOfDay = (date = new Date()) =>
    new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        23,
        59,
        59,
        999
    );

const dateKey = (date) => {
    const d = new Date(date);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const dateFromKey = (key) => {
    if (!key) return new Date();

    const [year, month, day] = key
        .split("-")
        .map(Number);

    return new Date(year, month - 1, day);
};

const isSameDay = (a, b) =>
    dateKey(a) === dateKey(b);

const formatAgendaDate = (key) => {
    const date = dateFromKey(key);
    const today = new Date();

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const formatted = date.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
    });

    if (isSameDay(date, today)) {
        return `Today · ${formatted}`;
    }

    if (isSameDay(date, tomorrow)) {
        return `Tomorrow · ${formatted}`;
    }

    return formatted;
};

export default function Events() {
    const {
        events,
        orgs,
        savedEventIds,
    } = useApp();

    const savedIds = Array.isArray(savedEventIds)
        ? savedEventIds
        : [];

    const approved = useMemo(
        () =>
            events.filter(
                (event) => event.status === "approved"
            ),
        [events]
    );

    const initialFilters = useMemo(() => {
        if (typeof window === "undefined") {
            return null;
        }

        try {
            const raw = localStorage.getItem(
                "rn-events-filters"
            );

            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }, []);

    const initialDateWindow =
        initialFilters?.dateWindow === "evening"
            ? "all"
            : initialFilters?.dateWindow || "all";

    const [view, setView] = useState(
        initialFilters?.view === "month"
            ? "month"
            : "list"
    );

    const [query, setQuery] = useState(
        initialFilters?.query || ""
    );

    const [cat, setCat] = useState(
        initialFilters?.cat || "All"
    );

    const [orgFilter, setOrgFilter] = useState(
        initialFilters?.orgFilter || "All"
    );

    const [tags, setTags] = useState(
        Array.isArray(initialFilters?.tags)
            ? initialFilters.tags
            : []
    );

    const [dateWindow, setDateWindow] =
        useState(initialDateWindow);

    const [pickedDate, setPickedDate] = useState(
        initialFilters?.pickedDate || ""
    );

    const [savedOnly, setSavedOnly] = useState(
        typeof initialFilters?.savedOnly === "boolean"
            ? initialFilters.savedOnly
            : false
    );

    const [eveningOnly, setEveningOnly] = useState(
        Boolean(
            initialFilters?.eveningOnly ||
                initialFilters?.dateWindow === "evening"
        )
    );

    const [moreFiltersOpen, setMoreFiltersOpen] =
        useState(false);

    const [subOpen, setSubOpen] = useState(false);

    const [cursor, setCursor] = useState(new Date());

    const [selectedDay, setSelectedDay] = useState(
        dateKey(new Date())
    );

    const orgName = (slug) =>
        orgs.find((org) => org.slug === slug)?.name;

    useEffect(() => {
        localStorage.setItem(
            "rn-events-filters",
            JSON.stringify({
                query,
                cat,
                orgFilter,
                tags,
                view,
                dateWindow,
                pickedDate,
                savedOnly,
                eveningOnly,
            })
        );
    }, [
        query,
        cat,
        orgFilter,
        tags,
        view,
        dateWindow,
        pickedDate,
        savedOnly,
        eveningOnly,
    ]);

    const toggleTag = (tag) => {
        setTags((current) =>
            current.includes(tag)
                ? current.filter(
                      (value) => value !== tag
                  )
                : [...current, tag]
        );
    };

    const matchesTags = (event) => {
        if (!tags.length) {
            return true;
        }

        const cost = String(
            event.cost || ""
        ).toLowerCase();

        const age = String(
            event.age || ""
        ).toLowerCase();

        const accessibility = String(
            event.accessibility || ""
        ).toLowerCase();

        const category = String(
            event.category || ""
        ).toLowerCase();

        return tags.every((tag) => {
            if (tag === "Free") {
                return (
                    cost.includes("free") ||
                    cost.includes("£0")
                );
            }

            if (tag === "Kids") {
                return (
                    age.includes("kid") ||
                    age.includes("child") ||
                    age.includes("family") ||
                    age.includes("all ages") ||
                    category.includes("family") ||
                    category.includes("youth")
                );
            }

            if (tag === "Wheelchair") {
                return (
                    accessibility.includes(
                        "wheelchair"
                    ) ||
                    accessibility.includes(
                        "accessible"
                    )
                );
            }

            if (tag === "Hearing") {
                return (
                    accessibility.includes(
                        "hearing loop"
                    ) ||
                    accessibility.includes(
                        "hearing-loop"
                    ) ||
                    accessibility.includes("hearing")
                );
            }

            if (tag === "Quiet") {
                return (
                    accessibility.includes("quiet") ||
                    accessibility.includes(
                        "sensory"
                    ) ||
                    accessibility.includes(
                        "low-sensory"
                    )
                );
            }

            if (tag === "StepFree") {
                return (
                    accessibility.includes(
                        "step-free"
                    ) ||
                    accessibility.includes(
                        "step free"
                    ) ||
                    accessibility.includes(
                        "level access"
                    )
                );
            }

            return true;
        });
    };

    const matchesSearch = (event) => {
        if (!query.trim()) {
            return true;
        }

        const organiser =
            orgName(event.orgSlug) ||
            event.organiser ||
            "";

        const haystack = [
            event.title,
            event.venue,
            event.address,
            event.description,
            event.category,
            event.age,
            event.accessibility,
            organiser,
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        return haystack.includes(
            query.trim().toLowerCase()
        );
    };

    const inDateWindow = (eventStart, mode) => {
        if (mode === "all") {
            return true;
        }

        const start = new Date(eventStart);
        const now = new Date();
        const todayStart = startOfDay(now);
        const todayEnd = endOfDay(now);

        if (mode === "today") {
            return (
                start >= todayStart &&
                start <= todayEnd
            );
        }

        if (mode === "tomorrow") {
            const tomorrowStart = new Date(
                todayStart
            );

            tomorrowStart.setDate(
                tomorrowStart.getDate() + 1
            );

            const tomorrowEnd = endOfDay(
                tomorrowStart
            );

            return (
                start >= tomorrowStart &&
                start <= tomorrowEnd
            );
        }

        if (mode === "weekend") {
            const currentDay =
                todayStart.getDay();

            let saturday;

            if (currentDay === 6) {
                saturday = new Date(todayStart);
            } else if (currentDay === 0) {
                saturday = new Date(todayStart);
                saturday.setDate(
                    saturday.getDate() - 1
                );
            } else {
                saturday = new Date(todayStart);

                saturday.setDate(
                    saturday.getDate() +
                        (6 - currentDay)
                );
            }

            const sunday = new Date(saturday);
            sunday.setDate(sunday.getDate() + 1);

            return (
                start >= startOfDay(saturday) &&
                start <= endOfDay(sunday)
            );
        }

        if (mode === "seven") {
            const end = new Date(todayEnd);
            end.setDate(end.getDate() + 6);

            return (
                start >= todayStart &&
                start <= end
            );
        }

        if (mode === "month") {
            const monthEnd = endOfMonth(now);
            monthEnd.setHours(
                23,
                59,
                59,
                999
            );

            return (
                start >= todayStart &&
                start <= monthEnd
            );
        }

        if (mode === "picked") {
            if (!pickedDate) {
                return true;
            }

            return (
                dateKey(start) === pickedDate
            );
        }

        return true;
    };

    const baseFiltered = useMemo(() => {
        return approved
            .filter(matchesSearch)
            .filter((event) =>
                cat === "All"
                    ? true
                    : event.category === cat
            )
            .filter((event) =>
                orgFilter === "All"
                    ? true
                    : event.orgSlug === orgFilter
            )
            .filter(matchesTags)
            .filter((event) =>
                eveningOnly
                    ? new Date(
                          event.start
                      ).getHours() >= 18
                    : true
            )
            .filter((event) =>
                savedOnly
                    ? savedIds.includes(event.id)
                    : true
            );
    }, [
        approved,
        query,
        cat,
        orgFilter,
        tags,
        eveningOnly,
        savedOnly,
        savedIds,
        orgs,
    ]);

    const filtered = useMemo(() => {
        const now = new Date();

        return baseFiltered
            .filter(
                (event) =>
                    new Date(
                        event.end || event.start
                    ) >= now
            )
            .filter((event) =>
                inDateWindow(
                    event.start,
                    dateWindow
                )
            )
            .sort(
                (a, b) =>
                    new Date(a.start) -
                    new Date(b.start)
            );
    }, [
        baseFiltered,
        dateWindow,
        pickedDate,
    ]);

    const filteredAll = useMemo(() => {
        const now = new Date();

        return baseFiltered
            .filter(
                (event) =>
                    new Date(
                        event.end || event.start
                    ) >= now
            )
            .sort(
                (a, b) =>
                    new Date(a.start) -
                    new Date(b.start)
            );
    }, [baseFiltered]);

    const groupedEvents = useMemo(() => {
        const groups = {};

        filtered.forEach((event) => {
            const key = dateKey(event.start);

            groups[key] ??= [];
            groups[key].push(event);
        });

        return Object.entries(groups).sort(
            ([a], [b]) =>
                dateFromKey(a) -
                dateFromKey(b)
        );
    }, [filtered]);

    const monthDays = useMemo(() => {
        const first = startOfMonth(cursor);
        const last = endOfMonth(cursor);
        const days = [];

        const startWeekday =
            (first.getDay() + 6) % 7;

        for (
            let i = 0;
            i < startWeekday;
            i += 1
        ) {
            days.push(null);
        }

        for (
            let day = 1;
            day <= last.getDate();
            day += 1
        ) {
            days.push(
                new Date(
                    cursor.getFullYear(),
                    cursor.getMonth(),
                    day
                )
            );
        }

        return days;
    }, [cursor]);

    const eventsByDay = useMemo(() => {
        const map = {};

        filteredAll.forEach((event) => {
            const key = dateKey(event.start);

            map[key] ??= [];
            map[key].push(event);
        });

        return map;
    }, [filteredAll]);

    const moreFilterCount =
        (orgFilter !== "All" ? 1 : 0) +
        tags.length +
        (savedOnly ? 1 : 0) +
        (eveningOnly ? 1 : 0);

    const hasActiveFilters =
        Boolean(query.trim()) ||
        cat !== "All" ||
        orgFilter !== "All" ||
        tags.length > 0 ||
        dateWindow !== "all" ||
        savedOnly ||
        eveningOnly;

    const clearFilters = () => {
        setQuery("");
        setCat("All");
        setOrgFilter("All");
        setTags([]);
        setDateWindow("all");
        setPickedDate("");
        setSavedOnly(false);
        setEveningOnly(false);

        toast.success("Filters cleared");
    };

    const selectDateWindow = (key) => {
        setDateWindow(key);

        if (key !== "picked") {
            setPickedDate("");
        }
    };

    const handlePickedDate = (value) => {
        setPickedDate(value);

        if (value) {
            setDateWindow("picked");

            const picked = dateFromKey(value);

            setCursor(
                new Date(
                    picked.getFullYear(),
                    picked.getMonth(),
                    1
                )
            );

            setSelectedDay(value);
        } else {
            setDateWindow("all");
        }
    };

    const moveMonth = (direction) => {
        const next = new Date(
            cursor.getFullYear(),
            cursor.getMonth() + direction,
            1
        );

        setCursor(next);

        setSelectedDay(
            dateKey(
                new Date(
                    next.getFullYear(),
                    next.getMonth(),
                    1
                )
            )
        );
    };

    const goToToday = () => {
        const now = new Date();

        setCursor(
            new Date(
                now.getFullYear(),
                now.getMonth(),
                1
            )
        );

        setSelectedDay(dateKey(now));
    };

    const quickDateOptions = [
        {
            key: "all",
            label: "Upcoming",
        },
        {
            key: "today",
            label: "Today",
        },
        {
            key: "tomorrow",
            label: "Tomorrow",
        },
        {
            key: "weekend",
            label: "This weekend",
        },
        {
            key: "seven",
            label: "Next 7 days",
        },
        {
            key: "month",
            label: "This month",
        },
    ];

    return (
        <div
            data-testid="events-page"
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12"
        >
            {/* PAGE HEADER */}
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-8">
                <div>
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                        What's On
                    </span>

                    <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight mt-2">
                        What's on in Blackrod
                    </h1>

                    <p className="mt-2 text-muted-foreground text-sm sm:text-base max-w-2xl">
                        Find events, activities and things
                        to do locally.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-full border border-border bg-surface p-1">
                        <button
                            data-testid="view-list"
                            type="button"
                            onClick={() =>
                                setView("list")
                            }
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition ${
                                view === "list"
                                    ? "bg-foreground text-background"
                                    : "text-foreground/70 hover:text-foreground"
                            }`}
                        >
                            <LayoutGrid className="h-3.5 w-3.5" />
                            Agenda
                        </button>

                        <button
                            data-testid="view-month"
                            type="button"
                            onClick={() =>
                                setView("month")
                            }
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition ${
                                view === "month"
                                    ? "bg-foreground text-background"
                                    : "text-foreground/70 hover:text-foreground"
                            }`}
                        >
                            <CalendarDays className="h-3.5 w-3.5" />
                            Month
                        </button>
                    </div>

                    <button
                        data-testid="sync-calendar"
                        type="button"
                        onClick={() =>
                            setSubOpen(true)
                        }
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-surface text-xs font-semibold hover:bg-muted transition"
                    >
                        <Rss className="h-3.5 w-3.5" />
                        Calendar options
                    </button>
                </div>
            </div>

            {/* SEARCH */}
            <div className="grid md:grid-cols-12 gap-3">
                <div className="relative md:col-span-8">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

                    <input
                        data-testid="events-search"
                        type="search"
                        placeholder="Search events, venues or organisers…"
                        value={query}
                        onChange={(event) =>
                            setQuery(
                                event.target.value
                            )
                        }
                        className="w-full pl-10 pr-4 py-3 rounded-full border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>

                <select
                    data-testid="events-category"
                    value={cat}
                    onChange={(event) =>
                        setCat(event.target.value)
                    }
                    className="md:col-span-2 px-4 py-3 rounded-full border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="All">
                        All categories
                    </option>

                    {CATEGORIES.map((category) => (
                        <option
                            key={category}
                            value={category}
                        >
                            {category}
                        </option>
                    ))}
                </select>

                <button
                    type="button"
                    onClick={() =>
                        setMoreFiltersOpen(
                            (current) => !current
                        )
                    }
                    className={`md:col-span-2 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full border text-sm font-semibold transition ${
                        moreFiltersOpen ||
                        moreFilterCount > 0
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border bg-surface hover:bg-muted"
                    }`}
                >
                    <SlidersHorizontal className="h-4 w-4" />

                    More filters

                    {moreFilterCount > 0 && (
                        <span className="h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground grid place-items-center text-[10px] font-bold">
                            {moreFilterCount}
                        </span>
                    )}
                </button>
            </div>

            {/* QUICK DATE FILTERS */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
                {quickDateOptions.map((option) => (
                    <button
                        key={option.key}
                        type="button"
                        data-testid={`chip-date-${option.key}`}
                        onClick={() =>
                            selectDateWindow(
                                option.key
                            )
                        }
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                            dateWindow ===
                            option.key
                                ? "border-foreground bg-foreground text-background"
                                : "border-border bg-surface hover:bg-muted"
                        }`}
                    >
                        {option.label}
                    </button>
                ))}

                <label
                    className={`relative inline-flex items-center rounded-full border text-xs font-semibold transition overflow-hidden ${
                        dateWindow === "picked"
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-surface hover:bg-muted"
                    }`}
                >
                    <CalendarDays className="h-3.5 w-3.5 ml-3 pointer-events-none" />

                    <span className="pl-1.5">
                        {pickedDate
                            ? dateFromKey(
                                  pickedDate
                              ).toLocaleDateString(
                                  "en-GB",
                                  {
                                      day: "numeric",
                                      month: "short",
                                  }
                              )
                            : "Pick a date"}
                    </span>

                    <input
                        type="date"
                        value={pickedDate}
                        onChange={(event) =>
                            handlePickedDate(
                                event.target.value
                            )
                        }
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        aria-label="Pick a date"
                    />
                </label>

                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={clearFilters}
                        data-testid="clear-filters"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-3.5 w-3.5" />
                        Clear
                    </button>
                )}
            </div>

            {/* MORE FILTERS */}
            {moreFiltersOpen && (
                <div className="mt-4 rounded-3xl border border-border bg-surface p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="font-display font-bold text-lg">
                                More filters
                            </h2>

                            <p className="mt-1 text-xs text-muted-foreground">
                                Narrow the calendar by
                                organiser, suitability and
                                accessibility.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                setMoreFiltersOpen(
                                    false
                                )
                            }
                            className="h-8 w-8 rounded-full grid place-items-center hover:bg-muted"
                            aria-label="Close filters"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="mt-5 grid lg:grid-cols-2 gap-6">
                        <div>
                            <label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
                                Organisation
                            </label>

                            <select
                                data-testid="events-org-filter"
                                value={orgFilter}
                                onChange={(event) =>
                                    setOrgFilter(
                                        event.target
                                            .value
                                    )
                                }
                                className="mt-2 w-full px-4 py-3 rounded-2xl border border-border bg-background text-sm"
                            >
                                <option value="All">
                                    All organisations
                                </option>

                                {orgs.map((org) => (
                                    <option
                                        key={org.slug}
                                        value={org.slug}
                                    >
                                        {org.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <div className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
                                Time & saved events
                            </div>

                            <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setEveningOnly(
                                            (current) =>
                                                !current
                                        )
                                    }
                                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold border ${
                                        eveningOnly
                                            ? "border-primary bg-primary text-primary-foreground"
                                            : "border-border bg-background hover:bg-muted"
                                    }`}
                                >
                                    <Clock className="h-3.5 w-3.5" />
                                    Evening
                                </button>

                                <button
                                    type="button"
                                    data-testid="chip-saved-only"
                                    onClick={() =>
                                        setSavedOnly(
                                            (current) =>
                                                !current
                                        )
                                    }
                                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold border ${
                                        savedOnly
                                            ? "border-primary bg-primary text-primary-foreground"
                                            : "border-border bg-background hover:bg-muted"
                                    }`}
                                >
                                    <Heart className="h-3.5 w-3.5" />
                                    Saved ({savedIds.length})
                                </button>
                            </div>
                        </div>

                        <div>
                            <div className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
                                Suitable for
                            </div>

                            <div className="mt-2 flex flex-wrap gap-2">
                                {[
                                    {
                                        key: "Free",
                                        label: "Free",
                                    },
                                    {
                                        key: "Kids",
                                        label:
                                            "Kids-friendly",
                                    },
                                ].map((option) => (
                                    <button
                                        key={
                                            option.key
                                        }
                                        type="button"
                                        data-testid={`chip-tag-${option.key.toLowerCase()}`}
                                        onClick={() =>
                                            toggleTag(
                                                option.key
                                            )
                                        }
                                        className={`px-3 py-2 rounded-full text-xs font-semibold border ${
                                            tags.includes(
                                                option.key
                                            )
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : "border-border bg-background hover:bg-muted"
                                        }`}
                                    >
                                        {
                                            option.label
                                        }
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
                                Accessibility
                            </div>

                            <div className="mt-2 flex flex-wrap gap-2">
                                {[
                                    {
                                        key: "StepFree",
                                        label:
                                            "Step-free",
                                    },
                                    {
                                        key: "Wheelchair",
                                        label:
                                            "Wheelchair",
                                    },
                                    {
                                        key: "Hearing",
                                        label:
                                            "Hearing loop",
                                    },
                                    {
                                        key: "Quiet",
                                        label:
                                            "Quiet / sensory",
                                    },
                                ].map((option) => (
                                    <button
                                        key={
                                            option.key
                                        }
                                        type="button"
                                        data-testid={`chip-tag-${option.key.toLowerCase()}`}
                                        onClick={() =>
                                            toggleTag(
                                                option.key
                                            )
                                        }
                                        className={`px-3 py-2 rounded-full text-xs font-semibold border ${
                                            tags.includes(
                                                option.key
                                            )
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : "border-border bg-background hover:bg-muted"
                                        }`}
                                    >
                                        {
                                            option.label
                                        }
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* RESULT COUNT */}
            <div className="mt-6 mb-6 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                    {view === "list"
                        ? `${filtered.length} upcoming event${
                              filtered.length === 1
                                  ? ""
                                  : "s"
                          }`
                        : `${filteredAll.length} upcoming event${
                              filteredAll.length ===
                              1
                                  ? ""
                                  : "s"
                          } in the calendar`}
                    {hasActiveFilters
                        ? " matching your filters."
                        : "."}
                </p>

                <Link
                    to="/submit-event"
                    className="text-sm font-semibold text-primary inline-flex items-center gap-1"
                >
                    Running an event? Add it free
                </Link>
            </div>

            {/* AGENDA VIEW */}
            {view === "list" &&
                (filtered.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-border p-10 sm:p-12 text-center">
                        <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground" />

                        <h2 className="font-display font-bold text-xl mt-4">
                            No events match those
                            filters
                        </h2>

                        <p className="mt-2 text-sm text-muted-foreground">
                            Try another date or clear
                            some filters.
                        </p>

                        <div className="mt-5 flex justify-center gap-2 flex-wrap">
                            {hasActiveFilters && (
                                <button
                                    type="button"
                                    onClick={
                                        clearFilters
                                    }
                                    className="px-4 py-2 rounded-full bg-foreground text-background text-sm font-semibold"
                                >
                                    Clear filters
                                </button>
                            )}

                            <Link
                                to="/submit-event"
                                className="px-4 py-2 rounded-full border border-border text-sm font-semibold"
                            >
                                Add an event
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {groupedEvents.map(
                            ([key, dayEvents]) => (
                                <section key={key}>
                                    <div className="flex items-center gap-4 mb-5">
                                        <div>
                                            <div className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                                                {
                                                    dayEvents.length
                                                }{" "}
                                                {dayEvents.length ===
                                                1
                                                    ? "event"
                                                    : "events"}
                                            </div>

                                            <h2 className="font-display font-black text-2xl sm:text-3xl tracking-tight mt-1">
                                                {formatAgendaDate(
                                                    key
                                                )}
                                            </h2>
                                        </div>

                                        <div className="flex-1 h-px bg-border hidden sm:block" />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {dayEvents.map(
                                            (
                                                event
                                            ) => (
                                                <EventCard
                                                    key={
                                                        event.id
                                                    }
                                                    event={
                                                        event
                                                    }
                                                    orgName={orgName(
                                                        event.orgSlug
                                                    )}
                                                />
                                            )
                                        )}
                                    </div>
                                </section>
                            )
                        )}
                    </div>
                ))}

            {/* MONTH VIEW */}
            {view === "month" && (
                <div
                    data-testid="events-month-view"
                    className="rounded-3xl border border-border bg-surface p-4 sm:p-6"
                >
                    <div className="flex items-center justify-between gap-3 mb-5">
                        <button
                            data-testid="month-prev"
                            type="button"
                            onClick={() =>
                                moveMonth(-1)
                            }
                            className="h-9 w-9 grid place-items-center rounded-full border border-border hover:bg-muted"
                            aria-label="Previous month"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>

                        <div className="text-center">
                            <h2 className="font-display font-bold text-xl sm:text-2xl">
                                {cursor.toLocaleString(
                                    "en-GB",
                                    {
                                        month: "long",
                                        year: "numeric",
                                    }
                                )}
                            </h2>

                            <button
                                type="button"
                                onClick={goToToday}
                                className="mt-1 text-xs font-semibold text-primary hover:underline"
                            >
                                Today
                            </button>
                        </div>

                        <button
                            data-testid="month-next"
                            type="button"
                            onClick={() =>
                                moveMonth(1)
                            }
                            className="h-9 w-9 grid place-items-center rounded-full border border-border hover:bg-muted"
                            aria-label="Next month"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 sm:gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                        {[
                            "Mon",
                            "Tue",
                            "Wed",
                            "Thu",
                            "Fri",
                            "Sat",
                            "Sun",
                        ].map((day) => (
                            <div
                                key={day}
                                className="text-center"
                            >
                                {day[0]}
                                <span className="hidden sm:inline">
                                    {day.slice(1)}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1 sm:gap-2">
                        {monthDays.map(
                            (day, index) => {
                                if (!day) {
                                    return (
                                        <div
                                            key={`empty-${index}`}
                                            className="aspect-square sm:aspect-auto sm:h-28 rounded-xl sm:rounded-2xl"
                                        />
                                    );
                                }

                                const key =
                                    dateKey(day);

                                const dayEvents =
                                    eventsByDay[
                                        key
                                    ] || [];

                                const today =
                                    startOfDay(
                                        new Date()
                                    );

                                const dayStart =
                                    startOfDay(day);

                                const isPast =
                                    dayStart <
                                    today;

                                const isToday =
                                    isSameDay(
                                        day,
                                        new Date()
                                    );

                                const isSelected =
                                    key ===
                                    selectedDay;

                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        data-testid={`month-day-${day.getDate()}`}
                                        onClick={() =>
                                            setSelectedDay(
                                                key
                                            )
                                        }
                                        className={`aspect-square sm:aspect-auto sm:h-28 rounded-xl sm:rounded-2xl border p-1.5 sm:p-2 flex flex-col overflow-hidden text-left transition ${
                                            isSelected
                                                ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                                                : isToday
                                                ? "border-primary bg-primary/5"
                                                : "border-border bg-background hover:border-primary/40"
                                        } ${
                                            isPast
                                                ? "opacity-45"
                                                : ""
                                        }`}
                                    >
                                        <div className="text-xs font-bold flex items-center justify-between">
                                            <span>
                                                {day.getDate()}
                                            </span>

                                            {dayEvents.length >
                                                0 && (
                                                <span className="sm:hidden text-[9px] font-bold text-primary">
                                                    {
                                                        dayEvents.length
                                                    }
                                                </span>
                                            )}
                                        </div>

                                        <div className="sm:hidden mt-auto flex flex-wrap gap-0.5 justify-center pb-0.5">
                                            {dayEvents
                                                .slice(
                                                    0,
                                                    3
                                                )
                                                .map(
                                                    (
                                                        event
                                                    ) => (
                                                        <span
                                                            key={
                                                                event.id
                                                            }
                                                            className="h-1.5 w-1.5 rounded-full bg-primary"
                                                        />
                                                    )
                                                )}
                                        </div>

                                        <div className="hidden sm:flex flex-col gap-1 overflow-hidden mt-1">
                                            {dayEvents
                                                .slice(
                                                    0,
                                                    2
                                                )
                                                .map(
                                                    (
                                                        event
                                                    ) => (
                                                        <Link
                                                            key={
                                                                event.id
                                                            }
                                                            to={`/events/${event.id}`}
                                                            onClick={(
                                                                clickEvent
                                                            ) =>
                                                                clickEvent.stopPropagation()
                                                            }
                                                            className="truncate text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                                                            title={
                                                                event.title
                                                            }
                                                        >
                                                            {
                                                                event.title
                                                            }
                                                        </Link>
                                                    )
                                                )}

                                            {dayEvents.length >
                                                2 && (
                                                <span className="text-[10px] text-muted-foreground px-1.5">
                                                    +
                                                    {dayEvents.length -
                                                        2}{" "}
                                                    more
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            }
                        )}
                    </div>

                    {/* SELECTED DAY */}
                    <div
                        data-testid="month-day-agenda"
                        className="mt-5 sm:mt-6 rounded-2xl border border-border bg-background p-4 sm:p-5"
                    >
                        <h3 className="font-display font-bold text-lg sm:text-xl">
                            {dateFromKey(
                                selectedDay
                            ).toLocaleDateString(
                                "en-GB",
                                {
                                    weekday:
                                        "long",
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                }
                            )}
                        </h3>

                        {(() => {
                            const dayEvents =
                                eventsByDay[
                                    selectedDay
                                ] || [];

                            if (
                                dayEvents.length ===
                                0
                            ) {
                                return (
                                    <div className="mt-3">
                                        <p className="text-sm text-muted-foreground">
                                            Nothing
                                            listed for
                                            this day yet.
                                        </p>

                                        <Link
                                            to="/submit-event"
                                            className="inline-flex mt-3 text-sm font-semibold text-primary"
                                        >
                                            Know
                                            something
                                            happening?
                                            Add an
                                            event →
                                        </Link>
                                    </div>
                                );
                            }

                            return (
                                <ul className="mt-3 space-y-2">
                                    {dayEvents.map(
                                        (
                                            event
                                        ) => (
                                            <li
                                                key={
                                                    event.id
                                                }
                                            >
                                                <Link
                                                    to={`/events/${event.id}`}
                                                    data-testid={`agenda-${event.id}`}
                                                    className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-surface hover:border-primary/40 transition"
                                                >
                                                    <div className="text-xs font-bold text-primary min-w-14">
                                                        {formatTime(
                                                            event.start
                                                        )}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-semibold text-sm truncate">
                                                            {
                                                                event.title
                                                            }
                                                        </div>

                                                        <div className="text-xs text-muted-foreground truncate">
                                                            {event.venue ||
                                                                orgName(
                                                                    event.orgSlug
                                                                ) ||
                                                                "Blackrod"}
                                                        </div>
                                                    </div>

                                                    <div className="hidden sm:block">
                                                        <CategoryBadge
                                                            category={
                                                                event.category
                                                            }
                                                        />
                                                    </div>
                                                </Link>
                                            </li>
                                        )
                                    )}
                                </ul>
                            );
                        })()}
                    </div>
                </div>
            )}

            <div className="mt-12 rounded-3xl border border-border bg-surface px-6 py-7 sm:flex sm:items-center sm:justify-between gap-6">
                <div>
                    <h2 className="font-display font-bold text-xl">
                        Running something in
                        Blackrod?
                    </h2>

                    <p className="mt-1 text-sm text-muted-foreground">
                        Add your event to Blackrod
                        Now so local residents can
                        find it.
                    </p>
                </div>

                <Link
                    to="/submit-event"
                    className="mt-4 sm:mt-0 inline-flex justify-center px-5 py-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
                >
                    Add an event — it's free
                </Link>
            </div>

            <NewsletterSection />

            <SubscribeCalendarDialog
                open={subOpen}
                onClose={() =>
                    setSubOpen(false)
                }
                allCategories={CATEGORIES}
                onDownloadIcs={() => {
                    const exportEvents =
                        view === "list"
                            ? filtered
                            : filteredAll;

                    if (
                        exportEvents.length === 0
                    ) {
                        toast.error(
                            "There are no matching events to add to your calendar"
                        );

                        return;
                    }

                    downloadICS(
                        exportEvents,
                        "blackrod-now.ics"
                    );

                    toast.success(
                        "Downloaded blackrod-now.ics"
                    );
                }}
            />
        </div>
    );
}