import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { EVENTS, ORGANISATIONS, FEED_POSTS, VOLUNTEER_OPPS } from "../data/mockData";

const AppContext = createContext(null);

export function AppProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        if (typeof window === "undefined") return "light";
        return localStorage.getItem("rl-theme") || "light";
    });

    const [role, setRole] = useState("guest"); // guest | admin | org | contributor
    const [events, setEvents] = useState(EVENTS);
    const [orgs, setOrgs] = useState(ORGANISATIONS);
    const [feed, setFeed] = useState(FEED_POSTS);
    const [volunteerOpps, setVolunteerOpps] = useState(VOLUNTEER_OPPS);
    const [follows, setFollows] = useState([]); // array of org slugs
    const [subscribers, setSubscribers] = useState(214);
    const [notifPrefs, setNotifPrefs] = useState({
        email: true,
        push: false,
        calendar: false,
        digest: true,
    });

    useEffect(() => {
        const root = document.documentElement;
        if (theme === "dark") root.classList.add("dark");
        else root.classList.remove("dark");
        localStorage.setItem("rl-theme", theme);
    }, [theme]);

    const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

    const toggleFollow = (slug) =>
        setFollows((f) => (f.includes(slug) ? f.filter((s) => s !== slug) : [...f, slug]));

    const addEvent = (evt) =>
        setEvents((prev) => [
            { id: `evt-${Date.now()}`, status: "pending", featured: false, ...evt },
            ...prev,
        ]);

    const updateEventStatus = (id, status) =>
        setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));

    const toggleEventFeatured = (id) =>
        setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, featured: !e.featured } : e)));

    const deleteEvent = (id) => setEvents((prev) => prev.filter((e) => e.id !== id));

    const addOrg = (org) =>
        setOrgs((prev) => [
            {
                slug: org.slug || `org-${Date.now()}`,
                upcoming: 0,
                status: "pending",
                tags: [],
                logo: "✨",
                cover: "",
                socials: {},
                ...org,
            },
            ...prev,
        ]);

    const updateOrgStatus = (slug, status) =>
        setOrgs((prev) => prev.map((o) => (o.slug === slug ? { ...o, status } : o)));

    const deleteOrg = (slug) => setOrgs((prev) => prev.filter((o) => o.slug !== slug));

    const addFeedPost = (post) =>
        setFeed((prev) => [{ id: `feed-${Date.now()}`, time: new Date().toISOString(), ...post }, ...prev]);

    const value = useMemo(
        () => ({
            theme,
            toggleTheme,
            role,
            setRole,
            events,
            orgs,
            feed,
            volunteerOpps,
            follows,
            toggleFollow,
            subscribers,
            setSubscribers,
            notifPrefs,
            setNotifPrefs,
            addEvent,
            updateEventStatus,
            toggleEventFeatured,
            deleteEvent,
            addOrg,
            updateOrgStatus,
            deleteOrg,
            addFeedPost,
        }),
        [theme, role, events, orgs, feed, volunteerOpps, follows, subscribers, notifPrefs],
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
