import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import {
    EventCard,
    OrgCard,
    VolunteerCard,
} from "@/components/Cards";
import NewsletterSection from "@/components/NewsletterSection";
import {
    ArrowRight,
    Heart,
    CalendarDays,
    Building2,
    HandHelping,
    MapPin,
    Sparkles,
} from "lucide-react";

const COMMUNITY_IMAGES = {
    hero: "/blackrod (1).jpg",
    familyEvent: "/blackrod (2).jpg",
    localMarket: "/blackrod (3).jpg",
};

export default function Home() {
    const {
        events,
        orgs,
        volunteerOpps,
        ready,
        savedEventIds,
    } = useApp();

    const [activeFeed, setActiveFeed] = useState("on");
    const [previousSeenEventIds, setPreviousSeenEventIds] =
        useState([]);
    const [lastVisitedAt, setLastVisitedAt] = useState("");
    const [visitSnapshotLoaded, setVisitSnapshotLoaded] =
        useState(false);

    const listRef = useRef(null);

    const approved = useMemo(
        () => events.filter((event) => event.status === "approved"),
        [events]
    );

    const sortedByDate = useMemo(() => {
        const now = new Date();

        return [...approved]
            .filter((event) => {
                const eventEnd = new Date(
                    event.end || event.start
                );

                return eventEnd >= now;
            })
            .sort(
                (a, b) =>
                    new Date(a.start) - new Date(b.start)
            );
    }, [approved]);

    const thisWeek = useMemo(() => {
        const end = new Date();
        end.setDate(end.getDate() + 7);

        return sortedByDate.filter(
            (event) => new Date(event.start) <= end
        );
    }, [sortedByDate]);

    const nextThirtyDays = useMemo(() => {
        const end = new Date();
        end.setDate(end.getDate() + 30);

        return sortedByDate.filter(
            (event) => new Date(event.start) <= end
        );
    }, [sortedByDate]);

    useEffect(() => {
        const seenRaw = localStorage.getItem(
            "rn-home-seen-events"
        );

        const lastVisitRaw = localStorage.getItem(
            "rn-home-last-visit"
        );

        let previous = [];

        try {
            previous = seenRaw ? JSON.parse(seenRaw) : [];
        } catch {
            previous = [];
        }

        setPreviousSeenEventIds(
            Array.isArray(previous) ? previous : []
        );

        setLastVisitedAt(lastVisitRaw || "");
        setVisitSnapshotLoaded(true);
    }, []);

    useEffect(() => {
        if (!visitSnapshotLoaded || approved.length === 0) {
            return;
        }

        localStorage.setItem(
            "rn-home-seen-events",
            JSON.stringify(
                approved.map((event) => event.id)
            )
        );

        localStorage.setItem(
            "rn-home-last-visit",
            new Date().toISOString()
        );
    }, [approved, visitSnapshotLoaded]);

    const whatsNew = useMemo(() => {
        const previousSet = new Set(previousSeenEventIds);

        return sortedByDate.filter(
            (event) => !previousSet.has(event.id)
        );
    }, [sortedByDate, previousSeenEventIds]);

    const streamMeta = {
        on: {
            label: "What's On",
            heading: "Happening over the next 7 days",
            description:
                "Events and activities coming up in and around Blackrod.",
            events: thisWeek,
        },

        new: {
            label: "What's New",
            heading: lastVisitedAt
                ? `${whatsNew.length} ${
                      whatsNew.length === 1
                          ? "new event"
                          : "new events"
                  } since your last visit`
                : "Recently added to Blackrod Now",
            description: lastVisitedAt
                ? "Catch up with events that have appeared since you were last here."
                : "Discover events currently listed on Blackrod Now.",
            events: whatsNew,
        },

        next: {
            label: "What's Next",
            heading: "Plan the next 30 days",
            description:
                "Look a little further ahead and see what's coming up.",
            events: nextThirtyDays,
        },
    };

    const selectedStream =
        streamMeta[activeFeed] || streamMeta.on;

    const savedUpcoming = useMemo(() => {
        const saved = new Set(savedEventIds || []);

        return sortedByDate
            .filter((event) => saved.has(event.id))
            .slice(0, 3);
    }, [sortedByDate, savedEventIds]);

    const featuredEvents = useMemo(
        () =>
            sortedByDate
                .filter((event) => event.featured)
                .slice(0, 3),
        [sortedByDate]
    );

    const organisationActivity = useMemo(() => {
        return orgs
            .map((org) => ({
                org,
                upcomingEvents: sortedByDate.filter(
                    (event) => event.orgSlug === org.slug
                ).length,
            }))
            .sort((a, b) => {
                if (b.upcomingEvents !== a.upcomingEvents) {
                    return (
                        b.upcomingEvents -
                        a.upcomingEvents
                    );
                }

                return (a.org.name || "").localeCompare(
                    b.org.name || ""
                );
            });
    }, [orgs, sortedByDate]);

    const featuredOrgs = useMemo(
        () =>
            organisationActivity
                .slice(0, 4)
                .map((item) => item.org),
        [organisationActivity]
    );

    const spotlightOrg = useMemo(() => {
        if (orgs.length === 0) return null;

        return (
            orgs.find(
                (org) => org.slug === "blackrod-bloomers"
            ) ||
            featuredOrgs[0] ||
            orgs[0]
        );
    }, [orgs, featuredOrgs]);

    const featuredBusiness = useMemo(() => {
        if (orgs.length === 0) return null;

        const preferred = orgs.find(
            (org) =>
                org.slug ===
                "douglas-valley-golf-club"
        );

        if (
            preferred &&
            preferred.slug !== spotlightOrg?.slug
        ) {
            return preferred;
        }

        return (
            orgs.find(
                (org) =>
                    org.slug !== spotlightOrg?.slug
            ) || null
        );
    }, [orgs, spotlightOrg]);

    const orgName = (slug) =>
        orgs.find((org) => org.slug === slug)?.name;

    const onFeedClick = (key) => {
        setActiveFeed(key);

        window.setTimeout(() => {
            listRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }, 50);
    };

    if (!ready) {
        return (
            <div
                data-testid="home-page"
                className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center"
            >
                <div className="animate-pulse text-muted-foreground text-sm">
                    Loading Blackrod Now…
                </div>
            </div>
        );
    }

    if (orgs.length === 0 && events.length === 0) {
        return (
            <div
                data-testid="home-page"
                className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16"
            >
                <div className="rounded-3xl border border-border bg-surface p-8">
                    <h1 className="font-display font-black text-3xl tracking-tight">
                        Blackrod Now is temporarily offline
                    </h1>

                    <p className="mt-3 text-sm text-muted-foreground">
                        We couldn't load community information
                        right now. Navigation is still available,
                        but some content may be missing until the
                        service reconnects.
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() =>
                                window.location.reload()
                            }
                            className="inline-flex items-center px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
                        >
                            Retry
                        </button>

                        <Link
                            to="/contact"
                            className="inline-flex items-center px-4 py-2 rounded-full border border-border text-sm font-semibold"
                        >
                            Contact us
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div data-testid="home-page">
            {/* HERO — full-bleed aerial view of Blackrod */}
            <section className="relative overflow-hidden border-b border-border">
                <img
                    src="/blackrod-aerial.jpg"
                    alt="Aerial view over Blackrod, Bolton"
                    className="absolute inset-0 h-full w-full object-cover object-[center_63%]"
                    loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/25" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-24 grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
                    <div className="lg:col-span-7">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/20 backdrop-blur-sm text-white text-[11px] font-bold tracking-wider uppercase mb-5">
                            <MapPin className="h-3.5 w-3.5" />
                            Blackrod, Bolton
                        </div>

                        <h1 className="font-display font-black tracking-tight text-5xl sm:text-6xl lg:text-7xl leading-[0.95] text-white drop-shadow-sm">
                            Blackrod
                            <span className="text-sky-300">
                                {" "}
                                Now
                            </span>
                        </h1>

                        <p className="mt-5 max-w-xl text-lg sm:text-xl font-semibold text-white/95">
                            What's on. What's new. What's next.
                        </p>

                        <p className="mt-3 max-w-xl text-base sm:text-lg text-white/80 leading-relaxed">
                            Your local place to discover events,
                            community groups, clubs, businesses,
                            venues, volunteering and what's
                            happening around Blackrod.
                        </p>

                        <div className="mt-7 flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={() =>
                                    onFeedClick("on")
                                }
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-transform"
                            >
                                See what's on
                                <ArrowRight className="h-4 w-4" />
                            </button>

                            <Link
                                to="/organisations"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold border-2 border-white/80 text-white hover:bg-white hover:text-slate-900 transition"
                            >
                                Explore Blackrod
                            </Link>
                        </div>

                        <div className="mt-8 flex items-center gap-6 text-xs text-white/70">
                            <div>
                                <div className="font-display font-bold text-2xl text-white">
                                    {approved.length}
                                </div>

                                <div className="uppercase tracking-wider">
                                    Events listed
                                </div>
                            </div>

                            <div className="h-8 w-px bg-white/30" />

                            <div>
                                <div className="font-display font-bold text-2xl text-white">
                                    {orgs.length}
                                </div>

                                <div className="uppercase tracking-wider">
                                    Local organisations
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-5 flex lg:justify-end">
                        <div className="w-full max-w-sm rounded-[2rem] border border-white/20 bg-white/10 backdrop-blur-md p-6 sm:p-8 text-white shadow-2xl">
                            <div className="text-xs font-bold uppercase tracking-[0.18em] text-white/80">
                                This week
                            </div>

                            <div className="mt-2 flex items-end gap-2">
                                <span className="font-display font-black text-5xl sm:text-6xl leading-none">
                                    {thisWeek.length}
                                </span>

                                <span className="text-sm font-medium pb-1.5">
                                    {thisWeek.length === 1
                                        ? "event"
                                        : "events"}{" "}
                                    coming up
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={() => onFeedClick("on")}
                                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-sky-200 hover:text-white transition"
                            >
                                Browse this week
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* RETURNING VISITOR NOTICE */}
            {lastVisitedAt && whatsNew.length > 0 && (
                <section className="border-b border-border bg-primary/5">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <span className="font-semibold text-sm">
                                Welcome back.
                            </span>

                            <span className="text-sm text-muted-foreground ml-1">
                                {whatsNew.length}{" "}
                                {whatsNew.length === 1
                                    ? "event has"
                                    : "events have"}{" "}
                                been added since your last visit.
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                onFeedClick("new")
                            }
                            className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
                        >
                            See what's new
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </section>
            )}

            {/* WHAT'S ON / NEW / NEXT */}
            <section
                ref={listRef}
                className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-18 scroll-mt-20"
            >
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
                    <div>
                        <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                            Discover what's happening
                        </span>

                        <h2 className="font-display font-black text-3xl sm:text-4xl tracking-tight mt-2">
                            {selectedStream.heading}
                        </h2>

                        <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-2xl">
                            {selectedStream.description}
                        </p>
                    </div>

                    <div className="inline-flex self-start p-1 rounded-full border border-border bg-surface">
                        {Object.entries(streamMeta).map(
                            ([key, stream]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() =>
                                        setActiveFeed(key)
                                    }
                                    className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition ${
                                        activeFeed === key
                                            ? "bg-foreground text-background"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {stream.label}
                                </button>
                            )
                        )}
                    </div>
                </div>

                {selectedStream.events.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-border p-10 text-center">
                        <CalendarDays className="h-7 w-7 mx-auto text-muted-foreground" />

                        <h3 className="font-display font-bold text-lg mt-3">
                            Nothing listed here yet
                        </h3>

                        <p className="mt-1 text-sm text-muted-foreground">
                            {activeFeed === "new"
                                ? "You're all caught up — there are no new events since your last visit."
                                : "There aren't any events in this time window yet."}
                        </p>

                        <Link
                            to="/events"
                            className="inline-flex items-center gap-1 mt-4 text-sm font-semibold text-primary"
                        >
                            Browse all events
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {selectedStream.events
                                .slice(0, 8)
                                .map((event) => (
                                    <EventCard
                                        key={event.id}
                                        event={event}
                                        orgName={orgName(
                                            event.orgSlug
                                        )}
                                    />
                                ))}
                        </div>

                        <div className="mt-8 text-center">
                            <Link
                                to="/events"
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border text-sm font-semibold hover:bg-muted transition"
                            >
                                See all events
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </>
                )}
            </section>

            {/* AROUND BLACKROD */}
            <section className="bg-surface border-y border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
                    <div className="mb-8">
                        <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                            Explore locally
                        </span>

                        <h2 className="font-display font-black text-3xl sm:text-4xl tracking-tight mt-2">
                            Around Blackrod
                        </h2>

                        <p className="mt-2 text-sm text-muted-foreground max-w-xl">
                            Find the people, places and
                            opportunities that make up the local
                            community.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Link
                            to="/organisations"
                            className="group rounded-3xl border border-border bg-background p-5 sm:p-6 hover:border-primary/40 hover:-translate-y-0.5 transition"
                        >
                            <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center">
                                <Building2 className="h-5 w-5 text-primary" />
                            </div>

                            <h3 className="font-display font-bold text-base sm:text-lg mt-4">
                                Groups & organisations
                            </h3>

                            <p className="hidden sm:block mt-1 text-sm text-muted-foreground">
                                Clubs, schools, groups, charities
                                and local organisations.
                            </p>

                            <div className="mt-4 inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-primary">
                                Explore
                                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                            </div>
                        </Link>

                        <Link
                            to="/venues"
                            className="group rounded-3xl border border-border bg-background p-5 sm:p-6 hover:border-primary/40 hover:-translate-y-0.5 transition"
                        >
                            <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center">
                                <MapPin className="h-5 w-5 text-primary" />
                            </div>

                            <h3 className="font-display font-bold text-base sm:text-lg mt-4">
                                Local venues
                            </h3>

                            <p className="hidden sm:block mt-1 text-sm text-muted-foreground">
                                Halls, meeting spaces, sports
                                facilities and places to hire.
                            </p>

                            <div className="mt-4 inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-primary">
                                Find a venue
                                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                            </div>
                        </Link>

                        <Link
                            to="/volunteering"
                            className="group rounded-3xl border border-border bg-background p-5 sm:p-6 hover:border-primary/40 hover:-translate-y-0.5 transition"
                        >
                            <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center">
                                <HandHelping className="h-5 w-5 text-primary" />
                            </div>

                            <h3 className="font-display font-bold text-base sm:text-lg mt-4">
                                Volunteering
                            </h3>

                            <p className="hidden sm:block mt-1 text-sm text-muted-foreground">
                                Find opportunities to support local
                                groups and causes.
                            </p>

                            <div className="mt-4 inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-primary">
                                Get involved
                                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                            </div>
                        </Link>

                        <Link
                            to="/local-feed"
                            className="group rounded-3xl border border-border bg-background p-5 sm:p-6 hover:border-primary/40 hover:-translate-y-0.5 transition"
                        >
                            <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center">
                                <Sparkles className="h-5 w-5 text-primary" />
                            </div>

                            <h3 className="font-display font-bold text-base sm:text-lg mt-4">
                                Community updates
                            </h3>

                            <p className="hidden sm:block mt-1 text-sm text-muted-foreground">
                                Local announcements, updates and
                                information from around Blackrod.
                            </p>

                            <div className="mt-4 inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-primary">
                                See updates
                                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                            </div>
                        </Link>
                    </div>
                </div>
            </section>

            {/* SAVED EVENTS - ONLY SHOW WHEN USED */}
            {savedUpcoming.length > 0 && (
                <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
                    <div className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
                        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                            <div>
                                <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                                    Your shortlist
                                </span>

                                <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight mt-2 inline-flex items-center gap-2">
                                    <Heart className="h-5 w-5 text-primary" />
                                    Your saved events
                                </h2>

                                <p className="mt-2 text-sm text-muted-foreground">
                                    Jump back into events you've
                                    saved for later.
                                </p>
                            </div>

                            <Link
                                to="/saved-events"
                                className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
                            >
                                View all saved
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {savedUpcoming.map((event) => (
                                <Link
                                    key={event.id}
                                    to={`/events/${event.id}`}
                                    className="rounded-2xl border border-border bg-background p-4 hover:border-primary/40 transition"
                                >
                                    <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                                        {new Date(
                                            event.start
                                        ).toLocaleDateString(
                                            "en-GB",
                                            {
                                                weekday:
                                                    "short",
                                                day: "numeric",
                                                month: "short",
                                            }
                                        )}
                                    </div>

                                    <h3 className="mt-2 font-display font-bold text-lg leading-tight">
                                        {event.title}
                                    </h3>

                                    <p className="mt-1 text-xs text-muted-foreground truncate">
                                        {orgName(
                                            event.orgSlug
                                        ) || "Local event"}
                                        {event.venue
                                            ? ` • ${event.venue}`
                                            : ""}
                                    </p>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* FEATURED EVENTS */}
            {featuredEvents.length > 0 && (
                <section className="border-y border-border bg-surface">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
                        <div className="flex items-end justify-between gap-4 mb-8">
                            <div>
                                <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                                    Don't miss
                                </span>

                                <h2 className="font-display font-black text-3xl sm:text-4xl tracking-tight mt-2">
                                    Featured around Blackrod
                                </h2>
                            </div>

                            <Link
                                to="/events"
                                className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-primary"
                            >
                                All events
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {featuredEvents.map(
                                (event, index) => (
                                    <EventCard
                                        key={event.id}
                                        event={event}
                                        orgName={orgName(
                                            event.orgSlug
                                        )}
                                        featured={
                                            index === 0
                                        }
                                    />
                                )
                            )}
                        </div>
                    </div>
                </section>
            )}

            {/* LOCAL ORGANISATIONS */}
            {featuredOrgs.length > 0 && (
                <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
                    <div className="flex items-end justify-between mb-8 gap-4">
                        <div>
                            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                                Local directory
                            </span>

                            <h2 className="font-display font-black text-3xl sm:text-4xl tracking-tight mt-2">
                                Active around Blackrod
                            </h2>

                            <p className="mt-2 text-sm text-muted-foreground">
                                Discover organisations with local
                                activity and events coming up.
                            </p>
                        </div>

                        <Link
                            to="/organisations"
                            className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-primary"
                        >
                            Full directory
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {featuredOrgs.map((org) => (
                            <OrgCard
                                key={org.slug}
                                org={org}
                            />
                        ))}
                    </div>

                    <div className="mt-6 sm:hidden">
                        <Link
                            to="/organisations"
                            className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
                        >
                            Browse the full directory
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </section>
            )}

            {/* SPOTLIGHTS */}
            {(spotlightOrg || featuredBusiness) && (
                <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-14 sm:pb-16">
                    <div className="grid lg:grid-cols-2 gap-6">
                        {spotlightOrg && (
                            <div
                                data-testid="community-spotlight"
                                className="rounded-3xl border border-border bg-surface overflow-hidden flex flex-col"
                            >
                                <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                                    {spotlightOrg.cover_path ||
                                    spotlightOrg.cover ? (
                                        <img
                                            src={
                                                spotlightOrg.cover_path
                                                    ? api.orgCoverUrl(
                                                          spotlightOrg.slug,
                                                          spotlightOrg.updated_at ||
                                                              ""
                                                      )
                                                    : spotlightOrg.cover
                                            }
                                            alt={
                                                spotlightOrg.name
                                            }
                                            className="absolute inset-0 h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div
                                            className="absolute inset-0"
                                            style={{
                                                background: `linear-gradient(135deg, ${
                                                    spotlightOrg.brandColor ||
                                                    "#0052FF"
                                                }CC, ${
                                                    spotlightOrg.brandColor ||
                                                    "#0052FF"
                                                }44)`,
                                            }}
                                        />
                                    )}

                                    <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold tracking-wider uppercase">
                                        Community spotlight
                                    </span>
                                </div>

                                <div className="p-6 sm:p-8 flex flex-col gap-3 flex-1">
                                    <h3 className="font-display font-bold text-2xl">
                                        {
                                            spotlightOrg.name
                                        }
                                    </h3>

                                    {spotlightOrg.about && (
                                        <p className="text-sm text-muted-foreground line-clamp-4">
                                            {
                                                spotlightOrg.about
                                            }
                                        </p>
                                    )}

                                    <Link
                                        to={`/organisations/${spotlightOrg.slug}`}
                                        className="inline-flex w-fit items-center gap-1 mt-auto pt-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-primary text-primary-foreground"
                                    >
                                        Discover more
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </Link>
                                </div>
                            </div>
                        )}

                        {featuredBusiness && (
                            <div
                                data-testid="business-spotlight"
                                className="rounded-3xl border border-border bg-surface overflow-hidden flex flex-col"
                            >
                                <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                                    {featuredBusiness.cover_path ||
                                    featuredBusiness.cover ? (
                                        <img
                                            src={
                                                featuredBusiness.cover_path
                                                    ? api.orgCoverUrl(
                                                          featuredBusiness.slug,
                                                          featuredBusiness.updated_at ||
                                                              ""
                                                      )
                                                    : featuredBusiness.cover
                                            }
                                            alt={
                                                featuredBusiness.name
                                            }
                                            className="absolute inset-0 h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div
                                            className="absolute inset-0"
                                            style={{
                                                background: `linear-gradient(135deg, ${
                                                    featuredBusiness.brandColor ||
                                                    "#0052FF"
                                                }CC, ${
                                                    featuredBusiness.brandColor ||
                                                    "#0052FF"
                                                }44)`,
                                            }}
                                        />
                                    )}

                                    <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-foreground text-background text-[10px] font-bold tracking-wider uppercase">
                                        Local spotlight
                                    </span>
                                </div>

                                <div className="p-6 sm:p-8 flex flex-col gap-3 flex-1">
                                    <h3 className="font-display font-bold text-2xl">
                                        {
                                            featuredBusiness.name
                                        }
                                    </h3>

                                    {featuredBusiness.about && (
                                        <p className="text-sm text-muted-foreground line-clamp-4">
                                            {
                                                featuredBusiness.about
                                            }
                                        </p>
                                    )}

                                    <Link
                                        to={`/organisations/${featuredBusiness.slug}`}
                                        className="inline-flex w-fit items-center gap-1 mt-auto pt-2 px-5 py-2.5 rounded-full text-sm font-semibold border-2 border-foreground"
                                    >
                                        View profile
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* VOLUNTEERING */}
            <section className="bg-surface border-y border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
                    <div className="flex items-end justify-between mb-8 gap-4">
                        <div>
                            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                                Get involved
                            </span>

                            <h2 className="font-display font-black text-3xl sm:text-4xl tracking-tight mt-2">
                                Volunteer in your community
                            </h2>

                            <p className="mt-2 text-sm text-muted-foreground max-w-lg">
                                Find opportunities to support local
                                charities, groups, projects and
                                causes.
                            </p>
                        </div>

                        <Link
                            to="/volunteering"
                            className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-primary"
                        >
                            All opportunities
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>

                    {volunteerOpps.length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-border bg-background p-8 text-center">
                            <HandHelping className="h-7 w-7 mx-auto text-muted-foreground" />

                            <h3 className="font-display font-bold text-lg mt-3">
                                No volunteer opportunities listed
                                right now
                            </h3>

                            <p className="mt-1 text-sm text-muted-foreground">
                                Check back soon as local
                                organisations add new opportunities.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {volunteerOpps
                                .slice(0, 3)
                                .map((opportunity) => (
                                    <VolunteerCard
                                        key={
                                            opportunity.id
                                        }
                                        opp={
                                            opportunity
                                        }
                                        orgName={orgName(
                                            opportunity.orgSlug
                                        )}
                                    />
                                ))}
                        </div>
                    )}
                </div>
            </section>

            {/* ORGANISATION CTA */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
                <div className="rounded-[2rem] bg-foreground text-background overflow-hidden">
                    <div className="grid lg:grid-cols-12 gap-8 items-center p-7 sm:p-10 lg:p-12">
                        <div className="lg:col-span-8">
                            <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.18em] uppercase text-background/60">
                                <Building2 className="h-4 w-4" />
                                For local organisations
                            </span>

                            <h2 className="font-display font-black text-3xl sm:text-4xl tracking-tight mt-3">
                                Run something locally?
                            </h2>

                            <p className="mt-3 max-w-2xl text-sm sm:text-base text-background/70 leading-relaxed">
                                Put your club, group, school,
                                charity, venue or local business on
                                Blackrod Now. Your listing is free
                                and helps residents discover what
                                you do.
                            </p>

                            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-background/70">
                                <span>✓ Create your local page</span>
                                <span>✓ Publish events</span>
                                <span>✓ Find volunteers</span>
                                <span>✓ Promote your venue</span>
                            </div>
                        </div>

                        <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 lg:items-stretch">
                            <Link
                                to="/add-organisation"
                                className="inline-flex justify-center items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
                            >
                                Get listed free
                                <ArrowRight className="h-4 w-4" />
                            </Link>

                            <Link
                                to="/submit-event"
                                className="inline-flex justify-center items-center gap-2 px-6 py-3 rounded-full border border-background/30 text-background text-sm font-semibold hover:bg-background/10 transition"
                            >
                                Add an event
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* NEWSLETTER */}
            <NewsletterSection />
        </div>
    );
}