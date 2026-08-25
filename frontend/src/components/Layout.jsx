import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import DemoTour from "@/components/DemoTour";
import { api } from "@/lib/api";
import {
    Moon,
    Sun,
    Menu,
    X,
    MapPin,
    Heart,
    Building2,
    CalendarPlus,
    LogIn,
    UserPlus,
    Users,
    ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

const LAUNCH_NOTICE_KEY = "blackrod-now-launch-notice-v1";
const LAUNCH_NOTICE_DISMISS_DAYS = 30;

const ADMIN_LAUNCH_CODE = (
    process.env.REACT_APP_ADMIN_LAUNCH_CODE || ""
).trim();

const NAV = [
    {
        to: "/events",
        label: "What's On",
        testId: "events",
    },
    {
        to: "/organisations",
        label: "Local Directory",
        testId: "organisations",
    },
    {
        to: "/local-feed",
        label: "Community Updates",
        testId: "local-feed",
    },
    {
        to: "/volunteering",
        label: "Volunteering",
        testId: "volunteering",
    },
];

export const Brand = ({ size = "default" }) => (
    <Link
        to="/"
        data-testid="brand-link"
        className="flex items-center gap-2 group shrink-0"
    >
        <img
            src="/logo.png"
            alt="Blackrod Now"
            className={`${
                size === "lg" ? "h-12 w-12" : "h-10 w-10"
            } object-contain group-hover:rotate-[-6deg] transition-transform duration-300`}
        />

        <span
            className={`font-display font-black tracking-tight text-foreground leading-none ${
                size === "lg" ? "text-2xl" : "text-xl"
            }`}
        >
            Blackrod<span className="text-primary"> Now</span>
        </span>
    </Link>
);

function LaunchNotice() {
    const { role } = useApp();
    const location = useLocation();
    const [open, setOpen] = useState(false);

    const isManagementArea =
        location.pathname.startsWith("/admin") ||
        location.pathname.startsWith("/organisation-dashboard") ||
        location.pathname.startsWith("/edit-organisation") ||
        location.pathname.startsWith("/edit-event");

    useEffect(() => {
        if (role !== "guest" || isManagementArea) {
            setOpen(false);
            return undefined;
        }

        let dismissedRecently = false;

        try {
            const stored = localStorage.getItem(LAUNCH_NOTICE_KEY);

            if (stored) {
                const parsed = JSON.parse(stored);
                const dismissedAt = Number(parsed?.dismissedAt || 0);
                const maxAge =
                    LAUNCH_NOTICE_DISMISS_DAYS * 24 * 60 * 60 * 1000;

                dismissedRecently =
                    dismissedAt > 0 && Date.now() - dismissedAt < maxAge;
            }
        } catch {
            dismissedRecently = false;
        }

        if (dismissedRecently) {
            setOpen(false);
            return undefined;
        }

        const timer = window.setTimeout(() => {
            setOpen(true);
        }, 650);

        return () => window.clearTimeout(timer);
    }, [role, isManagementArea]);

    useEffect(() => {
        if (!open) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                dismissNotice();
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [open]);

    const dismissNotice = () => {
        try {
            localStorage.setItem(
                LAUNCH_NOTICE_KEY,
                JSON.stringify({ dismissedAt: Date.now() })
            );
        } catch {
            // If localStorage is unavailable, simply close the notice.
        }

        setOpen(false);
    };

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[250] flex items-center justify-center p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="launch-notice-title"
        >
            <button
                type="button"
                className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
                onClick={dismissNotice}
                aria-label="Close welcome message"
            />

            <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-border bg-background shadow-2xl">
                <div className="absolute inset-x-0 top-0 h-1.5 bg-primary" />

                <button
                    type="button"
                    onClick={dismissNotice}
                    className="absolute right-4 top-4 z-10 h-9 w-9 grid place-items-center rounded-full border border-border bg-background/90 text-muted-foreground hover:text-foreground hover:bg-muted transition"
                    aria-label="Close welcome message"
                >
                    <X className="h-4 w-4" />
                </button>

                <div className="p-6 sm:p-8">
                    <div className="flex items-start gap-4 pr-10">
                        <img
                            src="/logo.png"
                            alt=""
                            className="h-14 w-14 sm:h-16 sm:w-16 object-contain shrink-0"
                        />

                        <div>
                            <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                                New community platform
                            </div>

                            <h2
                                id="launch-notice-title"
                                className="mt-3 font-display text-2xl sm:text-3xl font-black tracking-tight text-foreground"
                            >
                                Welcome to Blackrod Now
                            </h2>

                            <p className="mt-2 text-sm sm:text-base text-muted-foreground leading-relaxed">
                                One place to discover local events, organisations,
                                groups and community updates across Blackrod.
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 rounded-3xl border border-border bg-muted/35 p-4 sm:p-5">
                        <p className="text-sm sm:text-base leading-relaxed text-foreground/90">
                            Blackrod Now has just launched. During this early
                            stage, some listings may occasionally be incomplete,
                            out of date or change at short notice.
                        </p>

                        <p className="mt-3 text-sm sm:text-base leading-relaxed text-foreground/90">
                            We are inviting local organisations to claim and
                            manage their own profiles. As more organisations do
                            this, the information on Blackrod Now will become
                            increasingly accurate and useful for everyone.
                        </p>
                    </div>

                    <p className="mt-5 text-sm text-muted-foreground leading-relaxed">
                        Please explore the site, share Blackrod Now with others
                        and help us build a stronger community resource. For
                        important event details, we recommend checking with the
                        organiser before travelling.
                    </p>

                    <div className="mt-6 flex flex-col sm:flex-row gap-3">
                        <button
                            type="button"
                            onClick={dismissNotice}
                            className="inline-flex flex-1 items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition"
                        >
                            Explore Blackrod Now
                        </button>

                        <Link
                            to="/organisations"
                            onClick={dismissNotice}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-bold text-foreground hover:bg-muted transition"
                        >
                            <Building2 className="h-4 w-4" />
                            Find your organisation
                        </Link>
                    </div>

                    <div className="mt-4 text-center text-xs sm:text-sm text-muted-foreground">
                        Spot something that needs updating?{" "}
                        <Link
                            to="/contact"
                            onClick={dismissNotice}
                            className="font-semibold text-primary hover:underline"
                        >
                            Let us know
                        </Link>
                        .
                    </div>
                </div>
            </div>
        </div>
    );
}

function AdminSignInDialog({ open, onOpenChange }) {
    const { unlockAdmin, loginAdmin } = useApp();

    const [adminEmailInput, setAdminEmailInput] = useState("");
    const [adminPasswordInput, setAdminPasswordInput] = useState("");
    const [adminLoginBusy, setAdminLoginBusy] = useState(false);

    const submitAdminLogin = async () => {
        const email = (adminEmailInput || "").trim();
        const password = adminPasswordInput || "";

        // Legacy development/fallback route retained for compatibility.
        // This should not be relied upon as the production authentication method.
        if (
            !email &&
            ADMIN_LAUNCH_CODE &&
            password.trim() === ADMIN_LAUNCH_CODE
        ) {
            unlockAdmin(password.trim());
            setAdminEmailInput("");
            setAdminPasswordInput("");
            onOpenChange(false);
            toast.success("Admin mode unlocked");
            return;
        }

        if (!email || !password) {
            toast.error("Enter admin email and password");
            return;
        }

        setAdminLoginBusy(true);

        try {
            await loginAdmin(email, password);

            setAdminEmailInput("");
            setAdminPasswordInput("");
            onOpenChange(false);

            toast.success("Signed in as admin");
        } catch (error) {
            const detail = error?.response?.data?.detail;

            toast.error(
                typeof detail === "string" ? detail : "Login failed"
            );
        } finally {
            setAdminLoginBusy(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="sm:max-w-md"
                data-testid="admin-login-dialog"
            >
                <DialogHeader>
                    <DialogTitle>Admin sign in</DialogTitle>

                    <DialogDescription>
                        Sign in with your Blackrod Now admin email and password.
                        Access lasts 12 hours.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <label className="text-sm block">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Email
                        </span>

                        <input
                            type="email"
                            autoComplete="username"
                            data-testid="admin-email-input"
                            value={adminEmailInput}
                            onChange={(e) =>
                                setAdminEmailInput(e.target.value)
                            }
                            className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background text-base sm:text-sm"
                        />
                    </label>

                    <label className="text-sm block">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Password
                        </span>

                        <input
                            type="password"
                            autoComplete="current-password"
                            data-testid="admin-password-input"
                            value={adminPasswordInput}
                            onChange={(e) =>
                                setAdminPasswordInput(e.target.value)
                            }
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    submitAdminLogin();
                                }
                            }}
                            className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background text-base sm:text-sm"
                        />
                    </label>
                </div>

                <DialogFooter className="gap-2">
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="px-4 py-2 rounded-full border border-border text-sm font-semibold"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        disabled={adminLoginBusy}
                        data-testid="admin-login-submit"
                        onClick={submitAdminLogin}
                        className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
                    >
                        {adminLoginBusy ? "Signing in…" : "Sign in"}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Navbar() {
    const {
        theme,
        toggleTheme,
        role,
        setRole,
        adminUnlocked,
        lockAdmin,
        orgs,
        unlockOrgAccess,
        setActiveOrgSlug,
        savedEventIds,
    } = useApp();

    const [open, setOpen] = useState(false);

    const [orgLoginOpen, setOrgLoginOpen] = useState(false);
    const [orgLoginBusy, setOrgLoginBusy] = useState(false);
    const [orgSlugInput, setOrgSlugInput] = useState("");
    const [orgPasswordInput, setOrgPasswordInput] = useState("");

    const location = useLocation();
    const navigate = useNavigate();

    const savedCount = Array.isArray(savedEventIds)
        ? savedEventIds.length
        : 0;

    useEffect(() => {
        if (!orgSlugInput && orgs.length) {
            setOrgSlugInput(orgs[0].slug);
        }
    }, [orgs, orgSlugInput]);

    useEffect(() => {
        setOpen(false);
    }, [location.pathname]);

    const submitOrgLogin = async () => {
        if (!orgSlugInput) {
            toast.error("Select an organisation");
            return;
        }

        if (!orgPasswordInput.trim()) {
            toast.error("Enter organisation password");
            return;
        }

        setOrgLoginBusy(true);

        try {
            const result = await api.loginOrgAccess(orgSlugInput, {
                password: orgPasswordInput.trim(),
            });

            unlockOrgAccess(
                orgSlugInput,
                result?.token || ""
            );

            setActiveOrgSlug(orgSlugInput);
            setRole("org");

            setOrgPasswordInput("");
            setOrgLoginOpen(false);

            toast.success("Organisation access granted");

            navigate("/organisation-dashboard");
        } catch (error) {
            toast.error(
                error?.response?.data?.detail ||
                    "Organisation login failed"
            );
        } finally {
            setOrgLoginBusy(false);
        }
    };

    return (
        <>
            <header
                data-testid="site-header"
                className="sticky top-0 z-[100] w-full border-b border-border/60 bg-background/90 backdrop-blur-xl"
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-7 min-w-0">
                        <Brand />

                        <nav
                            className="hidden lg:flex items-center gap-1"
                            aria-label="Main navigation"
                        >
                            {NAV.map((n) => (
                                <NavLink
                                    key={n.to}
                                    to={n.to}
                                    data-testid={`nav-${n.testId}`}
                                    className={({ isActive }) =>
                                        `px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                                            isActive
                                                ? "bg-foreground text-background"
                                                : "text-foreground/70 hover:text-foreground hover:bg-muted"
                                        }`
                                    }
                                >
                                    {n.label}
                                </NavLink>
                            ))}
                        </nav>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        <Link
                            to="/saved-events"
                            data-testid="nav-saved"
                            className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-semibold text-foreground/75 hover:text-foreground hover:bg-muted transition"
                        >
                            <Heart className="h-4 w-4" />

                            <span>Saved</span>

                            {savedCount > 0 && (
                                <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center">
                                    {savedCount > 99
                                        ? "99+"
                                        : savedCount}
                                </span>
                            )}
                        </Link>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    data-testid="nav-for-organisations"
                                    variant="outline"
                                    size="sm"
                                    className="hidden md:inline-flex rounded-full gap-1.5 font-semibold border-foreground/20"
                                >
                                    <Building2 className="h-4 w-4" />

                                    For organisations

                                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                                </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent
                                align="end"
                                className="w-72 rounded-2xl p-2"
                            >
                                <DropdownMenuLabel className="px-3 py-2">
                                    <div className="font-display font-bold text-base text-foreground">
                                        For organisations
                                    </div>

                                    <div className="font-normal text-xs text-muted-foreground mt-1 leading-relaxed">
                                        Manage your presence or add something
                                        to Blackrod Now.
                                    </div>
                                </DropdownMenuLabel>

                                <DropdownMenuSeparator />

                                <DropdownMenuItem
                                    onSelect={(e) => {
                                        e.preventDefault();
                                        setOrgLoginOpen(true);
                                    }}
                                    className="rounded-xl cursor-pointer"
                                >
                                    <LogIn className="h-4 w-4 mr-2" />

                                    <div className="flex flex-col">
                                        <span className="font-medium">
                                            Manage your organisation
                                        </span>

                                        <span className="text-[11px] text-muted-foreground">
                                            Sign in to your dashboard
                                        </span>
                                    </div>
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                    asChild
                                    className="rounded-xl cursor-pointer"
                                >
                                    <Link to="/submit-event">
                                        <CalendarPlus className="h-4 w-4 mr-2" />

                                        <div className="flex flex-col">
                                            <span className="font-medium">
                                                Add an event
                                            </span>

                                            <span className="text-[11px] text-muted-foreground">
                                                Tell Blackrod what's happening
                                            </span>
                                        </div>
                                    </Link>
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                    asChild
                                    className="rounded-xl cursor-pointer"
                                >
                                    <Link to="/add-organisation">
                                        <UserPlus className="h-4 w-4 mr-2" />

                                        <div className="flex flex-col">
                                            <span className="font-medium">
                                                Add your organisation
                                            </span>

                                            <span className="text-[11px] text-muted-foreground">
                                                Create a free local listing
                                            </span>
                                        </div>
                                    </Link>
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />

                                <DropdownMenuItem
                                    asChild
                                    className="rounded-xl cursor-pointer"
                                >
                                    <Link to="/organisation/member/login">
                                        <Users className="h-4 w-4 mr-2" />
                                        Member login or invite
                                    </Link>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {adminUnlocked && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        data-testid="role-switcher"
                                        variant="ghost"
                                        size="sm"
                                        className="hidden sm:inline-flex rounded-full text-xs font-bold uppercase tracking-wider"
                                    >
                                        {role === "guest"
                                            ? "Resident"
                                            : role === "org"
                                            ? "Organisation"
                                            : "Site Admin"}
                                    </Button>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent
                                    align="end"
                                    className="rounded-2xl w-64"
                                >
                                    <DropdownMenuLabel>
                                        View site as
                                    </DropdownMenuLabel>

                                    <DropdownMenuSeparator />

                                    <DropdownMenuItem
                                        data-testid="role-guest"
                                        onClick={() => setRole("guest")}
                                    >
                                        <div className="flex flex-col gap-0.5">
                                            <span>Resident</span>

                                            <span className="text-[11px] text-muted-foreground">
                                                Public browsing experience.
                                            </span>
                                        </div>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                        data-testid="role-org"
                                        onClick={() => setRole("org")}
                                    >
                                        <div className="flex flex-col gap-0.5">
                                            <span>Organisation</span>

                                            <span className="text-[11px] text-muted-foreground">
                                                Organisation tools and
                                                dashboard.
                                            </span>
                                        </div>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                        data-testid="role-admin"
                                        onClick={() => setRole("admin")}
                                    >
                                        <div className="flex flex-col gap-0.5">
                                            <span>Site Admin</span>

                                            <span className="text-[11px] text-muted-foreground">
                                                Moderation and publishing
                                                tools.
                                            </span>
                                        </div>
                                    </DropdownMenuItem>

                                    <DropdownMenuSeparator />

                                    <DropdownMenuItem asChild>
                                        <Link
                                            to="/admin"
                                            data-testid="goto-admin"
                                        >
                                            Admin dashboard
                                        </Link>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem asChild>
                                        <Link
                                            to="/organisation-dashboard"
                                            data-testid="goto-org-dashboard"
                                        >
                                            Organisation dashboard
                                        </Link>
                                    </DropdownMenuItem>

                                    <DropdownMenuSeparator />

                                    <DropdownMenuItem
                                        data-testid="admin-logout"
                                        onClick={() => {
                                            lockAdmin();
                                            toast.success(
                                                "Returned to resident mode"
                                            );
                                        }}
                                    >
                                        Exit admin mode
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        <button
                            data-testid="theme-toggle"
                            onClick={toggleTheme}
                            className="h-9 w-9 grid place-items-center rounded-full border border-border bg-surface hover:bg-muted transition"
                            aria-label={
                                theme === "dark"
                                    ? "Switch to light mode"
                                    : "Switch to dark mode"
                            }
                        >
                            {theme === "dark" ? (
                                <Sun className="h-4 w-4" />
                            ) : (
                                <Moon className="h-4 w-4" />
                            )}
                        </button>

                        <button
                            data-testid="mobile-menu-toggle"
                            className="lg:hidden h-9 w-9 grid place-items-center rounded-full border border-border bg-surface hover:bg-muted transition"
                            onClick={() => setOpen((o) => !o)}
                            aria-label={
                                open
                                    ? "Close navigation menu"
                                    : "Open navigation menu"
                            }
                            aria-expanded={open}
                        >
                            {open ? (
                                <X className="h-4 w-4" />
                            ) : (
                                <Menu className="h-4 w-4" />
                            )}
                        </button>
                    </div>
                </div>

                {open && (
                    <div
                        data-testid="mobile-menu"
                        className="lg:hidden border-t border-border bg-background"
                    >
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                            <nav
                                className="space-y-1"
                                aria-label="Mobile navigation"
                            >
                                {NAV.map((n) => (
                                    <NavLink
                                        key={n.to}
                                        to={n.to}
                                        onClick={() =>
                                            setOpen(false)
                                        }
                                        data-testid={`mobile-nav-${n.testId}`}
                                        className={({ isActive }) =>
                                            `block px-4 py-3 rounded-2xl text-sm font-semibold ${
                                                isActive
                                                    ? "bg-foreground text-background"
                                                    : "text-foreground/80 hover:bg-muted"
                                            }`
                                        }
                                    >
                                        {n.label}
                                    </NavLink>
                                ))}

                                <NavLink
                                    to="/saved-events"
                                    onClick={() => setOpen(false)}
                                    data-testid="mobile-nav-saved"
                                    className={({ isActive }) =>
                                        `flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-semibold ${
                                            isActive
                                                ? "bg-foreground text-background"
                                                : "text-foreground/80 hover:bg-muted"
                                        }`
                                    }
                                >
                                    <span className="inline-flex items-center gap-2">
                                        <Heart className="h-4 w-4" />
                                        Saved events
                                    </span>

                                    {savedCount > 0 && (
                                        <span className="min-w-6 h-6 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center">
                                            {savedCount > 99
                                                ? "99+"
                                                : savedCount}
                                        </span>
                                    )}
                                </NavLink>
                            </nav>

                            <div className="my-4 border-t border-border" />

                            <div className="rounded-3xl border border-border bg-surface p-4">
                                <div className="flex items-start gap-3">
                                    <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                                        <Building2 className="h-5 w-5 text-primary" />
                                    </div>

                                    <div>
                                        <h3 className="font-display font-bold text-base">
                                            For organisations
                                        </h3>

                                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                            Manage your page, publish events
                                            or get your organisation listed.
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setOpen(false);
                                        setOrgLoginOpen(true);
                                    }}
                                    className="mt-4 w-full px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
                                >
                                    Manage your organisation
                                </button>

                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <Link
                                        to="/submit-event"
                                        onClick={() =>
                                            setOpen(false)
                                        }
                                        className="text-center px-3 py-2.5 rounded-full border border-border text-sm font-semibold hover:bg-muted transition"
                                    >
                                        Add event
                                    </Link>

                                    <Link
                                        to="/add-organisation"
                                        onClick={() =>
                                            setOpen(false)
                                        }
                                        className="text-center px-3 py-2.5 rounded-full border border-border text-sm font-semibold hover:bg-muted transition"
                                    >
                                        Get listed
                                    </Link>
                                </div>

                                <Link
                                    to="/organisation/member/login"
                                    onClick={() =>
                                        setOpen(false)
                                    }
                                    className="mt-3 block text-center text-xs font-semibold text-primary hover:underline"
                                >
                                    Organisation member login or invite
                                </Link>
                            </div>

                            {adminUnlocked && (
                                <div className="mt-3 rounded-2xl border border-border px-4 py-3">
                                    <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                                        Admin mode
                                    </div>

                                    <div className="flex gap-2 mt-2">
                                        <Link
                                            to="/admin"
                                            onClick={() =>
                                                setOpen(false)
                                            }
                                            className="flex-1 text-center px-3 py-2 rounded-full bg-foreground text-background text-sm font-semibold"
                                        >
                                            Admin
                                        </Link>

                                        <Link
                                            to="/organisation-dashboard"
                                            onClick={() =>
                                                setOpen(false)
                                            }
                                            className="flex-1 text-center px-3 py-2 rounded-full border border-border text-sm font-semibold"
                                        >
                                            Organisations
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </header>

            <Dialog
                open={orgLoginOpen}
                onOpenChange={setOrgLoginOpen}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            Manage your organisation
                        </DialogTitle>

                        <DialogDescription>
                            Choose your organisation and enter its password
                            to open the management dashboard.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <label className="text-sm block">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Organisation
                            </span>

                            <select
                                value={orgSlugInput}
                                onChange={(e) =>
                                    setOrgSlugInput(
                                        e.target.value
                                    )
                                }
                                className="mt-1 w-full px-3 py-2.5 rounded-2xl border border-border bg-background text-base sm:text-sm"
                            >
                                {orgs.map((o) => (
                                    <option
                                        key={o.slug}
                                        value={o.slug}
                                    >
                                        {o.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="text-sm block">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Organisation password
                            </span>

                            <input
                                type="password"
                                autoComplete="current-password"
                                value={orgPasswordInput}
                                onChange={(e) =>
                                    setOrgPasswordInput(
                                        e.target.value
                                    )
                                }
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        submitOrgLogin();
                                    }
                                }}
                                className="mt-1 w-full px-3 py-2.5 rounded-2xl border border-border bg-background text-base sm:text-sm"
                            />
                        </label>

                        <div className="rounded-2xl bg-muted/40 p-3 text-xs text-muted-foreground">
                            Are you an organisation member with an invitation?
                            Use the member login instead.
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Link
                            to="/organisation/member/login"
                            onClick={() =>
                                setOrgLoginOpen(false)
                            }
                            className="mr-auto text-xs font-semibold text-primary hover:underline"
                        >
                            Member login or invite
                        </Link>

                        <button
                            type="button"
                            onClick={() =>
                                setOrgLoginOpen(false)
                            }
                            className="px-4 py-2 rounded-full border border-border text-sm font-semibold"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            disabled={orgLoginBusy}
                            onClick={submitOrgLogin}
                            className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
                        >
                            {orgLoginBusy
                                ? "Signing in…"
                                : "Open dashboard"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function Footer({ onAdminLoginOpen }) {
    const [wizardOpen, setWizardOpen] = useState(false);
    const [wizardBusy, setWizardBusy] = useState(false);

    const [wizardForm, setWizardForm] = useState({
        name: "",
        email: "",
        business: "",
        service: "Website design and build",
        budget: "",
        timeline: "",
        details: "",
    });

    const submitWizardForm = async () => {
        if (
            !wizardForm.name ||
            !wizardForm.email ||
            !wizardForm.details
        ) {
            toast.error(
                "Please add your name, email and project details"
            );
            return;
        }

        setWizardBusy(true);

        try {
            await api.webWizardEnquiry({
                from_name: wizardForm.name,
                from_email: wizardForm.email,
                business: wizardForm.business,
                service: wizardForm.service,
                budget: wizardForm.budget,
                timeline: wizardForm.timeline,
                details: wizardForm.details,
            });

            toast.success(
                "Thanks, your Web Design Wizard enquiry has been sent"
            );

            setWizardOpen(false);

            setWizardForm({
                name: "",
                email: "",
                business: "",
                service: "Website design and build",
                budget: "",
                timeline: "",
                details: "",
            });
        } catch {
            toast.error(
                "Could not send your enquiry right now"
            );
        } finally {
            setWizardBusy(false);
        }
    };

    return (
        <footer
            data-testid="site-footer"
            className="mt-24 border-t border-border bg-surface"
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2 lg:col-span-2">
                    <Brand size="lg" />

                    <p className="mt-4 text-sm text-muted-foreground max-w-md leading-relaxed">
                        What's on, what's new, what's next.
                        Blackrod's community hub for local events,
                        groups, clubs, schools, businesses,
                        volunteering and community projects.
                    </p>

                    <div className="flex items-center gap-3 mt-4 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span className="text-sm">
                            Blackrod, Bolton
                        </span>
                    </div>
                </div>

                <div>
                    <div className="font-display font-bold text-sm uppercase tracking-wider mb-3">
                        Explore
                    </div>

                    <ul className="space-y-2.5 text-sm text-muted-foreground">
                        <li>
                            <Link
                                to="/events"
                                className="hover:text-foreground transition"
                            >
                                What's On
                            </Link>
                        </li>

                        <li>
                            <Link
                                to="/organisations"
                                className="hover:text-foreground transition"
                            >
                                Local Directory
                            </Link>
                        </li>

                        <li>
                            <Link
                                to="/local-feed"
                                className="hover:text-foreground transition"
                            >
                                Community Updates
                            </Link>
                        </li>

                        <li>
                            <Link
                                to="/volunteering"
                                className="hover:text-foreground transition"
                            >
                                Volunteering
                            </Link>
                        </li>

                        <li>
                            <Link
                                to="/venues"
                                className="hover:text-foreground transition"
                            >
                                Local venues
                            </Link>
                        </li>

                        <li>
                            <Link
                                to="/saved-events"
                                className="hover:text-foreground transition"
                            >
                                Saved events
                            </Link>
                        </li>
                    </ul>
                </div>

                <div>
                    <div className="font-display font-bold text-sm uppercase tracking-wider mb-3">
                        Get involved
                    </div>

                    <ul className="space-y-2.5 text-sm text-muted-foreground">
                        <li>
                            <Link
                                to="/submit-event"
                                className="hover:text-foreground transition"
                            >
                                Add an event
                            </Link>
                        </li>

                        <li>
                            <Link
                                to="/add-organisation"
                                className="hover:text-foreground transition"
                            >
                                Add your organisation
                            </Link>
                        </li>

                        <li>
                            <Link
                                to="/organisation/member/login"
                                className="hover:text-foreground transition"
                            >
                                Organisation member login
                            </Link>
                        </li>

                        <li>
                            <Link
                                to="/notifications"
                                className="hover:text-foreground transition"
                            >
                                Notification settings
                            </Link>
                        </li>

                        <li>
                            <Link
                                to="/faq"
                                className="hover:text-foreground transition"
                            >
                                Help & FAQs
                            </Link>
                        </li>

                        <li>
                            <Link
                                to="/contact"
                                className="hover:text-foreground transition"
                            >
                                Contact Blackrod Now
                            </Link>
                        </li>
                    </ul>
                </div>
            </div>

            <div className="border-t border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col lg:flex-row gap-5 lg:items-center lg:justify-between text-xs text-muted-foreground">
                    <div>
                        © {new Date().getFullYear()} Blackrod Now.
                        A community project.
                    </div>

                    <button
                        type="button"
                        onClick={() => setWizardOpen(true)}
                        className="inline-flex w-fit items-center gap-2 text-muted-foreground hover:text-foreground transition"
                        aria-label="Contact The Web Design Wizard"
                    >
                        <span>
                            Website by{" "}
                            <span className="font-semibold">
                                The Web Design Wizard
                            </span>
                        </span>

                        <img
                            src="/webwizard.png"
                            alt=""
                            className="h-8 w-auto object-contain"
                            loading="lazy"
                        />
                    </button>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <Link
                            to="/privacy"
                            className="hover:text-foreground transition"
                        >
                            Privacy
                        </Link>

                        <Link
                            to="/terms"
                            className="hover:text-foreground transition"
                        >
                            Terms
                        </Link>

                        <Link
                            to="/faq"
                            className="hover:text-foreground transition"
                        >
                            Help
                        </Link>

                        <button
                            type="button"
                            onClick={onAdminLoginOpen}
                            className="hover:text-foreground transition"
                        >
                            Site admin
                        </button>
                    </div>
                </div>
            </div>

            <Dialog
                open={wizardOpen}
                onOpenChange={setWizardOpen}
            >
                <DialogContent className="w-[calc(100vw-1.25rem)] sm:max-w-xl max-h-[88vh] overflow-y-auto p-4 sm:p-6">
                    <DialogHeader>
                        <DialogTitle>
                            The Web Design Wizard
                        </DialogTitle>

                        <DialogDescription>
                            Tell us what you need and we will follow
                            up with service options and a quote.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <div className="rounded-2xl border border-border bg-muted/30 p-3 text-sm">
                            <p className="font-semibold">
                                Web design and development services
                            </p>

                            <p className="text-muted-foreground mt-1">
                                Brand-led websites, UX improvements,
                                and full build support for local
                                organisations and businesses.
                            </p>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                            <label className="text-sm">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Name
                                </span>

                                <input
                                    value={wizardForm.name}
                                    onChange={(e) =>
                                        setWizardForm((prev) => ({
                                            ...prev,
                                            name: e.target.value,
                                        }))
                                    }
                                    className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background text-base sm:text-sm"
                                />
                            </label>

                            <label className="text-sm">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Email
                                </span>

                                <input
                                    type="email"
                                    value={wizardForm.email}
                                    onChange={(e) =>
                                        setWizardForm((prev) => ({
                                            ...prev,
                                            email: e.target.value,
                                        }))
                                    }
                                    className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background text-base sm:text-sm"
                                />
                            </label>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                            <label className="text-sm">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Business or organisation
                                </span>

                                <input
                                    value={wizardForm.business}
                                    onChange={(e) =>
                                        setWizardForm((prev) => ({
                                            ...prev,
                                            business:
                                                e.target.value,
                                        }))
                                    }
                                    className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background text-base sm:text-sm"
                                />
                            </label>

                            <label className="text-sm">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Service required
                                </span>

                                <select
                                    value={wizardForm.service}
                                    onChange={(e) =>
                                        setWizardForm((prev) => ({
                                            ...prev,
                                            service:
                                                e.target.value,
                                        }))
                                    }
                                    className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background text-base sm:text-sm"
                                >
                                    <option>
                                        Website design and build
                                    </option>

                                    <option>
                                        Website redesign
                                    </option>

                                    <option>
                                        Landing page and conversion
                                        optimisation
                                    </option>

                                    <option>
                                        Ongoing website support
                                    </option>

                                    <option>
                                        Branding and web strategy
                                    </option>
                                </select>
                            </label>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                            <label className="text-sm">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Budget range
                                </span>

                                <input
                                    value={wizardForm.budget}
                                    onChange={(e) =>
                                        setWizardForm((prev) => ({
                                            ...prev,
                                            budget:
                                                e.target.value,
                                        }))
                                    }
                                    placeholder="e.g. GBP2,000 to GBP5,000"
                                    className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background text-base sm:text-sm"
                                />
                            </label>

                            <label className="text-sm">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Timeline
                                </span>

                                <input
                                    value={wizardForm.timeline}
                                    onChange={(e) =>
                                        setWizardForm((prev) => ({
                                            ...prev,
                                            timeline:
                                                e.target.value,
                                        }))
                                    }
                                    placeholder="e.g. Launch in 6 weeks"
                                    className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background text-base sm:text-sm"
                                />
                            </label>
                        </div>

                        <label className="text-sm block">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Project details
                            </span>

                            <textarea
                                rows={5}
                                value={wizardForm.details}
                                onChange={(e) =>
                                    setWizardForm((prev) => ({
                                        ...prev,
                                        details:
                                            e.target.value,
                                    }))
                                }
                                placeholder="Tell us about goals, pages, functionality and style preferences"
                                className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background text-base sm:text-sm"
                            />
                        </label>
                    </div>

                    <DialogFooter className="mt-2 gap-2">
                        <button
                            type="button"
                            onClick={() =>
                                setWizardOpen(false)
                            }
                            className="px-4 py-2 rounded-full border border-border text-sm font-semibold"
                        >
                            Close
                        </button>

                        <button
                            type="button"
                            onClick={submitWizardForm}
                            disabled={wizardBusy}
                            className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
                        >
                            {wizardBusy
                                ? "Sending…"
                                : "Request quote"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </footer>
    );
}

export default function Layout({ children }) {
    const [adminLoginOpen, setAdminLoginOpen] =
        useState(false);

    return (
        <div className="min-h-screen flex flex-col bg-background text-foreground">
            <Navbar />

            <main className="flex-1">
                {children}
            </main>

            <Footer
                onAdminLoginOpen={() =>
                    setAdminLoginOpen(true)
                }
            />

            <LaunchNotice />

            <DemoTour />

            <AdminSignInDialog
                open={adminLoginOpen}
                onOpenChange={setAdminLoginOpen}
            />
        </div>
    );
}