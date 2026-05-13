import React, { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { OrgCard } from "@/components/Cards";
import { ORG_TYPES } from "@/data/mockData";
import { Search } from "lucide-react";

export default function Organisations() {
    const { orgs } = useApp();
    const [query, setQuery] = useState("");
    const [cat, setCat] = useState("All");

    const filtered = useMemo(() => {
        return orgs
            .filter((o) => o.status !== "pending")
            .filter((o) =>
                query
                    ? `${o.name} ${o.short} ${o.about}`.toLowerCase().includes(query.toLowerCase())
                    : true,
            )
            .filter((o) => (cat === "All" ? true : o.category === cat));
    }, [orgs, query, cat]);

    return (
        <div data-testid="orgs-page" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="mb-8">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Directory</span>
                <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight mt-2">
                    Organisations in Blackrod
                </h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    Clubs, schools, local businesses, charities and community groups — all in one place.
                </p>
            </div>

            <div className="grid md:grid-cols-12 gap-3 mb-8">
                <div className="md:col-span-7 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        data-testid="orgs-search"
                        placeholder="Search organisations…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-full border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
                <select
                    data-testid="orgs-category"
                    value={cat}
                    onChange={(e) => setCat(e.target.value)}
                    className="md:col-span-5 px-4 py-3 rounded-full border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="All">All types</option>
                    {ORG_TYPES.map((t) => (
                        <option key={t}>{t}</option>
                    ))}
                </select>
            </div>

            {filtered.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border p-12 text-center text-muted-foreground">
                    No organisations found.
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filtered.map((o) => (
                        <OrgCard key={o.slug} org={o} />
                    ))}
                </div>
            )}
        </div>
    );
}
