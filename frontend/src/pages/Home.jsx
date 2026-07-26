import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { EventCard, OrgCard, VolunteerCard } from "@/components/Cards";
import NewsletterSection from "@/components/NewsletterSection";
import {
    ArrowRight,
    Sparkles,
    Coffee,
    Heart,
} from "lucide-react";
import { toast } from "sonner";

const COMMUNITY_IMAGES = {
    hero: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1200&q=80",
    familyEvent: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=900&q=80",
    localMarket: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=80",
    volunteers: "https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=1200&q=80",
    localBusiness: "https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=1200&q=80",
};

const HERO_SEQUENCE = [
    { key: "on", lead: "What's", accent: "On" },
    { key: "new", lead: "What's", accent: "New" },
    { key: "next", lead: "What's", accent: "Next" },
    { key: "now", lead: "Blackrod", accent: "Now" },
];

export default function Home() {
    const { events, orgs, volunteerOpps, stats, ready, savedEventIds } = useApp();
    const subscribers = stats?.subscribers || 0;
    const [headlineStep, setHeadlineStep] = useState(0);
    const [activeFeed, setActiveFeed] = useState("on");
    const [previousSeenEventIds, setPreviousSeenEventIds] = useState([]);
    const [lastVisitedAt, setLastVisitedAt] = useState("");
    const listRef = useRef(null);

    useEffect(() => {
        if (headlineStep >= HERO_SEQUENCE.length - 1) return;
        const timer = window.setTimeout(() => {
            setHeadlineStep((current) => Math.min(current + 1, HERO_SEQUENCE.length - 1));
        }, 2000);
        return () => window.clearTimeout(timer);
    }, [headlineStep]);

    const approved = useMemo(() => events.filter((e) => e.status === "approved"), [events]);
    const now = new Date();

    const sortedByDate = useMemo(() => {
        const n = new Date();
        return [...approved]
            .filter((e) => new Date(e.end || e.start) >= n)
            .sort((a, b) => new Date(a.start) - new Date(b.start));
    }, [approved]);

    const upcoming = sortedByDate.slice(0, 8);

    const thisWeek = useMemo(() => {
        const weekFromNow = new Date();
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        return sortedByDate.filter((e) => new Date(e.start) <= weekFromNow);
    }, [sortedByDate]);

    const nextThirtyDays = useMemo(() => {
        const end = new Date();
        end.setDate(end.getDate() + 30);
        return sortedByDate.filter((e) => new Date(e.start) <= end);
    }, [sortedByDate]);

    // Read previous visit data once on mount
    useEffect(() => {
        const seenRaw = localStorage.getItem("rn-home-seen-events");
        const lastVisitRaw = localStorage.getItem("rn-home-last-visit");
        let previous = [];
        try {
            previous = seenRaw ? JSON.parse(seenRaw) : [];
        } catch {
            previous = [];
        }
        setPreviousSeenEventIds(Array.isArray(previous) ? previous : []);
        setLastVisitedAt(lastVisitRaw || "");
    }, []);

    // Write current visit data when approved events are known
    useEffect(() => {
        if (approved.length === 0) return;
        localStorage.setItem("rn-home-seen-events", JSON.stringify(approved.map((e) => e.id)));
        localStorage.setItem("rn-home-last-visit", new Date().toISOString());
    }, [approved]);

    const whatsNew = useMemo(() => {
        const previousSet = new Set(previousSeenEventIds);
        return sortedByDate.filter((e) => !previousSet.has(e.id));
    }, [sortedByDate, previousSeenEventIds]);

    const streamMeta = {
        on: {
            label: "What's On",
            subtitle: "Events happening in the next 7 days",
            events: thisWeek,
        },
        new: {
            label: "What's New",
            subtitle: lastVisitedAt
                ? `Posted since your last visit (${new Date(lastVisitedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })})`
                : "Posted since your last visit",
            events: whatsNew,
        },
        next: {
            label: "What's Next",
            subtitle: "Events in the next 30 days",
            events: nextThirtyDays,
        },
    };

    const selectedStream = streamMeta[activeFeed] || streamMeta.on;

    const savedUpcoming = useMemo(() => {
        const saved = new Set(savedEventIds);
        return sortedByDate.filter((e) => saved.has(e.id)).slice(0, 3);
    }, [sortedByDate, savedEventIds]);

    const onPillClick = (key) => {
        setActiveFeed(key);
        listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    // Guard early loading: return a skeleton while seed/refresh is in flight
    if (!ready) {
        return (
            <div data-testid="home-page" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
                <div className="animate-pulse text-muted-foreground text-sm">Loading Blackrod Now…</div>
            </div>
        );
    }

    if (orgs.length === 0 && events.length === 0) {
        return (
            <div data-testid="home-page" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="rounded-3xl border border-border bg-surface p-8">
                    <h1 className="font-display font-black text-3xl tracking-tight">Blackrod Now is temporarily offline</h1>
                    <p className="mt-3 text-sm text-muted-foreground">
                        We could not load community data right now. Navigation is still available, but content may be limited until the backend is reachable again.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
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

    const featuredEvents = sortedByDate.filter((e) => e.featured).slice(0, 3);
    const featuredOrgs = orgs.slice(0, 4);
    const spotlightOrg = orgs.find((o) => o.slug === "blackrod-bloomers") || orgs[0];
    const featuredBusiness = orgs.find((o) => o.slug === "douglas-valley-golf-club") || orgs[0];

    const orgName = (slug) => orgs.find((o) => o.slug === slug)?.name;

    return (
        <div data-testid="home-page">
            {/* HERO */}
            <section className="relative overflow-hidden border-b border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20 lg:pt-20 lg:pb-28 grid lg:grid-cols-12 gap-10 items-center">
                    <div className="lg:col-span-7 fade-in-up">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-[11px] font-bold tracking-wider uppercase mb-6">
                            <Sparkles className="h-3.5 w-3.5" /> Made possible by the Community Alliance Fund
                        </div>

                        <h1 className="font-display font-black tracking-tight text-5xl sm:text-6xl lg:text-7xl leading-[0.95] text-foreground">
                            <span className="sr-only">What's On, What's New, What's Next, Blackrod Now</span>
                            <span
                                key={headlineStep}
                                className={`hero-sequence-headline block mt-1 ${headlineStep < HERO_SEQUENCE.length - 1 ? "hero-sequence-headline-animated" : ""}`}
                                aria-hidden="true"
                            >
                                <span className="text-foreground">{HERO_SEQUENCE[headlineStep].lead} </span>
                                <span className="text-primary">{HERO_SEQUENCE[headlineStep].accent}</span>
                            </span>
                        </h1>
                        {headlineStep === HERO_SEQUENCE.length - 1 && (
                            <div className="hero-sequence-taglines mt-3" aria-hidden="true">
                                {HERO_SEQUENCE.slice(0, 3).map((line) => (
                                    <button
                                        key={line.key}
                                        type="button"
                                        onClick={() => onPillClick(line.key)}
                                        className={`hero-sequence-tagline ${activeFeed === line.key ? "hero-sequence-tagline-active" : ""}`}
                                    >
                                        <span className="text-foreground">{line.lead} </span>
                                        <span className="text-primary">{line.accent}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        <p className="mt-6 max-w-xl text-base sm:text-lg text-muted-foreground leading-relaxed">
                            Blackrod Now brings together local events, groups, clubs, schools, businesses and
                            community projects in one easy-to-use digital space.
                        </p>

                        <div className="mt-8 flex flex-wrap gap-3">
                            <Link
                                to="/events"
                                data-testid="hero-explore-events"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-transform"
                            >
                                Explore Events <ArrowRight className="h-4 w-4" />
                            </Link>

                            <Link
                                to="/add-organisation"
                                data-testid="hero-add-org"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-secondary text-secondary-foreground shadow-lg shadow-secondary/30 hover:scale-105 active:scale-95 transition-transform"
                            >
                                Add Your Organisation
                            </Link>

                            <Link
                                to="/submit-event"
                                data-testid="hero-submit-event"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold border-2 border-foreground text-foreground hover:bg-foreground hover:text-background transition"
                            >
                                Submit an Event
                            </Link>
                        </div>

                        <div className="mt-10 flex items-center gap-6 text-xs text-muted-foreground">
                            <div>
                                <div className="font-display font-bold text-2xl text-foreground">
                                    {approved.length}
                                </div>
                                <div className="uppercase tracking-wider">Events listed</div>
                            </div>

                            <div className="h-8 w-px bg-border" />

                            <div>
                                <div className="font-display font-bold text-2xl text-foreground">
                                    {orgs.length}
                                </div>
                                <div className="uppercase tracking-wider">Organisations</div>
                            </div>

                            <div className="h-8 w-px bg-border" />

                            <div>
                                <div className="font-display font-bold text-2xl text-foreground">
                                    {subscribers}
                                </div>
                                <div className="uppercase tracking-wider">Locals subscribed</div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-5 grid grid-cols-6 gap-3 fade-in-up">
                        <div className="col-span-4 aspect-square rounded-3xl overflow-hidden bg-muted">
                            <img
                                src={COMMUNITY_IMAGES.hero}
                                alt="People gathered at a local community event"
                                className="h-full w-full object-cover"
                            />
                        </div>

                        <div className="col-span-2 aspect-square rounded-3xl overflow-hidden bg-secondary p-4 flex flex-col justify-between">
                            <span className="text-[10px] font-bold tracking-wider uppercase text-secondary-foreground">
                                This week
                            </span>
                            <div className="font-display font-black text-5xl leading-none text-secondary-foreground">
                                {thisWeek.length}
                            </div>
                            <span className="text-xs text-secondary-foreground/80">events near you</span>
                        </div>

                        <div className="col-span-2 aspect-square rounded-3xl overflow-hidden bg-muted">
                            <img
                                src={COMMUNITY_IMAGES.familyEvent}
                                alt="Children and families enjoying a community activity"
                                className="h-full w-full object-cover"
                            />
                        </div>

                        <div className="col-span-4 aspect-[4/3] rounded-3xl overflow-hidden bg-muted">
                            <img
                                src={COMMUNITY_IMAGES.localMarket}
                                alt="Local market stalls at a community event"
                                className="h-full w-full object-cover"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* WHAT'S ON THIS WEEK */}
            <section ref={listRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
                <div className="flex items-end justify-between mb-8 gap-4">
                    <div>
                        <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                            {selectedStream.label}
                        </span>
                        <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-2">
                            {selectedStream.subtitle}
                        </h2>
                    </div>

                    <Link
                        to="/events"
                        className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-primary"
                    >
                        See all events <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>

                {selectedStream.events.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-border p-10 text-center text-muted-foreground">
                        {activeFeed === "new"
                            ? "No new events since your last visit."
                            : "No events in this window yet."}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {selectedStream.events.slice(0, 8).map((e) => (
                            <EventCard key={e.id} event={e} orgName={orgName(e.orgSlug)} />
                        ))}
                    </div>
                )}
            </section>

            {/* FEATURED EVENTS */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
                <div className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                        <div>
                            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                                Your shortlist
                            </span>
                            <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight mt-2 inline-flex items-center gap-2">
                                <Heart className="h-5 w-5 text-primary" /> Saved this week
                            </h2>
                            <p className="mt-2 text-sm text-muted-foreground">
                                Quickly jump back into events you marked to revisit.
                            </p>
                        </div>
                        <Link
                            to="/saved-events"
                            className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
                        >
                            Open saved events <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>

                    {savedUpcoming.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                            You have not saved any upcoming events yet. Tap the heart on an event card to build your shortlist.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {savedUpcoming.map((e) => (
                                <Link
                                    key={e.id}
                                    to={`/events/${e.id}`}
                                    className="rounded-2xl border border-border bg-background p-4 hover:border-primary/40 transition"
                                >
                                    <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                                        {new Date(e.start).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                                    </div>
                                    <h3 className="mt-2 font-display font-bold text-lg leading-tight">{e.title}</h3>
                                    <p className="mt-1 text-xs text-muted-foreground truncate">{orgName(e.orgSlug)} • {e.venue}</p>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {featuredEvents.length > 0 && (
                <section className="bg-surface border-y border-border">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
                        <div className="flex items-end justify-between mb-8">
                            <div>
                                <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
                                    Featured
                                </span>
                                <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-2">
                                    Don't miss these
                                </h2>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {featuredEvents.map((e, i) => (
                                <EventCard
                                    key={e.id}
                                    event={e}
                                    orgName={orgName(e.orgSlug)}
                                    featured={i === 0}
                                />
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* FEATURED ORGANISATIONS */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
                <div className="flex items-end justify-between mb-8 gap-4">
                    <div>
                        <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                            Local
                        </span>
                        <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-2">
                            Organisations you should know
                        </h2>
                    </div>

                    <Link
                        to="/organisations"
                        className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-primary"
                    >
                        Full directory <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {featuredOrgs.map((o) => (
                        <OrgCard key={o.slug} org={o} />
                    ))}
                </div>
            </section>

            {/* COMMUNITY SPOTLIGHT + BUSINESS */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20 grid lg:grid-cols-2 gap-6">
                <div
                    data-testid="community-spotlight"
                    className="rounded-3xl border border-border bg-surface overflow-hidden flex flex-col"
                >
                    <div className="relative aspect-[16/9] overflow-hidden">
                        <img
                            src={COMMUNITY_IMAGES.volunteers}
                            alt="Local volunteers working together in the community"
                            className="absolute inset-0 h-full w-full object-cover"
                        />

                        <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold tracking-wider uppercase">
                            Community Spotlight
                        </span>
                    </div>

                    <div className="p-6 sm:p-8 flex flex-col gap-3">
                        <h3 className="font-display font-bold text-2xl">{spotlightOrg.name}</h3>
                        <p className="text-sm text-muted-foreground">{spotlightOrg.about}</p>

                        <Link
                            to={`/organisations/${spotlightOrg.slug}`}
                            className="inline-flex w-fit items-center gap-1 mt-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-primary text-primary-foreground"
                        >
                            Read more <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                </div>

                <div
                    data-testid="business-spotlight"
                    className="rounded-3xl border border-border bg-surface overflow-hidden flex flex-col"
                >
                    <div className="relative aspect-[16/9] overflow-hidden">
                        <img
                            src={COMMUNITY_IMAGES.localBusiness}
                            alt="Independent local business serving the community"
                            className="absolute inset-0 h-full w-full object-cover"
                        />

                        <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold tracking-wider uppercase inline-flex items-center gap-1">
                            <Coffee className="h-3 w-3" /> Local Business
                        </span>
                    </div>

                    <div className="p-6 sm:p-8 flex flex-col gap-3">
                        <h3 className="font-display font-bold text-2xl">{featuredBusiness.name}</h3>
                        <p className="text-sm text-muted-foreground">{featuredBusiness.about}</p>

                        <Link
                            to={`/organisations/${featuredBusiness.slug}`}
                            className="inline-flex w-fit items-center gap-1 mt-2 px-5 py-2.5 rounded-full text-sm font-semibold border-2 border-foreground"
                        >
                            Visit profile <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                </div>
            </section>

            {/* VOLUNTEER OPPS */}
            <section className="bg-surface border-y border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
                    <div className="flex items-end justify-between mb-8 gap-4">
                        <div>
                            <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
                                Give back
                            </span>

                            <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-2">
                                Volunteer opportunities
                            </h2>

                            <p className="mt-2 text-sm text-muted-foreground max-w-md">
                                Great for DofE participants, teenagers and anyone wanting to give a few hours
                                a week to a brilliant cause.
                            </p>
                        </div>

                        <Link
                            to="/volunteering"
                            className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-primary"
                        >
                            All roles <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {volunteerOpps.slice(0, 3).map((v) => (
                            <VolunteerCard key={v.id} opp={v} orgName={orgName(v.orgSlug)} />
                        ))}
                    </div>
                </div>
            </section>

            {/* NEWSLETTER */}
            <NewsletterSection />
        </div>
    );
}