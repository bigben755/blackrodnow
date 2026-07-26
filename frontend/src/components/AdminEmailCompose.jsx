import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Mail, Eye, Send, Loader2, Users, AlertTriangle, CheckCircle2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

/**
 * Free-form compose box for the Super Admin.
 * - Recipients: comma / newline separated. Live count + invalid highlight.
 * - Sender: dropdown of whitelisted addresses from `/api/admin/email/senders`.
 * - Preview: renders the branded HTML server-side and shows it in a dialog.
 * - Send: POSTs to `/api/admin/email/send` and surfaces success/failure per address.
 */
export default function AdminEmailCompose() {
    const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
    const [senders, setSenders] = useState([]);
    const [defaultSender, setDefaultSender] = useState("");
    const [form, setForm] = useState({
        to: "",
        subject: "",
        body: "",
        from_email: "",
        reply_to: "",
    });
    const [attachments, setAttachments] = useState([]);
    const [preview, setPreview] = useState(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [sending, setSending] = useState(false);
    const [lastResult, setLastResult] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const r = await api.adminEmailSenders();
                setSenders(r.senders || []);
                setDefaultSender(r.default || "");
                setForm((f) => ({ ...f, from_email: r.default || (r.senders || [])[0] || "" }));
            } catch {
                toast.error("Couldn't load sender list");
            }
        })();
    }, []);

    // Live recipient parse for the counter/badges
    const recipientBits = form.to
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validCount = recipientBits.filter((r) => emailRe.test(r)).length;
    const invalidBits = recipientBits.filter((r) => !emailRe.test(r));

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const buildPayload = () => {
        const payload = new FormData();
        Object.entries(form).forEach(([key, value]) => payload.append(key, value || ""));
        attachments.forEach((file) => payload.append("attachments", file));
        return payload;
    };

    const formatBytes = (bytes) => {
        if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
        return `${bytes} B`;
    };

    const oversizedAttachment = attachments.find((file) => file.size > MAX_ATTACHMENT_BYTES);

    const doPreview = async () => {
        if (oversizedAttachment) {
            toast.error(`${oversizedAttachment.name} is larger than 10 MB`);
            return;
        }
        setBusy(true);
        try {
            const p = await api.adminEmailPreview(buildPayload());
            setPreview(p);
            setPreviewOpen(true);
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Preview failed");
        } finally {
            setBusy(false);
        }
    };

    const doSend = async () => {
        if (!validCount) {
            toast.error("Add at least one valid recipient");
            return;
        }
        if (!form.subject.trim() || !form.body.trim()) {
            toast.error("Subject and body are required");
            return;
        }
        if (oversizedAttachment) {
            toast.error(`${oversizedAttachment.name} is larger than 10 MB`);
            return;
        }
        if (!window.confirm(`Send email to ${validCount} recipient${validCount === 1 ? "" : "s"}?`)) return;
        setSending(true);
        try {
            const r = await api.adminEmailSend(buildPayload());
            setLastResult(r);
            if (r.ok) {
                toast.success(`Sent to ${r.sent} recipient${r.sent === 1 ? "" : "s"}`);
                setForm((f) => ({ ...f, to: "", subject: "", body: "" }));
                setAttachments([]);
                setPreviewOpen(false);
            } else {
                toast.error(`Sent ${r.sent}, failed ${r.failed}. See details below.`);
            }
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Send failed");
        } finally {
            setSending(false);
        }
    };

    return (
        <section className="rounded-3xl border border-border bg-surface p-6" data-testid="admin-email-compose">
            <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                    <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                        <Mail className="h-3 w-3" /> Compose email
                    </div>
                    <h2 className="font-display font-bold text-xl mt-1">Send a one-off email</h2>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                        Free-form message from an admin address. Preview it before sending.
                        Recipients don&rsquo;t need to be Blackrod Now subscribers.
                    </p>
                </div>
                <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span data-testid="compose-recipient-count">{validCount}</span> valid
                </div>
            </div>

            <div className="grid gap-3">
                <div className="grid sm:grid-cols-2 gap-3">
                    <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">From</span>
                        <select
                            data-testid="compose-from"
                            value={form.from_email}
                            onChange={set("from_email")}
                            className={inp}
                        >
                            {senders.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                    {s === defaultSender ? " (default)" : ""}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reply-to (optional)</span>
                        <input
                            data-testid="compose-reply-to"
                            type="email"
                            value={form.reply_to}
                            onChange={set("reply_to")}
                            placeholder="admin@yourcouncil.gov.uk"
                            className={inp}
                        />
                    </label>
                </div>

                <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        To — comma or newline separated
                    </span>
                    <textarea
                        data-testid="compose-to"
                        value={form.to}
                        onChange={set("to")}
                        rows={2}
                        placeholder="rachel@blackrodcricket.co.uk, hello@ptas.blackrod.school, ..."
                        className={inp}
                    />
                    <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-2">
                        <span>
                            <b className="text-foreground">{validCount}</b> valid ·{" "}
                            <b className={invalidBits.length ? "text-destructive" : "text-foreground"}>{invalidBits.length}</b> invalid
                        </span>
                        {invalidBits.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-destructive">
                                <AlertTriangle className="h-3 w-3" /> {invalidBits.slice(0, 3).join(", ")}{invalidBits.length > 3 ? "…" : ""}
                            </span>
                        )}
                    </div>
                </label>

                <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Subject</span>
                    <input
                        data-testid="compose-subject"
                        value={form.subject}
                        onChange={set("subject")}
                        maxLength={200}
                        className={inp}
                    />
                </label>

                <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Body</span>
                    <textarea
                        data-testid="compose-body"
                        value={form.body}
                        onChange={set("body")}
                        rows={9}
                        placeholder="Write your message. URLs are auto-linked. Blank line = new paragraph."
                        className={`${inp} resize-y`}
                    />
                    <div className="mt-1 text-[11px] text-muted-foreground">
                        Plain text. Blank lines become paragraphs. URLs become clickable links.
                    </div>
                </label>

                <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Attachments</span>
                    <input
                        data-testid="compose-attachments"
                        type="file"
                        multiple
                        onChange={(e) => setAttachments(Array.from(e.target.files || []))}
                        className="mt-1 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-full file:border-0 file:bg-muted file:px-4 file:py-2 file:text-xs file:font-semibold file:text-foreground hover:file:bg-muted/80"
                    />
                    <div className="mt-1 text-[11px] text-muted-foreground">
                        Optional. Attach one or more files to the outgoing email. Max 10 MB per file.
                    </div>
                    {attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {attachments.map((file, index) => (
                                <span
                                    key={`${file.name}-${index}`}
                                    className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs"
                                >
                                    <Paperclip className="h-3 w-3 text-muted-foreground" />
                                    <span className="max-w-[220px] truncate">{file.name}</span>
                                    <span className="text-[10px] text-muted-foreground">{formatBytes(file.size)}</span>
                                    <button
                                        type="button"
                                        onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                                        className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-background"
                                        aria-label={`Remove ${file.name}`}
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </label>

                <div className="flex flex-wrap gap-2 pt-1">
                    <button
                        data-testid="compose-preview"
                        onClick={doPreview}
                        disabled={busy || !form.subject.trim() || !form.body.trim()}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-xs font-semibold hover:bg-muted disabled:opacity-60"
                    >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                        Preview
                    </button>
                    <button
                        data-testid="compose-send"
                        onClick={doSend}
                        disabled={sending || !validCount || !form.subject.trim() || !form.body.trim()}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-60"
                    >
                        {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Send to {validCount || 0}
                    </button>
                </div>

                {lastResult && (
                    <div
                        data-testid="compose-last-result"
                        className={`mt-2 rounded-2xl border p-3 text-xs ${
                            lastResult.ok ? "border-secondary/40 bg-secondary/10" : "border-destructive/40 bg-destructive/5"
                        }`}
                    >
                        <div className="font-semibold flex items-center gap-1">
                            {lastResult.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-secondary" /> : <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                            Sent: {lastResult.sent} · Failed: {lastResult.failed}
                        </div>
                        {lastResult.results?.some((r) => !r.ok) && (
                            <ul className="mt-1.5 space-y-0.5 max-h-32 overflow-y-auto">
                                {lastResult.results.filter((r) => !r.ok).map((r, i) => (
                                    <li key={i} className="text-destructive">
                                        {r.to} — {r.error || "failed"}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>

            {/* Preview dialog */}
            <Dialog open={previewOpen} onOpenChange={(v) => !v && setPreviewOpen(false)}>
                <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden" data-testid="compose-preview-dialog">
                    <DialogHeader className="p-5 pb-3 border-b border-border">
                        <DialogTitle className="flex items-center gap-2">
                            <Eye className="h-4 w-4 text-primary" />
                            Email preview
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            {preview?.from} · to {preview?.count} recipient{preview?.count === 1 ? "" : "s"}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid sm:grid-cols-[280px_1fr] gap-0 max-h-[70vh]">
                        <aside className="border-r border-border bg-muted/30 p-4 text-xs overflow-y-auto">
                            <Row label="Subject" value={preview?.subject} />
                            <Row label="From" value={preview?.from} mono />
                            <Row label="To" value={preview?.recipients?.join(", ")} />
                            <Row
                                label="Attachments"
                                value={preview?.attachments?.length ? preview.attachments.map((file) => file.filename).join(", ") : "None"}
                            />
                            {preview?.invalid_recipients?.length > 0 && (
                                <Row label="Skipped (invalid)" value={preview.invalid_recipients.join(", ")} danger />
                            )}
                        </aside>
                        <iframe
                            data-testid="compose-preview-iframe"
                            title="email preview"
                            srcDoc={preview?.html || ""}
                            sandbox=""
                            className="w-full h-[70vh] bg-white"
                        />
                    </div>
                    <div className="p-4 border-t border-border flex flex-wrap justify-end gap-2">
                        <button
                            onClick={() => setPreviewOpen(false)}
                            className="inline-flex items-center px-4 py-2 rounded-full border border-border text-xs font-semibold hover:bg-muted"
                        >
                            Close
                        </button>
                        <button
                            data-testid="compose-preview-send"
                            onClick={doSend}
                            disabled={sending || !validCount}
                            className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-60"
                        >
                            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            Send to {validCount}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </section>
    );
}

const inp =
    "mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

function Row({ label, value, mono, danger }) {
    if (!value) return null;
    return (
        <div className="mb-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className={`mt-0.5 ${mono ? "font-mono text-[11px]" : "text-xs"} ${danger ? "text-destructive" : ""} break-all`}>
                {value}
            </div>
        </div>
    );
}
