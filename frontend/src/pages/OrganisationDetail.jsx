import React from "react";
import NewsletterSection from "@/components/NewsletterSection";
import { Link, useParams } from "react-router-dom";
import { useApp, eventsByOrg } from "@/context/AppContext";
import { CategoryBadge, formatDate, formatTime, VolunteerCard, FeedCard } from "@/components/Cards";
import {
    MapPin,
    Mail,
    Phone,
    Globe,
    Facebook,
    Instagram,
    Linkedin,
    Heart,
    HeartOff,
    ArrowLeft,
    Clock,
    FileText,
    Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

export default function OrganisationDetail() {
    const { slug } = useParams();
    const { orgs, events, feed, volunteerOpps, follows, toggleFollow } = useApp();

    const org = orgs.find((o) => o.slug === slug);
    if (!org) {
        return (
            <div className="max-w-3xl mx-auto py-24 px-6 text-center">
                <h1 className="font-display font-bold text-3xl">Organisation not found</h1>
                <Link to="/organisations" className="mt-6 inline-flex text-primary font-semibold">
                    Back to directory
                </Link>
            </div>
        );
    }

    const isFollowing = follows.includes(org.slug);
    const orgEvents = eventsByOrg(events, org.slug);
    const orgFeed = feed.filter((p) => p.orgSlug === org.slug);
    const orgVols = volunteerOpps.filter((v) => v.orgSlug === org.slug);

    const handleFollow = () => {
        toggleFollow(org.slug);
        toast.success(!isFollowing ? `Now following ${org.name}` : `Unfollowed ${org.name}`);
    };

    const brand = org.brandColor || "#0052FF";

    return (
        <div data-testid={`org-detail-${org.slug}`} className="">
            {/* Header banner */}
            <div
                className="relative h-56 sm:h-72 overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${brand}DD, ${brand}66)` }}
            >
                {org.cover && (
                    <img src={org.cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
                <div className="absolute top-6 left-4 sm:left-6">
                    <Link to="/organisations" className="inline-flex items-center gap-1 text-xs text-white/90 bg-black/40 backdrop-blur px-3 py-1.5 rounded-full">
                        <ArrowLeft className="h-3.5 w-3.5" /> Directory
                    </Link>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative">
                <div className="rounded-3xl bg-surface border border-border p-6 sm:p-8 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-end gap-5">
                        <div
                            className="h-24 w-24 rounded-3xl grid place-items-center text-5xl border-4 border-background shadow-lg"
                            style={{ background: `${brand}15` }}
                        >
                            <span aria-hidden>{org.logo}</span>
                        </div>
                        <div className="flex-1">
                            <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                                {org.category}
                            </span>
                            <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tight mt-1">
                                {org.name}
                            </h1>
                            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{org.short}</p>
                            <div className="flex flex-wrap gap-1.5 mt-3">
                                {org.tags?.map((t) => (
                                    <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted">
                                        {t}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <button
                            data-testid="org-follow"
                            onClick={handleFollow}
                            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold shrink-0 transition ${
                                isFollowing
                                    ? "bg-muted text-foreground"
                                    : "text-primary-foreground hover:scale-105"
                            }`}
                            style={isFollowing ? {} : { background: brand }}
                        >
                            {isFollowing ? (
                                <>
                                    <HeartOff className="h-4 w-4" /> Following
                                </>
                            ) : (
                                <>
                                    <Heart className="h-4 w-4" /> Follow
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="grid lg:grid-cols-3 gap-6 mt-8">
                    <div className="lg:col-span-2 space-y-6">
                        <Section title="About">
                            <p className="text-foreground/90 leading-relaxed">{org.about}</p>
                        </Section>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <Section title="What we do">
                                <p className="text-sm text-muted-foreground">{org.does}</p>
                            </Section>
                            <Section title="Who it's for">
                                <p className="text-sm text-muted-foreground">{org.forWho}</p>
                            </Section>
                        </div>

                        {orgEvents.length > 0 && (
                            <Section title="Upcoming events">
                                <div className="grid sm:grid-cols-2 gap-3">
                                    {orgEvents.map((e) => (
                                        <Link
                                            key={e.id}
                                            to={`/events/${e.id}`}
                                            className="p-4 rounded-2xl border border-border bg-background hover:border-primary/30 transition"
                                        >
                                            <CategoryBadge category={e.category} />
                                            <h4 className="font-display font-bold text-base mt-2">{e.title}</h4>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {formatDate(e.start)} · {formatTime(e.start)} · {e.venue}
                                            </p>
                                        </Link>
                                    ))}
                                </div>
                            </Section>
                        )}

                        {orgFeed.length > 0 && (
                            <Section title="Recent updates">
                                <div className="space-y-3">
                                    {orgFeed.map((p) => (
                                        <FeedCard
                                            key={p.id}
                                            post={p}
                                            orgName={org.name}
                                            orgLogo={org.logo}
                                            orgSlug={org.slug}
                                        />
                                    ))}
                                </div>
                            </Section>
                        )}

                        {orgVols.length > 0 && (
                            <Section title="Volunteer opportunities">
                                <div className="grid sm:grid-cols-2 gap-3">
                                    {orgVols.map((v) => (
                                        <VolunteerCard key={v.id} opp={v} orgName={org.name} />
                                    ))}
                                </div>
                            </Section>
                        )}

                        {org.documents?.length > 0 && (
                            <Section title="Documents">
                                <ul className="space-y-2">
                                    {org.documents.map((d) => (
                                        <li key={d.name}>
                                            <a
                                                href={d.url}
                                                className="inline-flex items-center gap-2 text-sm text-primary font-semibold"
                                            >
                                                <FileText className="h-4 w-4" />
                                                {d.name}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </Section>
                        )}

                        {org.gallery?.length > 0 && (
                            <Section title="Gallery">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {org.gallery.map((g, i) => (
                                        <img
                                            key={i}
                                            src={g}
                                            alt=""
                                            className="aspect-square rounded-2xl object-cover bg-muted"
                                            loading="lazy"
                                        />
                                    ))}
                                </div>
                            </Section>
                        )}
                    </div>

                    {/* Right rail */}
                    <aside className="space-y-4">
                        <Section title="Get in touch">
                            <InfoLine icon={Clock}>{org.meeting}</InfoLine>
                            <InfoLine icon={MapPin}>{org.address}</InfoLine>
                            <InfoLine icon={Mail}>
                                <a className="text-primary" href={`mailto:${org.email}`}>
                                    {org.email}
                                </a>
                            </InfoLine>
                            <InfoLine icon={Phone}>
                                <a className="text-primary" href={`tel:${org.phone}`}>
                                    {org.phone}
                                </a>
                            </InfoLine>
                            {org.website && (
                                <InfoLine icon={Globe}>
                                    <a className="text-primary" href={org.website} target="_blank" rel="noreferrer">
                                        Visit website
                                    </a>
                                </InfoLine>
                            )}
                        </Section>

                        <Section title="Social">
                            <div className="flex gap-2">
                                {org.socials?.facebook && (
                                    <a href={org.socials.facebook} className="h-9 w-9 rounded-full border border-border grid place-items-center hover:bg-muted">
                                        <Facebook className="h-4 w-4" />
                                    </a>
                                )}
                                {org.socials?.instagram && (
                                    <a href={org.socials.instagram} className="h-9 w-9 rounded-full border border-border grid place-items-center hover:bg-muted">
                                        <Instagram className="h-4 w-4" />
                                    </a>
                                )}
                                {org.socials?.tiktok && (
                                    <a href={org.socials.tiktok} className="h-9 w-9 rounded-full border border-border grid place-items-center hover:bg-muted text-xs font-bold">
                                        TT
                                    </a>
                                )}
                                {org.socials?.linkedin && (
                                    <a href={org.socials.linkedin} className="h-9 w-9 rounded-full border border-border grid place-items-center hover:bg-muted">
                                        <Linkedin className="h-4 w-4" />
                                    </a>
                                )}
                            </div>
                            <div className="mt-4 p-3 rounded-2xl bg-muted text-xs text-muted-foreground inline-flex items-center gap-2">
                                <ImageIcon className="h-3.5 w-3.5" /> Latest social posts coming soon.
                            </div>
                        </Section>
                    </aside>
                </div>
            </div>
            {/* NEWSLETTER */}
            <NewsletterSection />
        </div>
        );
    }

const Section = ({ title, children }) => (
    <section className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="font-display font-bold text-lg mb-3">{title}</h2>
        {children}
    </section>
);

const InfoLine = ({ icon: Icon, children }) => (
    <div className="flex items-start gap-2 text-sm py-1">
        <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <span>{children}</span>
    </div>
);
