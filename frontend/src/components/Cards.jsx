import React from "react";
import { Link } from "react-router-dom";
import {
    CalendarDays,
    Clock,
    MapPin,
    Tag,
    PoundSterling,
    Users,
    Accessibility,
    ArrowUpRight,
    Heart,
    Mail,
    MessageSquare,
    Share2,
} from "lucide-react";
import OrgAvatar from "@/components/OrgAvatar";
import ShareButtons from "@/components/ShareButtons";
import { api } from "@/lib/api";
import {
    getFeedLikeState,
    sendVolunteerDashboardEnquiry,
    toggleFeedLike,
} from "@/lib/communityActions";
import { resolveEventImage } from "@/lib/eventCategoryImage";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";

// Category → colour key (pill backgrounds)
const CAT_STYLE = {
    Family: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200",
    Youth: "bg-rose-100 text-rose-900 dark:bg-rose-500/15 dark:text-rose-200",
    Sport: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200",
    School: "bg-violet-100 text-violet-900 dark:bg-violet-500/15 dark:text-violet-200",
    Charity: "bg-pink-100 text-pink-900 dark:bg-pink-500/15 dark:text-pink-200",
    Business: "bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-200",
    Community: "bg-secondary text-secondary-foreground",
    Music: "bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-500/15 dark:text-fuchsia-200",
    "Food & Drink": "bg-orange-100 text-orange-900 dark:bg-orange-500/15 dark:text-orange-200",
    Volunteering: "bg-lime-100 text-lime-900 dark:bg-lime-500/15 dark:text-lime-200",
    Faith: "bg-indigo-100 text-indigo-900 dark:bg-indigo-500/15 dark:text-indigo-200",
    Heritage: "bg-stone-200 text-stone-900 dark:bg-stone-500/15 dark:text-stone-200",
    "Health & Wellbeing": "bg-teal-100 text-teal-900 dark:bg-teal-500/15 dark:text-teal-200",
};

