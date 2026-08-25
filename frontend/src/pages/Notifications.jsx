import React, { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { CATEGORIES } from "@/data/mockData";
import { Bell, Mail, Calendar, Smartphone, Heart } from "lucide-react";
import { toast } from "sonner";
import { enablePush, disablePush, getPushSubscription, isIos, isStandalone } from "@/lib/push";

export default function Notifications() {
    const { notifPrefs, setNotifPrefs, orgs, follows, toggleFollowOrg, toggleFollowCategory } = useApp();
    const [pushEnabled, setPushEnabled] = useState(false);
    const [pushBusy, setPushBusy] = useState(false);

    useEffect(() => {
        getPushSubscription()
            .then((sub) => setPushEnabled(!!sub))
            .catch(() => {});
    }, []);

    const togglePush = async () => {
        if (pushBusy) return;
        setPushBusy(true);
        try {
            if (pushEnabled) {
                await disablePush();
                setPushEnabled(false);
                toast.success("Push notifications turned off");
            } else {
                await enablePush();
                setPushEnabled(true);
                toast.success("You'll now get alerts from groups you follow");
            }
        } catch (error) {
            const reason = String(error?.message || "");
            if (reason === "denied") {
                toast.error("Notifications are blocked — allow them for this site in your browser settings");
            } else if (reason === "unsupported" && isIos() && !isStandalone()) {
                toast.error('On iPhone, install the app first: tap Share → "Add to Home Screen", then enable notifications here');
            } else if (reason === "unsupported") {
                toast.error("This browser doesn't support push notifications");
            } else {
                toast.error("Could not enable notifications — please try again");
            }
        } finally {
            setPushBusy(false);
        }
    };

    const setPref = (k) => setNotifPrefs((p) => ({ ...p, [k]: !p[k] }));

    const save = () => toast.success("Preferences saved");

    return (
        <div data-testid="notifications-page" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="mb-8">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                    Notifications & following
                </span>
                <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight mt-2">
                    Stay in the loop
                </h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    Choose what you want to hear about, and how.
                </p>
            </div>

            <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8 space-y-3 mb-6">
                <h2 className="font-display font-bold text-xl">Channels</h2>
                <Toggle
                    icon={Mail}
                    title="Email notifications"
                    desc="Personalised round-ups when followed groups post."
                    checked={notifPrefs.email}
                    onChange={() => setPref("email")}
                    testid="pref-email"
                />
                <Toggle
                    icon={Smartphone}
                    title="Push notifications"
                    desc={
                        pushEnabled
                            ? "On — instant alerts for new events and updates from groups you follow."
                            : "Instant alerts for new events and updates from groups you follow. On iPhone, add Blackrod Now to your home screen first."
                    }
                    checked={pushEnabled}
                    onChange={togglePush}
                    testid="pref-push"
                />
                <Toggle
                    icon={Calendar}
                    title="Calendar sync"
                    desc="Add events you've saved to your phone calendar."
                    checked={notifPrefs.calendar}
                    onChange={() => setPref("calendar")}
                    testid="pref-calendar"
                />
                <Toggle
                    icon={Bell}
                    title="Weekly digest"
                    desc="Friday round-up of weekend events."
                    checked={notifPrefs.digest}
                    onChange={() => setPref("digest")}
                    testid="pref-digest"
                />
                <button
                    data-testid="save-prefs"
                    onClick={save}
                    className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm"
                >
                    Save preferences
                </button>
            </section>

            <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8 mb-6">
                <h2 className="font-display font-bold text-xl mb-3">Organisations you follow</h2>
                {follows.orgs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        You're not following anyone yet. Visit an organisation's page and tap{" "}
                        <Heart className="inline h-3.5 w-3.5" /> Follow.
                    </p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {follows.orgs.map((slug) => {
                            const o = orgs.find((x) => x.slug === slug);
                            if (!o) return null;
                            return (
                                <button
                                    key={slug}
                                    data-testid={`unfollow-${slug}`}
                                    onClick={async () => {
                                        await toggleFollowOrg(slug);
                                        toast.info(`Unfollowed ${o.name}`);
                                    }}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-secondary-foreground font-semibold text-xs"
                                >
                                    <span>{o.logo}</span> {o.name} ✕
                                </button>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
                <h2 className="font-display font-bold text-xl mb-3">Follow categories</h2>
                <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((c) => {
                        const active = follows.categories.includes(c);
                        return (
                            <button
                                key={c}
                                data-testid={`follow-cat-${c}`}
                                onClick={async () => {
                                    await toggleFollowCategory(c);
                                    toast.success(active ? `Unfollowed ${c}` : `Following ${c}`);
                                }}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition ${
                                    active
                                        ? "bg-secondary text-secondary-foreground"
                                        : "border border-border hover:bg-muted"
                                }`}
                            >
                                {c}
                            </button>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}

const Toggle = ({ icon: Icon, title, desc, checked, onChange, testid }) => (
    <label
        data-testid={testid}
        className="flex items-center gap-4 py-3 cursor-pointer border-b border-border last:border-b-0"
    >
        <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary grid place-items-center">
            <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
            <div className="font-semibold text-sm">{title}</div>
            <div className="text-xs text-muted-foreground">{desc}</div>
        </div>
        <input
            type="checkbox"
            checked={checked}
            onChange={onChange}
            className="sr-only peer"
        />
        <div className="h-6 w-11 rounded-full bg-muted relative transition peer-checked:bg-primary">
            <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    checked ? "translate-x-5" : ""
                }`}
            />
        </div>
    </label>
);
