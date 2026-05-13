import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { EventCard, OrgCard, VolunteerCard, Stat } from "@/components/Cards";
import { IMAGES } from "@/data/mockData";
import {
    ArrowRight,
    Sparkles,
    CalendarDays,
    Building2,
    HeartHandshake,
    Coffee,
    Megaphone,
    Wand2,
} from "lucide-react";
import { toast } from "sonner";

export default function Home() {
    const { events, orgs, volunteerOpps, subscribers, setSubscribers } = useApp();
    const [email, setEmail] = useState("");

    const approved = events.filter((e) => e.status === "approved");
    const sortedByDate = [...approved].sort((a, b) => new Date(a.start) - new Date(b.start));
    const upcoming = sortedByDate.slice(0, 8);

    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const thisWeek = sortedByDate.filter((e) => new Date(e.start) <= weekFromNow);

    const featuredEvents = sortedByDate.filter((e) => e.featured).slice(0, 3);
    const featuredOrgs = orgs.slice(0, 4);
    const spotlightOrg = orgs.find((o) => o.slug === "blackrod-food-pantry") || orgs[0];
    const featuredBusiness = orgs.find((o) => o.slug === "the-corner-cafe") || orgs[0];

    const subscribe = (e) => {
        e.preventDefault();
        if (!email) return;
        setSubscribers((s) => s + 1);
        setEmail("");
        toast.success("You're on the list", { description: "We'll send you the weekly Blackrod digest." });
    };

    const orgName = (slug) => orgs.find((o) => o.slug === slug)?.name;

    return (
        <div data-testid="home-page" className="">
            {/* HERO */}
            <section className="relative overflow-hidden border-b border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20 lg:pt-20 lg:pb-28 grid lg:grid-cols-12 gap-10 items-center">
                    <div className="lg:col-span-7 fade-in-up">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-[11px] font-bold tracking-wider uppercase mb-6">
                            <Sparkles className="h-3.5 w-3.5" /> Made in Blackrod, Bolton
                        </div>
                        <h1 className="font-display font-black tracking-tight text-5xl sm:text-6xl lg:text-7xl leading-[0.95] text-foreground">
                            Blackrod<span className="text-primary">Life</span>
                            <span className="block text-foreground/70 text-3xl sm:text-4xl lg:text-5xl font-bold mt-3">
                                Everything happening, on one page.
                            </span>
                        </h1>
                        <p className="mt-6 max-w-xl text-base sm:text-lg text-muted-foreground leading-relaxed">
                            Events, groups, clubs, causes and local life — discover what's on, find your tribe
                            and back the local people making Blackrod brilliant.
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
                            <img src={IMAGES.hero} alt="Community gathering" className="h-full w-full object-cover" />
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
                                src={IMAGES.youthSport}
                                alt="Youth sport"
                                className="h-full w-full object-cover"
                            />
                        </div>
                        <div className="col-span-4 aspect-[4/3] rounded-3xl overflow-hidden bg-muted">
                            <img src={IMAGES.street} alt="Local street" className="h-full w-full object-cover" />
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

            {/* FEATURED EVENTS (bento) */}
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
                                <EventCard key={e.id} event={e} orgName={orgName(e.orgSlug)} featured={i === 0} />
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* UPLOAD ONCE PUBLISH EVERYWHERE */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
                <div
                    data-testid="upload-once-cta"
                    className="relative overflow-hidden rounded-[2rem] border border-border bg-foreground text-background p-8 sm:p-12 grid lg:grid-cols-12 gap-8 items-center"
                >
                    <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary blur-3xl opacity-30" />
                    <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-secondary blur-3xl opacity-30" />
                    <div className="relative lg:col-span-7">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-[11px] font-bold tracking-wider uppercase">
                            <Wand2 className="h-3.5 w-3.5" /> AI Feature
                        </div>
                        <h2 className="font-display font-black text-4xl sm:text-5xl tracking-tight mt-4 leading-[1.05]">
                            Upload once.
                            <br />
                            <span className="text-secondary">Publish everywhere.</span>
                        </h2>
                        <p className="mt-4 max-w-lg text-background/80">
                            Paste a flyer, newsletter snippet or a quick update — BlackrodLife turns it into a
                            page update, calendar entry, social caption and notification draft. In one click.
                        </p>
                        <div className="mt-6 flex flex-wrap gap-3">
                            <Link
                                to="/organisation-dashboard"
                                data-testid="upload-once-try"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-secondary text-secondary-foreground hover:scale-105 transition-transform"
                            >
                                Try it now <ArrowRight className="h-4 w-4" />
                            </Link>
                            <Link
                                to="/add-organisation"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold border-2 border-background/40 text-background hover:bg-background hover:text-foreground transition"
                            >
                                Become a publisher
                            </Link>
                        </div>
                    </div>
                    <div className="relative lg:col-span-5">
                        <div className="rounded-3xl bg-background/10 backdrop-blur p-5 border border-background/20">
                            <div className="text-xs uppercase tracking-wider text-background/60 font-bold">
                                Paste this…
                            </div>
                            <p className="mt-2 text-sm text-background/90 leading-relaxed">
                                "Summer Fair Saturday 14 June, 11am-4pm at the Community Centre. Stalls,
                                bouncy castles, raffle. Free entry — all welcome!"
                            </p>
                            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                                <div className="rounded-2xl bg-secondary/20 p-3 border border-secondary/30">
                                    <div className="text-secondary font-bold uppercase tracking-wider text-[10px]">
                                        Event draft
                                    </div>
                                    <div className="mt-1 text-background">Summer Fair · 14 Jun · CC</div>
                                </div>
                                <div className="rounded-2xl bg-primary/20 p-3 border border-primary/30">
                                    <div className="text-primary font-bold uppercase tracking-wider text-[10px]">
                                        Social post
                                    </div>
                                    <div className="mt-1 text-background">📣 Summer Fair this Sat!</div>
                                </div>
                                <div className="col-span-2 rounded-2xl bg-accent/20 p-3 border border-accent/30">
                                    <div className="text-accent font-bold uppercase tracking-wider text-[10px]">
                                        Notification
                                    </div>
                                    <div className="mt-1 text-background">New on BlackrodLife: Summer Fair</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

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
                            src={IMAGES.spotlight}
                            alt=""
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
                            src={IMAGES.coffee}
                            alt=""
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
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
                <div className="rounded-[2rem] bg-secondary text-secondary-foreground p-8 sm:p-12 grid lg:grid-cols-2 gap-8 items-center">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-foreground/10 text-secondary-foreground text-[11px] font-bold tracking-wider uppercase">
                            <Megaphone className="h-3.5 w-3.5" /> Weekly Digest
                        </div>
                        <h2 className="font-display font-black text-3xl sm:text-4xl tracking-tight mt-3">
                            Get the Blackrod weekend, every Friday morning.
                        </h2>
                        <p className="mt-3 text-secondary-foreground/80 max-w-lg">
                            A hand-curated round-up of the best events, kids' things, freebies and good
                            causes — delivered free to your inbox.
                        </p>
                    </div>
                    <form
                        onSubmit={subscribe}
                        data-testid="newsletter-form"
                        className="flex gap-2 bg-background/40 backdrop-blur p-2 rounded-full border border-secondary-foreground/20"
                    >
                        <input
                            type="email"
                            data-testid="newsletter-input"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            className="flex-1 px-4 py-2 bg-transparent text-secondary-foreground placeholder:text-secondary-foreground/60 outline-none text-sm font-medium"
                        />
                        <button
                            type="submit"
                            data-testid="newsletter-submit"
                            className="px-5 py-2 rounded-full bg-foreground text-background text-sm font-semibold"
                        >
                            Subscribe
                        </button>
                    </form>
                </div>
            </section>
        </div>
    );
}
