import React, { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useApp, eventsByOrg } from "@/context/AppContext";
import { CategoryBadge, formatDate, formatTime } from "@/components/Cards";
import NewsletterSection from "@/components/NewsletterSection";
import ShareButtons from "@/components/ShareButtons";
import PostNowDialog from "@/components/PostNowDialog";
import { ReportButton } from "@/components/ReportButton";
import { API, api } from "@/lib/api";
import {
    CalendarDays,
    MapPin,
    PoundSterling,
    Users,
    Accessibility,
    Mail,
    Phone,
    Share2,
    ArrowLeft,
    ExternalLink,
    Copy,
    Download,
    Edit3,
    ShieldCheck,
    Heart,
    Rocket,
} from "lucide-react";
import { toast } from "sonner";

const SITE_NAME = "RodLife";

const SITE_ORIGIN =
    typeof window !== "undefined"
        ? window.location.origin
        : "https://rodlife.co.uk";

const formatCalendarDate = (date) => {
    return new Date(date)
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
};

const escapeIcsText = (value = "") => {
    return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;");
};

const buildCalendarUrl = (event, provider) => {
    const start = new Date(event.start);
    const end = new Date(event.end);

    const location = [event.venue, event.address].filter(Boolean).join(", ");
    const description = event.description || "";

    if (provider === "google") {
        const params = new URLSearchParams({
            action: "TEMPLATE",
            text: event.title,
            details: description,
            location,
            dates: `${formatCalendarDate(start)}/${formatCalendarDate(end)}`,
        });

        return `https://calendar.google.com/calendar/render?${params.toString()}`;
    }

    if (provider === "outlook") {
        const params = new URLSearchParams({
            path: "/calendar/action/compose",
            rru: "addevent",
            subject: event.title,
            body: description,
            location,
            startdt: start.toISOString(),
            enddt: end.toISOString(),
        });

        return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
    }

    return "#";
};

const buildIcsContent = (event, eventUrl) => {
    const start = formatCalendarDate(event.start);
    const end = formatCalendarDate(event.end);
    const location = [event.venue, event.address].filter(Boolean).join(", ");
    const description = `${event.description || ""}\n\nFull details: ${eventUrl}`;

    return [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        `PRODID:-//${SITE_NAME}//Events Calendar//EN`,
        "BEGIN:VEVENT",
        `UID:${event.id}@rodlife-events`,
        `DTSTAMP:${formatCalendarDate(new Date())}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${escapeIcsText(event.title)}`,
        `DESCRIPTION:${escapeIcsText(description)}`,
        `LOCATION:${escapeIcsText(location)}`,
        `URL:${eventUrl}`,
        "END:VEVENT",
        "END:VCALENDAR",
    ].join("\r\n");
};

const downloadIcsFile = (event, eventUrl) => {
    const ics = buildIcsContent(event, eventUrl);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${event.id || "event"}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
};

const buildFacebookPost = (event, eventUrl, org) => {
    const date = formatDate(event.start);
    const startTime = formatTime(event.start);
    const endTime = formatTime(event.end);
    const location = [event.venue, event.address].filter(Boolean).join(", ");
    const organiser = org?.name || event.organiser || "";

    return [
        `🎉 Blackrod Event: ${event.title}`,
        "",
        `📅 ${date}`,
        `🕒 ${startTime}${endTime ? ` – ${endTime}` : ""}`,
        location ? `📍 ${location}` : "",
        organiser ? `👥 Organised by ${organiser}` : "",
        event.cost ? `💷 ${event.cost}` : "",
        "",
        event.description ? event.description.trim() : "",
        "",
        "Full details:",
        eventUrl,
        "",
        "#Blackrod #BlackrodEvents #Horwich #SouthHorwich #CommunityEvents",
    ]
        .filter(Boolean)
        .join("\n");
};

const copyToClipboard = async (text, successMessage) => {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(successMessage);
    } catch {
        toast.error("Could not copy to clipboard");
    }
};

