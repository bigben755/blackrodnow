import React from "react";
import "@/App.css";
import "@/index.css";
import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
    useLocation,
} from "react-router-dom";
import { Toaster } from "sonner";
import { AppProvider, useApp } from "@/context/AppContext";
import Layout from "@/components/Layout";
import ComingSoon from "@/pages/ComingSoon";

import Home from "@/pages/Home";
import Events from "@/pages/Events";
import SavedEvents from "@/pages/SavedEvents";
import EventDetail from "@/pages/EventDetail";
import Organisations from "@/pages/Organisations";
import OrganisationDetail from "@/pages/OrganisationDetail";
import SubmitEvent from "@/pages/SubmitEvent";
import SubmitEventsList from "@/pages/SubmitEventsList";
import AddOrganisation from "@/pages/AddOrganisation";
import AdminLive from "@/pages/AdminLive";
import InviteOrgs from "@/pages/InviteOrgs";
import OrgDashboard from "@/pages/OrgDashboard";
import LocalFeed from "@/pages/LocalFeed";
import Venues from "@/pages/Venues";
import Volunteering from "@/pages/Volunteering";
import Notifications from "@/pages/Notifications";
import FAQ from "@/pages/FAQ";
import Contact from "@/pages/Contact";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import Preferences from "@/pages/Preferences";
import Unsubscribe from "@/pages/Unsubscribe";
import OrgProfileEdit from "@/pages/OrgProfileEdit";
import Impact from "@/pages/Impact";
import EventEdit from "@/pages/EventEdit";
import Flyers from "@/pages/Flyers";
import AdminEvents from "@/pages/AdminEvents";
import MemberRedeem from "@/pages/MemberRedeem";
import MemberLogin from "@/pages/MemberLogin";
import OrgMemberLogin from "@/pages/OrgMemberLogin";
import OrgMemberRedeem from "@/pages/OrgMemberRedeem";

/**
 * Forces every React Router navigation to start at the very top of the page.
 *
 * This deliberately handles:
 * - normal route changes
 * - event-to-event navigation
 * - query-string changes
 * - hash changes
 * - navigating to the same pathname again
 * - browser scroll restoration trying to restore an old position
 * - late layout/render changes immediately after navigation
 */
function ScrollToTop() {
    const location = useLocation();

    React.useEffect(() => {
        if (!("scrollRestoration" in window.history)) {
            return undefined;
        }

        const previous = window.history.scrollRestoration;
        window.history.scrollRestoration = "manual";

        return () => {
            window.history.scrollRestoration = previous;
        };
    }, []);

    React.useLayoutEffect(() => {
        const scrollToTop = () => {
            window.scrollTo({
                top: 0,
                left: 0,
                behavior: "auto",
            });

            // Extra fallback for browsers/environments where the scrolling
            // element is documentElement or body rather than window.
            if (document.documentElement) {
                document.documentElement.scrollTop = 0;
                document.documentElement.scrollLeft = 0;
            }

            if (document.body) {
                document.body.scrollTop = 0;
                document.body.scrollLeft = 0;
            }
        };

        // Scroll immediately before the browser paints the new route.
        scrollToTop();

        // Repeat after React/browser layout has settled. This prevents
        // images, route transitions or browser restoration from putting
        // the page back at the previous scroll position.
        const animationFrame = window.requestAnimationFrame(() => {
            scrollToTop();
        });

        const shortTimer = window.setTimeout(() => {
            scrollToTop();
        }, 50);

        const finalTimer = window.setTimeout(() => {
            scrollToTop();
        }, 150);

        return () => {
            window.cancelAnimationFrame(animationFrame);
            window.clearTimeout(shortTimer);
            window.clearTimeout(finalTimer);
        };
    }, [
        location.pathname,
        location.search,
        location.hash,
        location.key,
    ]);

    return null;
}

function RequireRole({ allowed, children }) {
    const { role } = useApp();

    if (!allowed.includes(role)) {
        return <Navigate to="/" replace />;
    }

    return children;
}

// Public visitors see the branded Coming Soon page.
// Site admins + org admins (logged-in users with a real role) get the full site
// so they can preview, populate and edit content ahead of launch.
function ComingSoonGate({ children }) {
    const {
        siteSettings,
        role,
        hasOrgAccess,
        activeOrgSlug,
    } = useApp();

    const bypassEnv =
        String(
            process.env.REACT_APP_COMING_SOON_BYPASS || ""
        ).toLowerCase() === "true";

    const hasAnyOrgAccess = React.useMemo(() => {
        try {
            const raw = localStorage.getItem("rn-org-tokens");
            const parsed = raw ? JSON.parse(raw) : {};

            return (
                parsed &&
                typeof parsed === "object" &&
                Object.keys(parsed).length > 0
            );
        } catch {
            return false;
        }
    }, []);

    const authed =
        role === "admin" ||
        role === "org" ||
        hasOrgAccess?.(activeOrgSlug) ||
        hasAnyOrgAccess;

    if (
        siteSettings?.coming_soon &&
        !authed &&
        !bypassEnv
    ) {
        return <ComingSoon />;
    }

    return children;
}

