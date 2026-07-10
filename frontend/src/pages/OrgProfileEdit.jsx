import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { ORG_TYPES } from "@/data/mockData";
import { ArrowLeft, Save, Building2, Upload, Trash2, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import OrgAvatar from "@/components/OrgAvatar";

export default function OrgProfileEdit() {
    const { slug } = useParams();
    const { orgs, patchOrg, role, refresh } = useApp();
    const org = orgs.find((o) => o.slug === slug);
    const navigate = useNavigate();
    const [form, setForm] = useState(null);
    const [busy, setBusy] = useState(false);
    const [logoBusy, setLogoBusy] = useState(false);
    const [coverBusy, setCoverBusy] = useState(false);

    useEffect(() => {
        if (org && !form) {
            setForm({
                name: org.name || "",
                category: org.category || "Community groups",
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
                logo: org.logo || "✨",
                cover: org.cover || "",
                brandColor: org.brandColor || "#0052FF",
                socials: {
                    facebook: org.socials?.facebook || "",
                    instagram: org.socials?.instagram || "",
                    tiktok: org.socials?.tiktok || "",
                    linkedin: org.socials?.linkedin || "",
                },
            });
        }
    }, [org, form]);

    if (!org || !form) {
        return (
            <div className="max-w-2xl mx-auto py-24 px-6 text-center">
                <h1 className="font-display font-bold text-3xl">Organisation not found</h1>
                <Link to="/organisations" className="mt-6 inline-flex text-primary font-semibold">Back to directory</Link>
            </div>
        );
    }

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
    const setSocial = (k) => (e) => setForm((f) => ({ ...f, socials: { ...f.socials, [k]: e.target.value } }));

    const save = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            await patchOrg(slug, form);
            toast.success("Profile saved");
            navigate(role === "admin" ? "/admin" : `/organisations/${slug}`);
        } catch { toast.error("Save failed"); }
        finally { setBusy(false); }
    };

    return (
        <div data-testid="org-edit-page" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <Link to={role === "admin" ? "/admin" : "/organisation-dashboard"} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
                <ArrowLeft className="h-4 w-4" /> Back
            </Link>
            <div className="flex items-end justify-between mb-6">
                <div>
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Profile & branding</span>
                    <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tight mt-1">Edit {org.name}</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {role === "admin"
                            ? "Super admin — you can update any organisation."
                            : "Your changes go live immediately after saving."}
                    </p>
                </div>
            </div>

            <form onSubmit={save} className="rounded-3xl border border-border bg-surface p-6 sm:p-8 space-y-5">
                {/* Live preview */}
                <div
                    className="rounded-2xl overflow-hidden border border-border"
                    style={{ background: `linear-gradient(135deg, ${form.brandColor}CC, ${form.brandColor}44)` }}
                >
                    <div className="h-28 sm:h-32 relative">
                        {org.cover_path ? (
                            <img
                                src={api.orgCoverUrl(org.slug, org.updated_at || "")}
                                alt=""
                                className="absolute inset-0 h-full w-full object-cover opacity-70"
                            />
                        ) : form.cover ? (
                            <img src={form.cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
                        ) : null}
                        <div className="absolute bottom-2 left-4 flex items-center gap-3">
                            <OrgAvatar
                                org={{ ...org, ...form }}
                                size={56}
                                rounded="rounded-2xl"
                                className="shadow-md ring-2 ring-white/70"
                            />
                            <div className="text-white font-display font-bold text-lg drop-shadow">{form.name || "Your organisation"}</div>
                        </div>
                    </div>
                </div>

                {/* Logo + Cover uploaders */}
                <div className="grid sm:grid-cols-2 gap-4">
                    <ImageUploader
                        label="Logo"
                        hint="PNG, JPG or WebP. Center-cropped to 512×512 automatically. Max 5MB."
                        preview={org.logo_path ? api.orgLogoUrl(org.slug, false, org.updated_at || "") : null}
                        emojiFallback={form.logo}
                        busy={logoBusy}
                        onUpload={async (file) => {
                            setLogoBusy(true);
                            try {
                                await api.uploadOrgLogo(slug, file);
                                await refresh?.();
                                toast.success("Logo updated");
                            } catch (e) {
                                toast.error(e?.response?.data?.detail || "Upload failed");
                            } finally { setLogoBusy(false); }
                        }}
                        onRemove={org.logo_path ? async () => {
                            setLogoBusy(true);
                            try { await api.deleteOrgLogo(slug); await refresh?.(); toast.info("Logo removed"); }
                            catch { toast.error("Failed"); }
                            finally { setLogoBusy(false); }
                        } : null}
                        testId="logo-uploader"
                        aspect="aspect-square"
                    />
                    <ImageUploader
                        label="Cover image"
                        hint="Wide banner. Fit-cropped to 1600×500. Max 5MB."
                        preview={org.cover_path ? api.orgCoverUrl(org.slug, org.updated_at || "") : null}
                        busy={coverBusy}
                        onUpload={async (file) => {
                            setCoverBusy(true);
                            try {
                                await api.uploadOrgCover(slug, file);
                                await refresh?.();
                                toast.success("Cover updated");
                            } catch (e) {
                                toast.error(e?.response?.data?.detail || "Upload failed");
                            } finally { setCoverBusy(false); }
                        }}
                        onRemove={org.cover_path ? async () => {
                            setCoverBusy(true);
                            try { await api.deleteOrgCover(slug); await refresh?.(); toast.info("Cover removed"); }
                            catch { toast.error("Failed"); }
                            finally { setCoverBusy(false); }
                        } : null}
                        testId="cover-uploader"
                        aspect="aspect-[16/5]"
                    />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Name" required>
                        <input required data-testid="ed-name" value={form.name} onChange={set("name")} className={inp} />
                    </Field>
                    <Field label="Category">
                        <select data-testid="ed-category" value={form.category} onChange={set("category")} className={inp}>
                            {ORG_TYPES.map((c) => <option key={c}>{c}</option>)}
                        </select>
                    </Field>
                </div>
                <Field label="Short description">
                    <input data-testid="ed-short" value={form.short} onChange={set("short")} className={inp} />
                </Field>
                <Field label="About">
                    <textarea data-testid="ed-about" value={form.about} onChange={set("about")} rows={4} className={inp} />
                </Field>
                <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="What we do"><textarea data-testid="ed-does" value={form.does} onChange={set("does")} rows={3} className={inp} /></Field>
                    <Field label="Who it's for"><textarea data-testid="ed-forwho" value={form.forWho} onChange={set("forWho")} rows={3} className={inp} /></Field>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Meeting / opening times"><input data-testid="ed-meeting" value={form.meeting} onChange={set("meeting")} className={inp} /></Field>
                    <Field label="Address"><input data-testid="ed-address" value={form.address} onChange={set("address")} className={inp} /></Field>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                    <Field label="Email"><input data-testid="ed-email" type="email" value={form.email} onChange={set("email")} className={inp} /></Field>
                    <Field label="Phone"><input data-testid="ed-phone" value={form.phone} onChange={set("phone")} className={inp} /></Field>
                    <Field label="Website"><input data-testid="ed-website" value={form.website} onChange={set("website")} className={inp} /></Field>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Emoji fallback (used if no logo uploaded)"><input data-testid="ed-logo" value={form.logo} onChange={set("logo")} className={inp} maxLength={4} /></Field>
                    <Field label="Brand colour"><input data-testid="ed-color" type="color" value={form.brandColor} onChange={set("brandColor")} className="h-11 w-full rounded-2xl border border-border bg-background" /></Field>
                </div>
                <fieldset className="border border-border rounded-2xl p-4">
                    <legend className="text-xs font-bold tracking-wider uppercase text-muted-foreground px-2">Social links</legend>
                    <div className="grid sm:grid-cols-2 gap-3 mt-2">
                        <Field label="Facebook"><input data-testid="ed-fb" value={form.socials.facebook} onChange={setSocial("facebook")} className={inp} /></Field>
                        <Field label="Instagram"><input data-testid="ed-ig" value={form.socials.instagram} onChange={setSocial("instagram")} className={inp} /></Field>
                        <Field label="TikTok"><input data-testid="ed-tt" value={form.socials.tiktok} onChange={setSocial("tiktok")} className={inp} /></Field>
                        <Field label="LinkedIn"><input data-testid="ed-li" value={form.socials.linkedin} onChange={setSocial("linkedin")} className={inp} /></Field>
                    </div>
                </fieldset>

                <button
                    type="submit"
                    data-testid="ed-save"
                    disabled={busy}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-60"
                >
                    <Save className="h-4 w-4" /> Save changes
                </button>
            </form>
        </div>
    );
}

