import React, { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import {
    Moon,
    Sun,
    Menu,
    X,
    MapPin,
    Mail,
    Instagram,
    Facebook,
    Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
    { to: "/", label: "Home" },
    { to: "/events", label: "Events" },
    { to: "/organisations", label: "Organisations" },
    { to: "/local-feed", label: "Local Feed" },
    { to: "/volunteering", label: "Volunteering" },
    { to: "/venues", label: "Venues" },
];

export const Brand = ({ size = "default" }) => (
    <Link to="/" data-testid="brand-link" className="flex items-center gap-2 group">
        <span
            className={`grid place-items-center rounded-2xl bg-primary text-primary-foreground font-display font-black ${
                size === "lg" ? "h-12 w-12 text-2xl" : "h-9 w-9 text-lg"
            } shadow-lg shadow-primary/20 group-hover:rotate-[-6deg] transition-transform duration-300`}
        >
            B
        </span>
        <span className="font-display font-black tracking-tight text-foreground text-xl leading-none">
            Blackrod<span className="text-primary">Life</span>
        </span>
    </Link>
);

function Navbar() {
    const { theme, toggleTheme, role, setRole } = useApp();
    const [open, setOpen] = useState(false);
    const loc = useLocation();

    return (
        <header
            data-testid="site-header"
            className="sticky top-0 z-50 w-full backdrop-blur-xl bg-background/80 border-b border-border/60"
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
                                data-testid={`nav-${n.label.toLowerCase().replace(/\s+/g, "-")}`}
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

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                data-testid="role-switcher"
                                variant="ghost"
                                size="sm"
                                className="rounded-full text-xs font-bold uppercase tracking-wider"
                            >
                                {role === "guest" ? "Login" : role}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-2xl">
                            <DropdownMenuLabel>Demo role switcher</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem data-testid="role-guest" onClick={() => setRole("guest")}>
                                Guest
                            </DropdownMenuItem>
                            <DropdownMenuItem data-testid="role-admin" onClick={() => setRole("admin")}>
                                Site Admin
                            </DropdownMenuItem>
                            <DropdownMenuItem data-testid="role-org" onClick={() => setRole("org")}>
                                Organisation
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                data-testid="role-contributor"
                                onClick={() => setRole("contributor")}
                            >
                                Contributor
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                                <Link to="/admin" data-testid="goto-admin">
                                    Admin dashboard
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link to="/organisation-dashboard" data-testid="goto-org-dashboard">
                                    Organisation dashboard
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

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
                        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
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
                            data-testid={`mobile-nav-${n.label.toLowerCase().replace(/\s+/g, "-")}`}
                            className={({ isActive }) =>
                                `block px-3 py-2 rounded-xl text-sm font-medium ${
                                    isActive ? "bg-foreground text-background" : "text-foreground/80"
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
                </div>
            )}
        </header>
    );
}

function Footer() {
    return (
        <footer
            data-testid="site-footer"
            className="mt-24 border-t border-border bg-surface"
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid gap-10 grid-cols-2 md:grid-cols-4">
                <div className="col-span-2">
                    <Brand size="lg" />
                    <p className="mt-4 text-sm text-muted-foreground max-w-sm leading-relaxed">
                        Everything happening in Blackrod — events, groups, clubs, causes and local life. Made
                        by neighbours, for neighbours.
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
                            <Link to="/add-organisation" className="hover:text-foreground">
                                Add Organisation
                            </Link>
                        </li>
                        <li>
                            <Link to="/notifications" className="hover:text-foreground">
                                Notification settings
                            </Link>
                        </li>
                        <li>
                            <a href="mailto:hello@blackrodlife.example" className="hover:text-foreground">
                                Contact
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
            <div className="border-t border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row gap-3 items-center justify-between text-xs text-muted-foreground">
                    <span>© {new Date().getFullYear()} BlackrodLife. A community project.</span>
                    <div className="flex items-center gap-4">
                        <a href="#" className="hover:text-foreground">Privacy</a>
                        <a href="#" className="hover:text-foreground">Terms</a>
                        <a href="#" className="hover:text-foreground" aria-label="Facebook">
                            <Facebook className="h-4 w-4" />
                        </a>
                        <a href="#" className="hover:text-foreground" aria-label="Instagram">
                            <Instagram className="h-4 w-4" />
                        </a>
                        <a href="mailto:hello@blackrodlife.example" className="hover:text-foreground" aria-label="Email">
                            <Mail className="h-4 w-4" />
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}

export default function Layout({ children }) {
    return (
        <div className="min-h-screen flex flex-col bg-background text-foreground">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
        </div>
    );
}
