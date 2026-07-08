import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ChevronDown, HelpCircle, Mail, CalendarDays, Heart, Bell, Facebook } from "lucide-react";

const FAQS = [
    {
        cat: "Using Blackrod Now",
        q: "Do I need an account to use Blackrod Now?",
        a: "No — never. You can browse events, follow organisations, subscribe to the newsletter, and personalise everything without creating an account. Your preferences are stored on your device (and against your email if you subscribe).",
    },
    {
        cat: "Using Blackrod Now",
        q: "How do I find what's on this week?",
        a: "The homepage shows 'This week in Blackrod' at the top. Or hit Events for the full calendar — list view for scanning, month view for planning.",
    },
    {
        cat: "Using Blackrod Now",
        q: "How do I add events to my own calendar?",
        a: "Every event page has 'Add to Google / Apple / Outlook Calendar' buttons. For the whole calendar, tap 'Sync calendar' on the Events page and download the .ics file — imports into any calendar app.",
    },
    {
        cat: "Following organisations",
        q: "How do I follow an organisation or a topic?",
        a: "On any organisation's page, tap the ♥ Follow button. To follow topics like 'Youth' or 'Music', head to Notifications. No login required — your follows are saved on this device.",
    },
    {
        cat: "Following organisations",
        q: "Will my follows sync across my phone and laptop?",
        a: "Not automatically without an account, but when you subscribe to the newsletter with your email, your follows travel with your email — so the same personalised digest reaches you wherever.",
    },
    {
        cat: "Newsletter",
        q: "What's in the weekly newsletter?",
        a: "A short round-up delivered Friday morning. If you follow specific organisations or topics, we prioritise events and updates from those. Otherwise you get a general Blackrod-wide digest.",
    },
    {
        cat: "Newsletter",
        q: "How do I unsubscribe?",
        a: "Every email has a one-click unsubscribe link at the bottom. You can also visit your Preferences link (in any email) and turn the digest off there — or delete your subscription completely.",
    },
    {
        cat: "Newsletter",
        q: "How do I change which orgs I get updates about?",
        a: "Open the 'Personalise' link in any Blackrod Now email — you'll land on your preferences page where you can add/remove followed organisations and categories any time.",
    },
    {
        cat: "Submitting events",
        q: "Can anyone submit an event?",
        a: "Yes. Hit 'Submit an Event' in the top nav or footer, fill in the form and send it. Admins review and publish it — usually within 24 hours. No login required.",
    },
    {
        cat: "Submitting events",
        q: "Why are submitted events reviewed?",
        a: "A quick moderation step keeps the site accurate, safe and free of spam. Trusted, established organisations may be given direct-publish access on request.",
    },
    {
        cat: "Organisations",
        q: "How does my group get listed?",
        a: "Tap 'Add Your Organisation' and fill in the short form. An admin reviews it (usually same day) and it appears in the directory.",
    },
    {
        cat: "Organisations",
        q: "I run an organisation. How do I edit my listing?",
        a: "Go to the Organisation dashboard from the top-right menu, pick your group, and tap 'Profile & branding'. Update your logo, cover, colour, contacts and socials — changes go live immediately.",
    },
    {
        cat: "Organisations",
        q: "I'm not great with tech — can someone help me?",
        a: "Yes. Blackrod Now super admins can update any organisation's listing on your behalf. Contact us via the 'Contact admin' button in your dashboard, or the Contact page.",
    },
    {
        cat: "Organisations",
        q: "How does the Facebook sync work?",
        a: "Connect your Facebook page once from your dashboard. Every event you publish on Blackrod Now also posts to your Facebook page automatically — and your Facebook posts flow back here as feed updates. Setup is currently in preparation with Meta; full switch-on happens automatically once approved.",
    },
    {
        cat: "Organisations",
        q: "What is 'Upload Once, Publish Everywhere'?",
        a: "Our AI tool. Paste any flyer, newsletter or update into your dashboard and it extracts an event listing, social caption, notification text and update post — in one go. If your paste has multiple events, we split them out one by one.",
    },
    {
        cat: "Organisations",
        q: "What are the Documents on my profile for?",
        a: "A public shelf for PDFs, Word docs and images your community actually asks for — membership forms, kit lists, safeguarding policies, annual reports, meeting minutes. Residents click to download.",
    },
    {
        cat: "Volunteering",
        q: "How do I sign up to volunteer?",
        a: "Head to Volunteering. Each opportunity has a contact button — tap it and message the organisation directly. Great for DofE Skills or Volunteering sections.",
    },
    {
        cat: "Volunteering",
        q: "Is there anything for young people?",
        a: "Yes. Look for Youth, DofE, and Under-18 opportunities on the Volunteering page. Air Cadets, Scouts, Girlguiding, junior sport clubs and the food pantry all welcome young volunteers.",
    },
    {
        cat: "Privacy",
        q: "What data do you collect?",
        a: "Your email if you subscribe to the newsletter; anonymous device follows on your browser; whatever you type into forms. No trackers, no adverts. See our Privacy page.",
    },
];

