import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { getDeviceId } from "@/lib/device";
import {
    EVENTS as SEED_EVENTS,
    ORGANISATIONS as SEED_ORGS,
    FEED_POSTS as SEED_FEED,
    VENUES as SEED_VENUES,
    VOLUNTEER_OPPS as SEED_VOLS,
} from "@/data/mockData";

const AppContext = createContext(null);

export function AppProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        if (typeof window === "undefined") return "light";
        return localStorage.getItem("rl-theme") || "light";
    });
    const [role, setRole] = useState(() => localStorage.getItem("rn-role") || "guest");

    const [orgs, setOrgs] = useState([]);
    const [events, setEvents] = useState([]);
    const [feed, setFeed] = useState([]);
    const [venues, setVenues] = useState([]);
    const [volunteerOpps, setVolunteerOpps] = useState([]);
    const [follows, setFollows] = useState({ orgs: [], categories: [] });
    const [stats, setStats] = useState({ subscribers: 0, events_total: 0, orgs_total: 0, events_pending: 0, orgs_pending: 0, messages_unread: 0 });
    const [notifPrefs, setNotifPrefs] = useState({ email: true, push: false, calendar: false, digest: true });
    const [ready, setReady] = useState(false);
    // Active org (for org dashboard)
    const [activeOrgSlug, setActiveOrgSlug] = useState(() => localStorage.getItem("rn-active-org") || "");

    useEffect(() => {
        const root = document.documentElement;
        if (theme === "dark") root.classList.add("dark");
        else root.classList.remove("dark");
        localStorage.setItem("rl-theme", theme);
    }, [theme]);

    useEffect(() => {
        localStorage.setItem("rn-role", role);
    }, [role]);

    useEffect(() => {
        if (activeOrgSlug) localStorage.setItem("rn-active-org", activeOrgSlug);
    }, [activeOrgSlug]);

    const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

    // ─────────── Bootstrap: seed if empty, then load ───────────
    const refresh = useCallback(async () => {
        const [orgsR, evR, feedR, vR, volR, fR, sR] = await Promise.all([
            api.orgs({ include_pending: true }).catch(() => []),
            api.events({ include_pending: true }).catch(() => []),
            api.feed().catch(() => []),
            api.venues().catch(() => []),
            api.volunteers().catch(() => []),
            api.follows().catch(() => ({ orgs: [], categories: [] })),
            api.stats().catch(() => ({})),
        ]);
        setOrgs(orgsR);
        setEvents(evR);
        setFeed(feedR);
        setVenues(vR);
        setVolunteerOpps(volR);
        setFollows({ orgs: fR.orgs || [], categories: fR.categories || [] });
        setStats((prev) => ({ ...prev, ...sR }));
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const seeded = await api.isSeeded();
                if (!seeded.seeded) {
                    // Bootstrap: push seed data from bundled mock
                    await api.seed({
                        organisations: SEED_ORGS,
                        events: SEED_EVENTS,
                        feed_posts: SEED_FEED,
                        venues: SEED_VENUES,
                        volunteers: SEED_VOLS,
                    });
                }
            } catch (e) {
                console.warn("Seed check failed", e);
            }
            await refresh();
            setReady(true);
        })();
    }, [refresh]);

    // ─────────── Follows ───────────
    const isFollowingOrg = (slug) => follows.orgs.includes(slug);
    const isFollowingCategory = (cat) => follows.categories.includes(cat);

    const toggleFollowOrg = async (slug) => {
        const already = isFollowingOrg(slug);
        const res = await api.toggleFollow("org", slug, already ? "remove" : "add");
        setFollows({ orgs: res.orgs || [], categories: res.categories || [] });
        return !already;
    };
    const toggleFollowCategory = async (cat) => {
        const already = isFollowingCategory(cat);
        const res = await api.toggleFollow("category", cat, already ? "remove" : "add");
        setFollows({ orgs: res.orgs || [], categories: res.categories || [] });
        return !already;
    };

    // ─────────── Mutations ───────────
    const addEvent = async (evt) => {
        const created = await api.createEvent({ ...evt, status: "pending" });
        setEvents((prev) => [created, ...prev]);
        return created;
    };
    const updateEvent = async (id, patch) => {
        const updated = await api.updateEvent(id, patch);
        setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)));
        return updated;
    };
    const setEventStatus = async (id, status) => {
        const updated = await api.setEventStatus(id, status);
        setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)));
    };
    const toggleEventFeatured = async (id) => {
        const updated = await api.featureEvent(id);
        setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)));
    };
    const deleteEvent = async (id) => {
        await api.deleteEvent(id);
        setEvents((prev) => prev.filter((e) => e.id !== id));
    };
    const addOrg = async (org) => {
        const created = await api.submitOrg(org);
        setOrgs((prev) => [created, ...prev]);
        return created;
    };
    const patchOrg = async (slug, patch) => {
        const updated = await api.patchOrg(slug, patch);
        setOrgs((prev) => prev.map((o) => (o.slug === slug ? updated : o)));
        return updated;
    };
    const setOrgStatus = async (slug, status) => {
        const updated = await api.setOrgStatus(slug, status);
        setOrgs((prev) => prev.map((o) => (o.slug === slug ? updated : o)));
    };
    const deleteOrg = async (slug) => {
        await api.deleteOrg(slug);
        setOrgs((prev) => prev.filter((o) => o.slug !== slug));
    };
    const addFeedPost = async (post) => {
        const created = await api.createFeedPost(post);
        setFeed((prev) => [created, ...prev]);
        return created;
    };

    const value = useMemo(
        () => ({
            ready,
            theme, toggleTheme,
            role, setRole,
            orgs, events, feed, venues, volunteerOpps,
            follows, toggleFollowOrg, toggleFollowCategory, isFollowingOrg, isFollowingCategory,
            stats, refresh,
            notifPrefs, setNotifPrefs,
            activeOrgSlug, setActiveOrgSlug,
            addEvent, updateEvent, setEventStatus, toggleEventFeatured, deleteEvent,
            addOrg, patchOrg, setOrgStatus, deleteOrg,
            addFeedPost,
            deviceId: getDeviceId(),
        }),
        [ready, theme, role, orgs, events, feed, venues, volunteerOpps, follows, stats, notifPrefs, activeOrgSlug, refresh],
    );

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error("useApp must be used inside AppProvider");
    return ctx;
};

// Helpers
export const orgBySlug = (orgs, slug) => orgs.find((o) => o.slug === slug);
export const eventsByOrg = (events, slug) =>
    events.filter((e) => e.orgSlug === slug && e.status === "approved");
