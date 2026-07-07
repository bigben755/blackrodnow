import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { EventCard, OrgCard, VolunteerCard } from "@/components/Cards";
import NewsletterSection from "@/components/NewsletterSection";
import {
    ArrowRight,
    Sparkles,
    Coffee,
    Wand2,
} from "lucide-react";
import { toast } from "sonner";

const COMMUNITY_IMAGES = {
    hero: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1200&q=80",
    familyEvent: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=900&q=80",
    localMarket: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=80",
    volunteers: "https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=1200&q=80",
    localBusiness: "https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=1200&q=80",
};

export default function Home() {
    const { events, orgs, volunteerOpps, subscribers } = useApp();

    const approved = events.filter((e) => e.status === "approved");
    const now = new Date();

    const sortedByDate = [...approved]
        .filter((e) => new Date(e.end || e.start) >= now)
        .sort((a, b) => new Date(a.start) - new Date(b.start));

    const upcoming = sortedByDate.slice(0, 8);

    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    const thisWeek = sortedByDate.filter((e) => new Date(e.start) <= weekFromNow);

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
                            Blackrod & South Horwich<span className="text-primary"> Now</span>
                            <span className="block text-foreground/70 text-3xl sm:text-4xl lg:text-5xl font-bold mt-3">
                                What's on, what's new, what's next.
                            </span>
                        </h1>

                        <p className="mt-6 max-w-xl text-base sm:text-lg text-muted-foreground leading-relaxed">
                            Blackrod & South HorwichNow brings together local events, groups, clubs, schools, businesses and
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
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
                <div className="flex items-end justify-between mb-8 gap-4">
                    <div>
                        <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                            What's on
                        </span>
                        <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-2">
                            This week in Blackrod
                        </h2>
                    </div>

                    <Link
                        to="/events"
                        className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-primary"
                    >
                        See all events <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>

                {thisWeek.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-border p-10 text-center text-muted-foreground">
                        Nothing on the calendar for this week — yet.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {thisWeek.slice(0, 4).map((e) => (
                            <EventCard key={e.id} event={e} orgName={orgName(e.orgSlug)} />
                        ))}
                    </div>
                )}
            </section>

            {/* FEATURED EVENTS */}
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