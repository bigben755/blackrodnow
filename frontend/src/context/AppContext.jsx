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
const normalizeRole = (role) => (role === "admin" || role === "org" ? role : "guest");

export function AppProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        if (typeof window === "undefined") return "light";
        return localStorage.getItem("rl-theme") || "light";
    });
    const [adminUnlocked, setAdminUnlocked] = useState(() => {
        if (typeof window === "undefined") return false;
        // Rehydrate admin session from stored JWT if present + not expired.
        const jwt = localStorage.getItem("rn-admin-jwt") || "";
        if (!jwt) return false;
        try {
            const payload = JSON.parse(atob(jwt.split(".")[1]));
            if (payload?.exp && payload.exp * 1000 > Date.now() && payload?.role === "admin") return true;
            localStorage.removeItem("rn-admin-jwt");
        } catch {
            localStorage.removeItem("rn-admin-jwt");
        }
        return false;
    });
    const [adminCodeSession, setAdminCodeSession] = useState(() => {
        if (typeof window === "undefined") return "";
        return localStorage.getItem("rn-admin-jwt") || "";
    });
    const [role, setRoleState] = useState(() => {
        if (typeof window === "undefined") return "guest";
        try {
            const jwt = localStorage.getItem("rn-admin-jwt") || "";
            if (jwt) {
                const payload = JSON.parse(atob(jwt.split(".")[1]));
                if (payload?.exp && payload.exp * 1000 > Date.now() && payload?.role === "admin") return "admin";
            }
        } catch { /* ignore */ }
        return "guest";
    });

    const [orgs, setOrgs] = useState([]);
    const [events, setEvents] = useState([]);
    const [feed, setFeed] = useState([]);
    const [venues, setVenues] = useState([]);
    const [volunteerOpps, setVolunteerOpps] = useState([]);
    const [follows, setFollows] = useState({ orgs: [], categories: [] });
    const [stats, setStats] = useState({ subscribers: 0, events_total: 0, orgs_total: 0, events_pending: 0, orgs_pending: 0, messages_unread: 0 });
    const [notifPrefs, setNotifPrefs] = useState({ email: true, push: false, calendar: false, digest: true });
    const [savedEventIds, setSavedEventIds] = useState(() => {
        if (typeof window === "undefined") return [];
        try {
            const raw = localStorage.getItem("rn-saved-events");
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    });
    const [ready, setReady] = useState(false);
    // Active org (for org dashboard)
    const [activeOrgSlug, setActiveOrgSlug] = useState(() => localStorage.getItem("rn-active-org") || "");
    const [impersonatingOrgSlug, setImpersonatingOrgSlug] = useState(() => localStorage.getItem("rn-impersonating-org") || "");
    const [orgTokens, setOrgTokens] = useState(() => {
        if (typeof window === "undefined") return {};
        try {
            const raw = localStorage.getItem("rn-org-tokens");
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch {
            return {};
        }
    });
    const [demoActive, setDemoActive] = useState(false);
    const [demoRole, setDemoRole] = useState("guest");
    const [demoStepIndex, setDemoStepIndex] = useState(0);

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
        if (!adminUnlocked && role === "admin") setRoleState("guest");
    }, [adminUnlocked, role]);

    useEffect(() => {
        if (activeOrgSlug) localStorage.setItem("rn-active-org", activeOrgSlug);
    }, [activeOrgSlug]);

    useEffect(() => {
        if (impersonatingOrgSlug) localStorage.setItem("rn-impersonating-org", impersonatingOrgSlug);
        else localStorage.removeItem("rn-impersonating-org");
    }, [impersonatingOrgSlug]);

    useEffect(() => {
        localStorage.setItem("rn-org-tokens", JSON.stringify(orgTokens));
    }, [orgTokens]);

    useEffect(() => {
        localStorage.setItem("rn-saved-events", JSON.stringify(savedEventIds));
    }, [savedEventIds]);

    const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

    const setRole = useCallback(
        (nextRole) => {
            const normalized = normalizeRole(nextRole);
            if (!adminUnlocked && normalized === "admin") return false;
            setRoleState(normalized);
            return true;
        },
        [adminUnlocked],
    );

    const unlockAdmin = useCallback((code = "") => {
        setAdminUnlocked(true);
        const normalized = code || "";
        setAdminCodeSession(normalized);
        if (typeof window !== "undefined") localStorage.setItem("rn-admin-code", normalized);
        setRoleState("admin");
    }, []);

    const loginAdmin = useCallback(async (email, password) => {
        const res = await api.authLoginAdmin(email, password);
        if (!res?.token) throw new Error("Login failed");
        if (typeof window !== "undefined") {
            localStorage.setItem("rn-admin-jwt", res.token);
        }
        setAdminUnlocked(true);
        setAdminCodeSession(res.token);
        setRoleState("admin");
        return res;
    }, []);

    const lockAdmin = useCallback(() => {
        setAdminUnlocked(false);
        setAdminCodeSession("");
        if (typeof window !== "undefined") {
            localStorage.removeItem("rn-admin-code");
            localStorage.removeItem("rn-admin-jwt");
        }
        setRoleState("guest");
    }, []);

    const hasOrgAccess = useCallback((slug) => !!orgTokens[slug], [orgTokens]);
    const getOrgToken = useCallback((slug) => orgTokens[slug] || "", [orgTokens]);

    const unlockOrgAccess = useCallback((slug, token) => {
        if (!slug) return;
        if (!token) return;
        setOrgTokens((current) => ({ ...current, [slug]: token }));
    }, []);

    const clearOrgAccess = useCallback((slug) => {
        if (!slug) return;
        setOrgTokens((current) => {
            const next = { ...current };
            delete next[slug];
            return next;
        });
    }, []);

    const impersonateOrg = useCallback(async (slug) => {
        if (!slug) throw new Error("No organisation selected");
        const res = await api.adminImpersonateOrg(slug);
        setOrgTokens((current) => ({ ...current, [slug]: res?.token || "" }));
        setActiveOrgSlug(slug);
        setImpersonatingOrgSlug(slug);
        setRoleState("org");
        return res;
    }, []);

    const stopImpersonation = useCallback(() => {
        const slug = impersonatingOrgSlug;
        setImpersonatingOrgSlug("");
        if (slug) {
            setOrgTokens((current) => {
                const next = { ...current };
                delete next[slug];
                return next;
            });
        }
        setRoleState("admin");
    }, [impersonatingOrgSlug]);

    const startDemo = useCallback((roleHint = "guest") => {
        setDemoRole(roleHint);
        setDemoStepIndex(0);
        setDemoActive(true);
    }, []);

    const stopDemo = useCallback(() => {
        setDemoActive(false);
        setDemoStepIndex(0);
    }, []);

    const nextDemoStep = useCallback((totalSteps = 1) => {
        const size = Math.max(1, Number(totalSteps) || 1);
        setDemoStepIndex((current) => (current + 1) % size);
    }, []);

    const prevDemoStep = useCallback((totalSteps = 1) => {
        const size = Math.max(1, Number(totalSteps) || 1);
        setDemoStepIndex((current) => (current - 1 + size) % size);
    }, []);

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

        const apiUnavailable =
            !orgsR.length &&
            !evR.length &&
            !feedR.length &&
            !vR.length &&
            !volR.length &&
            !Object.keys(sR || {}).length;

        if (apiUnavailable) {
            // Emergency read-only mode when backend is unreachable.
            setOrgs(SEED_ORGS);
            setEvents(SEED_EVENTS);
            setFeed(SEED_FEED);
            setVenues(SEED_VENUES);
            setVolunteerOpps(SEED_VOLS);
            setFollows({ orgs: [], categories: [] });
            setStats((prev) => ({
                ...prev,
                subscribers: 0,
                events_total: SEED_EVENTS.length,
                orgs_total: SEED_ORGS.length,
                events_pending: SEED_EVENTS.filter((item) => item.status === "pending").length,
                orgs_pending: SEED_ORGS.filter((item) => item.status === "pending").length,
                messages_unread: 0,
            }));
            return;
        }

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

    // ─────────── Saved events (resident shortlist) ───────────
    const isEventSaved = useCallback((eventId) => savedEventIds.includes(eventId), [savedEventIds]);

    const toggleSaveEvent = useCallback((eventId) => {
        let savedNow = false;
        setSavedEventIds((current) => {
            if (current.includes(eventId)) {
                savedNow = false;
                return current.filter((id) => id !== eventId);
            }
            savedNow = true;
            return [eventId, ...current];
        });
        return savedNow;
    }, []);

    // ─────────── Mutations ───────────
    const addEvent = async (evt) => {
        const created = await api.createEvent({ ...evt, status: "pending" });
        setEvents((prev) => [created, ...prev]);
        return created;
    };
    const updateEvent = async (id, patch, orgSlugForAuth = "") => {
        const updated = await api.updateEvent(id, patch, orgSlugForAuth);
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
            adminUnlocked, adminCodeSession, unlockAdmin, loginAdmin, lockAdmin,
            orgs, events, feed, venues, volunteerOpps,
            follows, toggleFollowOrg, toggleFollowCategory, isFollowingOrg, isFollowingCategory,
            savedEventIds, isEventSaved, toggleSaveEvent,
            stats, refresh,
            notifPrefs, setNotifPrefs,
            activeOrgSlug, setActiveOrgSlug,
            orgTokens, hasOrgAccess, getOrgToken, unlockOrgAccess, clearOrgAccess,
            impersonatingOrgSlug, impersonateOrg, stopImpersonation,
            demoActive,
            demoRole,
            demoStepIndex,
            startDemo,
            stopDemo,
            nextDemoStep,
            prevDemoStep,
            addEvent, updateEvent, setEventStatus, toggleEventFeatured, deleteEvent,
            addOrg, patchOrg, setOrgStatus, deleteOrg,
            addFeedPost,
            deviceId: getDeviceId(),
        }),
        [
            ready,
            theme,
            role,
            adminUnlocked,
            adminCodeSession,
            unlockAdmin,
            loginAdmin,
            lockAdmin,
            orgs,
            events,
            feed,
            venues,
            volunteerOpps,
            follows,
            savedEventIds,
            isEventSaved,
            toggleSaveEvent,
            stats,
            notifPrefs,
            activeOrgSlug,
            orgTokens,
            hasOrgAccess,
            getOrgToken,
            unlockOrgAccess,
            clearOrgAccess,
            impersonatingOrgSlug,
            impersonateOrg,
            stopImpersonation,
            demoActive,
            demoRole,
            demoStepIndex,
            startDemo,
            stopDemo,
            nextDemoStep,
            prevDemoStep,
            refresh,
        ],
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
