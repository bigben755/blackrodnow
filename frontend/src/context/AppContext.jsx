import React, { createContext, useContext, useEffect, useState } from "react";
import { EVENTS, ORGANISATIONS, FEED_POSTS, VOLUNTEER_OPPS } from "../data/mockData";

const AppContext = createContext(null);

export function AppProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        if (typeof window === "undefined") return "light";
        return localStorage.getItem("rl-theme") || "light";
    });

    const [role, setRole] = useState("guest"); // guest | admin | org
    const [demoActive, setDemoActive] = useState(false);
    const [demoRole, setDemoRole] = useState("guest");
    const [demoStepIndex, setDemoStepIndex] = useState(0);
    const [events, setEvents] = useState(EVENTS);
    const [orgs, setOrgs] = useState(ORGANISATIONS);
    const [feed, setFeed] = useState(FEED_POSTS);
    const [volunteerOpps, setVolunteerOpps] = useState(VOLUNTEER_OPPS);
    const [follows, setFollows] = useState([]); // array of org slugs
    const initialSubscribers = [
        { id: "sub-1", email: "hello@blackrodnow.example" },
        { id: "sub-2", email: "events@blackrodnow.example" },
        { id: "sub-3", email: "community@blackrodnow.example" },
        { id: "sub-4", email: "local@blackrodnow.example" },
    ];
    const [subscriberList, setSubscriberList] = useState(initialSubscribers);
    const [subscribers, setSubscribers] = useState(initialSubscribers.length);
    const [users, setUsers] = useState([
        { id: "user-admin", name: "Site Admin", email: "admin@blackrodnow.example", role: "Site admin", lastReset: "2026-05-01" },
        { id: "user-org1", name: "Events Team", email: "events@blackrodnow.example", role: "Organisation admin", lastReset: "2026-04-22" },
        { id: "user-editor", name: "Content Editor", email: "editor@blackrodnow.example", role: "Contributor", lastReset: "2026-04-30" },
    ]);
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

    const addEvent = (evt) => {
        const org = orgs.find((o) => o.slug === evt.orgSlug);
        const status =
            evt.status || (org && org.status === "approved" ? "approved" : "pending");
        setEvents((prev) => [
            { id: `evt-${Date.now()}`, status, featured: false, ...evt },
            ...prev,
        ]);
    };

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

    const addSubscriber = (email) => {
        setSubscriberList((prev) => [{ id: `sub-${Date.now()}`, email }, ...prev]);
        setSubscribers((prev) => prev + 1);
    };

    const removeSubscriber = (id) => {
        setSubscriberList((prev) => prev.filter((s) => s.id !== id));
        setSubscribers((prev) => Math.max(0, prev - 1));
    };

    const resetPassword = (id) =>
        setUsers((prev) =>
            prev.map((user) =>
                user.id === id
                    ? { ...user, lastReset: new Date().toISOString().split("T")[0] }
                    : user,
            ),
        );

    const updateEvent = (id, updates) =>
        setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));

    const bulkAddEvents = (items) =>
        setEvents((prev) =>
            items
                .map((item) => ({ id: `evt-${Date.now()}-${Math.floor(Math.random() * 10000)}`, featured: false, ...item }))
                .concat(prev),
        );

    const updateOrg = (slug, updates) =>
        setOrgs((prev) => prev.map((o) => (o.slug === slug ? { ...o, ...updates } : o)));

    const startDemo = (roleName) => {
        const demoTarget = roleName;
        setRole(demoTarget);
        setDemoRole(demoTarget);
        setDemoStepIndex(0);
        setDemoActive(true);
    };

    const stopDemo = () => {
        setDemoActive(false);
        setDemoStepIndex(0);
        setDemoRole("guest");
    };

    const nextDemoStep = () =>
        setDemoStepIndex((prev) => Math.max(prev + 1, 0));

    const prevDemoStep = () =>
        setDemoStepIndex((prev) => Math.max(prev - 1, 0));

    const value = {
        theme,
        toggleTheme,
        role,
        setRole,
        demoActive,
        demoRole,
        demoStepIndex,
        startDemo,
        stopDemo,
        nextDemoStep,
        prevDemoStep,
        events,
        orgs,
        feed,
        volunteerOpps,
        follows,
        toggleFollow,
        subscribers,
        setSubscribers,
        subscriberList,
        addSubscriber,
        removeSubscriber,
        users,
        resetPassword,
        notifPrefs,
        setNotifPrefs,
        addEvent,
        updateEventStatus,
        toggleEventFeatured,
        deleteEvent,
        updateEvent,
        bulkAddEvents,
        addOrg,
        updateOrgStatus,
        updateOrg,
        deleteOrg,
        addFeedPost,
    };

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
