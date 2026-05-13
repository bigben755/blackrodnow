import React from "react";
import { useParams, Link } from "react-router-dom";
import { useApp, eventsByOrg } from "@/context/AppContext";
import { CategoryBadge, formatDate, formatTime } from "@/components/Cards";
import {
    CalendarDays,
    Clock,
    MapPin,
    PoundSterling,
    Users,
    Accessibility,
    Mail,
    Phone,
    Share2,
    ArrowLeft,
    ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

const buildCalendarUrl = (event, provider) => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    const fmt = (d) =>
        d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    if (provider === "google") {
        const params = new URLSearchParams({
            action: "TEMPLATE",
            text: event.title,
            details: event.description,
            location: `${event.venue}, ${event.address}`,
            dates: `${fmt(start)}/${fmt(end)}`,
        });
        return `https://calendar.google.com/calendar/render?${params.toString()}`;
    }
    if (provider === "outlook") {
        const params = new URLSearchParams({
            path: "/calendar/action/compose",
            rru: "addevent",
            subject: event.title,
            body: event.description,
            location: `${event.venue}, ${event.address}`,
            startdt: start.toISOString(),
            enddt: end.toISOString(),
        });
        return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
    }
    // Apple (.ics) — we'll just toast
    return "#";
};

export default function EventDetail() {
    const { id } = useParams();
    const { events, orgs } = useApp();
    const event = events.find((e) => e.id === id);

    if (!event) {
        return (
            <div className="max-w-3xl mx-auto py-24 px-6 text-center">
                <h1 className="font-display font-bold text-3xl">Event not found</h1>
                <p className="mt-3 text-muted-foreground">
                    It might have been moved or removed.
                </p>
                <Link to="/events" className="mt-6 inline-flex text-primary font-semibold">
                    Back to all events
                </Link>
            </div>
        );
    }

    const org = orgs.find((o) => o.slug === event.orgSlug);

    const share = async () => {
        const url = window.location.href;
        try {
            if (navigator.share) {
                await navigator.share({ title: event.title, url });
            } else {
                await navigator.clipboard.writeText(url);
                toast.success("Link copied to clipboard");
            }
        } catch {
            /* ignore */
        }
    };

    return (
        <div data-testid={`event-detail-${event.id}`} className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <Link to="/events" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
                <ArrowLeft className="h-4 w-4" /> All events
            </Link>

            <div className="rounded-3xl overflow-hidden border border-border bg-surface">
                <div className="relative aspect-[16/8] bg-muted overflow-hidden">
                    {event.image && (
                        <img src={event.image} alt={event.title} className="absolute inset-0 h-full w-full object-cover" />
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
                        <InfoRow icon={CalendarDays} label="When" value={`${formatDate(event.start)} · ${formatTime(event.start)} – ${formatTime(event.end)}`} />
                        <InfoRow icon={MapPin} label="Where" value={`${event.venue}, ${event.address}`} />
                        <InfoRow icon={PoundSterling} label="Cost" value={event.cost} />
                        <InfoRow icon={Users} label="Suitable for" value={event.age} />
                        <InfoRow icon={Accessibility} label="Accessibility" value={event.accessibility} />
                        <InfoRow icon={Mail} label="Contact" value={
                            <span className="space-x-3">
                                <a href={`mailto:${event.contactEmail}`} className="text-primary">{event.contactEmail}</a>
                                <a href={`tel:${event.contactPhone}`} className="text-primary inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{event.contactPhone}</a>
                            </span>
                        } />
                    </div>

                    <p className="mt-8 text-base text-foreground/90 leading-relaxed whitespace-pre-line">
                        {event.description}
                    </p>

                    <div className="mt-8 flex flex-wrap gap-2">
                        {event.booking && (
                            <a
                                href={event.booking}
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
                            data-testid="event-apple-cal"
                            onClick={() =>
                                toast.info("Apple Calendar", { description: "Subscribe link coming soon." })
                            }
                            className="inline-flex items-center gap-1.5 px-5 py-3 rounded-full text-sm font-semibold border-2 border-foreground hover:bg-foreground hover:text-background transition"
                        >
                            Add to Apple Calendar
                        </button>
                        <button
                            data-testid="event-share"
                            onClick={share}
                            className="inline-flex items-center gap-1.5 px-5 py-3 rounded-full text-sm font-semibold bg-secondary text-secondary-foreground"
                        >
                            <Share2 className="h-4 w-4" /> Share
                        </button>
                    </div>
                </div>
            </div>

            {org && (
                <section className="mt-10">
                    <h2 className="font-display font-bold text-2xl">More from {org.name}</h2>
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
                                    <h3 className="font-display font-bold mt-2">{e.title}</h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {formatDate(e.start)} · {formatTime(e.start)}
                                    </p>
                                </Link>
                            ))}
                    </div>
                </section>
            )}
        </div>
    );
}

const InfoRow = ({ icon: Icon, label, value }) => (
    <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
            <Icon className="h-4 w-4" />
        </div>
        <div className="leading-tight">
            <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">{label}</div>
            <div className="text-sm mt-1">{value}</div>
        </div>
    </div>
);
