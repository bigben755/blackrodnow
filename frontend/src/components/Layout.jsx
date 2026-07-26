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
    Mail,
    Sparkles,
    HelpCircle,
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

const ADMIN_LAUNCH_CODE = (process.env.REACT_APP_ADMIN_LAUNCH_CODE || "").trim();

const NAV = [
    { to: "/", label: "Home" },
    { to: "/events", label: "Events" },
    { to: "/saved-events", label: "Saved" },
    { to: "/organisations", label: "Organisations" },
    { to: "/local-feed", label: "Local Feed" },
    { to: "/volunteering", label: "Volunteering" },
    { to: "/venues", label: "Venues" },
    { to: "/contact", label: "Contact" },
];

export const Brand = ({ size = "default" }) => (
    <Link to="/" data-testid="brand-link" className="flex items-center gap-2 group">
        <img
            src="/logo.png"
            alt="Blackrod Now"
            className={`${size === "lg" ? "h-12 w-12" : "h-10 w-10"} object-contain group-hover:rotate-[-6deg] transition-transform duration-300`}
        />
        <span className="font-display font-black tracking-tight text-foreground text-xl leading-none">
            Blackrod<span className="text-primary"> Now</span>
        </span>
    </Link>
);

function Navbar() {
    const {
        theme,
        toggleTheme,
        role,
        setRole,
        adminUnlocked,
        unlockAdmin,
        loginAdmin,
        lockAdmin,
        orgs,
        unlockOrgAccess,
        setActiveOrgSlug,
    } = useApp();
    const [open, setOpen] = useState(false);
    const [adminLoginOpen, setAdminLoginOpen] = useState(false);
    const [adminEmailInput, setAdminEmailInput] = useState("");
    const [adminPasswordInput, setAdminPasswordInput] = useState("");
    const [adminLoginBusy, setAdminLoginBusy] = useState(false);
    const [orgLoginOpen, setOrgLoginOpen] = useState(false);
    const [orgLoginBusy, setOrgLoginBusy] = useState(false);
    const [orgSlugInput, setOrgSlugInput] = useState("");
    const [orgPasswordInput, setOrgPasswordInput] = useState("");
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        if (!orgSlugInput && orgs.length) setOrgSlugInput(orgs[0].slug);
    }, [orgs, orgSlugInput]);

    useEffect(() => {
        setOpen(false);
    }, [location.pathname]);

    const submitAdminLogin = async () => {
        const email = (adminEmailInput || "").trim();
        const password = adminPasswordInput || "";
        // Legacy: launch-code-only path (dev/fallback). If email is empty and
        // the password field contains the launch code, keep the old behaviour.
        if (!email && ADMIN_LAUNCH_CODE && password.trim() === ADMIN_LAUNCH_CODE) {
            unlockAdmin(password.trim());
            setAdminEmailInput("");
            setAdminPasswordInput("");
            setAdminLoginOpen(false);
            toast.success("Admin mode unlocked (legacy)");
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
            setAdminLoginOpen(false);
            toast.success("Signed in as admin");
        } catch (error) {
            const detail = error?.response?.data?.detail;
            toast.error(typeof detail === "string" ? detail : "Login failed");
        } finally {
            setAdminLoginBusy(false);
        }
    };

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
            const result = await api.loginOrgAccess(orgSlugInput, { password: orgPasswordInput.trim() });
            unlockOrgAccess(orgSlugInput, result?.token || "");
            setActiveOrgSlug(orgSlugInput);
            setRole("org");
            setOrgPasswordInput("");
            setOrgLoginOpen(false);
            toast.success("Organisation access granted");
            navigate("/organisation-dashboard");
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Organisation login failed");
        } finally {
            setOrgLoginBusy(false);
        }
    };

    return (
        <header
            data-testid="site-header"
            className="sticky top-0 z-[100] w-full backdrop-blur-xl bg-background/80 border-b border-border/60"
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <div className="flex items-center gap-8">
                    <Brand />

                    <nav className="hidden lg:flex items-center gap-1">
                        {NAV.map((n) => (
                            <NavLink
                                key={n.to}
                                to={n.to}
                                end={n.to === "/"}
                                data-testid={`nav-${n.label
                                    .toLowerCase()
                                    .replace(/\s+/g, "-")}`}
                                className={({ isActive }) =>
                                    `px-3 py-2 rounded-full text-sm font-medium transition-colors ${
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

                <div className="flex items-center gap-2">
                    <Link
                        to="/submit-event"
                        data-testid="nav-add-event"
                        className="hidden md:inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold bg-secondary text-secondary-foreground hover:scale-105 transition-transform shadow-sm shadow-secondary/30"
                    >
                        <Sparkles className="h-4 w-4" /> Add Event
                    </Link>

                    <Link
                        to="/add-organisation"
                        data-testid="nav-add-org"
                        className="hidden md:inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold border-2 border-foreground text-foreground hover:bg-foreground hover:text-background transition"
                    >
                        Add Organisation
                    </Link>

                    <Link
                        to="/faq"
                        data-testid="nav-help-centre-button"
                        className="hidden xl:inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold border border-border bg-surface text-foreground hover:bg-muted transition"
                    >
                        <HelpCircle className="h-4 w-4" />
                        Help
                    </Link>

                    {adminUnlocked ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    data-testid="role-switcher"
                                    variant="ghost"
                                    size="sm"
                                    className="rounded-full text-xs font-bold uppercase tracking-wider"
                                >
                                    {role === "guest"
                                        ? "Resident"
                                        : role === "org"
                                        ? "Organisation"
                                        : "Site Admin"}
                                </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="end" className="rounded-2xl">
                                <DropdownMenuLabel>Launch day role switcher</DropdownMenuLabel>
                                <DropdownMenuSeparator />

                                <DropdownMenuItem
                                    data-testid="role-guest"
                                    onClick={() => setRole("guest")}
                                >
                                    <div className="flex flex-col gap-0.5">
                                        <span>Resident</span>
                                        <span className="text-[11px] text-muted-foreground">
                                            Public browsing view seen by residents.
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
                                            Organisation tools and dashboard access.
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
                                            Full moderation and publishing tools.
                                        </span>
                                    </div>
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />

                                <DropdownMenuItem asChild>
                                    <Link to="/admin" data-testid="goto-admin">
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

                                <DropdownMenuItem
                                    data-testid="admin-logout"
                                    onClick={() => {
                                        lockAdmin();
                                        toast.success("Returned to resident mode");
                                    }}
                                >
                                    Exit admin mode
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <>
                            <Button
                                data-testid="org-login-open"
                                variant="ghost"
                                size="sm"
                                onClick={() => setOrgLoginOpen(true)}
                                className="rounded-full text-xs font-bold uppercase tracking-wider"
                            >
                                Org login
                            </Button>
                            <Button
                                data-testid="admin-login-open"
                                variant="ghost"
                                size="sm"
                                onClick={() => setAdminLoginOpen(true)}
                                className="rounded-full text-xs font-bold uppercase tracking-wider"
                            >
                                Admin login
                            </Button>
                        </>
                    )}

                    <button
                        data-testid="theme-toggle"
                        onClick={toggleTheme}
                        className="h-9 w-9 grid place-items-center rounded-full border border-border bg-surface hover:bg-muted transition"
                        aria-label="Toggle theme"
                    >
                        {theme === "dark" ? (
                            <Sun className="h-4 w-4" />
                        ) : (
                            <Moon className="h-4 w-4" />
                        )}
                    </button>

                    <button
                        data-testid="mobile-menu-toggle"
                        className="lg:hidden h-9 w-9 grid place-items-center rounded-full border border-border bg-surface"
                        onClick={() => setOpen((o) => !o)}
                        aria-label="Open menu"
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
                    className="lg:hidden border-t border-border bg-background px-4 py-3 space-y-1"
                >
                    {NAV.map((n) => (
                        <NavLink
                            key={n.to}
                            to={n.to}
                            end={n.to === "/"}
                            onClick={() => setOpen(false)}
                            data-testid={`mobile-nav-${n.label
                                .toLowerCase()
                                .replace(/\s+/g, "-")}`}
                            className={({ isActive }) =>
                                `block px-3 py-2 rounded-xl text-sm font-medium ${
                                    isActive
                                        ? "bg-foreground text-background"
                                        : "text-foreground/80"
                                }`
                            }
                        >
                            {n.label}
                        </NavLink>
                    ))}

                    <div className="flex gap-2 pt-2">
                        <Link
                            to="/submit-event"
                            onClick={() => setOpen(false)}
                            className="flex-1 text-center px-3 py-2 rounded-full text-sm font-semibold bg-secondary text-secondary-foreground"
                        >
                            Add Event
                        </Link>

                        <Link
                            to="/add-organisation"
                            onClick={() => setOpen(false)}
                            className="flex-1 text-center px-3 py-2 rounded-full text-sm font-semibold border-2 border-foreground"
                        >
                            Add Org
                        </Link>
                    </div>

                    {!adminUnlocked && (
                        <>
                            <button
                                type="button"
                                onClick={() => {
                                    setOpen(false);
                                    setOrgLoginOpen(true);
                                }}
                                className="w-full mt-2 px-3 py-2 rounded-full text-sm font-semibold border border-border"
                            >
                                Org login
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setOpen(false);
                                    setAdminLoginOpen(true);
                                }}
                                className="w-full mt-2 px-3 py-2 rounded-full text-sm font-semibold border border-border"
                            >
                                Admin login
                            </button>
                        </>
                    )}
                </div>
            )}

            {orgLoginOpen && (
                <Dialog open={orgLoginOpen} onOpenChange={setOrgLoginOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Organisation access</DialogTitle>
                            <DialogDescription>
                                Enter your organisation password to open your dashboard.
                            </DialogDescription>
                        </DialogHeader>

                        <label className="text-sm">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Organisation</span>
                            <select
                                value={orgSlugInput}
                                onChange={(e) => setOrgSlugInput(e.target.value)}
                                className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background"
                            >
                                {orgs.map((o) => (
                                    <option key={o.slug} value={o.slug}>{o.name}</option>
                                ))}
                            </select>
                        </label>

                        <label className="text-sm">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</span>
                            <input
                                type="password"
                                value={orgPasswordInput}
                                onChange={(e) => setOrgPasswordInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") submitOrgLogin();
                                }}
                                className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background"
                            />
                        </label>

                        <DialogFooter>
                            <button
                                type="button"
                                onClick={() => setOrgLoginOpen(false)}
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
                                Unlock
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {adminLoginOpen && (
                <Dialog open={adminLoginOpen} onOpenChange={setAdminLoginOpen}>
                    <DialogContent className="sm:max-w-md" data-testid="admin-login-dialog">
                        <DialogHeader>
                            <DialogTitle>Admin sign in</DialogTitle>
                            <DialogDescription>
                                Sign in with your admin email and password. Access lasts 12 hours.
                            </DialogDescription>
                        </DialogHeader>

                        <label className="text-sm block">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</span>
                            <input
                                type="email"
                                autoComplete="username"
                                data-testid="admin-email-input"
                                value={adminEmailInput}
                                onChange={(e) => setAdminEmailInput(e.target.value)}
                                className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background"
                            />
                        </label>

                        <label className="text-sm block mt-3">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</span>
                            <input
                                type="password"
                                autoComplete="current-password"
                                data-testid="admin-password-input"
                                value={adminPasswordInput}
                                onChange={(e) => setAdminPasswordInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") submitAdminLogin();
                                }}
                                className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background"
                            />
                        </label>

                        <DialogFooter>
                            <button
                                type="button"
                                onClick={() => setAdminLoginOpen(false)}
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
            )}
        </header>
    );
}

function Footer() {
    const { startDemo, role } = useApp();
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
        if (!wizardForm.name || !wizardForm.email || !wizardForm.details) {
            toast.error("Please add your name, email and project details");
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
            toast.success("Thanks, your Web Design Wizard enquiry has been sent");
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
            toast.error("Could not send your enquiry right now");
        } finally {
            setWizardBusy(false);
        }
    };

    return (
        <footer
            data-testid="site-footer"
            className="mt-24 border-t border-border bg-surface"
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid gap-10 grid-cols-2 md:grid-cols-4">
                <div className="col-span-2">
                    <Brand size="lg" />

                    <p className="mt-4 text-sm text-muted-foreground max-w-sm leading-relaxed">
                        What's on, what's new, what's next. Blackrod's community hub
                        for events, groups, clubs, schools, businesses and projects.
                    </p>

                    <div className="flex items-center gap-3 mt-4 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span className="text-sm">Blackrod, Bolton</span>
                    </div>
                </div>

                <div>
                    <div className="font-display font-bold text-sm uppercase tracking-wider mb-3">
                        Explore
                    </div>

                    <ul className="space-y-2 text-sm text-muted-foreground">
                        <li>
                            <Link to="/events" className="hover:text-foreground">
                                Events
                            </Link>
                        </li>
                        <li>
                            <Link to="/organisations" className="hover:text-foreground">
                                Organisations
                            </Link>
                        </li>
                        <li>
                            <Link to="/local-feed" className="hover:text-foreground">
                                Local Feed
                            </Link>
                        </li>
                        <li>
                            <Link to="/volunteering" className="hover:text-foreground">
                                Volunteering
                            </Link>
                        </li>
                        <li>
                            <Link to="/venues" className="hover:text-foreground">
                                Venues
                            </Link>
                        </li>
                        <li>
                            <Link to="/faq" className="hover:text-foreground">
                                Help Centre
                            </Link>
                        </li>
                    </ul>
                </div>

                <div>
                    <div className="font-display font-bold text-sm uppercase tracking-wider mb-3">
                        Contribute
                    </div>

                    <ul className="space-y-2 text-sm text-muted-foreground">
                        <li>
                            <Link to="/submit-event" className="hover:text-foreground">
                                Submit Event
                            </Link>
                        </li>
                        <li>
                            <Link
                                to="/add-organisation"
                                className="hover:text-foreground"
                            >
                                Add Organisation
                            </Link>
                        </li>
                        <li>
                            <Link to="/notifications" className="hover:text-foreground">
                                Notification settings
                            </Link>
                        </li>
                        <li>
                            <Link to="/faq" className="hover:text-foreground">
                                Help & FAQs
                            </Link>
                        </li>
                        <li>
                            <Link to="/contact" className="hover:text-foreground">
                                Contact
                            </Link>
                        </li>
                    </ul>
                </div>
            </div>

            <div className="border-t border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row gap-3 items-center justify-between text-xs text-muted-foreground">
                    <span>
                        © {new Date().getFullYear()} Blackrod Now. A community
                        project.
                    </span>

                    <div className="flex items-center gap-3 text-sm font-semibold text-foreground">
                        <span>This website was designed and created by The Web Design Wizard</span>
                        <button
                            type="button"
                            onClick={() => setWizardOpen(true)}
                            className="rounded-2xl p-1 hover:bg-muted transition-colors"
                            aria-label="Open Web Design Wizard contact form"
                        >
                            <img
                                src="/webwizard.png"
                                alt="The Web Design Wizard logo"
                                className="h-[5.625rem] sm:h-[6.75rem] w-auto"
                                loading="lazy"
                            />
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        <a href="#" className="hover:text-foreground">
                            Privacy
                        </a>

                        <a href="#" className="hover:text-foreground">
                            Terms
                        </a>

                        <Link to="/faq" className="hover:text-foreground">
                            Help
                        </Link>

                        <Button
                            data-testid="start-demo-footer"
                            variant="ghost"
                            size="sm"
                            onClick={() => startDemo(role)}
                        >
                            Demo
                        </Button>

                    </div>
                </div>
            </div>

            {wizardOpen && (
                <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
                    <DialogContent className="w-[calc(100vw-1.25rem)] sm:max-w-xl max-h-[88vh] overflow-y-auto p-4 sm:p-6">
                    <DialogHeader>
                        <DialogTitle>The Web Design Wizard</DialogTitle>
                        <DialogDescription>
                            Tell us what you need and we will follow up with service options and a quote.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <div className="rounded-2xl border border-border bg-muted/30 p-3 text-sm">
                            <p className="font-semibold">Web design and development services</p>
                            <p className="text-muted-foreground mt-1">Brand-led websites, UX improvements, and full build support for local organisations and businesses.</p>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                            <label className="text-sm">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</span>
                                <input value={wizardForm.name} onChange={(e) => setWizardForm((prev) => ({ ...prev, name: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background text-base sm:text-sm" />
                            </label>
                            <label className="text-sm">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</span>
                                <input type="email" value={wizardForm.email} onChange={(e) => setWizardForm((prev) => ({ ...prev, email: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background text-base sm:text-sm" />
                            </label>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                            <label className="text-sm">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business or organisation</span>
                                <input value={wizardForm.business} onChange={(e) => setWizardForm((prev) => ({ ...prev, business: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background text-base sm:text-sm" />
                            </label>
                            <label className="text-sm">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Service required</span>
                                <select value={wizardForm.service} onChange={(e) => setWizardForm((prev) => ({ ...prev, service: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background text-base sm:text-sm">
                                    <option>Website design and build</option>
                                    <option>Website redesign</option>
                                    <option>Landing page and conversion optimisation</option>
                                    <option>Ongoing website support</option>
                                    <option>Branding and web strategy</option>
                                </select>
                            </label>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                            <label className="text-sm">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Budget range</span>
                                <input value={wizardForm.budget} onChange={(e) => setWizardForm((prev) => ({ ...prev, budget: e.target.value }))} placeholder="e.g. GBP2,000 to GBP5,000" className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background text-base sm:text-sm" />
                            </label>
                            <label className="text-sm">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timeline</span>
                                <input value={wizardForm.timeline} onChange={(e) => setWizardForm((prev) => ({ ...prev, timeline: e.target.value }))} placeholder="e.g. Launch in 6 weeks" className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background text-base sm:text-sm" />
                            </label>
                        </div>

                        <label className="text-sm block">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project details</span>
                            <textarea rows={5} value={wizardForm.details} onChange={(e) => setWizardForm((prev) => ({ ...prev, details: e.target.value }))} placeholder="Tell us about goals, pages, functionality and style preferences" className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background text-base sm:text-sm" />
                        </label>
                    </div>

                    <DialogFooter className="mt-2 gap-2">
                        <button type="button" onClick={() => setWizardOpen(false)} className="px-4 py-2 rounded-full border border-border text-sm font-semibold">Close</button>
                        <button type="button" onClick={submitWizardForm} disabled={wizardBusy} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">Request quote</button>
                    </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </footer>
    );
}

export default function Layout({ children }) {
    return (
        <div className="min-h-screen flex flex-col bg-background text-foreground">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
            <DemoTour />
        </div>
    );
}