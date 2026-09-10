import React from "react";
import {
    AlertTriangle,
    BadgeCheck,
    Building2,
    CheckCircle2,
    Mail,
    Phone,
    RefreshCw,
    Send,
    ShieldCheck,
    UserCheck,
    XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import {
    getAdminOrganisationContacts,
    getClaimVerifications,
    recordManualClaimVerification,
    sendClaimRelationshipVerification,
} from "@/lib/communityActions";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

const inp = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";

const domainOf = (email) => String(email || "").trim().toLowerCase().split("@")[1] || "";
const hostOf = (url) => {
    try {
        const value = String(url || "").trim();
        if (!value) return "";
        return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
        return "";
    }
};

export default function AdminClaimsCentre() {
    const { orgs, refresh } = useApp();
    const [claims, setClaims] = React.useState([]);
    const [contacts, setContacts] = React.useState([]);
    const [verifications, setVerifications] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [busyId, setBusyId] = React.useState("");
    const [notes, setNotes] = React.useState({});
    const [manualClaim, setManualClaim] = React.useState(null);
    const [manualForm, setManualForm] = React.useState({ method: "telephone", reason: "" });

    const load = React.useCallback(async () => {
        setLoading(true);
        try {
            const [requestRows, contactRows, verificationRows] = await Promise.all([
                api.orgEditRequests("pending").catch(() => []),
                getAdminOrganisationContacts().catch(() => []),
                getClaimVerifications().catch(() => []),
            ]);
            setClaims((Array.isArray(requestRows) ? requestRows : []).filter((request) => request.request_type === "claim"));
            setContacts(contactRows || []);
            setVerifications(verificationRows || []);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => { load(); }, [load]);

    const contactBySlug = React.useMemo(
        () => Object.fromEntries(contacts.map((item) => [item.slug, item])),
        [contacts]
    );
    const orgBySlug = React.useMemo(
        () => Object.fromEntries((orgs || []).map((item) => [item.slug, item])),
        [orgs]
    );
    const verificationByRequest = React.useMemo(
        () => Object.fromEntries(verifications.map((item) => [item.request_id, item])),
        [verifications]
    );

    const startIndependentCheck = async (claim) => {
        setBusyId(claim.id);
        try {
            const result = await sendClaimRelationshipVerification(claim.id);
            toast.success(`Confirmation sent to ${result?.verification?.recipient_masked || "the organisation's established contact"}`);
            await load();
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not send organisation confirmation");
        } finally {
            setBusyId("");
        }
    };

    const openManual = (claim, prefill = "") => {
        setManualClaim(claim);
        setManualForm({
            method: prefill === "email_match" ? "existing_contact_email" : "telephone",
            reason: prefill === "email_match"
                ? "Claimant used the same email address already recorded as the organisation's established contact."
                : "",
        });
    };

    const saveManual = async () => {
        if (!manualClaim) return;
        setBusyId(manualClaim.id);
        try {
            await recordManualClaimVerification(manualClaim.id, manualForm);
            toast.success("Organisation relationship recorded as verified");
            setManualClaim(null);
            await load();
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not record verification");
        } finally {
            setBusyId("");
        }
    };

    const approve = async (claim) => {
        const verification = verificationByRequest[claim.id];
        if (verification?.status !== "approved") {
            toast.error("Verify the claimant's relationship with the organisation before granting access");
            return;
        }
        if (!window.confirm(`Grant ${claim.contact_name || claim.contact_email} administrator access to ${claim.org_name}?`)) return;
        setBusyId(claim.id);
        try {
            await api.reviewOrgEditRequest(claim.id, {
                status: "approved",
                reviewer_notes: notes[claim.id] || `Relationship verified by ${verification.method || "admin check"}.`,
            });
            // The backend claim-review gate records the organisation as managed
            // only after the independent relationship check has passed.
            await refresh();
            await load();
            toast.success(`Access granted to ${claim.org_name}`);
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not approve claim");
        } finally {
            setBusyId("");
        }
    };

    const reject = async (claim) => {
        if (!window.confirm(`Reject this claim for ${claim.org_name}?`)) return;
        setBusyId(claim.id);
        try {
            await api.reviewOrgEditRequest(claim.id, {
                status: "rejected",
                reviewer_notes: notes[claim.id] || "The organisation relationship could not be verified.",
            });
            await load();
            toast.success("Claim rejected");
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not reject claim");
        } finally {
            setBusyId("");
        }
    };

    const approvedVerificationCount = claims.filter((claim) => verificationByRequest[claim.id]?.status === "approved").length;
    const pendingVerificationCount = claims.filter((claim) => verificationByRequest[claim.id]?.status === "pending").length;

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="admin-claims-centre">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Organisation access</div>
                    <h2 className="font-display font-black text-3xl mt-1">Official profile claims</h2>
                    <p className="text-sm text-muted-foreground mt-2 max-w-3xl">
                        A claimant has already proved control of the email address they entered using the six-digit code. This second stage checks that they are actually authorised to represent the organisation before admin access is granted.
                    </p>
                </div>
                <button type="button" onClick={load} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-bold"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh</button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
                <Metric value={claims.length} label="Awaiting decision" />
                <Metric value={approvedVerificationCount} label="Relationship verified" />
                <Metric value={pendingVerificationCount} label="Awaiting org reply" />
                <Metric value={claims.length - approvedVerificationCount - pendingVerificationCount} label="Needs verification" tone={claims.length - approvedVerificationCount - pendingVerificationCount ? "warn" : ""} />
            </div>

            <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
                <div className="font-bold flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Recommended standard</div>
                <p className="mt-1 text-xs leading-relaxed">
                    Best evidence is an independent approval sent to an email address Blackrod Now already holds for the organisation. If that is impossible, verify using a published telephone number, official website/social channel, in-person contact or suitable documentary evidence and record exactly what you checked. “Verified” here means authority to manage the listing, not an endorsement of the organisation.
                </p>
            </div>

            <div className="mt-6 space-y-4">
                {claims.map((claim) => {
                    const contact = contactBySlug[claim.org_slug];
                    const org = orgBySlug[claim.org_slug];
                    const verification = verificationByRequest[claim.id];
                    const claimantEmail = String(claim.contact_email || "").trim().toLowerCase();
                    const establishedEmail = String(contact?.email || "").trim().toLowerCase();
                    const sameEmail = Boolean(claimantEmail && establishedEmail && claimantEmail === establishedEmail);
                    const websiteHost = hostOf(org?.website || contact?.website);
                    const claimantDomain = domainOf(claimantEmail);
                    const domainAligned = Boolean(websiteHost && claimantDomain && (websiteHost === claimantDomain || websiteHost.endsWith(`.${claimantDomain}`) || claimantDomain.endsWith(`.${websiteHost}`)));
                    const verified = verification?.status === "approved";
                    const verificationPending = verification?.status === "pending";
                    const rejectedByOrg = verification?.status === "rejected";

                    return (
                        <article key={claim.id} className="rounded-3xl border border-border bg-surface p-5 sm:p-6" data-testid={`official-claim-${claim.id}`}>
                            <div className="flex flex-col xl:flex-row xl:items-start gap-5">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Building2 className="h-5 w-5 text-primary" />
                                        <h3 className="font-display font-bold text-xl">{claim.org_name}</h3>
                                        {verified && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-black uppercase"><BadgeCheck className="h-3 w-3" /> Relationship verified</span>}
                                        {verificationPending && <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black uppercase">Awaiting confirmation</span>}
                                        {rejectedByOrg && <span className="px-2 py-1 rounded-full bg-red-100 text-red-900 text-[10px] font-black uppercase">Org contact rejected claim</span>}
                                    </div>

                                    <div className="mt-4 grid md:grid-cols-2 gap-3">
                                        <Info label="Claimant" icon={UserCheck} value={claim.contact_name || "Not supplied"} />
                                        <Info label="Claimant email · verified by code" icon={Mail} value={claimantEmail} />
                                        <Info label="Phone supplied" icon={Phone} value={claim.contact_phone || "Not supplied"} />
                                        <Info label="Established organisation email" icon={Mail} value={establishedEmail || "None held"} />
                                    </div>

                                    {(sameEmail || domainAligned) && (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {sameEmail && <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-semibold">Claimant email already matches established contact</span>}
                                            {domainAligned && <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-semibold">Email domain aligns with organisation website</span>}
                                        </div>
                                    )}

                                    <div className="mt-4 rounded-2xl bg-muted/40 p-4">
                                        <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Claimant's evidence</div>
                                        <div className="mt-2 text-sm whitespace-pre-wrap">{claim.message || "No additional evidence supplied."}</div>
                                    </div>

                                    {verification && (
                                        <div className="mt-4 rounded-2xl border border-border p-4 text-xs">
                                            <div className="font-bold">Relationship check</div>
                                            <div className="mt-1 text-muted-foreground">
                                                Method: {String(verification.method || "unknown").replaceAll("_", " ")} · Status: <strong className="text-foreground">{verification.status}</strong>
                                                {verification.recipient_masked ? ` · Sent to ${verification.recipient_masked}` : ""}
                                            </div>
                                            {verification.manual_reason && <div className="mt-2">{verification.manual_reason}</div>}
                                        </div>
                                    )}

                                    <label className="block mt-4">
                                        <span className="text-xs font-bold">Admin notes for decision / claimant</span>
                                        <textarea value={notes[claim.id] || ""} onChange={(e) => setNotes((current) => ({ ...current, [claim.id]: e.target.value }))} rows={2} className={`${inp} mt-1 resize-y`} placeholder="Optional review notes…" />
                                    </label>
                                </div>

                                <div className="xl:w-72 shrink-0 space-y-2">
                                    {!verified && !verificationPending && establishedEmail && !sameEmail && (
                                        <button type="button" onClick={() => startIndependentCheck(claim)} disabled={busyId === claim.id} className="claim-primary"><Send className="h-4 w-4" /> Send official confirmation</button>
                                    )}
                                    {verificationPending && (
                                        <button type="button" onClick={() => startIndependentCheck(claim)} disabled={busyId === claim.id} className="claim-secondary"><RefreshCw className="h-4 w-4" /> Resend confirmation</button>
                                    )}
                                    {sameEmail && !verified && (
                                        <button type="button" onClick={() => openManual(claim, "email_match")} disabled={busyId === claim.id} className="claim-secondary"><CheckCircle2 className="h-4 w-4" /> Accept established email match</button>
                                    )}
                                    {!verified && (
                                        <button type="button" onClick={() => openManual(claim)} disabled={busyId === claim.id} className="claim-secondary"><ShieldCheck className="h-4 w-4" /> Record manual verification</button>
                                    )}
                                    {!establishedEmail && !verified && (
                                        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /> No established email is held, so an independent email confirmation cannot be sent.</div>
                                    )}
                                    <button type="button" onClick={() => approve(claim)} disabled={!verified || busyId === claim.id || rejectedByOrg} className="claim-primary disabled:opacity-40"><CheckCircle2 className="h-4 w-4" /> Grant access</button>
                                    <button type="button" onClick={() => reject(claim)} disabled={busyId === claim.id} className="claim-danger"><XCircle className="h-4 w-4" /> Reject claim</button>
                                </div>
                            </div>
                        </article>
                    );
                })}

                {!claims.length && (
                    <div className="rounded-3xl border border-border bg-surface p-10 text-center">
                        <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-600" />
                        <h3 className="font-bold mt-3">No organisation claims waiting</h3>
                        <p className="text-sm text-muted-foreground mt-1">New verified-email claim requests will appear here automatically.</p>
                    </div>
                )}
            </div>

            <Dialog open={Boolean(manualClaim)} onOpenChange={(open) => !open && setManualClaim(null)}>
                <DialogContent className="max-w-xl">
                    <DialogHeader><DialogTitle>Record manual organisation verification</DialogTitle></DialogHeader>
                    <p className="text-sm text-muted-foreground">Record what independent evidence you used to establish that the claimant is authorised to represent {manualClaim?.org_name}.</p>
                    <label className="block mt-3">
                        <span className="text-xs font-bold">Verification method</span>
                        <select value={manualForm.method} onChange={(e) => setManualForm((f) => ({ ...f, method: e.target.value }))} className={`${inp} mt-1`}>
                            <option value="existing_contact_email">Existing organisation email match</option>
                            <option value="telephone">Published telephone number</option>
                            <option value="official_website">Official website</option>
                            <option value="official_social">Official social media account</option>
                            <option value="in_person">Known / in-person verification</option>
                            <option value="documentary">Documentary evidence</option>
                            <option value="other">Other</option>
                        </select>
                    </label>
                    <label className="block mt-3">
                        <span className="text-xs font-bold">What did you check?</span>
                        <textarea value={manualForm.reason} onChange={(e) => setManualForm((f) => ({ ...f, reason: e.target.value }))} rows={4} className={`${inp} mt-1 resize-y`} placeholder="For example: Called the telephone number published on the organisation's official website and spoke to…" />
                    </label>
                    <DialogFooter>
                        <button type="button" onClick={() => setManualClaim(null)} className="px-4 py-2 rounded-full border border-border text-sm font-semibold">Cancel</button>
                        <button type="button" onClick={saveManual} disabled={!manualForm.reason.trim() || manualForm.reason.trim().length < 10 || busyId === manualClaim?.id} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">Record verification</button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <style>{`.claim-primary,.claim-secondary,.claim-danger{width:100%;display:flex;align-items:center;justify-content:center;gap:.45rem;border-radius:9999px;padding:.65rem .85rem;font-size:.75rem;font-weight:800}.claim-primary{background:hsl(var(--primary));color:hsl(var(--primary-foreground))}.claim-secondary{border:1px solid hsl(var(--border));background:hsl(var(--background))}.claim-danger{border:1px solid hsl(var(--destructive));color:hsl(var(--destructive))}`}</style>
        </section>
    );
}

function Metric({ value, label, tone = "" }) {
    return (
        <div className={`rounded-2xl border p-4 ${tone === "warn" ? "border-amber-300 bg-amber-50" : "border-border bg-surface"}`}>
            <div className="text-2xl font-black">{value}</div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mt-1">{label}</div>
        </div>
    );
}

function Info({ label, icon: Icon, value }) {
    return (
        <div className="rounded-xl border border-border p-3">
            <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Icon className="h-3 w-3" /> {label}</div>
            <div className="text-sm mt-1 break-all">{value || "—"}</div>
        </div>
    );
}
