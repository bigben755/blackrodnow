import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { Heart, ArrowRight, CalendarDays } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { EventCard } from "@/components/Cards";

export default function SavedEvents() {
    const { events, orgs, savedEventIds } = useApp();

    const orgName = (slug) => orgs.find((o) => o.slug === slug)?.name;

    const savedEvents = useMemo(() => {
        const savedSet = new Set(savedEventIds);
        return events
            .filter((e) => e.status === "approved" && savedSet.has(e.id))
            .sort((a, b) => new Date(a.start) - new Date(b.start));
    }, [events, savedEventIds]);

    const now = new Date();
    const upcoming = savedEvents.filter((e) => new Date(e.end || e.start) >= now);
    const past = savedEvents.filter((e) => new Date(e.end || e.start) < now);

    return (
        <div data-testid="saved-events-page" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="rounded-3xl border border-border bg-surface p-6 sm:p-8 mb-8">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                            Shortlist
                        </span>
                        <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight mt-2 inline-flex items-center gap-2">
                            Your saved events
                        </h1>
                        <p className="mt-3 text-sm text-muted-foreground max-w-2xl">
                            Keep track of events you want to revisit. Saved events are stored on this device.
                        </p>
                    </div>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-background text-sm">
                        <Heart className="h-4 w-4 text-primary" />
                        {savedEvents.length} saved
                    </div>
                </div>
            </div>

            {savedEvents.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border p-12 text-center">
                    <div className="inline-flex h-14 w-14 rounded-2xl bg-muted items-center justify-center mb-4">
                        <Heart className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h2 className="font-display font-bold text-2xl">No saved events yet</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Tap the heart icon on any event card to build your shortlist.
                    </p>
                    <Link
                        to="/events"
                        className="mt-5 inline-flex items-center gap-1.5 px-5 py-3 rounded-full text-sm font-semibold bg-primary text-primary-foreground"
                    >
                        Browse events <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
            ) : (
                <>
                    <section className="mb-10">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-display font-bold text-2xl inline-flex items-center gap-2">
                                <CalendarDays className="h-5 w-5 text-primary" /> Upcoming
                            </h2>
                            <Link to="/events" className="text-sm font-semibold text-primary inline-flex items-center gap-1">
                                See all events <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                        {upcoming.length === 0 ? (
                            <div className="rounded-3xl border border-dashed border-border p-8 text-sm text-muted-foreground">
                                None of your saved events are upcoming right now.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {upcoming.map((e) => (
                                    <EventCard key={e.id} event={e} orgName={orgName(e.orgSlug)} />
                                ))}
                            </div>
                        )}
                    </section>

                    {past.length > 0 && (
                        <section>
                            <h3 className="font-display font-bold text-xl mb-4">Past saved events</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 opacity-90">
                                {past.slice(0, 6).map((e) => (
                                    <EventCard key={e.id} event={e} orgName={orgName(e.orgSlug)} />
                                ))}
                            </div>
                        </section>
                    )}
                </>
            )}
        </div>
    );
}
