import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { CalendarDays, Sun, Moon, Sparkles, ArrowRight, Building2, HandHelping, Rocket } from "lucide-react";
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

const CountdownUnit = ({ label, value, theme = "dark" }) => (
    <div className={`flex flex-col items-center justify-center min-w-[70px] sm:min-w-[92px] rounded-2xl px-3 py-4 sm:px-5 sm:py-5 backdrop-blur ${
        theme === "dark"
            ? "border border-white/15 bg-white/5"
            : "border border-slate-200 bg-white/70"
    }`}>
        <div data-testid={`cs-countdown-${label.toLowerCase()}`} className={`font-display font-black text-3xl sm:text-5xl leading-none tabular-nums ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
            {String(value).padStart(2, "0")}
        </div>
        <div className={`text-[10px] sm:text-xs uppercase tracking-[0.2em] mt-2 ${theme === "dark" ? "text-white/60" : "text-slate-500"}`}>{label}</div>
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

    // Register org dialog
    const [registerOpen, setRegisterOpen] = useState(false);
    const [registerBusy, setRegisterBusy] = useState(false);
    const [registerForm, setRegisterForm] = useState({
        orgName: "",
        category: "Community groups",
        contactName: "",
        contactEmail: "",
        short: "",
    });

    // Claim org dialog
    const [claimOpen, setClaimOpen] = useState(false);
    const [claimBusy, setClaimBusy] = useState(false);
    const [claimNeedsCode, setClaimNeedsCode] = useState(false);
    const [claimForm, setClaimForm] = useState({ contact_name: "", contact_email: "", contact_phone: "", message: "", verification_code: "", slug: "" });

    useEffect(() => {
        if (!orgSlug && orgs?.length) setOrgSlug(orgs[0].slug);
        if (!claimForm.slug && orgs?.length) setClaimForm((f) => ({ ...f, slug: orgs[0].slug }));
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

    const submitRegister = async () => {
        if (!registerForm.orgName || !registerForm.contactEmail) {
            return toast.error("Organisation name and email are required");
        }
        setRegisterBusy(true);
        try {
            const slug = registerForm.orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
            await api.submitOrg({
                slug,
                name: registerForm.orgName,
                category: registerForm.category,
                short: registerForm.short,
                about: registerForm.short,
                does: "",
                forWho: "",
                email: registerForm.contactEmail,
                location: "Blackrod",
                logo: "✨",
                brandColor: "#0052FF",
                status: "pending",
            });
            toast.success("Registration submitted!", { description: "We'll review and get in touch before launch." });
            setRegisterForm({ orgName: "", category: "Community groups", contactName: "", contactEmail: "", short: "" });
            setRegisterOpen(false);
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not submit right now — try again shortly");
        } finally {
            setRegisterBusy(false);
        }
    };

    const submitClaimForm = async () => {
        if (!claimForm.slug || !claimForm.contact_email) {
            return toast.error("Select your organisation and enter your email");
        }
        if ((claimForm.message || "").trim().length < 20) {
            return toast.error("Please include more proof detail (at least 20 characters)");
        }
        if (claimNeedsCode && (claimForm.verification_code || "").trim().length !== 6) {
            return toast.error("Enter the 6-digit verification code from your email");
        }
        setClaimBusy(true);
        try {
            const response = await api.claimOrg(claimForm.slug, {
                contact_name: claimForm.contact_name,
                contact_email: claimForm.contact_email,
                contact_phone: claimForm.contact_phone,
                message: claimForm.message,
                verification_code: claimForm.verification_code,
            });
            if (response?.requires_verification) {
                setClaimNeedsCode(true);
                toast.success("Verification code sent", { description: "Check your email and enter the code to finish your claim." });
            } else {
                toast.success("Claim request sent", { description: "We'll verify your details and send login credentials before launch." });
                setClaimForm({ contact_name: "", contact_email: "", contact_phone: "", message: "", verification_code: "", slug: orgs?.[0]?.slug || "" });
                setClaimNeedsCode(false);
                setClaimOpen(false);
            }
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not send claim request right now");
        } finally {
            setClaimBusy(false);
        }
    };

    return (
        <div
            data-testid="coming-soon-page"
            data-theme={theme}
            className="min-h-screen relative overflow-hidden transition-colors duration-500"
            style={
                theme === "dark"
                    ? {
                        color: "#F8FAFC",
                        background:
                            "radial-gradient(1200px 600px at 15% -10%, rgba(0,82,255,0.55), transparent 60%), radial-gradient(900px 500px at 100% 0%, rgba(210,255,0,0.14), transparent 60%), linear-gradient(180deg,#050a1d 0%, #030517 60%, #010314 100%)",
                    }
                    : {
                        color: "#0F172A",
                        background:
                            "radial-gradient(1200px 600px at 15% -10%, rgba(0,82,255,0.18), transparent 60%), radial-gradient(900px 500px at 100% 0%, rgba(210,255,0,0.16), transparent 60%), linear-gradient(180deg,#F8FAFF 0%, #EEF3FF 60%, #E4ECFF 100%)",
                    }
            }
        >
            {/* Grid overlay */}
            <div
                aria-hidden
                className={`pointer-events-none absolute inset-0 ${theme === "dark" ? "opacity-[0.08]" : "opacity-[0.05]"}`}
                style={{
                    backgroundImage:
                        theme === "dark"
                            ? "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)"
                            : "linear-gradient(rgba(15,23,42,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.35) 1px, transparent 1px)",
                    backgroundSize: "48px 48px",
                }}
            />

            {/* Header */}
            <header className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-6 flex items-center justify-between flex-wrap gap-3">
                <div className={theme === "dark" ? "[&_span]:!text-white [&_span_span]:!text-[#0052FF]" : ""}>
                    <Brand size="lg" />
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setRegisterOpen(true)}
                        className="px-4 py-2 rounded-full bg-[#D2FF00] text-black text-xs font-bold uppercase tracking-wider hover:brightness-95 transition"
                    >
                        Register your org
                    </button>
                    <button
                        type="button"
                        data-testid="cs-admin-login-open"
                        onClick={() => setAdminOpen(true)}
                        className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition ${
                            theme === "dark"
                                ? "border border-white/20 hover:bg-white/10 text-white"
                                : "border border-slate-300 hover:bg-white text-slate-800"
                        }`}
                    >
                        Admin login
                    </button>
                    <button
                        type="button"
                        data-testid="cs-org-login-open"
                        onClick={() => setOrgOpen(true)}
                        className="px-4 py-2 rounded-full bg-[#0052FF] text-white text-xs font-bold uppercase tracking-wider hover:brightness-110 transition"
                    >
                        Org login
                    </button>
                    <button
                        type="button"
                        data-testid="cs-theme-toggle"
                        onClick={toggleTheme}
                        aria-label="Toggle theme"
                        className={`p-2 rounded-full transition ${
                            theme === "dark"
                                ? "border border-white/20 hover:bg-white/10 text-white"
                                : "border border-slate-300 hover:bg-white text-slate-800"
                        }`}
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
                            <Rocket className="h-3.5 w-3.5" /> Launching 12 September 2026
                        </span>
                        <h1 className={`font-display font-black tracking-tight mt-5 text-5xl sm:text-6xl lg:text-7xl leading-[0.95] ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                            Get your
                            <br />
                            <span className="text-[#0052FF]">organisation</span>
                            <br />
                            listed first.
                        </h1>
                        <p className={`mt-6 max-w-xl text-base sm:text-lg leading-relaxed ${theme === "dark" ? "text-white/75" : "text-slate-600"}`}>
                            Blackrod Now is a free community hub launching this September. Register your organisation now and you&apos;ll
                            be live from day one &mdash; events, volunteer roles, venue hire and more, seen by everyone in Blackrod.
                        </p>

                        {/* Countdown */}
                        <div className="mt-8 sm:mt-10">
                            <div className={`text-xs uppercase tracking-[0.25em] flex items-center gap-2 ${theme === "dark" ? "text-white/50" : "text-slate-500"}`}>
                                <CalendarDays className="h-3.5 w-3.5" /> Launching 12 September 2026
                            </div>
                            <div data-testid="cs-countdown" className="mt-3 flex flex-wrap gap-2 sm:gap-3">
                                <CountdownUnit label="Days" value={days} theme={theme} />
                                <CountdownUnit label="Hours" value={hours} theme={theme} />
                                <CountdownUnit label="Mins" value={minutes} theme={theme} />
                                <CountdownUnit label="Secs" value={seconds} theme={theme} />
                            </div>
                        </div>

                        {/* Subscribe */}
                        <div className="mt-10 max-w-lg">
                            <div className={`text-xs uppercase tracking-[0.25em] mb-3 ${theme === "dark" ? "text-white/50" : "text-slate-500"}`}>Be the first to know</div>
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
                                    className={`flex-1 min-w-0 px-4 py-3 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#0052FF] ${
                                        theme === "dark"
                                            ? "bg-white/10 border border-white/20 placeholder:text-white/40 text-white"
                                            : "bg-white border border-slate-300 placeholder:text-slate-400 text-slate-900"
                                    }`}
                                />
                                <button
                                    type="button"
                                    data-testid="cs-subscribe-submit"
                                    disabled={subscribing}
                                    onClick={submitSubscribe}
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#0052FF] text-white text-sm font-black uppercase tracking-wider hover:brightness-110 disabled:opacity-60 shadow-lg shadow-[#0052FF]/25"
                                >
                                    {subscribing ? "Adding…" : (
                                        <>
                                            Get notified <ArrowRight className="h-4 w-4" />
                                        </>
                                    )}
                                </button>
                            </div>
                            <p className={`text-[11px] mt-2 ${theme === "dark" ? "text-white/40" : "text-slate-500"}`}>
                                One friendly email at launch. Unsubscribe any time. No spam, no adverts.
                            </p>
                        </div>
                    </div>

                    {/* Right column — org onboarding */}
                    <aside className="lg:col-span-5 space-y-3">
                        <div className={`rounded-3xl border p-5 backdrop-blur ${theme === "dark" ? "border-white/15 bg-white/5" : "border-slate-200 bg-white/70"}`}>
                            <div className="flex items-center gap-2.5 mb-1">
                                <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${theme === "dark" ? "bg-[#0052FF]/30" : "bg-[#0052FF]/10"}`}><CalendarDays className="h-4 w-4 text-[#0052FF]" /></div>
                                <h3 className={`font-display font-bold text-base ${theme === "dark" ? "text-white" : "text-slate-900"}`}>You run events</h3>
                            </div>
                            <p className={`text-sm mt-2 ${theme === "dark" ? "text-white/65" : "text-slate-600"}`}>Clubs, societies, sports groups &amp; community associations — get events in front of everyone in Blackrod automatically.</p>
                        </div>

                        <div className={`rounded-3xl border p-5 backdrop-blur ${theme === "dark" ? "border-white/15 bg-white/5" : "border-slate-200 bg-white/70"}`}>
                            <div className="flex items-center gap-2.5 mb-1">
                                <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${theme === "dark" ? "bg-[#D2FF00]/20" : "bg-yellow-50"}`}><Building2 className="h-4 w-4 text-yellow-600" /></div>
                                <h3 className={`font-display font-bold text-base ${theme === "dark" ? "text-white" : "text-slate-900"}`}>You hire out a venue</h3>
                            </div>
                            <p className={`text-sm mt-2 ${theme === "dark" ? "text-white/65" : "text-slate-600"}`}>Halls, sports facilities, meeting rooms &amp; outdoor spaces — let local organisers find and contact you.</p>
                        </div>

                        <div className={`rounded-3xl border p-5 backdrop-blur ${theme === "dark" ? "border-white/15 bg-white/5" : "border-slate-200 bg-white/70"}`}>
                            <div className="flex items-center gap-2.5 mb-1">
                                <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${theme === "dark" ? "bg-white/10" : "bg-slate-100"}`}><HandHelping className="h-4 w-4 text-slate-500" /></div>
                                <h3 className={`font-display font-bold text-base ${theme === "dark" ? "text-white" : "text-slate-900"}`}>You need volunteers</h3>
                            </div>
                            <p className={`text-sm mt-2 ${theme === "dark" ? "text-white/65" : "text-slate-600"}`}>Charities &amp; community projects — post opportunities and connect with residents who want to give back.</p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setRegisterOpen(true)}
                                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#0052FF] text-white text-sm font-black uppercase tracking-wider hover:brightness-110 shadow-lg shadow-[#0052FF]/25"
                            >
                                <Sparkles className="h-4 w-4" /> Register free
                            </button>
                            <button
                                type="button"
                                onClick={() => setClaimOpen(true)}
                                className={`flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-bold border transition ${theme === "dark" ? "border-white/25 text-white hover:bg-white/10" : "border-slate-300 text-slate-800 hover:bg-white"}`}
                            >
                                Claim existing page <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>

                        <p className={`text-[11px] text-center ${theme === "dark" ? "text-white/35" : "text-slate-400"}`}>
                            Already registered? <button type="button" onClick={() => setOrgOpen(true)} className="underline underline-offset-2">Sign in to your dashboard</button>
                        </p>
                    </aside>
                </div>
            </main>

            {/* Footer — Web Wizard credit */}
            <footer className={`relative z-10 border-t ${theme === "dark" ? "border-white/10" : "border-slate-200"}`}>
                <div className="max-w-7xl mx-auto px-5 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className={`text-xs ${theme === "dark" ? "text-white/50" : "text-slate-500"}`}>
                        © 2026 Blackrod Now · A community project
                    </div>
                    <button
                        type="button"
                        onClick={() => setWizardOpen(true)}
                        data-testid="cs-webwizard-footer"
                        className={`flex items-center gap-3 rounded-2xl px-3 py-2 transition ${
                            theme === "dark" ? "hover:bg-white/5" : "hover:bg-white/70"
                        }`}
                        title="Get in touch with The Web Design Wizard"
                    >
                        <img
                            src="/webwizard.png"
                            alt="The Web Design Wizard logo"
                            className="h-10 w-auto"
                            loading="lazy"
                        />
                        <span className={`text-xs sm:text-sm text-left leading-tight ${theme === "dark" ? "text-white/70" : "text-slate-600"}`}>
                            This site was created by
                            <br />
                            <span className={`font-semibold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>The Web Design Wizard</span>
                        </span>
                    </button>
                </div>
            </footer>

            {/* Register organisation dialog */}
            <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Register your organisation</DialogTitle>
                        <DialogDescription>Tell us the basics. We'll review and activate your page before launch.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3">
                        <label className="text-sm block">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Organisation name *</span>
                            <input value={registerForm.orgName} onChange={(e) => setRegisterForm((f) => ({ ...f, orgName: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background" placeholder="e.g. Blackrod Bloomers" />
                        </label>
                        <label className="text-sm block">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</span>
                            <select value={registerForm.category} onChange={(e) => setRegisterForm((f) => ({ ...f, category: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background">
                                <option>Community groups</option>
                                <option>Sports &amp; fitness</option>
                                <option>Arts &amp; culture</option>
                                <option>Faith groups</option>
                                <option>Schools &amp; education</option>
                                <option>Health &amp; wellbeing</option>
                                <option>Charities &amp; social</option>
                                <option>Venues &amp; spaces</option>
                                <option>Local business</option>
                                <option>Other</option>
                            </select>
                        </label>
                        <label className="text-sm block">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">One-line description</span>
                            <input value={registerForm.short} onChange={(e) => setRegisterForm((f) => ({ ...f, short: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background" placeholder="What does your group do?" />
                        </label>
                        <label className="text-sm block">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your name</span>
                            <input value={registerForm.contactName} onChange={(e) => setRegisterForm((f) => ({ ...f, contactName: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background" />
                        </label>
                        <label className="text-sm block">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact email *</span>
                            <input type="email" value={registerForm.contactEmail} onChange={(e) => setRegisterForm((f) => ({ ...f, contactEmail: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background" placeholder="We'll send login details here" />
                        </label>
                    </div>
                    <DialogFooter>
                        <button type="button" onClick={() => setRegisterOpen(false)} className="px-4 py-2 rounded-full border border-border text-sm font-semibold">Cancel</button>
                        <button type="button" disabled={registerBusy} onClick={submitRegister} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">
                            {registerBusy ? "Submitting…" : "Submit registration"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Claim existing page dialog */}
            <Dialog open={claimOpen} onOpenChange={(open) => {
                setClaimOpen(open);
                if (!open) {
                    setClaimNeedsCode(false);
                    setClaimForm((f) => ({ ...f, verification_code: "" }));
                }
            }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Claim your organisation's page</DialogTitle>
                        <DialogDescription>Some pages were created in advance. We now verify claim requests with a one-time code sent to your email.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3">
                        <label className="text-sm block">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Organisation</span>
                            <select value={claimForm.slug} onChange={(e) => setClaimForm((f) => ({ ...f, slug: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background">
                                {(orgs || []).map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
                            </select>
                        </label>
                        <label className="text-sm block">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your name</span>
                            <input value={claimForm.contact_name} onChange={(e) => setClaimForm((f) => ({ ...f, contact_name: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background" />
                        </label>
                        <div className="grid sm:grid-cols-2 gap-3">
                            <label className="text-sm block">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email *</span>
                                <input type="email" value={claimForm.contact_email} onChange={(e) => setClaimForm((f) => ({ ...f, contact_email: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background" />
                            </label>
                            <label className="text-sm block">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone</span>
                                <input type="tel" value={claimForm.contact_phone} onChange={(e) => setClaimForm((f) => ({ ...f, contact_phone: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background" placeholder="For quick verification" />
                            </label>
                        </div>
                        <label className="text-sm block">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your role &amp; proof</span>
                            <textarea rows={3} value={claimForm.message} onChange={(e) => setClaimForm((f) => ({ ...f, message: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background" placeholder="e.g. I'm the club chair — our website / Facebook page is…" required />
                        </label>
                        {claimNeedsCode && (
                            <label className="text-sm block">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verification code *</span>
                                <input
                                    inputMode="numeric"
                                    value={claimForm.verification_code}
                                    onChange={(e) => setClaimForm((f) => ({ ...f, verification_code: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                                    className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background"
                                    placeholder="6-digit code"
                                />
                            </label>
                        )}
                    </div>
                    <DialogFooter>
                        <button type="button" onClick={() => setClaimOpen(false)} className="px-4 py-2 rounded-full border border-border text-sm font-semibold">Cancel</button>
                        <button type="button" disabled={claimBusy} onClick={submitClaimForm} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">
                            {claimBusy ? "Sending…" : (claimNeedsCode ? "Verify and submit claim" : "Send verification code")}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                        <Link
                            to="/organisation/member/redeem"
                            className="mr-auto text-xs font-semibold text-primary hover:underline"
                            onClick={() => setOrgOpen(false)}
                        >
                            Redeem member invite
                        </Link>
                        <Link
                            to="/organisation/member/login"
                            className="text-xs font-semibold text-primary hover:underline"
                            onClick={() => setOrgOpen(false)}
                        >
                            Member login
                        </Link>
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