const inp = "w-full px-4 py-2.5 rounded-2xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary";

const Field = ({ label, required, children }) => (
    <label className="block">
        <span className="text-xs font-bold tracking-wider uppercase text-muted-foreground">
            {label} {required && <span className="text-accent">*</span>}
        </span>
        <div className="mt-1.5">{children}</div>
    </label>
);

function ImageUploader({ label, hint, preview, emojiFallback, busy, onUpload, onRemove, testId, aspect = "aspect-square" }) {
    const inputId = `upload-${testId}`;
    return (
        <div className="rounded-2xl border border-border bg-background p-4">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold tracking-wider uppercase text-muted-foreground">{label}</span>
                {onRemove && (
                    <button
                        type="button"
                        data-testid={`${testId}-remove`}
                        onClick={onRemove}
                        disabled={busy}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-destructive"
                    >
                        <Trash2 className="h-3 w-3" /> Remove
                    </button>
                )}
            </div>
            <div className={`relative w-full ${aspect} rounded-xl bg-muted/50 border border-dashed border-border overflow-hidden grid place-items-center`}>
                {preview ? (
                    <img src={preview} alt="" className={`h-full w-full ${aspect === "aspect-square" ? "object-contain p-2" : "object-cover"}`} />
                ) : emojiFallback ? (
                    <span aria-hidden className="text-5xl">{emojiFallback}</span>
                ) : (
                    <div className="text-center text-muted-foreground text-xs px-4">
                        <ImageIcon className="h-6 w-6 mx-auto mb-1 opacity-60" />
                        No image uploaded yet
                    </div>
                )}
                {busy && (
                    <div className="absolute inset-0 bg-background/70 grid place-items-center">
                        <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">{hint}</p>
            <label
                htmlFor={inputId}
                className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary text-primary-foreground font-semibold text-xs cursor-pointer disabled:opacity-60"
            >
                <Upload className="h-3.5 w-3.5" /> {preview ? "Replace" : "Upload"}
                <input
                    id={inputId}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    data-testid={`${testId}-input`}
                    className="hidden"
                    disabled={busy}
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onUpload(f);
                        e.target.value = "";
                    }}
                />
            </label>
        </div>
    );
}
