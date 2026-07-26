import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { ORG_TYPES } from "@/data/mockData";
import { CheckCircle2, ArrowRight, Building2, Search, PenLine } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const initial = {
    name: "",
    category: "Community groups",
    short: "",
    about: "",
    logo: "✨",
    cover: "",
    contactName: "",
    email: "",
    phone: "",
    website: "",
    facebook: "",
    instagram: "",
    tiktok: "",
    linkedin: "",
    address: "",
    meeting: "",
    brandColor: "#0052FF",
    consent: false,
};

const DRAFT_KEY = "rn-add-org-draft";

export default function AddOrganisation() {
    const { addOrg, orgs } = useApp();
    const [form, setForm] = useState(initial);
    const [submitted, setSubmitted] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        try {
            const raw = localStorage.getItem(DRAFT_KEY);
            if (raw) setForm((current) => ({ ...current, ...JSON.parse(raw) }));
        } catch {
            /* ignore */
        }
    }, []);

    useEffect(() => {
        try {
            const draft = { ...form };
            delete draft.consent;
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } catch {
            /* ignore */
        }
    }, [form]);

    const matchingOrg = useMemo(() => {
        const query = form.name.trim().toLowerCase();
        if (!query) return null;
        return orgs.find((org) => org.name.toLowerCase() === query || org.name.toLowerCase().includes(query) || query.includes(org.name.toLowerCase()));
    }, [form.name, orgs]);

    const set = (k) => (e) =>
        setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.consent) {
            toast.error("Please consent before submitting");
            return;
        }
        const slug = form.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");
        try {
            await addOrg({
                slug,
                name: form.name,
                category: form.category,
                short: form.short,
                about: form.about,
                does: form.about,
                forWho: "",
                meeting: form.meeting,
                address: form.address,
                location: "Blackrod",
                email: form.email,
                phone: form.phone,
                website: form.website,
                socials: {
                    facebook: form.facebook,
                    instagram: form.instagram,
                    tiktok: form.tiktok,
                    linkedin: form.linkedin,
                },
                brandColor: form.brandColor,
                logo: form.logo || "✨",
                cover: form.cover,
            });
            localStorage.removeItem(DRAFT_KEY);
            toast.success("Organisation submitted for approval");
            setSubmitted(true);
        } catch (err) {
            toast.error("Couldn't submit — is the name already taken?");
        }
    };

    if (submitted) {
        return (
            <div data-testid="add-org-success" className="max-w-2xl mx-auto px-6 py-24 text-center">
                <div className="h-14 w-14 mx-auto rounded-full bg-secondary text-secondary-foreground grid place-items-center">
                    <CheckCircle2 className="h-7 w-7" />
                </div>
                <h1 className="font-display font-black text-3xl sm:text-4xl mt-6">You're in the directory!</h1>
                <p className="mt-3 text-muted-foreground">
                    Once an admin approves your profile, it'll appear on Blackrod Now. We'll email you when
                    it's live.
                </p>
                <button
                    onClick={() => navigate("/organisations")}
                    className="mt-6 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm inline-flex items-center gap-1"
                >
                    See directory <ArrowRight className="h-4 w-4" />
                </button>
            </div>
        );
    }

    return (
        <div data-testid="add-org-page" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="mb-8">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Join</span>
                <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight mt-2">
                    Add your organisation
                </h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    Free for clubs, schools, charities, faith groups and local businesses serving Blackrod.
                </p>
                <div className="mt-4 rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
                    <div className="font-semibold text-foreground">What happens next</div>
                    <p className="mt-1">Your draft is saved automatically. Once submitted, admins review it for duplicates and publish it after a quick check.</p>
                </div>
            </div>

            {matchingOrg && (
                <div className="mb-5 rounded-3xl border border-accent/30 bg-accent/5 p-4 text-sm">
                    <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-2xl bg-accent/10 text-accent grid place-items-center shrink-0">
                            <Search className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-semibold">This looks like an existing organisation</div>
                            <p className="text-muted-foreground mt-1">If you already manage {matchingOrg.name}, claim the profile or suggest edits instead of creating a duplicate.</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <button type="button" onClick={() => navigate(`/organisations/${matchingOrg.slug}`)} className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                                    <PenLine className="h-3.5 w-3.5" /> Open profile
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <form onSubmit={submit} data-testid="add-org-form" className="rounded-3xl border border-border bg-surface p-6 sm:p-8 space-y-6">
                <Field label="Organisation name" required>
                    <input data-testid="ao-name" required value={form.name} onChange={set("name")} className={inp} />
                </Field>
                <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Type / category" required>
                        <select data-testid="ao-category" value={form.category} onChange={set("category")} className={inp}>
                            {ORG_TYPES.map((c) => (
                                <option key={c}>{c}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Brand colour">
                        <input data-testid="ao-color" type="color" value={form.brandColor} onChange={set("brandColor")} className="h-11 w-full rounded-2xl border border-border bg-background" />
                    </Field>
                </div>
                <Field label="Short description" required>
                    <input data-testid="ao-short" required value={form.short} onChange={set("short")} className={inp} placeholder="One line that helps people recognise you" />
                </Field>
                <Field label="Full description">
                    <textarea data-testid="ao-about" rows={5} value={form.about} onChange={set("about")} className={inp} placeholder="A bit more detail about what you do" />
                </Field>
                <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Logo emoji / character">
                        <input data-testid="ao-logo" value={form.logo} onChange={set("logo")} className={inp} placeholder="e.g. ⚽" />
                    </Field>
                    <Field label="Cover image URL">
                        <input data-testid="ao-cover" value={form.cover} onChange={set("cover")} className={inp} placeholder="https://" />
                    </Field>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Main contact name">
                        <input data-testid="ao-contact" value={form.contactName} onChange={set("contactName")} className={inp} />
                    </Field>
                    <Field label="Contact email">
                        <input data-testid="ao-email" type="email" value={form.email} onChange={set("email")} className={inp} />
                    </Field>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Contact phone">
                        <input data-testid="ao-phone" value={form.phone} onChange={set("phone")} className={inp} />
                    </Field>
                    <Field label="Website">
                        <input data-testid="ao-website" type="url" value={form.website} onChange={set("website")} className={inp} placeholder="https://" />
                    </Field>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Facebook URL">
                        <input data-testid="ao-fb" value={form.facebook} onChange={set("facebook")} className={inp} placeholder="https://facebook.com/..." />
                    </Field>
                    <Field label="Instagram URL">
                        <input data-testid="ao-ig" value={form.instagram} onChange={set("instagram")} className={inp} placeholder="https://instagram.com/..." />
                    </Field>
                    <Field label="TikTok URL">
                        <input data-testid="ao-tt" value={form.tiktok} onChange={set("tiktok")} className={inp} />
                    </Field>
                    <Field label="LinkedIn URL">
                        <input data-testid="ao-li" value={form.linkedin} onChange={set("linkedin")} className={inp} />
                    </Field>
                </div>
                <Field label="Location / address">
                    <input data-testid="ao-address" value={form.address} onChange={set("address")} className={inp} />
                </Field>
                <Field label="Meeting / opening times">
                    <input data-testid="ao-meeting" value={form.meeting} onChange={set("meeting")} className={inp} placeholder="e.g. Tuesdays 7pm" />
                </Field>

                <label className="flex items-start gap-2 text-sm">
                    <input
                        type="checkbox"
                        data-testid="ao-consent"
                        checked={form.consent}
                        onChange={set("consent")}
                        className="mt-1 h-4 w-4 rounded border-border accent-primary"
                    />
                    <span className="text-muted-foreground">
                        I'm authorised to add this organisation and consent to listing it on Blackrod Now.
                    </span>
                </label>

                <button
                    type="submit"
                    data-testid="ao-submit"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:scale-105 transition-transform"
                >
                    <Building2 className="h-4 w-4" /> Submit organisation
                </button>
            </form>
        </div>
    );
}

const inp =
    "w-full px-4 py-2.5 rounded-2xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary";

const Field = ({ label, required, children }) => (
    <label className="block">
        <span className="text-xs font-bold tracking-wider uppercase text-muted-foreground">
            {label} {required && <span className="text-accent">*</span>}
        </span>
        <div className="mt-1.5">{children}</div>
    </label>
);
