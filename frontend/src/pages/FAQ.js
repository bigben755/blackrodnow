import React, { useMemo, useState } from "react";
import {
    Search,
    HelpCircle,
    Users,
    CalendarDays,
    Building2,
    Share2,
    HeartHandshake,
    BriefcaseBusiness,
    ChevronDown,
    UserPlus,
    Mail,
} from "lucide-react";
import NewsletterSection from "@/components/NewsletterSection";

const userGroups = [
    {
        id: "all",
        label: "All users",
        icon: HelpCircle,
    },
    {
        id: "residents",
        label: "Residents",
        icon: Users,
    },
    {
        id: "organisers",
        label: "Event organisers",
        icon: CalendarDays,
    },
    {
        id: "organisations",
        label: "Community organisations",
        icon: Building2,
    },
    {
        id: "facebook",
        label: "Facebook Page admins",
        icon: Share2,
    },
    {
        id: "volunteers",
        label: "Volunteers",
        icon: HeartHandshake,
    },
    {
        id: "businesses",
        label: "Local business support",
        icon: BriefcaseBusiness,
    },
];

const faqItems = [
    {
        id: "what-is-blackrod-now",
        group: "residents",
        category: "Getting started",
        question: "What is Blackrod Now?",
        answer:
            "Blackrod Now is a local community events and information hub designed to help residents find what is happening in Blackrod, South Horwich and the surrounding area. It brings together events, groups, activities, community notices and local organisation updates in one place.",
    },
    {
        id: "who-can-use",
        group: "all",
        category: "Getting started",
        question: "Who can use Blackrod Now?",
        answer:
            "Residents, families, community groups, charities, churches, sports clubs, schools, volunteers, local businesses and event organisers can all use Blackrod Now. Residents can browse events, while approved organisers can submit and manage event listings.",
    },
    {
        id: "create-account",
        group: "all",
        category: "Account setup",
        question: "How do I create an account?",
        answer:
            "Choose Register or Create Account, enter your name and email address, create a secure password, then confirm your email if verification is required. Once your account is active, you can save events, submit updates or request access to manage an organisation.",
        steps: [
            "Select Register or Create Account.",
            "Enter your name, email address and password.",
            "Confirm your email address if prompted.",
            "Choose whether you are a resident, organiser, volunteer or organisation admin.",
            "Complete your profile so the team can verify your access where needed.",
        ],
    },
    {
        id: "forgot-password",
        group: "all",
        category: "Account setup",
        question: "What if I forget my password?",
        answer:
            "Use the forgotten password link on the sign-in page. You will receive a reset link by email. For security, reset links may expire after a short period.",
    },
    {
        id: "resident-account",
        group: "residents",
        category: "Residents",
        question: "Do residents need an account to view events?",
        answer:
            "No. Public event listings should be visible without an account. Creating an account can allow residents to save events, receive reminders, follow organisations and subscribe to event updates.",
    },
    {
        id: "find-events",
        group: "residents",
        category: "Residents",
        question: "How do I find events near me?",
        answer:
            "Use the main events page and filter by date, category, location, cost or suitability. You can look for family events, free events, markets, festivals, sports activities, church events, youth activities and regular community groups.",
    },
    {
        id: "save-event",
        group: "residents",
        category: "Residents",
        question: "Can I save an event or add it to my calendar?",
        answer:
            "Yes. Event pages can include buttons to add the event to Google Calendar, Outlook or download an .ics calendar file for Apple Calendar and other calendar apps.",
    },
    {
        id: "submit-event",
        group: "organisers",
        category: "Posting events",
        question: "How do I post an event?",
        answer:
            "Sign in, choose Submit Event, complete the event form and send it for review. You should include the event name, organiser, date, time, venue, description, category, cost, booking link, contact details and an image or poster if available.",
        steps: [
            "Sign in to your account.",
            "Select Submit Event.",
            "Add the event title, date, time and venue.",
            "Add a clear description and choose a category.",
            "Add booking details, cost and contact information.",
            "Upload a poster or event image if you have one.",
            "Submit the event for review or publish if your organisation has approval rights.",
        ],
    },
    {
        id: "event-info-needed",
        group: "organisers",
        category: "Posting events",
        question: "What information should I include in an event listing?",
        answer:
            "A good event listing should include what the event is, who it is for, when it starts and ends, where it takes place, whether it is free or paid, how people book, accessibility information and who to contact with questions.",
    },
    {
        id: "event-review",
        group: "organisers",
        category: "Posting events",
        question: "Will my event be reviewed before it goes live?",
        answer:
            "Some accounts may be able to publish directly, but new organisers and unverified organisations may have events reviewed first. This helps keep the site accurate, safe and relevant to the local community.",
    },
    {
        id: "edit-event",
        group: "organisers",
        category: "Managing events",
        question: "Can I edit an event after posting it?",
        answer:
            "Yes, if you created the event or manage the organisation linked to it. You can update dates, times, descriptions, images, booking links, contact details and cancellation notices.",
    },
    {
        id: "cancel-event",
        group: "organisers",
        category: "Managing events",
        question: "What should I do if an event is cancelled?",
        answer:
            "Update the event as soon as possible and mark it as cancelled. The event page should clearly show the cancellation so residents do not attend unnecessarily. You can also use the share tools to post an update on Facebook or WhatsApp.",
    },
    {
        id: "recurring-events",
        group: "organisers",
        category: "Managing events",
        question: "Can I add recurring events?",
        answer:
            "Yes. Recurring events are useful for weekly groups, monthly clubs, term-time activities, church groups, youth sessions and regular community meetups. You should include the recurrence pattern, such as every Monday, monthly, term-time only or last Saturday of each month.",
    },
    {
        id: "claim-organisation",
        group: "organisations",
        category: "Organisation setup",
        question: "How does an organisation claim its page?",
        answer:
            "If your organisation already appears on Blackrod Now, choose Claim this organisation and complete the verification form. You may need to confirm your role, provide an official email address, link to your website or Facebook Page, or provide another reasonable proof that you represent the organisation.",
        steps: [
            "Open your organisation page.",
            "Select Claim this organisation.",
            "Confirm your name, role and contact details.",
            "Provide a website, official email address or Facebook Page link.",
            "Wait for approval.",
            "Once approved, you can manage organisation details and events.",
        ],
    },
    {
        id: "organisation-profile",
        group: "organisations",
        category: "Organisation setup",
        question: "What should an organisation profile include?",
        answer:
            "An organisation profile should include the organisation name, description, logo, contact email, phone number if public, venue or base, website, Facebook Page, regular activities, accessibility information and upcoming events.",
    },
    {
        id: "multiple-admins",
        group: "organisations",
        category: "Organisation setup",
        question: "Can more than one person manage an organisation?",
        answer:
            "Yes. Organisations should ideally have more than one trusted admin so events can still be updated if one person is unavailable. Admin access should only be given to people authorised to act for the organisation.",
    },
    {
        id: "facebook-connect",
        group: "facebook",
        category: "Facebook integration",
        question: "Can I connect my organisation’s Facebook Page?",
        answer:
            "The site can include a guided Connect with your Facebook Page process. Direct Facebook posting and automatic imports require the organisation’s Page admin to authorise the connection and grant the required Meta permissions. Until full integration is enabled, the site can still generate Facebook-ready posts and share links.",
    },
    {
        id: "facebook-admin",
        group: "facebook",
        category: "Facebook integration",
        question: "Do I need to be a Facebook Page admin?",
        answer:
            "Yes. Only someone with the correct Facebook Page admin access should connect a Page. This protects organisations and prevents unauthorised posting or importing.",
    },
    {
        id: "facebook-post-event",
        group: "facebook",
        category: "Facebook integration",
        question: "Can Blackrod Now post directly to our Facebook Page?",
        answer:
            "This can be added later through Meta’s Page permissions and app approval process. The recommended first version is a safer share toolkit: create the event on Blackrod Now, copy the Facebook-ready post, then paste or share it to your Facebook Page.",
    },
    {
        id: "facebook-import",
        group: "facebook",
        category: "Facebook integration",
        question: "Can a Facebook post automatically create an event on Blackrod Now?",
        answer:
            "This is possible for connected Facebook Pages, but the safest approach is to create draft events first. The system can detect likely event posts, extract details and ask the organisation to review and approve the listing before it appears publicly.",
    },
    {
        id: "facebook-copy-post",
        group: "facebook",
        category: "Facebook integration",
        question: "What is the Facebook-ready post button?",
        answer:
            "The Facebook-ready post button creates a formatted post using the event title, date, time, venue, organiser, description and event link. It can be copied and pasted into a Facebook Page, local group, WhatsApp community or newsletter.",
    },
    {
        id: "facebook-permissions",
        group: "facebook",
        category: "Facebook integration",
        question: "What permissions would Facebook connection need?",
        answer:
            "Depending on the features enabled, Facebook connection may require permissions to show the Pages a user manages, read Page engagement, read Page posts or publish Page posts. Organisations should only approve permissions they understand and need.",
    },
    {
        id: "volunteer-register",
        group: "volunteers",
        category: "Volunteers",
        question: "How do I register as a volunteer?",
        answer:
            "Create an account and choose Volunteer as your user type. You may then be able to follow organisations, respond to volunteer opportunities or receive updates when local groups need help.",
    },
    {
        id: "volunteer-events",
        group: "volunteers",
        category: "Volunteers",
        question: "Can organisations post volunteer opportunities?",
        answer:
            "Yes. Volunteer opportunities can be listed as events or community notices. They should include the role, date or ongoing commitment, location, age suitability, safeguarding requirements and who to contact.",
    },
    {
        id: "business-support",
        group: "businesses",
        category: "Local business support",
        question: "How can local businesses support events?",
        answer:
            "Local businesses can support events through raffle prizes, venue support, equipment, promotion or volunteering. Business support should be clearly labelled so residents understand whether a listing is community-focused rather than a commercial advertisement.",
    },
    {
        id: "business-post-events",
        group: "businesses",
        category: "Local business support",
        question: "Can businesses post events?",
        answer:
            "Yes, where the event is relevant to the local community. Examples might include charity fundraisers, open days, workshops, family activities, community markets or business-supported local events. Pure commercial advertising may be handled differently from community listings.",
    },
    {
        id: "moderation",
        group: "all",
        category: "Safety & moderation",
        question: "Why are some events moderated?",
        answer:
            "Moderation helps keep the site accurate, safe and useful. It reduces spam, duplicate listings, incorrect information, unauthorised claims and content that is not relevant to Blackrod or the surrounding community.",
    },
    {
        id: "report-problem",
        group: "all",
        category: "Safety & moderation",
        question: "How do I report incorrect information?",
        answer:
            "Use the Suggest an update button on the event or organisation page. Include what needs changing and, where possible, provide a source such as an organiser message, poster, official website or Facebook Page link.",
    },
    {
        id: "data-privacy",
        group: "all",
        category: "Safety & moderation",
        question: "What personal information is shown publicly?",
        answer:
            "Public pages should show only the information needed to promote the event or organisation. Personal contact details should only be shown where the organiser has chosen to publish them. Organisation emails are usually better than personal emails.",
    },
    {
        id: "support",
        group: "all",
        category: "Support",
        question: "How do I get help?",
        answer:
            "Use the contact or support option on the site. When asking for help, include your name, organisation if relevant, the event or page affected, and a clear description of the issue.",
    },
];

