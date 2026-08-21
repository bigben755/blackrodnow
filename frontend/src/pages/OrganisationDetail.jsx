import React, { useEffect, useState } from "react";
import NewsletterSection from "@/components/NewsletterSection";
import { Link, useParams } from "react-router-dom";
import { useApp, eventsByOrg } from "@/context/AppContext";
import { CategoryBadge, formatDate, formatTime, VolunteerCard, FeedCard } from "@/components/Cards";
import OrgAvatar from "@/components/OrgAvatar";
import { ReportButton } from "@/components/ReportButton";
import { api } from "@/lib/api";
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
    PenLine,
    Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import SeoJsonLd, { organizationJsonLd } from "@/components/SeoJsonLd";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export default function OrganisationDetail() {
    const { slug } = useParams();
    const { orgs, events, feed, volunteerOpps, follows, toggleFollowOrg } = useApp();
    const [claimOpen, setClaimOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [claimBusy, setClaimBusy] = useState(false);
    const [claimNeedsCode, setClaimNeedsCode] = useState(false);
    const [editBusy, setEditBusy] = useState(false);
    const [claimForm, setClaimForm] = useState({ contact_name: "", contact_email: "", contact_phone: "", message: "", verification_code: "" });
    const [editForm, setEditForm] = useState({
        name: "",
        short: "",
        about: "",
        does: "",
        forWho: "",
        meeting: "",
        address: "",
        location: "Blackrod",
        email: "",
        phone: "",
        website: "",
        brandColor: "#0052FF",
        logo: "",
        cover: "",
        contact_name: "",
        contact_email: "",
        message: "",
    });

    const org = orgs.find((o) => o.slug === slug);

    useEffect(() => {
        if (!org) return;
        setEditForm({
            name: org.name || "",
            short: org.short || "",
            about: org.about || "",
            does: org.does || "",
            forWho: org.forWho || "",
            meeting: org.meeting || "",
            address: org.address || "",
            location: org.location || "Blackrod",
            email: org.email || "",
            phone: org.phone || "",
            website: org.website || "",
            brandColor: org.brandColor || "#0052FF",
            logo: org.logo || "",
            cover: org.cover || "",
            contact_name: "",
            contact_email: "",
            message: "",
        });
    }, [org]);

    useEffect(() => {
        if (!org?.slug) return;
        api.trackAnalytics({
            kind: "org_view",
            entity_type: "org",
            entity_id: org.slug,
            org_slug: org.slug,
        }).catch(() => {});
    }, [org?.slug]);

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

    const isFollowing = follows.orgs.includes(org.slug);
    const orgEvents = eventsByOrg(events, org.slug);
    const orgFeed = feed.filter((p) => p.orgSlug === org.slug);
    const orgVols = volunteerOpps.filter((v) => v.orgSlug === org.slug);

    const handleFollow = async () => {
        const nowFollowing = await toggleFollowOrg(org.slug);
        toast.success(nowFollowing ? `Now following ${org.name}` : `Unfollowed ${org.name}`);
    };

    const submitClaim = async (e) => {
        e.preventDefault();
        setClaimBusy(true);
        try {
            const response = await api.claimOrg(org.slug, {
                contact_name: claimForm.contact_name,
                contact_email: claimForm.contact_email,
                contact_phone: claimForm.contact_phone,
                message: claimForm.message,
                verification_code: claimForm.verification_code,
            });
            if (response?.requires_verification) {
                setClaimNeedsCode(true);
                toast.success("Verification code sent", { description: "Check your email, then enter the 6-digit code to complete your claim." });
            } else {
                toast.success("Claim request sent", { description: "Admins will review the profile ownership request." });
                setClaimOpen(false);
                setClaimNeedsCode(false);
                setClaimForm({ contact_name: "", contact_email: "", contact_phone: "", message: "", verification_code: "" });
            }
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Couldn't send claim request");
        } finally {
            setClaimBusy(false);
        }
    };

    const submitEdit = async (e) => {
        e.preventDefault();
        setEditBusy(true);
        try {
            await api.suggestOrgEdits(org.slug, editForm);
            toast.success("Edit suggestion sent", { description: "We'll review the suggested updates against the current profile." });
            setEditOpen(false);
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Couldn't send edit suggestion");
        } finally {
            setEditBusy(false);
        }
    };

    const brand = org.brandColor || "#0052FF";

    return (
        <div data-testid={`org-detail-${org.slug}`} className="">
            <SeoJsonLd id="org" data={organizationJsonLd(org, typeof window !== "undefined" ? window.location.href : "")} />
            {/* Header banner */}
            <div
                className="relative h-56 sm:h-72 overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${brand}DD, ${brand}66)` }}
            >
                {org.cover_path ? (
                    <img
                        src={api.orgCoverUrl(org.slug, org.updated_at || "")}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                    />
                ) : org.cover ? (
                    <img src={org.cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
                ) : null}
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
                        <OrgAvatar
                            org={org}
                            size={96}
                            rounded="rounded-3xl"
                            className="border-4 border-background shadow-lg"
                            style={{ background: `${brand}15` }}
                        />
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
                        <ReportButton kind="org" targetId={org.slug} className="ml-2" />
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setClaimOpen(true)}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border-2 border-foreground text-sm font-semibold"
                            >
                                <PenLine className="h-4 w-4" /> Claim this profile
                            </button>
                            <button
                                type="button"
                                onClick={() => setEditOpen(true)}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-muted text-sm font-semibold"
                            >
                                <Sparkles className="h-4 w-4" /> Suggest edits
                            </button>
                        </div>
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
                                            org={org}
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

            <Dialog open={claimOpen} onOpenChange={(open) => {
                setClaimOpen(open);
                if (!open) {
                    setClaimNeedsCode(false);
                    setClaimForm({ contact_name: "", contact_email: "", contact_phone: "", message: "", verification_code: "" });
                }
            }}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Claim this profile</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submitClaim} className="space-y-4">
                        <p className="text-sm text-muted-foreground">Tell us who you are and how you're connected to this organisation. We will send a verification code to your email before your claim is submitted.</p>
                        <Field label="Your name" required>
                            <input value={claimForm.contact_name} onChange={(e) => setClaimForm((f) => ({ ...f, contact_name: e.target.value }))} className={inp} required />
                        </Field>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <Field label="Email" required>
                                <input type="email" value={claimForm.contact_email} onChange={(e) => setClaimForm((f) => ({ ...f, contact_email: e.target.value }))} className={inp} required />
                            </Field>
                            <Field label="Phone number">
                                <input type="tel" value={claimForm.contact_phone} onChange={(e) => setClaimForm((f) => ({ ...f, contact_phone: e.target.value }))} className={inp} placeholder="So we can call to verify" />
                            </Field>
                        </div>
                        <Field label="Your role and proof of ownership" required>
                            <textarea rows={4} value={claimForm.message} onChange={(e) => setClaimForm((f) => ({ ...f, message: e.target.value }))} className={inp} required placeholder="e.g. I'm the club secretary — our website / social handle / Companies House number is…" />
                        </Field>
                        {claimNeedsCode && (
                            <Field label="Verification code" required>
                                <input
                                    value={claimForm.verification_code}
                                    onChange={(e) => setClaimForm((f) => ({ ...f, verification_code: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                                    className={inp}
                                    inputMode="numeric"
                                    placeholder="6-digit code"
                                    required
                                />
                            </Field>
                        )}
                        <DialogFooter>
                            <button type="button" onClick={() => setClaimOpen(false)} className="px-4 py-2 rounded-full border border-border text-sm font-semibold">Cancel</button>
                            <button type="submit" disabled={claimBusy} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">{claimBusy ? "Sending…" : (claimNeedsCode ? "Verify and submit claim" : "Send verification code")}</button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Suggest edits</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submitEdit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                        <p className="text-sm text-muted-foreground">Update the fields you know about. Admins will compare your suggestion to the live profile and apply the changes if they look right.</p>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <Field label="Name"><input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className={inp} /></Field>
                            <Field label="Short summary"><input value={editForm.short} onChange={(e) => setEditForm((f) => ({ ...f, short: e.target.value }))} className={inp} /></Field>
                        </div>
                        <Field label="About"><textarea rows={4} value={editForm.about} onChange={(e) => setEditForm((f) => ({ ...f, about: e.target.value }))} className={inp} /></Field>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <Field label="What we do"><textarea rows={3} value={editForm.does} onChange={(e) => setEditForm((f) => ({ ...f, does: e.target.value }))} className={inp} /></Field>
                            <Field label="Who it's for"><textarea rows={3} value={editForm.forWho} onChange={(e) => setEditForm((f) => ({ ...f, forWho: e.target.value }))} className={inp} /></Field>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <Field label="Meeting times"><input value={editForm.meeting} onChange={(e) => setEditForm((f) => ({ ...f, meeting: e.target.value }))} className={inp} /></Field>
                            <Field label="Address"><input value={editForm.address} onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))} className={inp} /></Field>
                        </div>
                        <div className="grid sm:grid-cols-3 gap-4">
                            <Field label="Email"><input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className={inp} /></Field>
                            <Field label="Phone"><input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} className={inp} /></Field>
                            <Field label="Website"><input type="url" value={editForm.website} onChange={(e) => setEditForm((f) => ({ ...f, website: e.target.value }))} className={inp} /></Field>
                        </div>
                        <div className="grid sm:grid-cols-3 gap-4">
                            <Field label="Brand colour"><input type="color" value={editForm.brandColor} onChange={(e) => setEditForm((f) => ({ ...f, brandColor: e.target.value }))} className="h-11 w-full rounded-2xl border border-border bg-background" /></Field>
                            <Field label="Logo emoji"><input value={editForm.logo} onChange={(e) => setEditForm((f) => ({ ...f, logo: e.target.value }))} className={inp} /></Field>
                            <Field label="Cover URL"><input value={editForm.cover} onChange={(e) => setEditForm((f) => ({ ...f, cover: e.target.value }))} className={inp} /></Field>
                        </div>
                        <Field label="Notes for admin"><textarea rows={3} value={editForm.message} onChange={(e) => setEditForm((f) => ({ ...f, message: e.target.value }))} className={inp} placeholder="Tell us what changed and why" /></Field>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <Field label="Your name"><input value={editForm.contact_name} onChange={(e) => setEditForm((f) => ({ ...f, contact_name: e.target.value }))} className={inp} /></Field>
                            <Field label="Your email"><input type="email" value={editForm.contact_email} onChange={(e) => setEditForm((f) => ({ ...f, contact_email: e.target.value }))} className={inp} /></Field>
                        </div>
                        <DialogFooter>
                            <button type="button" onClick={() => setEditOpen(false)} className="px-4 py-2 rounded-full border border-border text-sm font-semibold">Cancel</button>
                            <button type="submit" disabled={editBusy} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">{editBusy ? "Sending…" : "Send suggestion"}</button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
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

const inp = "w-full px-4 py-2.5 rounded-2xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary";

const Field = ({ label, required, children }) => (
    <label className="block">
        <span className="text-xs font-bold tracking-wider uppercase text-muted-foreground">
            {label} {required && <span className="text-accent">*</span>}
        </span>
        <div className="mt-1.5">{children}</div>
    </label>
);