export const CategoryBadge = ({ category }) => (
    <span
        data-testid={`cat-badge-${category}`}
        className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-[0.1em] uppercase ${
            CAT_STYLE[category] || "bg-muted text-foreground"
        }`}
    >
        {category}
    </span>
);

// Event times are stored as UK wall-clock strings — render the literal digits,
// never convert through the browser timezone (that caused the BST drift bug).
const formatDate = (iso) => {
    const d = new Date(String(iso).slice(0, 16));
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
};
const formatTime = (iso) => String(iso).slice(11, 16);

export const isMultiDay = (event) =>
    !!event?.end && String(event.end).slice(0, 10) !== String(event.start).slice(0, 10);

const LINK_RE = /(https?:\/\/[^\s]+)/gi;

const renderTextWithLinks = (text) => {
    const parts = String(text || "").split(LINK_RE);
    return parts.map((part, idx) => {
        if (part.match(/^https?:\/\//i)) {
            const clean = part.replace(/[.,;!?]+$/, "");
            return (
                <a
                    key={`link-${idx}-${clean}`}
                    href={clean}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline break-all"
                >
                    {clean}
                </a>
            );
        }
        return <React.Fragment key={`txt-${idx}`}>{part}</React.Fragment>;
    });
};

export const EventCard = ({ event, featured = false, orgName }) => {
    const { isEventSaved, toggleSaveEvent } = useApp();
    const saved = isEventSaved?.(event.id);
    const eventImage = resolveEventImage(event);

    return (
        <article
            data-testid={`event-card-${event.id}`}
            className={`group relative flex flex-col bg-surface rounded-3xl border border-border overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_14px_44px_-12px_rgba(0,0,0,0.18)] dark:hover:shadow-[0_14px_44px_-12px_rgba(0,0,0,0.5)] hover:border-primary/30 ${
                featured ? "md:flex-row md:col-span-2" : ""
            }`}
        >
            <button
                type="button"
                data-testid={`save-event-${event.id}`}
                aria-label={saved ? "Remove from saved events" : "Save this event"}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const nextSaved = toggleSaveEvent(event.id);
                    toast.success(nextSaved ? "Saved to your shortlist" : "Removed from shortlist");
                }}
                className={`absolute top-3 right-3 z-20 h-9 w-9 rounded-full border backdrop-blur grid place-items-center transition ${saved ? "bg-primary text-primary-foreground border-primary" : "bg-background/85 text-foreground border-border hover:border-primary/40"}`}
            >
                <Heart className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
            </button>

            <Link to={`/events/${event.id}`} className="contents">
                <div
                    className={`relative overflow-hidden bg-muted ${
                        featured ? "md:w-1/2 aspect-[4/3] md:aspect-auto" : "aspect-[16/10]"
                    }`}
                >
                    <img
                        src={eventImage}
                        alt={event.title}
                        className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
                        loading="lazy"
                    />
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                        <CategoryBadge category={event.category} />
                        {event.cost === "Free" && (
                            <span className="px-2 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-secondary text-secondary-foreground">
                                Free
                            </span>
                        )}
                        {event.recurrence?.term_time_only && (
                            <span
                                data-testid={`term-time-badge-${event.id}`}
                                className="px-2 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-100 text-amber-900"
                            >
                                Term-time only
                            </span>
                        )}
                    </div>
                    <div className="absolute bottom-3 left-3 bg-background/90 backdrop-blur rounded-2xl px-3 py-2 flex items-center gap-3">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        <div className="leading-tight">
                            <div className="text-xs font-bold tracking-wide uppercase">
                                {formatDate(event.start)}{isMultiDay(event) ? ` – ${formatDate(event.end)}` : ""}
                            </div>
                            <div className="text-[11px] text-muted-foreground">{formatTime(event.start)}</div>
                        </div>
                    </div>
                </div>
                <div className="p-6 flex flex-col gap-3 flex-1">
                    <h3 className="font-display font-bold text-xl sm:text-2xl tracking-tight text-foreground group-hover:text-primary transition-colors">
                        {event.title}
                    </h3>
                    {orgName && (
                        <div className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                            {orgName}
                        </div>
                    )}
                    <p className="text-sm text-muted-foreground line-clamp-3">{event.description}</p>
                    <div className="mt-auto flex items-center gap-4 text-xs text-muted-foreground pt-2">
                        <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {event.venue}
                        </span>
                        <span className="ml-auto inline-flex items-center gap-1 text-primary font-semibold">
                            View <ArrowUpRight className="h-3.5 w-3.5" />
                        </span>
                    </div>
                </div>
            </Link>
        </article>
    );
};

export const OrgCard = ({ org }) => (
    <Link
        to={`/organisations/${org.slug}`}
        data-testid={`org-card-${org.slug}`}
        className="group flex flex-col bg-surface rounded-3xl border border-border overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_14px_44px_-12px_rgba(0,0,0,0.18)] dark:hover:shadow-[0_14px_44px_-12px_rgba(0,0,0,0.5)] hover:border-primary/30"
    >
        <div
            className="relative h-28 overflow-hidden"
            style={{
                background: `linear-gradient(135deg, ${org.brandColor}AA, ${org.brandColor}55)`,
            }}
        >
            {org.cover_path ? (
                <img
                    src={api.orgCoverUrl(org.slug, org.updated_at || "")}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
                />
            ) : org.cover ? (
                <img
                    src={org.cover}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-700"
                />
            ) : null}
            <div className="absolute -bottom-6 left-5">
                <OrgAvatar org={org} size={56} thumb rounded="rounded-2xl" className="shadow-md" />
            </div>
        </div>
        <div className="px-5 pt-9 pb-5 flex flex-col gap-2 flex-1">
            <div className="flex items-start justify-between gap-2">
                <h3 className="font-display font-bold text-lg leading-tight group-hover:text-primary transition-colors">
                    {org.name}
                </h3>
            </div>
            <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground">
                {org.category}
            </span>
            <p className="text-sm text-muted-foreground line-clamp-2">{org.short}</p>
            <div className="mt-auto flex items-center justify-between pt-3 text-xs">
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {org.upcoming} upcoming
                </span>
                <span className="inline-flex items-center gap-1 text-primary font-semibold">
                    View profile <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
            </div>
        </div>
    </Link>
);

export const VolunteerCard = ({ opp, orgName }) => {
    const { orgs } = useApp();
    const org = orgs.find((item) => item.slug === opp.orgSlug);
    const suppliedEmail = String(org?.email || "").trim();
    const [showContactForm, setShowContactForm] = React.useState(false);
    const [contactBusy, setContactBusy] = React.useState(false);
    const [contactForm, setContactForm] = React.useState({
        name: "",
        email: "",
        message: `Hi, I'm interested in the “${opp.title}” volunteering opportunity listed on Blackrod Now. Could you send me some more information?`,
    });

    const trackContact = () => {
        api.trackAnalytics({
            kind: "volunteer_contact",
            entity_id: opp.id,
            org_slug: opp.orgSlug,
        }).catch(() => {});
    };

    const openEmail = (email, form = contactForm) => {
        const subject = `Volunteering enquiry – ${opp.title}`;
        const body = [
            `Hello ${org?.name || orgName || "there"},`,
            "",
            form.message || `I'm interested in the “${opp.title}” volunteering opportunity listed on Blackrod Now.`,
            "",
            form.name ? `Name: ${form.name}` : "",
            form.email ? `Reply email: ${form.email}` : "",
            "",
            "Sent from Blackrod Now",
        ].filter((line) => line !== "").join("\n");

        window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    const handleContact = () => {
        trackContact();
        if (suppliedEmail) {
            openEmail(suppliedEmail, {
                ...contactForm,
                message: `I'm interested in the “${opp.title}” volunteering opportunity listed on Blackrod Now. Could you send me some more information?`,
            });
            return;
        }
        setShowContactForm((open) => !open);
    };

    const submitDashboardEnquiry = async (event) => {
        event.preventDefault();
        setContactBusy(true);
        try {
            const result = await sendVolunteerDashboardEnquiry(opp.id, contactForm);
            if (result?.mode === "email" && result?.email) {
                openEmail(result.email, contactForm);
                setShowContactForm(false);
                return;
            }
            toast.success("Message sent to the organisation", {
                description: "It will appear in their Blackrod Now dashboard.",
            });
            setShowContactForm(false);
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not send your message");
        } finally {
            setContactBusy(false);
        }
    };

    return (
        <div
            data-testid={`volunteer-card-${opp.id}`}
            className="group bg-surface rounded-3xl border border-border p-6 flex flex-col gap-3 transition-all duration-300 hover:-translate-y-1 hover:border-secondary hover:shadow-lg"
        >
            <div className="flex items-center gap-2">
                <span className="px-2 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-secondary text-secondary-foreground">
                    Volunteer
                </span>
                <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                    {orgName}
                </span>
            </div>
            <h3 className="font-display font-bold text-lg leading-tight">{opp.title}</h3>
            <p className="text-sm text-muted-foreground">{opp.description}</p>
            <div className="mt-2 grid grid-cols-1 gap-1.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                    <Users className="h-3.5 w-3.5" /> Age: {opp.age}
                </span>
                <span className="inline-flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" /> {opp.time}
                </span>
                <span className="inline-flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5" /> {opp.skills}
                </span>
            </div>
            <button
                type="button"
                data-testid={`volunteer-contact-${opp.id}`}
                onClick={handleContact}
                className="mt-3 self-start inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-foreground text-background hover:scale-105 transition-transform"
            >
                {suppliedEmail ? <Mail className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                Get in touch
            </button>

            {!suppliedEmail && showContactForm && (
                <form
                    onSubmit={submitDashboardEnquiry}
                    className="mt-2 rounded-2xl border border-border bg-background p-4 space-y-3"
                    data-testid={`volunteer-contact-form-${opp.id}`}
                >
                    <p className="text-xs text-muted-foreground">
                        This organisation has not published an email address. Your message will be sent directly to its Blackrod Now dashboard instead.
                    </p>
                    <input
                        type="text"
                        value={contactForm.name}
                        onChange={(e) => setContactForm((current) => ({ ...current, name: e.target.value }))}
                        placeholder="Your name"
                        maxLength={120}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-sm"
                    />
                    <input
                        type="email"
                        required
                        value={contactForm.email}
                        onChange={(e) => setContactForm((current) => ({ ...current, email: e.target.value }))}
                        placeholder="Your email"
                        className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-sm"
                    />
                    <textarea
                        required
                        minLength={5}
                        maxLength={3000}
                        rows={4}
                        value={contactForm.message}
                        onChange={(e) => setContactForm((current) => ({ ...current, message: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-sm resize-y"
                    />
                    <div className="flex gap-2 flex-wrap">
                        <button
                            type="submit"
                            disabled={contactBusy}
                            className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-60"
                        >
                            {contactBusy ? "Sending…" : "Send message"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowContactForm(false)}
                            className="px-4 py-2 rounded-full border border-border text-xs font-semibold"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export const FeedCard = ({ post, orgName, orgLogo, orgSlug, org }) => {
    const when = new Date(post.time);
    const orgLike = org || { slug: orgSlug, logo: orgLogo, name: orgName };
    const [liked, setLiked] = React.useState(false);
    const [likeCount, setLikeCount] = React.useState(0);
    const [likeBusy, setLikeBusy] = React.useState(false);
    const [shareOpen, setShareOpen] = React.useState(false);

    React.useEffect(() => {
        let active = true;
        getFeedLikeState(post.id)
            .then((state) => {
                if (!active) return;
                setLiked(Boolean(state?.liked));
                setLikeCount(Number(state?.likes || 0));
            })
            .catch(() => {});
        return () => {
            active = false;
        };
    }, [post.id]);

    const handleLike = async () => {
        if (likeBusy) return;
        setLikeBusy(true);
        try {
            const result = await toggleFeedLike(post.id, liked ? "remove" : "add");
            setLiked(Boolean(result?.liked));
            setLikeCount(Number(result?.likes || 0));
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not update like");
        } finally {
            setLikeBusy(false);
        }
    };

    const shareUrl = typeof window !== "undefined"
        ? `${window.location.origin}/local-feed#update-${post.id}`
        : "";
    const shareText = [
        post.title,
        String(post.body || "").replace(/\s+/g, " ").trim().slice(0, 220),
        orgName ? `From ${orgName} on Blackrod Now` : "On Blackrod Now",
    ].filter(Boolean).join("\n\n");

    return (
        <article
            id={`update-${post.id}`}
            data-testid={`feed-card-${post.id}`}
            className="bg-surface rounded-3xl border border-border p-6 flex flex-col gap-3 scroll-mt-24"
        >
            <div className="flex items-center gap-3">
                <Link
                    to={`/organisations/${orgSlug}`}
                    className="shrink-0"
                >
                    <OrgAvatar org={orgLike} size={44} thumb rounded="rounded-2xl" />
                </Link>
                <div className="flex-1">
                    <Link to={`/organisations/${orgSlug}`} className="font-semibold text-sm hover:text-primary">
                        {orgName}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                        {post.type} • {when.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                </div>
            </div>
            <h3 className="font-display font-bold text-lg leading-tight">{post.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{renderTextWithLinks(post.body)}</p>
            {post.image && (
                <img
                    src={post.image}
                    alt=""
                    className="rounded-2xl object-cover w-full max-h-64"
                    loading="lazy"
                />
            )}
            <div className="flex items-center gap-3 pt-1">
                <button
                    type="button"
                    data-testid={`feed-like-${post.id}`}
                    onClick={handleLike}
                    disabled={likeBusy}
                    className={`inline-flex items-center gap-1.5 text-xs transition disabled:opacity-60 ${liked ? "text-accent font-semibold" : "text-muted-foreground hover:text-accent"}`}
                    aria-pressed={liked}
                >
                    <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} />
                    {liked ? "Liked" : "Like"}
                    {likeCount > 0 && <span aria-label={`${likeCount} likes`}>({likeCount})</span>}
                </button>
                <span className="text-xs text-muted-foreground">•</span>
                <button
                    type="button"
                    data-testid={`feed-share-${post.id}`}
                    onClick={() => setShareOpen((open) => !open)}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
                    aria-expanded={shareOpen}
                >
                    <Share2 className="h-3.5 w-3.5" /> Share
                </button>
            </div>
            {shareOpen && (
                <div className="pt-1" data-testid={`feed-share-options-${post.id}`}>
                    <ShareButtons
                        text={shareText}
                        title={post.title}
                        url={shareUrl}
                        platforms={["native", "facebook", "whatsapp", "linkedin", "twitter", "instagram", "copy"]}
                        analytics={{
                            entityType: "org",
                            entityId: orgSlug,
                            orgSlug,
                        }}
                    />
                </div>
            )}
        </article>
    );
};

export const VenueCard = ({ venue, eventCount }) => (
    <div
        data-testid={`venue-card-${venue.id}`}
        className="bg-surface rounded-3xl border border-border overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
    >
        <div className="relative aspect-[16/9] bg-muted overflow-hidden">
            {venue.image && (
                <img
                    src={venue.image}
                    alt={venue.name}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                />
            )}
            <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-background/90 backdrop-blur">
                Capacity {venue.capacity}
            </div>
        </div>
        <div className="p-6 flex flex-col gap-2 flex-1">
            <h3 className="font-display font-bold text-lg">{venue.name}</h3>
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {venue.address}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-1">
                {venue.facilities.map((f) => (
                    <span
                        key={f}
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-foreground/80"
                    >
                        {f}
                    </span>
                ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                <Accessibility className="h-3.5 w-3.5" /> {venue.accessibility}
            </p>
            <div className="mt-auto pt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{eventCount || 0} upcoming events</span>
                <a
                    href={venue.booking}
                    className="text-xs font-semibold text-primary inline-flex items-center gap-1"
                >
                    Enquire <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
            </div>
        </div>
    </div>
);

// Compact helpers
export const Stat = ({ label, value, icon: Icon, tone = "default" }) => (
    <div
        data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}
        className={`rounded-3xl border border-border bg-surface p-5 flex items-center gap-4 ${
            tone === "primary" ? "ring-2 ring-primary/20" : ""
        }`}
    >
        {Icon && (
            <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary grid place-items-center">
                <Icon className="h-5 w-5" />
            </div>
        )}
        <div>
            <div className="text-2xl font-display font-bold leading-none">{value}</div>
            <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">{label}</div>
        </div>
    </div>
);

export { CAT_STYLE, formatDate, formatTime, PoundSterling };
