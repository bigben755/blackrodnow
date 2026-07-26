import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger,
} from "@/components/ui/dialog";
import { CalendarDays, Sun, Moon, Send, Sparkles, ArrowRight } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Brand } from "@/components/Layout";
import { api } from "@/lib/api";

const LAUNCH_DATE_FALLBACK = "2026-09-12T09:00:00+00:00";

function useCountdown(targetIso) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);
    return useMemo(() => {
        let target;
        try {
            target = new Date(targetIso).getTime();
        } catch {
            target = new Date(LAUNCH_DATE_FALLBACK).getTime();
        }
        let diff = Math.max(0, target - now);
        const days = Math.floor(diff / 86400000);
        diff -= days * 86400000;
        const hours = Math.floor(diff / 3600000);
        diff -= hours * 3600000;
        const minutes = Math.floor(diff / 60000);
        diff -= minutes * 60000;
        const seconds = Math.floor(diff / 1000);
        return { days, hours, minutes, seconds, done: target - now <= 0 };
    }, [now, targetIso]);
}

const CountdownUnit = ({ label, value }) => (
    <div className="flex flex-col items-center justify-center min-w-[70px] sm:min-w-[92px] rounded-2xl border border-white/15 bg-white/5 backdrop-blur px-3 py-4 sm:px-5 sm:py-5">
        <div data-testid={`cs-countdown-${label.toLowerCase()}`} className="font-display font-black text-3xl sm:text-5xl leading-none tabular-nums text-white">
            {String(value).padStart(2, "0")}
        </div>
        <div className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-white/60 mt-2">{label}</div>
    </div>
);