const categoryOrder = [
    "Getting started",
    "Account setup",
    "Residents",
    "Posting events",
    "Managing events",
    "Organisation setup",
    "Facebook integration",
    "Volunteers",
    "Local business support",
    "Safety & moderation",
    "Support",
];

export default function FAQ() {
    const [selectedGroup, setSelectedGroup] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [openItems, setOpenItems] = useState(["what-is-blackrod-now"]);

    const filteredFaqs = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();

        return faqItems.filter((item) => {
            const matchesGroup =
                selectedGroup === "all" ||
                item.group === selectedGroup ||
                item.group === "all";

            const matchesSearch =
                !query ||
                item.question.toLowerCase().includes(query) ||
                item.answer.toLowerCase().includes(query) ||
                item.category.toLowerCase().includes(query);

            return matchesGroup && matchesSearch;
        });
    }, [selectedGroup, searchTerm]);

    const groupedFaqs = useMemo(() => {
        return filteredFaqs.reduce((acc, item) => {
            if (!acc[item.category]) {
                acc[item.category] = [];
            }

            acc[item.category].push(item);
            return acc;
        }, {});
    }, [filteredFaqs]);

    const selectedGroupLabel =
        userGroups.find((group) => group.id === selectedGroup)?.label || "All users";

    const toggleItem = (id) => {
        setOpenItems((current) =>
            current.includes(id)
                ? current.filter((itemId) => itemId !== id)
                : [...current, id]
        );
    };

    const clearFilters = () => {
        setSelectedGroup("all");
        setSearchTerm("");
    };

    return (
        <main className="min-h-screen bg-background">
            <section className="relative overflow-hidden border-b border-border bg-surface">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(0,0,0,0.08),_transparent_35%)] pointer-events-none" />

                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
                    <div className="max-w-4xl">
                        <p className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary">
                            <HelpCircle className="h-4 w-4" />
                            Help Centre
                        </p>

                        <h1 className="mt-6 font-display text-4xl sm:text-6xl font-black tracking-tight leading-tight">
                            Blackrod Now FAQs
                        </h1>

                        <p className="mt-5 max-w-3xl text-base sm:text-lg text-muted-foreground leading-relaxed">
                            Find help with setting up your account, registering your
                            organisation, posting events, managing listings, sharing to
                            Facebook, connecting a Facebook Page and using Blackrod Now as
                            a community events hub.
                        </p>

                        <div className="mt-8 grid gap-3 sm:grid-cols-3">
                            <HeroStat
                                icon={UserPlus}
                                label="Account setup"
                                text="Register as a resident, organiser or organisation admin."
                            />
                            <HeroStat
                                icon={CalendarDays}
                                label="Event posting"
                                text="Submit, edit, share and manage local events."
                            />
                            <HeroStat
                                icon={Share2}
                                label="Facebook support"
                                text="Prepare for Page connection, sharing and event imports."
                            />
                        </div>
                    </div>
                </div>
            </section>

            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                    <aside className="lg:sticky lg:top-6 h-fit space-y-5">
                        <div className="rounded-3xl border border-border bg-surface p-5">
                            <h2 className="font-display font-bold text-xl">
                                Filter by user group
                            </h2>

                            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                                Choose the type of user you are to see the most relevant
                                help.
                            </p>

                            <div className="mt-5 space-y-2">
                                {userGroups.map((group) => {
                                    const Icon = group.icon;
                                    const active = selectedGroup === group.id;

                                    return (
                                        <button
                                            key={group.id}
                                            type="button"
                                            onClick={() => setSelectedGroup(group.id)}
                                            className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                                                active
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-background hover:bg-muted text-foreground"
                                            }`}
                                        >
                                            <Icon className="h-4 w-4 shrink-0" />
                                            <span>{group.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="rounded-3xl border border-border bg-surface p-5">
                            <h2 className="font-display font-bold text-xl">
                                Popular actions
                            </h2>

                            <div className="mt-4 space-y-3">
                                <QuickAction
                                    icon={UserPlus}
                                    title="Create an account"
                                    text="Register and choose your user type."
                                />
                                <QuickAction
                                    icon={CalendarDays}
                                    title="Post an event"
                                    text="Submit an event for the community calendar."
                                />
                                <QuickAction
                                    icon={Building2}
                                    title="Claim an organisation"
                                    text="Request admin access for your group or venue."
                                />
                                <QuickAction
                                    icon={Share2}
                                    title="Connect Facebook"
                                    text="Prepare your Page for guided connection."
                                />
                            </div>
                        </div>

                        <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5">
                            <div className="flex items-start gap-3">
                                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
                                    <Mail className="h-4 w-4" />
                                </div>

                                <div>
                                    <h2 className="font-display font-bold text-lg">
                                        Still need help?
                                    </h2>
                                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                                        Contact the Blackrod Now team with your name,
                                        organisation, event link and a short description of
                                        what you need.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </aside>

                    <div>
                        <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-primary">
                                        Showing help for
                                    </p>
                                    <h2 className="mt-1 font-display font-black text-2xl">
                                        {selectedGroupLabel}
                                    </h2>
                                </div>

                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
                                >
                                    Clear filters
                                </button>
                            </div>

                            <div className="relative mt-5">
                                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                                <input
                                    type="search"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search account setup, events, Facebook, organisations..."
                                    className="w-full rounded-2xl border border-border bg-background py-3 pl-11 pr-4 text-sm outline-none focus:border-primary"
                                />
                            </div>
                        </div>

                        <div className="mt-6 space-y-6">
                            {filteredFaqs.length === 0 && (
                                <div className="rounded-3xl border border-border bg-surface p-8 text-center">
                                    <h3 className="font-display font-bold text-2xl">
                                        No FAQs found
                                    </h3>
                                    <p className="mt-2 text-muted-foreground">
                                        Try a different search term or clear the filters.
                                    </p>
                                </div>
                            )}

                            {categoryOrder
                                .filter((category) => groupedFaqs[category]?.length)
                                .map((category) => (
                                    <section
                                        key={category}
                                        className="rounded-3xl border border-border bg-surface p-5 sm:p-6"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                                                <HelpCircle className="h-4 w-4" />
                                            </div>

                                            <div>
                                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                    FAQ category
                                                </p>
                                                <h2 className="font-display font-black text-2xl">
                                                    {category}
                                                </h2>
                                            </div>
                                        </div>

                                        <div className="mt-5 divide-y divide-border">
                                            {groupedFaqs[category].map((item) => {
                                                const open = openItems.includes(item.id);

                                                return (
                                                    <article
                                                        key={item.id}
                                                        className="py-4 first:pt-0 last:pb-0"
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                toggleItem(item.id)
                                                            }
                                                            className="w-full flex items-start justify-between gap-4 text-left"
                                                        >
                                                            <div>
                                                                <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                                    {item.category}
                                                                </span>

                                                                <h3 className="mt-2 font-display text-lg sm:text-xl font-bold">
                                                                    {item.question}
                                                                </h3>
                                                            </div>

                                                            <ChevronDown
                                                                className={`mt-2 h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
                                                                    open
                                                                        ? "rotate-180"
                                                                        : ""
                                                                }`}
                                                            />
                                                        </button>

                                                        {open && (
                                                            <div className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                                                                <p>{item.answer}</p>

                                                                {item.steps && (
                                                                    <ol className="mt-4 space-y-2">
                                                                        {item.steps.map(
                                                                            (
                                                                                step,
                                                                                index
                                                                            ) => (
                                                                                <li
                                                                                    key={`${item.id}-${index}`}
                                                                                    className="flex gap-3"
                                                                                >
                                                                                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                                                                                        {index +
                                                                                            1}
                                                                                    </span>
                                                                                    <span>
                                                                                        {
                                                                                            step
                                                                                        }
                                                                                    </span>
                                                                                </li>
                                                                            )
                                                                        )}
                                                                    </ol>
                                                                )}
                                                            </div>
                                                        )}
                                                    </article>
                                                );
                                            })}
                                        </div>
                                    </section>
                                ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="border-t border-border bg-surface">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                    <div className="rounded-3xl bg-background border border-border p-6 sm:p-8">
                        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                                    For organisations
                                </p>

                                <h2 className="mt-2 font-display font-black text-2xl sm:text-3xl">
                                    Ready to start posting community events?
                                </h2>

                                <p className="mt-3 max-w-3xl text-sm sm:text-base text-muted-foreground leading-relaxed">
                                    Create an account, claim your organisation and start
                                    submitting events. You can also use the event sharing
                                    tools to create Facebook-ready posts, WhatsApp messages
                                    and calendar links.
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <a
                                    href="/register"
                                    className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:scale-105 transition-transform"
                                >
                                    <UserPlus className="h-4 w-4" />
                                    Register
                                </a>

                                <a
                                    href="/submit-event"
                                    className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-semibold hover:bg-muted"
                                >
                                    <CalendarDays className="h-4 w-4" />
                                    Submit event
                                </a>

                                <a
                                    href="/facebook-connect"
                                    className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-semibold hover:bg-muted"
                                >
                                    <Share2 className="h-4 w-4" />
                                    Facebook setup
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* NEWSLETTER */}
            <NewsletterSection />
        </main>
    );
}

const HeroStat = ({ icon: Icon, label, text }) => (
    <div className="rounded-3xl border border-border bg-background/80 p-5">
        <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
            </div>

            <div>
                <h3 className="font-bold text-sm">{label}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {text}
                </p>
            </div>
        </div>
    </div>
);

const QuickAction = ({ icon: Icon, title, text }) => (
    <div className="flex gap-3 rounded-2xl border border-border bg-background p-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
        </div>

        <div>
            <h3 className="text-sm font-bold">{title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {text}
            </p>
        </div>
    </div>
);