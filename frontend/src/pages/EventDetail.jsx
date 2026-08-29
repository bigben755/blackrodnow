import React, { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useApp, eventsByOrg } from "@/context/AppContext";
import {
    CategoryBadge,
    formatDate,
    formatTime,
    isMultiDay,
} from "@/components/Cards";
import NewsletterSection from "@/components/NewsletterSection";
import ShareButtons from "@/components/ShareButtons";
import PostNowDialog from "@/components/PostNowDialog";
import { ReportButton } from "@/components/ReportButton";
import { API, api } from "@/lib/api";
import { resolveEventImage } from "@/lib/eventCategoryImage";
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
    ChevronDown,
    Navigation,
    Building2,
} from "lucide-react";
import { toast } from "sonner";
import SeoJsonLd, {
    eventJsonLd,
} from "@/components/SeoJsonLd";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SITE_NAME = "Blackrod Now";

const SITE_ORIGIN =
    typeof window !== "undefined"
        ? window.location.origin
        : (
              process.env.REACT_APP_SITE_ORIGIN || ""
          ).replace(/\/$/, "");

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
    const end = new Date(
        event.end || event.start
    );

    const location = [
        event.venue,
        event.address,
    ]
        .filter(Boolean)
        .join(", ");

    const description =
        event.description || "";

    if (provider === "google") {
        const params = new URLSearchParams({
            action: "TEMPLATE",
            text: event.title,
            details: description,
            location,
            dates: `${formatCalendarDate(
                start
            )}/${formatCalendarDate(end)}`,
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

const buildMapsUrl = (event) => {
    const location = [
        event.venue,
        event.address,
        "Blackrod",
    ]
        .filter(Boolean)
        .join(", ");

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        location
    )}`;
};

const buildIcsContent = (
    event,
    eventUrl
) => {
    const start = formatCalendarDate(
        event.start
    );

    const end = formatCalendarDate(
        event.end || event.start
    );

    const location = [
        event.venue,
        event.address,
    ]
        .filter(Boolean)
        .join(", ");

    const description = `${
        event.description || ""
    }\n\nFull details: ${eventUrl}`;

    return [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        `PRODID:-//${SITE_NAME}//Events Calendar//EN`,
        "BEGIN:VEVENT",
        `UID:${event.id}@blackrod-now-events`,
        `DTSTAMP:${formatCalendarDate(
            new Date()
        )}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${escapeIcsText(
            event.title
        )}`,
        `DESCRIPTION:${escapeIcsText(
            description
        )}`,
        `LOCATION:${escapeIcsText(
            location
        )}`,
        `URL:${eventUrl}`,
        "END:VEVENT",
        "END:VCALENDAR",
    ].join("\r\n");
};

const downloadIcsFile = (
    event,
    eventUrl
) => {
    const ics = buildIcsContent(
        event,
        eventUrl
    );

    const blob = new Blob([ics], {
        type: "text/calendar;charset=utf-8",
    });

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href = url;
    link.download = `${
        event.id || "event"
    }.ics`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
};

const buildFacebookPost = (
    event,
    eventUrl,
    org
) => {
    const date = formatDate(
        event.start
    );

    const startTime = formatTime(
        event.start
    );

    const endTime = event.end
        ? formatTime(event.end)
        : "";

    const location = [
        event.venue,
        event.address,
    ]
        .filter(Boolean)
        .join(", ");

    const organiser =
        org?.name ||
        event.organiser ||
        "";

    return [
        `🎉 Blackrod Event: ${event.title}`,
        "",
        `📅 ${date}`,
        `🕒 ${startTime}${
            endTime
                ? ` – ${endTime}`
                : ""
        }`,
        location
            ? `📍 ${location}`
            : "",
        organiser
            ? `👥 Organised by ${organiser}`
            : "",
        event.cost
            ? `💷 ${event.cost}`
            : "",
        "",
        event.description
            ? event.description.trim()
            : "",
        "",
        "Full details:",
        eventUrl,
        "",
        "#Blackrod #BlackrodEvents #CommunityEvents",
    ]
        .filter(Boolean)
        .join("\n");
};