export default function EventDetail() {
    const { id } = useParams();
    const { events, orgs, role, isEventSaved, toggleSaveEvent } = useApp();
    const [postNowOpen, setPostNowOpen] = React.useState(false);
    const event = events.find((e) => e.id === id);
    const org = orgs.find((o) => o.slug === event?.orgSlug);

    useEffect(() => {
        if (!event?.id) return;
        api.trackAnalytics({
            kind: "event_view",
            entity_type: "event",
            entity_id: event.id,
            org_slug: event.orgSlug,
        }).catch(() => {});
    }, [event?.id, event?.orgSlug]);

    if (!event) {
        return (
            <div className="max-w-3xl mx-auto py-24 px-6 text-center">
                <h1 className="font-display font-bold text-3xl">Event not found</h1>
                <p className="mt-3 text-muted-foreground">
                    It might have been moved or removed.
                </p>
                <Link
                    to="/events"
                    className="mt-6 inline-flex text-primary font-semibold"
                >
                    Back to all events
                </Link>
            </div>
        );
    }

    const eventUrl =
        typeof window !== "undefined"
            ? window.location.href
            : `${SITE_ORIGIN}/events/${event.id}`;

    // Crawler-friendly URL that renders per-event OG tags; redirects humans
    // to the canonical `eventUrl`. Used for FB / LinkedIn / X / WhatsApp
    // shares so each post gets a rich preview card.
    const shareOgUrl = `${API}/events/${event.id}/og`;

    const location = [event.venue, event.address].filter(Boolean).join(", ");
    const facebookPost = buildFacebookPost(event, eventUrl, org);
    const saved = isEventSaved?.(event.id);

    const shareNative = async () => {
        try {
            if (navigator.share) {
                await navigator.share({
                    title: event.title,
                    text: `Blackrod Event: ${event.title}`,
                    url: eventUrl,
                });
            } else {
                await copyToClipboard(eventUrl, "Event link copied");
            }
        } catch {
            // User cancelled native share.
        }
    };

    const downloadPoster = async () => {
        if (!event.image) {
            toast.info("No event poster is available for this event yet.");
            return;
        }

        const imageUrl = event.image.startsWith("http")
            ? event.image
            : `${SITE_ORIGIN}${event.image}`;

        await copyToClipboard(imageUrl, "Poster image link copied");
    };

    const eventSchema = {
        "@context": "https://schema.org",
        "@type": "Event",
        name: event.title,
        description: event.description,
        startDate: new Date(event.start).toISOString(),
        endDate: new Date(event.end).toISOString(),
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        image: event.image
            ? event.image.startsWith("http")
                ? event.image
                : `${SITE_ORIGIN}${event.image}`
            : undefined,
        url: eventUrl,
        location: {
            "@type": "Place",
            name: event.venue || "Blackrod",
            address: {
                "@type": "PostalAddress",
                streetAddress: event.address || "",
                addressLocality: "Blackrod",
                addressRegion: "Greater Manchester",
                addressCountry: "GB",
            },
        },
        organizer: {
            "@type": "Organization",
            name: org?.name || event.organiser || SITE_NAME,
            url: org?.website || undefined,
        },
        offers: event.cost
            ? {
                  "@type": "Offer",
                  price: event.cost.toLowerCase().includes("free") ? "0" : undefined,
                  priceCurrency: "GBP",
                  availability: "https://schema.org/InStock",
                  url: event.booking || eventUrl,
              }
            : undefined,
    };

    return (
        <div
            data-testid={`event-detail-${event.id}`}
            className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10"
        >
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(eventSchema),
                }}
            />

            <Link
                to="/events"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
            >
                <ArrowLeft className="h-4 w-4" /> All events
            </Link>

            <div className="rounded-3xl overflow-hidden border border-border bg-surface">
                <div className="relative aspect-[16/8] bg-muted overflow-hidden">
                    {event.image && (
                        <img
                            src={event.image}
                            alt={`${event.title} event poster`}
                            className="absolute inset-0 h-full w-full object-cover"
                        />
                    )}

                    <div className="absolute top-4 left-4 flex gap-2">
                        <CategoryBadge category={event.category} />

                        {event.cost?.toLowerCase().includes("free") && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-secondary text-secondary-foreground">
                                Free
                            </span>
                        )}
                    </div>
                </div>

                <div className="p-6 sm:p-10">
                    <h1 className="font-display font-black text-3xl sm:text-5xl tracking-tight leading-tight">
                        {event.title}
                    </h1>

                    {org && (
                        <Link
                            to={`/organisations/${org.slug}`}
                            className="inline-flex items-center gap-2 mt-3 text-sm font-semibold text-primary"
                        >
                            <span className="text-lg">{org.logo}</span> {org.name}
                        </Link>
                    )}

                    <div className="mt-8 grid sm:grid-cols-2 gap-5">
                        <InfoRow
                            icon={CalendarDays}
                            label="When"
                            value={`${formatDate(event.start)} · ${formatTime(
                                event.start
                            )} – ${formatTime(event.end)}`}
                        />

                        <InfoRow
                            icon={MapPin}
                            label="Where"
                            value={location || "Blackrod"}
                        />

                        <InfoRow
                            icon={PoundSterling}
                            label="Cost"
                            value={event.cost || "Not specified"}
                        />

                        <InfoRow
                            icon={Users}
                            label="Suitable for"
                            value={event.age || "Not specified"}
                        />

                        <InfoRow
                            icon={Accessibility}
                            label="Accessibility"
                            value={event.accessibility || "Not specified"}
                        />

                        {(event.contactEmail || event.contactPhone) && (
                            <InfoRow
                                icon={Mail}
                                label="Contact"
                                value={
                                    <span className="space-x-3">
                                        {event.contactEmail && (
                                            <a
                                                href={`mailto:${event.contactEmail}`}
                                                className="text-primary"
                                            >
                                                {event.contactEmail}
                                            </a>
                                        )}

                                        {event.contactPhone && (
                                            <a
                                                href={`tel:${event.contactPhone}`}
                                                className="text-primary inline-flex items-center gap-1"
                                            >
                                                <Phone className="h-3.5 w-3.5" />
                                                {event.contactPhone}
                                            </a>
                                        )}
                                    </span>
                                }
                            />
                        )}
                    </div>

                    <p className="mt-8 text-base text-foreground/90 leading-relaxed whitespace-pre-line">
                        {event.description}
                    </p>

                    <div className="mt-8 flex flex-wrap gap-2">
                        <button
                            type="button"
                            data-testid="event-save"
                            onClick={() => {
                                const nextSaved = toggleSaveEvent(event.id);
                                toast.success(nextSaved ? "Saved to your shortlist" : "Removed from shortlist");
                            }}
                            className={`inline-flex items-center gap-1.5 px-5 py-3 rounded-full text-sm font-semibold border-2 transition ${saved ? "border-primary bg-primary text-primary-foreground" : "border-foreground hover:bg-foreground hover:text-background"}`}
                        >
                            <Heart className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
                            {saved ? "Saved" : "Save event"}
                        </button>

                        {event.booking && (
                            <a
                                href={event.booking}
                                target="_blank"
                                rel="noreferrer"
                                data-testid="event-book"
                                className="inline-flex items-center gap-1.5 px-5 py-3 rounded-full text-sm font-semibold bg-primary text-primary-foreground hover:scale-105 transition-transform"
                            >
                                Book / RSVP <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                        )}

                        <a
                            href={buildCalendarUrl(event, "google")}
                            target="_blank"
                            rel="noreferrer"
                            data-testid="event-google-cal"
                            className="inline-flex items-center gap-1.5 px-5 py-3 rounded-full text-sm font-semibold border-2 border-foreground hover:bg-foreground hover:text-background transition"
                        >
                            Add to Google Calendar
                        </a>

                        <a
                            href={buildCalendarUrl(event, "outlook")}
                            target="_blank"
                            rel="noreferrer"
                            data-testid="event-outlook-cal"
                            className="inline-flex items-center gap-1.5 px-5 py-3 rounded-full text-sm font-semibold border-2 border-foreground hover:bg-foreground hover:text-background transition"
                        >
                            Add to Outlook
                        </a>

                        <button
                            type="button"
                            data-testid="event-apple-cal"
                            onClick={() => downloadIcsFile(event, eventUrl)}
                            className="inline-flex items-center gap-1.5 px-5 py-3 rounded-full text-sm font-semibold border-2 border-foreground hover:bg-foreground hover:text-background transition"
                        >
                            Download .ics
                        </button>

                        <button
                            type="button"
                            data-testid="event-share"
                            onClick={shareNative}
                            className="inline-flex items-center gap-1.5 px-5 py-3 rounded-full text-sm font-semibold bg-secondary text-secondary-foreground"
                        >
                            <Share2 className="h-4 w-4" /> Share
                        </button>
                    </div>
                </div>
            </div>

            <section className="mt-10 rounded-3xl border border-border bg-surface p-6 sm:p-8">
                <div className="max-w-3xl">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary">
                        Promote this event
                    </p>

                    <h2 className="mt-2 font-display font-black text-2xl sm:text-3xl">
                        Share this Blackrod event in seconds
                    </h2>

                    <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
                        Are you involved with this event, or do you want to help more
                        people find it? Use the one-tap buttons below to share to any
                        social platform, copy the poster link, or save the event to your
                        calendar.
                    </p>

                    <div className="mt-5">
                        <button
                            type="button"
                            data-testid="event-post-now-btn"
                            onClick={() => setPostNowOpen(true)}
                            className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-primary text-primary-foreground text-sm font-bold hover:brightness-110 shadow-sm"
                        >
                            <Rocket className="h-4 w-4" /> Post Now — poster + caption + share
                        </button>
                        <p className="mt-2 text-xs text-muted-foreground">
                            One-click social bundle. Grab the poster, tweak the caption, and post to any channel.
                        </p>
                    </div>

                    <div className="mt-5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">One-tap share</div>
                        <ShareButtons
                            text={`${event.title} — ${formatDate(event.start)} at ${event.venue || "Blackrod"}`}
                            url={eventUrl}
                            ogUrl={shareOgUrl}
                            title={event.title}
                            analytics={{ entityType: "event", entityId: event.id, orgSlug: event.orgSlug }}
                        />
                    </div>
                    <div className="mt-4 flex justify-end">
                        <ReportButton kind="event" targetId={event.id} />
                    </div>
                </div>

                <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <ActionButton
                        icon={Copy}
                        label="Copy Facebook Post"
                        description="Ready to paste onto a Facebook Page or group."
                        onClick={() =>
                            copyToClipboard(facebookPost, "Facebook post copied")
                        }
                    />

                    <ActionButton
                        icon={Download}
                        label="Copy Poster Link"
                        description="Use the event image in social posts."
                        onClick={downloadPoster}
                    />

                    <ActionButton
                        icon={CalendarDays}
                        label="Download Calendar File"
                        description="Works with Apple Calendar and most calendar apps."
                        onClick={() => downloadIcsFile(event, eventUrl)}
                    />
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                    {(role === "admin" || role === "org") && (
                        <Link
                            to={`/edit-event/${event.id}`}
                            data-testid="edit-event-cta"
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold bg-primary text-primary-foreground hover:brightness-110 transition"
                        >
                            <Edit3 className="h-4 w-4" />
                            Edit event
                        </Link>
                    )}
                    <Link
                        to={`/events/${event.id}/suggest-update`}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold border border-border hover:border-primary/40 hover:text-primary transition"
                    >
                        <Edit3 className="h-4 w-4" />
                        Suggest an update
                    </Link>

                    <Link
                        to={`/events/${event.id}/claim`}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold border border-border hover:border-primary/40 hover:text-primary transition"
                    >
                        <ShieldCheck className="h-4 w-4" />
                        Claim this event
                    </Link>
                </div>
            </section>

            <section className="mt-10 rounded-3xl border border-border bg-background p-6 sm:p-8">
                <h2 className="font-display font-bold text-2xl">
                    Facebook-ready post
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">
                    Copy and paste this into your organisation’s Facebook Page, local
                    group, WhatsApp community or newsletter.
                </p>

                <pre className="mt-4 whitespace-pre-wrap rounded-2xl bg-muted p-4 text-sm leading-relaxed overflow-x-auto">
                    {facebookPost}
                </pre>

                <button
                    type="button"
                    onClick={() => copyToClipboard(facebookPost, "Facebook post copied")}
                    className="mt-4 inline-flex items-center gap-1.5 px-5 py-3 rounded-full text-sm font-semibold bg-primary text-primary-foreground hover:scale-105 transition-transform"
                >
                    <Copy className="h-4 w-4" />
                    Copy Facebook Post
                </button>
            </section>

            {org && (
                <section className="mt-10">
                    <h2 className="font-display font-bold text-2xl">
                        More from {org.name}
                    </h2>

                    <div className="mt-4 grid sm:grid-cols-2 gap-4">
                        {eventsByOrg(events, org.slug)
                            .filter((e) => e.id !== event.id)
                            .slice(0, 4)
                            .map((e) => (
                                <Link
                                    key={e.id}
                                    to={`/events/${e.id}`}
                                    className="p-5 rounded-3xl border border-border bg-surface hover:border-primary/30 transition"
                                >
                                    <CategoryBadge category={e.category} />
                                    <h3 className="font-display font-bold mt-2">
                                        {e.title}
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {formatDate(e.start)} · {formatTime(e.start)}
                                    </p>
                                </Link>
                            ))}
                    </div>
                </section>
            )}
            {/* NEWSLETTER */}
            <NewsletterSection />

            <PostNowDialog
                event={event}
                open={postNowOpen}
                onOpenChange={setPostNowOpen}
            />
        </div>
    );
}

const InfoRow = ({ icon: Icon, label, value }) => (
    <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
            <Icon className="h-4 w-4" />
        </div>

        <div className="leading-tight">
            <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                {label}
            </div>
            <div className="text-sm mt-1">{value}</div>
        </div>
    </div>
);

const ActionButton = ({ icon: Icon, label, description, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="text-left rounded-2xl border border-border bg-background p-4 hover:border-primary/40 hover:shadow-sm transition"
    >
        <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
                <Icon className="h-4 w-4" />
            </div>

            <div>
                <div className="font-semibold text-sm">{label}</div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {description}
                </p>
            </div>
        </div>
    </button>
);