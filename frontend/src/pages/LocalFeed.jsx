import React, { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import NewsletterSection from "@/components/NewsletterSection";
import { FeedCard } from "@/components/Cards";
import { Info } from "lucide-react";
import { Link } from "react-router-dom";

const TYPES = [
    "All",
    "Community updates",
    "School news",
    "Club update",
    "Volunteer request",
    "Local business offer",
    "Public notice",
    "Charity appeal",
];

export default function LocalFeed() {
    const { feed, orgs } = useApp();
    const [type, setType] = useState("All");

    const filtered = useMemo(() => {
        const sorted = [...feed].sort((a, b) => new Date(b.time) - new Date(a.time));
        if (type === "All") return sorted;
        return sorted.filter((p) => p.type.toLowerCase().includes(type.toLowerCase().split(" ")[0]));
    }, [feed, type]);

    const orgLookup = (slug) => orgs.find((o) => o.slug === slug) || {};

    return (
        <div data-testid="local-feed-page" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="mb-6">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Local Feed</span>
                <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight mt-2">
                    What people are saying
                </h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    A live feed of community updates, school news, business offers and charity appeals.
                </p>
            </div>

            <div
                data-testid="feed-source-info"
                className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3"
            >
                <div className="h-8 w-8 rounded-xl bg-primary/15 text-primary grid place-items-center shrink-0">
                    <Info className="h-4 w-4" />
                </div>
                <div className="text-sm text-foreground/80 leading-relaxed">
                    <span className="font-semibold text-foreground">Where do posts come from?</span> Local
                    organisations publish updates via their{" "}
                    <Link to="/organisation-dashboard" className="text-primary font-semibold underline">
                        dashboard
                    </Link>{" "}
                    — paste a flyer, newsletter or quick note and it appears here as a card. Live pulls
                    from Facebook &amp; Instagram are coming soon.
                </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-6 -mx-1 px-1 overflow-x-auto scrollbar-thin">
                {TYPES.map((t) => (
                    <button
                        key={t}
                        data-testid={`feed-filter-${t}`}
                        onClick={() => setType(t)}
                        className={`px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition ${
                            type === t
                                ? "bg-foreground text-background"
                                : "bg-surface border border-border text-foreground/70 hover:text-foreground"
                        }`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {filtered.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border p-10 text-center text-muted-foreground text-sm">
                    No posts yet. Be the first to share something.
                </div>
            ) : (
                <div className="space-y-4">
                    {filtered.map((p) => {
                        const o = orgLookup(p.orgSlug);
                        return (
                            <FeedCard
                                key={p.id}
                                post={p}
                                orgName={o.name || "Unknown"}
                                orgLogo={o.logo || "📍"}
                                orgSlug={p.orgSlug}
                                org={o}
                            />
                        );
                    })}
                </div>
            )}

                    {/* NEWSLETTER */}
                    <NewsletterSection />
        </div>
    );
}