export default function App() {
    return (
        <AppProvider>
            <BrowserRouter>
                <ScrollToTop />

                <ComingSoonGate>
                    <Layout>
                        <Routes>
                            <Route
                                path="/"
                                element={<Home />}
                            />

                            <Route
                                path="/events"
                                element={<Events />}
                            />

                            <Route
                                path="/saved-events"
                                element={<SavedEvents />}
                            />

                            <Route
                                path="/events/:id"
                                element={<EventDetail />}
                            />

                            <Route
                                path="/organisations"
                                element={<Organisations />}
                            />

                            <Route
                                path="/organisations/:slug"
                                element={<OrganisationDetail />}
                            />

                            <Route
                                path="/submit-event"
                                element={<SubmitEvent />}
                            />

                            <Route
                                path="/submit-events-list"
                                element={<SubmitEventsList />}
                            />

                            <Route
                                path="/edit-event/:id"
                                element={
                                    <RequireRole
                                        allowed={[
                                            "admin",
                                            "org",
                                        ]}
                                    >
                                        <EventEdit />
                                    </RequireRole>
                                }
                            />

                            <Route
                                path="/add-organisation"
                                element={<AddOrganisation />}
                            />

                            <Route
                                path="/local-feed"
                                element={<LocalFeed />}
                            />

                            <Route
                                path="/venues"
                                element={<Venues />}
                            />

                            <Route
                                path="/volunteering"
                                element={<Volunteering />}
                            />

                            <Route
                                path="/notifications"
                                element={<Notifications />}
                            />

                            <Route
                                path="/admin"
                                element={
                                    <RequireRole
                                        allowed={["admin"]}
                                    >
                                        <AdminLive />
                                    </RequireRole>
                                }
                            />

                            <Route
                                path="/admin/invite-organisations"
                                element={
                                    <RequireRole
                                        allowed={["admin"]}
                                    >
                                        <InviteOrgs />
                                    </RequireRole>
                                }
                            />

                            <Route
                                path="/admin/impact"
                                element={
                                    <RequireRole
                                        allowed={["admin"]}
                                    >
                                        <Impact />
                                    </RequireRole>
                                }
                            />

                            <Route
                                path="/admin/flyers"
                                element={
                                    <RequireRole
                                        allowed={["admin"]}
                                    >
                                        <Flyers />
                                    </RequireRole>
                                }
                            />

                            <Route
                                path="/admin/events"
                                element={
                                    <RequireRole
                                        allowed={["admin"]}
                                    >
                                        <AdminEvents />
                                    </RequireRole>
                                }
                            />

                            <Route
                                path="/organisation-dashboard"
                                element={
                                    <RequireRole
                                        allowed={[
                                            "admin",
                                            "org",
                                        ]}
                                    >
                                        <OrgDashboard />
                                    </RequireRole>
                                }
                            />

                            <Route
                                path="/member/redeem"
                                element={<MemberRedeem />}
                            />

                            <Route
                                path="/member/login"
                                element={<MemberLogin />}
                            />

                            <Route
                                path="/faq"
                                element={<FAQ />}
                            />

                            <Route
                                path="/help"
                                element={<FAQ />}
                            />

                            <Route
                                path="/contact"
                                element={<Contact />}
                            />

                            <Route
                                path="/privacy"
                                element={<Privacy />}
                            />

                            <Route
                                path="/terms"
                                element={<Terms />}
                            />

                            <Route
                                path="/preferences/:token"
                                element={<Preferences />}
                            />

                            <Route
                                path="/unsubscribe/:token"
                                element={<Unsubscribe />}
                            />

                            <Route
                                path="/edit-organisation/:slug"
                                element={
                                    <RequireRole
                                        allowed={[
                                            "admin",
                                            "org",
                                        ]}
                                    >
                                        <OrgProfileEdit />
                                    </RequireRole>
                                }
                            />

                            <Route
                                path="/organisation/member/login"
                                element={<OrgMemberLogin />}
                            />
                            <Route
                                path="/organisation/member/redeem"
                                element={<OrgMemberRedeem />}
                            />

                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </Layout>
                </ComingSoonGate>

                <Toaster
                    richColors
                    closeButton
                    position="top-right"
                />
            </BrowserRouter>
        </AppProvider>
    );
}