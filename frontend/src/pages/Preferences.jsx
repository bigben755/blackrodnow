import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { CATEGORIES } from "@/data/mockData";
import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Preferences() {
    const { token } = useParams();
    const { orgs } = useApp();
    const [sub, setSub] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        api.preferences(token)
            .then(setSub)
            .catch((e) => setError(e?.response?.data?.detail || "Unknown token"));
    }, [token]);

    const toggleOrg = (slug) => {
        setSub((s) => ({
            ...s,
            followed_orgs: s.followed_orgs.includes(slug)
                ? s.followed_orgs.filter((x) => x !== slug)
                : [...s.followed_orgs, slug],
        }));
    };
    const toggleCat = (cat) => {
        setSub((s) => ({
            ...s,
            followed_categories: s.followed_categories.includes(cat)
                ? s.followed_categories.filter((x) => x !== cat)
                : [...s.followed_categories, cat],
        }));
    };

    const save = async () => {
        setBusy(true);
        try {
            const updated = await api.updatePreferences(token, {
                followed_orgs: sub.followed_orgs,
                followed_categories: sub.followed_categories,
                digest: sub.digest,
            });
            setSub(updated);
            toast.success("Preferences saved");
        } catch { toast.error("Save failed"); }
        finally { setBusy(false); }
    };

    const unsubscribe = async () => {
        try { await api.unsubscribe(sub.unsub_token); toast.info("You've been unsubscribed"); setSub({ ...sub, unsubscribed: true }); }
        catch { toast.error("Failed"); }
    };

    if (error) {
        return (
            <div className="max-w-2xl mx-auto py-24 px-6 text-center">
                <h1 className="font-display font-black text-3xl">This link's expired or invalid</h1>
                <p className="mt-3 text-muted-foreground">{error}</p>
                <Link to="/" className="mt-4 inline-flex text-primary font-semibold">Back to Blackrod Now</Link>
            </div>
        );
    }
    if (!sub) return <div className="max-w-2xl mx-auto py-24 px-6 text-center text-muted-foreground">Loading…</div>;
    if (sub.unsubscribed) {
        return (
            <div className="max-w-2xl mx-auto py-24 px-6 text-center">
                <h1 className="font-display font-black text-3xl">You're unsubscribed</h1>
                <p className="mt-3 text-muted-foreground">Change your mind? <Link to="/" className="text-primary font-semibold">Resubscribe on the homepage</Link>.</p>
            </div>
        );
    }

    return (
        <div data-testid="preferences-page" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="mb-6">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Your Blackrod Now</span>
                <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight mt-2">Personalise your digest</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    Delivering to <b>{sub.email}</b>. Choose the organisations and categories you'd like the Friday digest to focus on.
                </p>
            </div>

            <section className="rounded-3xl border border-border bg-surface p-6 mb-4">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="font-display font-bold">Weekly digest</h2>
                    <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" data-testid="pref-digest-toggle" checked={sub.digest} onChange={(e) => setSub({ ...sub, digest: e.target.checked })} className="accent-primary h-4 w-4" />
                        {sub.digest ? "On" : "Off"}
                    </label>
                </div>
                <p className="text-xs text-muted-foreground">Turn off to stop the weekly digest but keep ad-hoc announcements.</p>
            </section>

            <section className="rounded-3xl border border-border bg-surface p-6 mb-4">
                <h2 className="font-display font-bold mb-3">Organisations you follow</h2>
                <div className="flex flex-wrap gap-2">
                    {orgs.filter((o) => o.status !== "pending").map((o) => {
                        const active = sub.followed_orgs.includes(o.slug);
                        return (
                            <button
                                key={o.slug}
                                data-testid={`pref-org-${o.slug}`}
                                onClick={() => toggleOrg(o.slug)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                                    active ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"
                                }`}
                            >
                                <span>{o.logo}</span> {o.name}
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className="rounded-3xl border border-border bg-surface p-6 mb-4">
                <h2 className="font-display font-bold mb-3">Categories you care about</h2>
                <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((c) => {
                        const active = sub.followed_categories.includes(c);
                        return (
                            <button
                                key={c}
                                data-testid={`pref-cat-${c}`}
                                onClick={() => toggleCat(c)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition ${
                                    active ? "bg-secondary text-secondary-foreground" : "border border-border hover:bg-muted"
                                }`}
                            >
                                {c}
                            </button>
                        );
                    })}
                </div>
            </section>

            <div className="flex flex-wrap gap-2">
                <button data-testid="pref-save" disabled={busy} onClick={save} className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-60">
                    <Save className="h-4 w-4" /> Save preferences
                </button>
                <button data-testid="pref-unsubscribe" onClick={unsubscribe} className="inline-flex items-center gap-2 px-5 py-3 rounded-full border-2 border-foreground font-semibold text-sm">
                    <Trash2 className="h-4 w-4" /> Unsubscribe from everything
                </button>
            </div>
        </div>
    );
}