export default function ComingSoon() {
    const { theme, toggleTheme, loginAdmin, unlockAdmin, unlockOrgAccess, setActiveOrgSlug, setRole, orgs } = useApp();
    const { days, hours, minutes, seconds } = useCountdown(
        (typeof window !== "undefined" && window.__RN_LAUNCH_AT__) || LAUNCH_DATE_FALLBACK
    );

    // Subscribe field
    const [email, setEmail] = useState("");
    const [subscribing, setSubscribing] = useState(false);

    // Admin dialog
    const [adminOpen, setAdminOpen] = useState(false);
    const [adminEmail, setAdminEmail] = useState("");
    const [adminPassword, setAdminPassword] = useState("");
    const [adminBusy, setAdminBusy] = useState(false);

    // Org dialog
    const [orgOpen, setOrgOpen] = useState(false);
    const [orgSlug, setOrgSlug] = useState("");
    const [orgPassword, setOrgPassword] = useState("");
    const [orgBusy, setOrgBusy] = useState(false);

    // Web Wizard dialog
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

    useEffect(() => {
        if (!orgSlug && orgs?.length) setOrgSlug(orgs[0].slug);
    }, [orgs, orgSlug]);

    const submitSubscribe = async () => {
        if (!email) return toast.error("Enter your email");
        setSubscribing(true);
        try {
            await api.subscribe(email.trim());
            toast.success("You're on the list — we'll email you when Blackrod Now launches");
            setEmail("");
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not subscribe right now");
        } finally {
            setSubscribing(false);
        }
    };

    const submitAdmin = async () => {
        const codeCandidate = adminPassword.trim();
        const legacyCode = process.env.REACT_APP_ADMIN_LAUNCH_CODE || "";
        if (!adminEmail && legacyCode && codeCandidate === legacyCode) {
            unlockAdmin(codeCandidate);
            toast.success("Admin mode unlocked (legacy)");
            setAdminOpen(false);
            return;
        }
        if (!adminEmail || !adminPassword) return toast.error("Enter admin email and password");
        setAdminBusy(true);
        try {
            await loginAdmin(adminEmail, adminPassword);
            toast.success("Signed in as admin — welcome to your preview");
            setAdminOpen(false);
        } catch (error) {
            const detail = error?.response?.data?.detail;
            toast.error(typeof detail === "string" ? detail : "Login failed");
        } finally {
            setAdminBusy(false);
        }
    };

    const submitOrg = async () => {
        if (!orgSlug || !orgPassword) return toast.error("Pick your organisation and enter its password");
        setOrgBusy(true);
        try {
            const res = await api.loginOrgAccess(orgSlug, { password: orgPassword });
            const token = res?.token || res?.access_token || res?.orgAuth || `org-${orgSlug}-${Date.now()}`;
            unlockOrgAccess(orgSlug, token);
            setActiveOrgSlug(orgSlug);
            setRole("org");
            toast.success("Signed in — opening your organisation dashboard");
            setOrgOpen(false);
            window.location.assign("/organisation-dashboard");
        } catch (error) {
            const detail = error?.response?.data?.detail;
            toast.error(typeof detail === "string" ? detail : "Login failed — check your password");
        } finally {
            setOrgBusy(false);
        }
    };

    const submitWizard = async () => {
        if (!wizardForm.name || !wizardForm.email || !wizardForm.details) {
            return toast.error("Please add your name, email and project details");
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
            toast.success("Thanks — your Web Design Wizard enquiry has been sent");
            setWizardForm({
                name: "",
                email: "",
                business: "",
                service: "Website design and build",
                budget: "",
                timeline: "",
                details: "",
            });
            setWizardOpen(false);
        } catch {
            toast.error("Could not send your enquiry right now");
        } finally {
            setWizardBusy(false);
        }
    };

    return (
        <div
            data-testid="coming-soon-page"
            className="min-h-screen text-white relative overflow-hidden"
            style={{
                background:
                    "radial-gradient(1200px 600px at 15% -10%, rgba(0,82,255,0.35), transparent 60%), radial-gradient(900px 500px at 100% 0%, rgba(210,255,0,0.25), transparent 60%), linear-gradient(180deg,#050a1d 0%, #030517 60%, #010314 100%)",
            }}
        >
            {/* Grid overlay */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.08]"
                style={{
                    backgroundImage:
                        "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
                    backgroundSize: "48px 48px",
                }}
            />

            {/* Header */}
            <header className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-6 flex items-center justify-between flex-wrap gap-3">
                <div className="text-white [&_span]:text-white [&_span_span]:text-primary">
                    <Brand size="lg" />
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        data-testid="cs-admin-login-open"
                        onClick={() => setAdminOpen(true)}
                        className="px-4 py-2 rounded-full border border-white/20 hover:bg-white/10 text-xs font-bold uppercase tracking-wider transition"
                    >
                        Admin login
                    </button>
                    <button
                        type="button"
                        data-testid="cs-org-login-open"
                        onClick={() => setOrgOpen(true)}
                        className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider hover:brightness-110 transition"
                    >
                        Org login
                    </button>
                    <button
                        type="button"
                        data-testid="cs-theme-toggle"
                        onClick={toggleTheme}
                        aria-label="Toggle theme"
                        className="p-2 rounded-full border border-white/20 hover:bg-white/10 transition"
                    >
                        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </button>
                </div>
            </header>

            {/* Hero */}
            <main className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 pt-8 sm:pt-16 pb-24">
                <div className="grid lg:grid-cols-12 gap-10 items-start">
                    <div className="lg:col-span-7">
                        <span
                            data-testid="cs-badge"
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#D2FF00] text-black text-[11px] font-black uppercase tracking-[0.2em]"
                        >
                            <Sparkles className="h-3.5 w-3.5" /> Made possible by the Community Alliance Fund
                        </span>
                        <h1 className="font-display font-black tracking-tight text-white mt-5 text-5xl sm:text-6xl lg:text-7xl leading-[0.95]">
                            Something
                            <br />
                            <span className="text-[#D2FF00]">brilliant</span> is
                            <br />
                            coming to Blackrod.
                        </h1>
                        <p className="mt-6 text-white/75 max-w-xl text-base sm:text-lg leading-relaxed">
                            Blackrod Now is a new community hub for what&apos;s on, what&apos;s new, and what&apos;s next —
                            events, clubs, organisations, volunteering, and news, all in one place. Free. No account needed.
                        </p>

                        {/* Countdown */}
                        <div className="mt-8 sm:mt-10">
                            <div className="text-xs uppercase tracking-[0.25em] text-white/50 flex items-center gap-2">
                                <CalendarDays className="h-3.5 w-3.5" /> Launching 12 September 2026
                            </div>
                            <div data-testid="cs-countdown" className="mt-3 flex flex-wrap gap-2 sm:gap-3">
                                <CountdownUnit label="Days" value={days} />
                                <CountdownUnit label="Hours" value={hours} />
                                <CountdownUnit label="Mins" value={minutes} />
                                <CountdownUnit label="Secs" value={seconds} />
                            </div>
                        </div>

                        {/* Subscribe */}
                        <div className="mt-10 max-w-lg">
                            <div className="text-xs uppercase tracking-[0.25em] text-white/50 mb-3">Be the first to know</div>
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
                                <input
                                    data-testid="cs-subscribe-input"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") submitSubscribe();
                                    }}
                                    className="flex-1 min-w-0 px-4 py-3 rounded-full bg-white/10 border border-white/20 placeholder:text-white/40 text-white focus:outline-none focus:ring-2 focus:ring-[#D2FF00] text-sm"
                                />
                                <button
                                    type="button"
                                    data-testid="cs-subscribe-submit"
                                    disabled={subscribing}
                                    onClick={submitSubscribe}
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#D2FF00] text-black text-sm font-black uppercase tracking-wider hover:brightness-95 disabled:opacity-60"
                                >
                                    {subscribing ? "Adding…" : (
                                        <>
                                            Get notified <ArrowRight className="h-4 w-4" />
                                        </>
                                    )}
                                </button>
                            </div>
                            <p className="text-[11px] text-white/40 mt-2">
                                One friendly email at launch. Unsubscribe any time. No spam, no adverts.
                            </p>
                        </div>
                    </div>

                    {/* Right column — spotlight cards */}
                    <aside className="lg:col-span-5">
                        <div className="grid gap-4">
                            <div className="rounded-3xl border border-white/15 bg-white/5 backdrop-blur p-6">
                                <div className="text-xs uppercase tracking-[0.25em] text-[#D2FF00]">What&apos;s coming</div>
                                <ul className="mt-3 space-y-2 text-sm text-white/80">
                                    <li>• Weekly events across Blackrod &amp; Horwich</li>
                                    <li>• Local organisation directory &amp; profiles</li>
                                    <li>• Volunteering opportunities and spaces to hire</li>
                                    <li>• Personalised newsletter — follow only what you love</li>
                                </ul>
                            </div>
                            <div className="rounded-3xl border border-white/15 bg-white/5 backdrop-blur p-6">
                                <div className="text-xs uppercase tracking-[0.25em] text-[#D2FF00]">Run a business?</div>
                                <p className="mt-3 text-sm text-white/80">
                                    The team behind Blackrod Now, The Web Design Wizard, builds sites like this for local businesses across Bolton.
                                </p>
                                <button
                                    type="button"
                                    data-testid="cs-webwizard-open"
                                    onClick={() => setWizardOpen(true)}
                                    className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black text-xs font-black uppercase tracking-wider hover:bg-white/90 transition"
                                >
                                    <Send className="h-3.5 w-3.5" /> Get in touch
                                </button>
                            </div>
                        </div>
                    </aside>
                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 border-t border-white/10">
                <div className="max-w-7xl mx-auto px-5 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/50">
                    <div>© 2026 Blackrod Now · A community project</div>
                    <div>Built by The Web Design Wizard · Blackrod, Bolton</div>
                </div>
            </footer>

            {/* Admin login dialog */}
            <Dialog open={adminOpen} onOpenChange={setAdminOpen}>
                <DialogContent className="sm:max-w-md" data-testid="cs-admin-dialog">
                    <DialogHeader>
                        <DialogTitle>Admin sign in</DialogTitle>
                        <DialogDescription>Sign in to preview the site as an admin.</DialogDescription>
                    </DialogHeader>
                    <label className="text-sm block">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</span>
                        <input
                            type="email"
                            autoComplete="username"
                            data-testid="cs-admin-email"
                            value={adminEmail}
                            onChange={(e) => setAdminEmail(e.target.value)}
                            className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background"
                        />
                    </label>
                    <label className="text-sm block mt-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</span>
                        <input
                            type="password"
                            autoComplete="current-password"
                            data-testid="cs-admin-password"
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") submitAdmin();
                            }}
                            className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background"
                        />
                    </label>
                    <DialogFooter>
                        <button type="button" onClick={() => setAdminOpen(false)} className="px-4 py-2 rounded-full border border-border text-sm font-semibold">Cancel</button>
                        <button
                            type="button"
                            data-testid="cs-admin-submit"
                            disabled={adminBusy}
                            onClick={submitAdmin}
                            className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
                        >
                            {adminBusy ? "Signing in…" : "Sign in"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Org login dialog */}
            <Dialog open={orgOpen} onOpenChange={setOrgOpen}>
                <DialogContent className="sm:max-w-md" data-testid="cs-org-dialog">
                    <DialogHeader>
                        <DialogTitle>Organisation sign in</DialogTitle>
                        <DialogDescription>Sign in to your organisation dashboard.</DialogDescription>
                    </DialogHeader>
                    <label className="text-sm block">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Organisation</span>
                        <select
                            data-testid="cs-org-slug"
                            value={orgSlug}
                            onChange={(e) => setOrgSlug(e.target.value)}
                            className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background"
                        >
                            {(orgs || []).map((o) => (
                                <option key={o.slug} value={o.slug}>{o.name}</option>
                            ))}
                        </select>
                    </label>
                    <label className="text-sm block mt-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</span>
                        <input
                            type="password"
                            autoComplete="current-password"
                            data-testid="cs-org-password"
                            value={orgPassword}
                            onChange={(e) => setOrgPassword(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") submitOrg();
                            }}
                            className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background"
                        />
                    </label>
                    <DialogFooter>
                        <button type="button" onClick={() => setOrgOpen(false)} className="px-4 py-2 rounded-full border border-border text-sm font-semibold">Cancel</button>
                        <button
                            type="button"
                            data-testid="cs-org-submit"
                            disabled={orgBusy}
                            onClick={submitOrg}
                            className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
                        >
                            {orgBusy ? "Signing in…" : "Sign in"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Web Wizard dialog */}
            <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="cs-webwizard-dialog">
                    <DialogHeader>
                        <DialogTitle>The Web Design Wizard — get in touch</DialogTitle>
                        <DialogDescription>Tell us about your business and what you&apos;d like to build. We&apos;ll come back within one working day.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3">
                        <label className="text-sm block">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your name</span>
                            <input data-testid="cs-wiz-name" value={wizardForm.name} onChange={(e) => setWizardForm((p) => ({ ...p, name: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background" />
                        </label>
                        <label className="text-sm block">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</span>
                            <input data-testid="cs-wiz-email" type="email" value={wizardForm.email} onChange={(e) => setWizardForm((p) => ({ ...p, email: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background" />
                        </label>
                        <label className="text-sm block">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business name</span>
                            <input value={wizardForm.business} onChange={(e) => setWizardForm((p) => ({ ...p, business: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background" />
                        </label>
                        <label className="text-sm block">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What do you need?</span>
                            <select value={wizardForm.service} onChange={(e) => setWizardForm((p) => ({ ...p, service: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background">
                                <option>Website design and build</option>
                                <option>Website refresh</option>
                                <option>E-commerce</option>
                                <option>Web app / custom software</option>
                                <option>SEO / performance</option>
                                <option>Not sure — help me decide</option>
                            </select>
                        </label>
                        <div className="grid sm:grid-cols-2 gap-3">
                            <label className="text-sm block">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Budget (optional)</span>
                                <input value={wizardForm.budget} onChange={(e) => setWizardForm((p) => ({ ...p, budget: e.target.value }))} placeholder="e.g. £2,000 to £5,000" className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background" />
                            </label>
                            <label className="text-sm block">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timeline (optional)</span>
                                <input value={wizardForm.timeline} onChange={(e) => setWizardForm((p) => ({ ...p, timeline: e.target.value }))} placeholder="e.g. Launch in 6 weeks" className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background" />
                            </label>
                        </div>
                        <label className="text-sm block">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project details</span>
                            <textarea data-testid="cs-wiz-details" rows={5} value={wizardForm.details} onChange={(e) => setWizardForm((p) => ({ ...p, details: e.target.value }))} placeholder="Tell us about goals, pages, functionality and style preferences" className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background" />
                        </label>
                    </div>
                    <DialogFooter>
                        <button type="button" onClick={() => setWizardOpen(false)} className="px-4 py-2 rounded-full border border-border text-sm font-semibold">Cancel</button>
                        <button
                            type="button"
                            data-testid="cs-wiz-submit"
                            disabled={wizardBusy}
                            onClick={submitWizard}
                            className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
                        >
                            {wizardBusy ? "Sending…" : "Send enquiry"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