const copyToClipboard = async (
    text,
    successMessage
) => {
    try {
        await navigator.clipboard.writeText(
            text
        );

        toast.success(successMessage);
    } catch {
        toast.error(
            "Could not copy to clipboard"
        );
    }
};

export default function EventDetail() {
    const { id } = useParams();

    const {
        events,
        orgs,
        role,
        activeOrgSlug,
        isEventSaved,
        toggleSaveEvent,
    } = useApp();

    const [postNowOpen, setPostNowOpen] =
        React.useState(false);

    const event = events.find(
        (item) => item.id === id
    );

    const org = orgs.find(
        (item) =>
            item.slug === event?.orgSlug
    );

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
                <CalendarDays className="h-9 w-9 mx-auto text-muted-foreground" />

                <h1 className="font-display font-bold text-3xl mt-4">
                    Event not found
                </h1>

                <p className="mt-3 text-muted-foreground">
                    It may have been moved,
                    cancelled or removed.
                </p>

                <Link
                    to="/events"
                    className="mt-6 inline-flex items-center gap-1 text-primary font-semibold"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to What's On
                </Link>
            </div>
        );
    }

    const eventUrl =
        typeof window !== "undefined"
            ? window.location.href
            : `${
                  SITE_ORIGIN || ""
              }/events/${event.id}`;

    const shareOgUrl = `${API}/events/${event.id}/og`;

    const location = [
        event.venue,
        event.address,
    ]
        .filter(Boolean)
        .join(", ");

    const facebookPost =
        buildFacebookPost(
            event,
            eventUrl,
            org
        );

    const saved =
        isEventSaved?.(event.id);

    const eventImage =
        resolveEventImage(event);

    const canManage =
        role === "admin" ||
        (role === "org" &&
            activeOrgSlug ===
                event.orgSlug);

    const upcomingFromOrg = org
        ? eventsByOrg(
              events,
              org.slug
          )
              .filter(
                  (item) =>
                      item.id !== event.id &&
                      item.status ===
                          "approved" &&
                      new Date(
                          item.end ||
                              item.start
                      ) >= new Date()
              )
              .sort(
                  (a, b) =>
                      new Date(a.start) -
                      new Date(b.start)
              )
              .slice(0, 4)
        : [];

    const shareNative = async () => {
        try {
            if (navigator.share) {
                await navigator.share({
                    title: event.title,
                    text: `${event.title} on Blackrod Now`,
                    url: eventUrl,
                });
            } else {
                await copyToClipboard(
                    eventUrl,
                    "Event link copied"
                );
            }
        } catch {
            // Native share cancelled.
        }
    };

    const copyPosterLink =
        async () => {
            const imageUrl =
                eventImage.startsWith(
                    "http"
                )
                    ? eventImage
                    : `${SITE_ORIGIN}${eventImage}`;

            await copyToClipboard(
                imageUrl,
                "Poster image link copied"
            );
        };

    return (
        <div
            data-testid={`event-detail-${event.id}`}
            className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10"
        >
            <SeoJsonLd
                id="event"
                data={eventJsonLd(
                    event,
                    org,
                    eventUrl,
                    eventImage
                )}
            />

            <Link
                to="/events"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to What's On
            </Link>

            {/* HERO */}
            <article className="rounded-[2rem] overflow-hidden border border-border bg-surface">
                <div className="relative aspect-[16/8] sm:aspect-[16/7] bg-muted overflow-hidden">
                    <img
                        src={eventImage}
                        alt={event.title}
                        className="absolute inset-0 h-full w-full object-cover"
                    />

                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/65 to-transparent pointer-events-none" />

                    <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                        <CategoryBadge
                            category={
                                event.category
                            }
                        />

                        {event.cost
                            ?.toLowerCase()
                            .includes(
                                "free"
                            ) && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-secondary text-secondary-foreground">
                                Free
                            </span>
                        )}

                        {event.recurrence
                            ?.term_time_only && (
                            <span
                                data-testid="detail-term-time-badge"
                                className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-100 text-amber-900"
                            >
                                Term-time only
                            </span>
                        )}
                    </div>
                </div>

                <div className="p-6 sm:p-9 lg:p-10">
                    <div className="max-w-4xl">
                        <h1 className="font-display font-black text-3xl sm:text-5xl tracking-tight leading-tight">
                            {event.title}
                        </h1>

                        {org && (
                            <Link
                                to={`/organisations/${org.slug}`}
                                className="inline-flex items-center gap-2 mt-3 text-sm font-semibold text-primary hover:underline"
                            >
                                <Building2 className="h-4 w-4" />
                                {org.name}
                            </Link>
                        )}
                    </div>

                    {/* MAIN ACTIONS */}
                    <div className="mt-7 flex flex-wrap gap-2">
                        {event.booking && (
                            <a
                                href={
                                    event.booking
                                }
                                target="_blank"
                                rel="noreferrer"
                                data-testid="event-book"
                                className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold bg-primary text-primary-foreground hover:brightness-110 transition"
                            >
                                Book / RSVP
                                <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                        )}

                        <button
                            type="button"
                            data-testid="event-save"
                            onClick={() => {
                                const nextSaved =
                                    toggleSaveEvent(
                                        event.id
                                    );

                                toast.success(
                                    nextSaved
                                        ? "Saved to your events"
                                        : "Removed from saved events"
                                );
                            }}
                            className={`inline-flex items-center gap-1.5 px-5 py-3 rounded-full text-sm font-semibold border transition ${
                                saved
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-background hover:border-primary/50"
                            }`}
                        >
                            <Heart
                                className={`h-4 w-4 ${
                                    saved
                                        ? "fill-current"
                                        : ""
                                }`}
                            />

                            {saved
                                ? "Saved"
                                : "Save event"}
                        </button>

                        <DropdownMenu>
                            <DropdownMenuTrigger
                                asChild
                            >
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-1.5 px-5 py-3 rounded-full text-sm font-semibold border border-border bg-background hover:bg-muted transition"
                                >
                                    <CalendarDays className="h-4 w-4" />
                                    Add to calendar
                                    <ChevronDown className="h-3.5 w-3.5" />
                                </button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent
                                align="start"
                                className="rounded-2xl"
                            >
                                <DropdownMenuItem
                                    asChild
                                >
                                    <a
                                        href={buildCalendarUrl(
                                            event,
                                            "google"
                                        )}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Google Calendar
                                    </a>
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                    asChild
                                >
                                    <a
                                        href={buildCalendarUrl(
                                            event,
                                            "outlook"
                                        )}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Outlook Calendar
                                    </a>
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />

                                <DropdownMenuItem
                                    onClick={() =>
                                        downloadIcsFile(
                                            event,
                                            eventUrl
                                        )
                                    }
                                >
                                    Download .ics file
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <button
                            type="button"
                            data-testid="event-share"
                            onClick={
                                shareNative
                            }
                            className="inline-flex items-center gap-1.5 px-5 py-3 rounded-full text-sm font-semibold border border-border bg-background hover:bg-muted transition"
                        >
                            <Share2 className="h-4 w-4" />
                            Share
                        </button>
                    </div>

                    {/* EVENT FACTS */}
                    <div className="mt-9 rounded-3xl border border-border bg-background p-5 sm:p-6">
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            <InfoRow
                                icon={
                                    CalendarDays
                                }
                                label="When"
                                value={
                                    isMultiDay(event)
                                        ? `${formatDate(event.start)} · ${formatTime(event.start)} – ${formatDate(event.end)} · ${formatTime(event.end)}`
                                        : `${formatDate(event.start)} · ${formatTime(event.start)}${
                                              event.end
                                                  ? ` – ${formatTime(event.end)}`
                                                  : ""
                                          }`
                                }
                            />

                            <InfoRow
                                icon={MapPin}
                                label="Where"
                                value={
                                    <div>
                                        <div>
                                            {location ||
                                                "Blackrod"}
                                        </div>

                                        {(event.venue ||
                                            event.address) && (
                                            <a
                                                href={buildMapsUrl(
                                                    event
                                                )}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 mt-1.5 text-xs font-semibold text-primary hover:underline"
                                            >
                                                <Navigation className="h-3 w-3" />
                                                Directions
                                            </a>
                                        )}
                                    </div>
                                }
                            />

                            <InfoRow
                                icon={
                                    PoundSterling
                                }
                                label="Cost"
                                value={
                                    event.cost ||
                                    "Not specified"
                                }
                            />

                            <InfoRow
                                icon={Users}
                                label="Suitable for"
                                value={
                                    event.age ||
                                    "Not specified"
                                }
                            />

                            <InfoRow
                                icon={
                                    Accessibility
                                }
                                label="Accessibility"
                                value={
                                    event.accessibility ||
                                    "Not specified"
                                }
                            />

                            {(event.contactEmail ||
                                event.contactPhone) && (
                                <InfoRow
                                    icon={Mail}
                                    label="Contact"
                                    value={
                                        <div className="space-y-1">
                                            {event.contactEmail && (
                                                <a
                                                    href={`mailto:${event.contactEmail}`}
                                                    className="block text-primary hover:underline break-all"
                                                >
                                                    {
                                                        event.contactEmail
                                                    }
                                                </a>
                                            )}

                                            {event.contactPhone && (
                                                <a
                                                    href={`tel:${event.contactPhone}`}
                                                    className="inline-flex items-center gap-1 text-primary hover:underline"
                                                >
                                                    <Phone className="h-3.5 w-3.5" />
                                                    {
                                                        event.contactPhone
                                                    }
                                                </a>
                                            )}
                                        </div>
                                    }
                                />
                            )}
                        </div>
                    </div>

                    {/* DESCRIPTION */}
                    {event.description && (
                        <section className="mt-9 max-w-4xl">
                            <h2 className="font-display font-bold text-2xl">
                                About this event
                            </h2>

                            <p className="mt-4 text-base text-foreground/90 leading-relaxed whitespace-pre-line">
                                {
                                    event.description
                                }
                            </p>
                        </section>
                    )}
                </div>
            </article>

            {/* ORGANISER TOOLS */}
            {canManage && (
                <section className="mt-8 rounded-3xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                        <div className="max-w-2xl">
                            <p className="text-xs font-bold uppercase tracking-wider text-primary">
                                Organiser tools
                            </p>

                            <h2 className="mt-2 font-display font-black text-2xl">
                                Manage and promote this event
                            </h2>

                            <p className="mt-2 text-sm text-muted-foreground">
                                These controls are only
                                visible to authorised
                                organisation users and
                                site administrators.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Link
                                to={`/edit-event/${event.id}`}
                                data-testid="edit-event-cta"
                                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold bg-primary text-primary-foreground"
                            >
                                <Edit3 className="h-4 w-4" />
                                Edit event
                            </Link>

                            <button
                                type="button"
                                data-testid="event-post-now-btn"
                                onClick={() =>
                                    setPostNowOpen(
                                        true
                                    )
                                }
                                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold bg-foreground text-background"
                            >
                                <Rocket className="h-4 w-4" />
                                Post Now
                            </button>
                        </div>
                    </div>

                    <div className="mt-6">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                            One-tap sharing
                        </div>

                        <ShareButtons
                            text={`${event.title} — ${formatDate(
                                event.start
                            )} at ${
                                event.venue ||
                                "Blackrod"
                            }`}
                            url={eventUrl}
                            ogUrl={
                                shareOgUrl
                            }
                            title={
                                event.title
                            }
                            analytics={{
                                entityType:
                                    "event",
                                entityId:
                                    event.id,
                                orgSlug:
                                    event.orgSlug,
                            }}
                        />
                    </div>

                    <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <ActionButton
                            icon={Copy}
                            label="Copy Facebook post"
                            description="Copy a ready-to-edit event caption."
                            onClick={() =>
                                copyToClipboard(
                                    facebookPost,
                                    "Facebook post copied"
                                )
                            }
                        />

                        <ActionButton
                            icon={Download}
                            label="Copy poster link"
                            description="Copy the event image URL for social posts."
                            onClick={
                                copyPosterLink
                            }
                        />

                        <ActionButton
                            icon={
                                CalendarDays
                            }
                            label="Download calendar file"
                            description="Download an .ics version of this event."
                            onClick={() =>
                                downloadIcsFile(
                                    event,
                                    eventUrl
                                )
                            }
                        />
                    </div>
                </section>
            )}

            {/* CORRECTIONS / CLAIM */}
            <section className="mt-8 rounded-3xl border border-border bg-surface p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="font-display font-bold text-lg">
                            Something not right?
                        </h2>

                        <p className="mt-1 text-xs text-muted-foreground">
                            Help us keep Blackrod
                            Now's event information
                            accurate.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Link
                            to={`/events/${event.id}/suggest-update`}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border border-border hover:border-primary/40 hover:text-primary transition"
                        >
                            <Edit3 className="h-3.5 w-3.5" />
                            Suggest an update
                        </Link>

                        {!canManage && (
                            <Link
                                to={`/events/${event.id}/claim`}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border border-border hover:border-primary/40 hover:text-primary transition"
                            >
                                <ShieldCheck className="h-3.5 w-3.5" />
                                Claim this event
                            </Link>
                        )}

                        <ReportButton
                            kind="event"
                            targetId={
                                event.id
                            }
                        />
                    </div>
                </div>
            </section>

            {/* MORE FROM ORGANISER */}
            {org &&
                upcomingFromOrg.length >
                    0 && (
                    <section className="mt-10">
                        <div className="flex items-end justify-between gap-4">
                            <div>
                                <span className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                                    More locally
                                </span>

                                <h2 className="font-display font-bold text-2xl sm:text-3xl mt-2">
                                    More from{" "}
                                    {org.name}
                                </h2>
                            </div>

                            <Link
                                to={`/organisations/${org.slug}`}
                                className="hidden sm:inline-flex text-sm font-semibold text-primary"
                            >
                                View organisation →
                            </Link>
                        </div>

                        <div className="mt-5 grid sm:grid-cols-2 gap-4">
                            {upcomingFromOrg.map(
                                (item) => (
                                    <Link
                                        key={
                                            item.id
                                        }
                                        to={`/events/${item.id}`}
                                        className="group p-5 rounded-3xl border border-border bg-surface hover:border-primary/30 transition"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <CategoryBadge
                                                category={
                                                    item.category
                                                }
                                            />

                                            <span className="text-xs text-muted-foreground">
                                                {formatTime(
                                                    item.start
                                                )}
                                            </span>
                                        </div>

                                        <h3 className="font-display font-bold text-lg mt-3 group-hover:text-primary transition">
                                            {
                                                item.title
                                            }
                                        </h3>

                                        <p className="text-xs text-muted-foreground mt-1">
                                            {formatDate(
                                                item.start
                                            )}
                                            {item.venue
                                                ? ` · ${item.venue}`
                                                : ""}
                                        </p>
                                    </Link>
                                )
                            )}
                        </div>
                    </section>
                )}

            <NewsletterSection />

            {canManage && (
                <PostNowDialog
                    event={event}
                    open={postNowOpen}
                    onOpenChange={
                        setPostNowOpen
                    }
                />
            )}
        </div>
    );
}

const InfoRow = ({
    icon: Icon,
    label,
    value,
}) => (
    <div className="flex items-start gap-3 min-w-0">
        <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
            <Icon className="h-4 w-4" />
        </div>

        <div className="leading-tight min-w-0">
            <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                {label}
            </div>

            <div className="text-sm mt-1 leading-relaxed break-words">
                {value}
            </div>
        </div>
    </div>
);

const ActionButton = ({
    icon: Icon,
    label,
    description,
    onClick,
}) => (
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
                <div className="font-semibold text-sm">
                    {label}
                </div>

                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {description}
                </p>
            </div>
        </div>
    </button>
);