const CATEGORIES = Array.from(new Set(FAQS.map((f) => f.cat)));

export default function FAQ() {
    const [q, setQ] = useState("");
    const [cat, setCat] = useState("All");

    const filtered = useMemo(
        () =>
            FAQS.filter(
                (f) =>
                    (cat === "All" || f.cat === cat) &&
                    (!q || `${f.q} ${f.a}`.toLowerCase().includes(q.toLowerCase())),
            ),
        [q, cat],
    );

    return (
        <div data-testid="faq-page" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="mb-8">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Help</span>
                <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight mt-2">Frequently asked</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    Everything you need to know about using Blackrod Now — no account needed.
                </p>
            </div>

            {/* Quick jump cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                <QuickCard icon={CalendarDays} label="Events" href="/events" />
                <QuickCard icon={Heart} label="Following" href="/notifications" />
                <QuickCard icon={Bell} label="Newsletter" href="/#newsletter" />
                <QuickCard icon={Facebook} label="Facebook" href="#" />
            </div>

            <div className="grid md:grid-cols-12 gap-3 mb-6">
                <div className="md:col-span-8 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        data-testid="faq-search"
                        placeholder="Search the FAQ…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-full border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
                <select
                    data-testid="faq-category"
                    value={cat}
                    onChange={(e) => setCat(e.target.value)}
                    className="md:col-span-4 px-4 py-3 rounded-full border border-border bg-surface text-sm"
                >
                    <option value="All">All topics</option>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
            </div>

            {filtered.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    No matches. <Link to="/contact" className="text-primary font-semibold">Ask us directly</Link>.
                </div>
            ) : (
                <ul className="space-y-2">
                    {filtered.map((f, i) => (
                        <FAQItem key={i} q={f.q} a={f.a} cat={f.cat} />
                    ))}
                </ul>
            )}

            <div className="mt-10 rounded-3xl bg-primary/10 border border-primary/20 p-6 text-center">
                <div className="inline-flex items-center gap-2 text-primary font-semibold">
                    <Mail className="h-4 w-4" /> Can't find your answer?
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Drop us a note — we usually reply the same day.</p>
                <Link to="/contact" data-testid="faq-contact-link" className="mt-3 inline-flex items-center gap-1 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm">
                    Contact us
                </Link>
            </div>
        </div>
    );
}

function FAQItem({ q, a, cat }) {
    const [open, setOpen] = useState(false);
    return (
        <li className="rounded-2xl border border-border bg-surface overflow-hidden">
            <button
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-start gap-4 p-4 text-left hover:bg-muted transition"
                data-testid={`faq-toggle-${q.slice(0, 20)}`}
            >
                <HelpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{cat}</div>
                    <div className="font-semibold text-sm mt-0.5">{q}</div>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground mt-1 transition ${open ? "rotate-180" : ""}`} />
            </button>
            {open && <div className="px-4 pb-4 pl-14 text-sm text-muted-foreground leading-relaxed">{a}</div>}
        </li>
    );
}

function QuickCard({ icon: Icon, label, href }) {
    return (
        <Link
            to={href}
            className="rounded-2xl border border-border bg-surface p-4 hover:-translate-y-0.5 transition-transform text-center"
        >
            <div className="h-9 w-9 mx-auto rounded-2xl bg-primary/10 text-primary grid place-items-center">
                <Icon className="h-4 w-4" />
            </div>
            <div className="mt-2 font-semibold text-sm">{label}</div>
        </Link>
    );
}
