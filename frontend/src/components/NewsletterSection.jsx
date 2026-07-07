import React, { useState } from "react";
import { Megaphone } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";

export default function NewsletterSection() {
    const { subscribers, setSubscribers } = useApp();
    const [email, setEmail] = useState("");

    const subscribe = (e) => {
        e.preventDefault();

        if (!email) return;

        setSubscribers((s) => s + 1);
        setEmail("");

        toast.success("You're on the list", {
            description: "We'll send you the weekly Blackrod Now digest.",
        });
    };

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
            <div className="rounded-[2rem] bg-secondary text-secondary-foreground p-8 sm:p-12 grid lg:grid-cols-2 gap-8 items-center">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-foreground/10 text-secondary-foreground text-[11px] font-bold tracking-wider uppercase">
                        <Megaphone className="h-3.5 w-3.5" /> Weekly Digest
                    </div>

                    <h2 className="font-display font-black text-3xl sm:text-4xl tracking-tight mt-3">
                        Get the Blackrod Now Newsletter, every Monday morning.
                    </h2>

                    <p className="mt-3 text-secondary-foreground/80 max-w-lg">
                        A round-up of the latest events, kids' things, freebies and good causes — delivered free to your inbox.
                    </p>
                </div>

                <div className="space-y-6">
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
            </div>
        </section>
    );
}
