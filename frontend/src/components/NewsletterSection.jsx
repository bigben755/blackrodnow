import React, { useState } from "react";
import { Megaphone, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useApp, orgBySlug } from "@/context/AppContext";
import { api } from "@/lib/api";
import { useNavigate } from "react-router-dom";

export default function NewsletterSection() {
    const { follows, orgs } = useApp();
    const [email, setEmail] = useState("");
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(null); // {pref_token}
    const navigate = useNavigate();

    const subscribe = async (e) => {
        e.preventDefault();
        if (!email) return;
        setBusy(true);
        try {
            const res = await api.subscribe(email, {
                followed_orgs: follows.orgs || [],
                followed_categories: follows.categories || [],
            });
            setDone(res);
            setEmail("");
            toast.success("You're on the list 🎉", {
                description: res.already_subscribed
                    ? "We updated your preferences with any orgs you've been following."
                    : "Check your inbox for a welcome — you can personalise anytime.",
            });
        } catch (err) {
            toast.error("Couldn't subscribe. Please try again.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
            <div className="rounded-[2rem] bg-secondary text-secondary-foreground p-8 sm:p-12 grid lg:grid-cols-2 gap-8 items-center">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-foreground/10 text-secondary-foreground text-[11px] font-bold tracking-wider uppercase">
                        <Megaphone className="h-3.5 w-3.5" /> Weekly Digest
                    </div>
                    <h2 className="font-display font-black text-3xl sm:text-4xl tracking-tight mt-3">
                        Get the Blackrod Now digest, every Friday morning.
                    </h2>
                    <p className="mt-3 text-secondary-foreground/80 max-w-lg">
                        A round-up of the events, freebies and good causes near you — tailored to the
                        organisations and topics you follow. Free forever, unsubscribe in one click.
                    </p>
                    {(follows.orgs.length + follows.categories.length) > 0 && (
                        <p className="mt-3 text-secondary-foreground/70 text-sm">
                            You'll get updates on{" "}
                            <b>{follows.orgs.length}</b> organisation{follows.orgs.length !== 1 && "s"}{" "}
                            and <b>{follows.categories.length}</b> categor{follows.categories.length !== 1 ? "ies" : "y"} you follow.
                        </p>
                    )}
                </div>

                <div className="space-y-3">
                    {!done ? (
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
                                disabled={busy}
                                className="px-5 py-2 rounded-full bg-foreground text-background text-sm font-semibold disabled:opacity-60"
                            >
                                {busy ? "…" : "Subscribe"}
                            </button>
                        </form>
                    ) : (
                        <div
                            data-testid="newsletter-success"
                            className="rounded-3xl bg-foreground text-background p-5"
                        >
                            <div className="inline-flex items-center gap-2 text-secondary">
                                <CheckCircle2 className="h-5 w-5" />
                                <span className="font-semibold">You're subscribed</span>
                            </div>
                            <p className="mt-2 text-sm text-background/80">
                                Want the digest personalised to specific organisations and categories?
                            </p>
                            <button
                                onClick={() => navigate(`/preferences/${done.pref_token}`)}
                                data-testid="newsletter-personalise"
                                className="mt-3 inline-flex items-center gap-1 px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-sm font-semibold"
                            >
                                Personalise <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}
                    <p className="text-xs text-secondary-foreground/70 px-2">
                        No account needed. One-click unsubscribe from every email.
                    </p>
                </div>
            </div>
        </section>
    );
}
