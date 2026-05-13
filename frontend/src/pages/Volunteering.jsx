import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { VolunteerCard } from "@/components/Cards";
import { Heart, Sparkles } from "lucide-react";

export default function Volunteering() {
    const { volunteerOpps, orgs } = useApp();
    const [filter, setFilter] = useState("All");
    const orgName = (slug) => orgs.find((o) => o.slug === slug)?.name;

    const filtered =
        filter === "All"
            ? volunteerOpps
            : filter === "Under 18"
            ? volunteerOpps.filter((v) => /^1[4-7]/.test(v.age))
            : volunteerOpps.filter((v) => /18\+|adults/i.test(v.age));

    return (
        <div data-testid="volunteering-page" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div
                data-testid="volunteer-hero"
                className="rounded-[2rem] bg-secondary text-secondary-foreground p-8 sm:p-12 mb-10 relative overflow-hidden"
            >
                <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-foreground/10 blur-3xl" />
                <div className="relative max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-foreground/10 text-secondary-foreground text-[11px] font-bold tracking-wider uppercase">
                        <Sparkles className="h-3.5 w-3.5" /> Give a few hours — change a week
                    </div>
                    <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight mt-3 leading-tight">
                        Volunteer in Blackrod
                    </h1>
                    <p className="mt-3 text-secondary-foreground/80">
                        Brilliant opportunities for DofE participants, teenagers, students and adults who
                        want to help build a stronger community.
                    </p>
                </div>
            </div>

            <div className="flex gap-2 mb-6">
                {["All", "Under 18", "18+"].map((t) => (
                    <button
                        key={t}
                        data-testid={`vol-filter-${t}`}
                        onClick={() => setFilter(t)}
                        className={`px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider ${
                            filter === t ? "bg-foreground text-background" : "bg-surface border border-border"
                        }`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((v) => (
                    <VolunteerCard key={v.id} opp={v} orgName={orgName(v.orgSlug)} />
                ))}
            </div>
        </div>
    );
}
