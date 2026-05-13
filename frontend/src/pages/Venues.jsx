import React from "react";
import { useApp } from "@/context/AppContext";
import { VenueCard } from "@/components/Cards";
import { VENUES } from "@/data/mockData";

export default function Venues() {
    const { events } = useApp();
    const countAtVenue = (name) =>
        events.filter((e) => e.status === "approved" && e.venue?.toLowerCase().includes(name.split(" ")[0].toLowerCase())).length;

    return (
        <div data-testid="venues-page" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="mb-8">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Venues</span>
                <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight mt-2">
                    Spaces to hire
                </h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    From church halls to function rooms — places to host your next event in Blackrod.
                </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {VENUES.map((v) => (
                    <VenueCard key={v.id} venue={v} eventCount={countAtVenue(v.name)} />
                ))}
            </div>
        </div>
    );
}
