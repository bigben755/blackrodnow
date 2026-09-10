import React from "react";
import {
    Archive,
    Building2,
    CheckCircle2,
    FileText,
    Inbox,
    Mail,
    Paperclip,
    RefreshCw,
    Reply,
    Search,
    Send,
    Trash2,
    Users,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
    getAdminOrganisationContacts,
    getAdminMessageAttachments,
    sendAdminCommunityMessage,
} from "@/lib/communityActions";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

const inp = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";

const formatWhen = (value) => {
    if (!value) return "";
    try {
        return new Date(value).toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return String(value);
    }
};

const messageAddress = (message) => {
    if (message.direction === "outbound_admin") {
        return message.to_email || message.to_org_slug || "Recipient";
    }
    return message.from_email || message.from_org_slug || message.from_name || "Sender";
};

const attachmentList = (message) => {
    const direct = Array.isArray(message?.attachments) ? message.attachments : [];
    const meta = Array.isArray(message?.metadata?.attachments) ? message.metadata.attachments : [];
    return direct.length ? direct : meta;
};

export default function AdminCommunications({ initialOrgSlug = "", initialMode = "", onInitialOrgHandled }) {
    const [contacts, setContacts] = React.useState([]);
    const [messages, setMessages] = React.useState([]);
    const [senders, setSenders] = React.useState([]);
    const [defaultSender, setDefaultSender] = React.useState("");
    const [view, setView] = React.useState("inbox");
    const [messageFilter, setMessageFilter] = React.useState("inbound");
    const [query, setQuery] = React.useState("");
    const [selectedMessage, setSelectedMessage] = React.useState(null);
    const [messageAttachments, setMessageAttachments] = React.useState([]);
    const [attachmentLoading, setAttachmentLoading] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [sending, setSending] = React.useState(false);
    const [preview, setPreview] = React.useState(null);
    const [previewOpen, setPreviewOpen] = React.useState(false);
    const [attachments, setAttachments] = React.useState([]);
    const [recipientMode, setRecipientMode] = React.useState("single");
    const [selectedOrgSlug, setSelectedOrgSlug] = React.useState("");
    const [directEmail, setDirectEmail] = React.useState("");
    const [parentMessageId, setParentMessageId] = React.useState("");
    const [form, setForm] = React.useState({
        from_email: "",
        reply_to: "",
        subject: "",
        body: "",
    });

    const load = React.useCallback(async () => {
        setLoading(true);
        try {
            const [contactRows, messageRows, senderData] = await Promise.all([
                getAdminOrganisationContacts().catch(() => []),
                api.adminMessages().catch(() => []),
                api.adminEmailSenders().catch(() => ({ senders: [], default: "" })),
            ]);
            setContacts(contactRows || []);
            setMessages(Array.isArray(messageRows) ? messageRows : []);
            setSenders(senderData?.senders || []);
            setDefaultSender(senderData?.default || "");
            setForm((current) => ({
                ...current,
                from_email: current.from_email || senderData?.default || senderData?.senders?.[0] || "",
            }));
            if (!selectedOrgSlug && contactRows?.length) {
                setSelectedOrgSlug(contactRows.find((item) => item.email)?.slug || contactRows[0]?.slug || "");
            }
        } finally {
            setLoading(false);
        }
    }, [selectedOrgSlug]);

    React.useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    React.useEffect(() => {
        if (!initialOrgSlug && !initialMode) return;
        if (initialOrgSlug) setSelectedOrgSlug(initialOrgSlug);
        if (initialMode === "all") setRecipientMode("all");
        else if (initialMode === "inbox") { setView("inbox"); setMessageFilter("inbound"); }
        else setRecipientMode("single");
        setDirectEmail("");
        if (initialMode !== "inbox") setView("compose");
        if (onInitialOrgHandled) onInitialOrgHandled();
    }, [initialMode, initialOrgSlug, onInitialOrgHandled]);

    const contactBySlug = React.useMemo(
        () => Object.fromEntries(contacts.map((item) => [item.slug, item])),
        [contacts]
    );

    const recipientEmails = React.useMemo(() => {
        if (recipientMode === "all") {
            return [...new Set(contacts.map((item) => item.email).filter(Boolean))];
        }
        if (recipientMode === "direct") return directEmail ? [directEmail] : [];
        const email = contactBySlug[selectedOrgSlug]?.email;
        return email ? [email] : [];
    }, [contactBySlug, contacts, directEmail, recipientMode, selectedOrgSlug]);

    const visibleMessages = React.useMemo(() => {
        const needle = query.trim().toLowerCase();
        return messages
            .filter((message) => {
                if (messageFilter === "inbound" && message.direction === "outbound_admin") return false;
                if (messageFilter === "sent" && message.direction !== "outbound_admin") return false;
                if (messageFilter === "unread" && (message.read || message.direction === "outbound_admin")) return false;
                if (!needle) return true;
                return [message.subject, message.body, message.from_name, message.from_email, message.to_email, message.from_org_slug, message.to_org_slug]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase()
                    .includes(needle);
            })
            .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    }, [messageFilter, messages, query]);

    const openMessage = async (message) => {
        setSelectedMessage(message);
        const recordedAttachments = attachmentList(message);
        setMessageAttachments(recordedAttachments);

        // Always ask the backend for live attachment metadata on received email.
        // Resend webhook payloads may not contain the complete attachment list,
        // while the receiving API can return fresh signed download URLs.
        if (message.direction !== "outbound_admin" || recordedAttachments.length > 0) {
            setAttachmentLoading(true);
            try {
                const rows = await getAdminMessageAttachments(message.id);
                setMessageAttachments(rows?.length ? rows : recordedAttachments);
            } catch {
                setMessageAttachments(recordedAttachments);
            } finally {
                setAttachmentLoading(false);
            }
        }
        if (!message.read && message.direction !== "outbound_admin") {
            try {
                await api.markMessageRead(message.id);
                setMessages((current) => current.map((item) => item.id === message.id ? { ...item, read: true } : item));
                setSelectedMessage((current) => current ? { ...current, read: true } : current);
            } catch {
                // Reading the message still works if marking it read fails.
            }
        }
    };

    const replyTo = (message) => {
        const email = message.direction === "outbound_admin" ? message.to_email : message.from_email;
        const slug = message.direction === "outbound_admin" ? message.to_org_slug : message.from_org_slug;
        const baseSubject = String(message.subject || "").replace(/^re:\s*/i, "");
        if (slug && contactBySlug[slug]?.email) {
            setRecipientMode("single");
            setSelectedOrgSlug(slug);
            setDirectEmail("");
        } else {
            setRecipientMode("direct");
            setDirectEmail(email || "");
        }
        setParentMessageId(message.id || "");
        setForm((current) => ({
            ...current,
            subject: `Re: ${baseSubject}`,
            body: "",
        }));
        setAttachments([]);
        setSelectedMessage(null);
        setView("compose");
    };

    const deleteMessage = async (message) => {
        if (!window.confirm(`Delete “${message.subject || "this message"}” from the admin inbox?`)) return;
        try {
            await api.deleteAdminMessage(message.id);
            setMessages((current) => current.filter((item) => item.id !== message.id));
            setSelectedMessage(null);
            toast.success("Message deleted");
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not delete message");
        }
    };

    const addAttachments = (files) => {
        const next = Array.from(files || []);
        const tooLarge = next.find((file) => file.size > 10 * 1024 * 1024);
        if (tooLarge) {
            toast.error(`${tooLarge.name} is larger than 10 MB`);
            return;
        }
        setAttachments(next);
    };

    const communityPayload = () => {
        const payload = new FormData();
        payload.append("to_mode", recipientMode === "all" ? "all" : recipientMode === "direct" ? "email" : "orgs");
        payload.append("org_slugs", recipientMode === "single" ? selectedOrgSlug : "");
        payload.append("to_email", recipientMode === "direct" ? directEmail : "");
        payload.append("subject", form.subject.trim());
        payload.append("body", form.body.trim());
        payload.append("from_email", form.from_email || defaultSender);
        payload.append("reply_to", form.reply_to || "");
        payload.append("parent_message_id", parentMessageId || "");
        attachments.forEach((file) => payload.append("attachments", file));
        return payload;
    };

    const previewPayload = () => {
        const payload = new FormData();
        payload.append("to", recipientEmails.join(","));
        payload.append("subject", form.subject.trim());
        payload.append("body", form.body.trim());
        payload.append("from_email", form.from_email || defaultSender);
        payload.append("reply_to", form.reply_to || "");
        attachments.forEach((file) => payload.append("attachments", file));
        return payload;
    };

    const doPreview = async () => {
        if (!form.subject.trim() || !form.body.trim()) return toast.error("Add a subject and message first");
        if (!recipientEmails.length) return toast.error("Choose an organisation with an email address");
        try {
            const result = await api.adminEmailPreview(previewPayload());
            setPreview(result);
            setPreviewOpen(true);
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Preview failed");
        }
    };

    const doSend = async () => {
        if (!form.subject.trim() || !form.body.trim()) return toast.error("Subject and message are required");
        if (!recipientEmails.length) return toast.error("No valid recipient email is available");
        const who = recipientMode === "all"
            ? `${recipientEmails.length} organisation email address${recipientEmails.length === 1 ? "" : "es"}`
            : recipientEmails[0];
        if (!window.confirm(`Send “${form.subject.trim()}” to ${who}?`)) return;

        setSending(true);
        try {
            const result = await sendAdminCommunityMessage(communityPayload());
            if (result.failed) {
                toast.error(`Sent ${result.sent}; ${result.failed} failed`);
            } else {
                toast.success(`Sent to ${result.sent} recipient${result.sent === 1 ? "" : "s"}`);
            }
            setForm((current) => ({ ...current, subject: "", body: "" }));
            setAttachments([]);
            setParentMessageId("");
            await load();
            setView("inbox");
            setMessageFilter("sent");
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not send email");
        } finally {
            setSending(false);
        }
    };

    const unreadCount = messages.filter((message) => !message.read && message.direction !== "outbound_admin").length;
    const missingEmailCount = contacts.filter((contact) => !contact.email).length;

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="admin-communications">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Messages & email</div>
                    <h2 className="font-display font-black text-3xl mt-1">Community communications</h2>
                    <p className="text-sm text-muted-foreground mt-2 max-w-3xl">
                        Read incoming messages and emails, reply to organisations, or send one message to an individual organisation or every organisation. Outgoing messages support attachments up to 10 MB per file.
                    </p>
                </div>
                <button type="button" onClick={load} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-bold">
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
                </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
                <Metric value={unreadCount} label="Unread" />
                <Metric value={messages.filter((item) => item.direction !== "outbound_admin").length} label="Received" />
                <Metric value={messages.filter((item) => item.direction === "outbound_admin").length} label="Sent / replies" />
                <Metric value={missingEmailCount} label="Orgs without email" tone={missingEmailCount ? "warn" : ""} />
            </div>

            <div className="mt-6 flex gap-2">
                <button type="button" onClick={() => setView("inbox")} className={`comm-tab ${view === "inbox" ? "active" : ""}`}><Inbox className="h-4 w-4" /> Inbox</button>
                <button type="button" onClick={() => setView("compose")} className={`comm-tab ${view === "compose" ? "active" : ""}`}><Send className="h-4 w-4" /> Compose</button>
            </div>

            {view === "inbox" ? (
                <div className="mt-4 rounded-3xl border border-border bg-surface overflow-hidden">
                    <div className="p-4 border-b border-border flex flex-col lg:flex-row lg:items-center gap-3">
                        <div className="flex flex-wrap gap-2">
                            {[["inbound", "Inbox"], ["unread", "Unread"], ["sent", "Sent"], ["all", "All"]].map(([key, label]) => (
                                <button key={key} type="button" onClick={() => setMessageFilter(key)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${messageFilter === key ? "bg-foreground text-background border-foreground" : "border-border"}`}>{label}</button>
                            ))}
                        </div>
                        <div className="relative flex-1 lg:max-w-sm lg:ml-auto">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search messages…" className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-2 text-sm" />
                        </div>
                    </div>

                    <div className="divide-y divide-border max-h-[680px] overflow-y-auto">
                        {visibleMessages.map((message) => {
                            const incoming = message.direction !== "outbound_admin";
                            return (
                                <button key={message.id} type="button" onClick={() => openMessage(message)} className={`w-full p-4 text-left hover:bg-muted/40 flex gap-3 ${incoming && !message.read ? "bg-primary/5" : ""}`}>
                                    <span className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${incoming ? "bg-blue-100 text-blue-900" : "bg-emerald-100 text-emerald-900"}`}>
                                        {incoming ? <Mail className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold truncate">{message.subject || "No subject"}</span>
                                            {incoming && !message.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1 truncate">{incoming ? "From" : "To"}: {messageAddress(message)} · {formatWhen(message.created_at)}</div>
                                        <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{message.body}</div>
                                    </div>
                                    {attachmentList(message).length > 0 && <Paperclip className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />}
                                </button>
                            );
                        })}
                        {!visibleMessages.length && <div className="p-12 text-center text-sm text-muted-foreground">No messages in this view.</div>}
                    </div>
                </div>
            ) : (
                <div className="mt-4 rounded-3xl border border-border bg-surface p-5 sm:p-6">
                    <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-primary" />
                        <h3 className="font-display font-bold text-xl">Compose email</h3>
                    </div>
                    <div className="mt-5 grid gap-4">
                        <div className="grid lg:grid-cols-3 gap-3">
                            <label className="block">
                                <span className="text-xs font-bold">Recipient</span>
                                <select value={recipientMode} onChange={(e) => { setRecipientMode(e.target.value); setParentMessageId(""); }} className={`${inp} mt-1`}>
                                    <option value="single">One organisation</option>
                                    <option value="all">All organisations</option>
                                    <option value="direct">Direct email / reply</option>
                                </select>
                            </label>
                            {recipientMode === "single" && (
                                <label className="block lg:col-span-2">
                                    <span className="text-xs font-bold">Organisation</span>
                                    <select value={selectedOrgSlug} onChange={(e) => setSelectedOrgSlug(e.target.value)} className={`${inp} mt-1`}>
                                        <option value="">Choose organisation</option>
                                        {contacts.map((contact) => (
                                            <option key={contact.slug} value={contact.slug}>{contact.name}{contact.email ? ` — ${contact.email}` : " — NO EMAIL"}</option>
                                        ))}
                                    </select>
                                </label>
                            )}
                            {recipientMode === "all" && (
                                <div className="lg:col-span-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
                                    <strong>{recipientEmails.length}</strong> unique organisation email addresses will receive separate messages. {missingEmailCount > 0 && <span className="text-amber-700">{missingEmailCount} organisations have no usable email and will be skipped.</span>}
                                </div>
                            )}
                            {recipientMode === "direct" && (
                                <label className="block lg:col-span-2">
                                    <span className="text-xs font-bold">Email address</span>
                                    <input type="email" value={directEmail} onChange={(e) => setDirectEmail(e.target.value)} className={`${inp} mt-1`} />
                                </label>
                            )}
                        </div>

                        {recipientMode === "single" && selectedOrgSlug && !contactBySlug[selectedOrgSlug]?.email && (
                            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                                This organisation has no registered, member or public email address. Add an email to its profile/access record before sending.
                            </div>
                        )}

                        <div className="grid sm:grid-cols-2 gap-3">
                            <label className="block">
                                <span className="text-xs font-bold">From</span>
                                <select value={form.from_email} onChange={(e) => setForm((f) => ({ ...f, from_email: e.target.value }))} className={`${inp} mt-1`}>
                                    {senders.map((sender) => <option key={sender} value={sender}>{sender}</option>)}
                                </select>
                            </label>
                            <label className="block">
                                <span className="text-xs font-bold">Reply-to (optional)</span>
                                <input type="email" value={form.reply_to} onChange={(e) => setForm((f) => ({ ...f, reply_to: e.target.value }))} className={`${inp} mt-1`} />
                            </label>
                        </div>

                        <label className="block">
                            <span className="text-xs font-bold">Subject</span>
                            <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} className={`${inp} mt-1`} maxLength={200} />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold">Message</span>
                            <textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} rows={10} className={`${inp} mt-1 resize-y`} />
                        </label>

                        <label className="block">
                            <span className="text-xs font-bold">Attachments</span>
                            <input type="file" multiple onChange={(e) => addAttachments(e.target.files)} className="mt-1 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-full file:border-0 file:bg-muted file:px-4 file:py-2 file:text-xs file:font-bold" />
                            <div className="text-[11px] text-muted-foreground mt-1">Maximum 10 MB per file.</div>
                        </label>
                        {attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {attachments.map((file, index) => (
                                    <span key={`${file.name}-${index}`} className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs">
                                        <Paperclip className="h-3.5 w-3.5" /> {file.name}
                                        <button type="button" onClick={() => setAttachments((current) => current.filter((_, i) => i !== index))}><X className="h-3.5 w-3.5" /></button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {parentMessageId && <div className="text-xs text-muted-foreground">This will be recorded as a reply to message {parentMessageId}.</div>}

                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={doPreview} disabled={!recipientEmails.length || !form.subject.trim() || !form.body.trim()} className="px-4 py-2 rounded-full border border-border text-xs font-bold disabled:opacity-50">Preview</button>
                            <button type="button" onClick={doSend} disabled={sending || !recipientEmails.length || !form.subject.trim() || !form.body.trim()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50">
                                <Send className={`h-3.5 w-3.5 ${sending ? "animate-pulse" : ""}`} /> Send to {recipientEmails.length || 0}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Dialog open={Boolean(selectedMessage)} onOpenChange={(open) => !open && setSelectedMessage(null)}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    {selectedMessage && (
                        <>
                            <DialogHeader>
                                <DialogTitle>{selectedMessage.subject || "No subject"}</DialogTitle>
                            </DialogHeader>
                            <div className="text-xs text-muted-foreground">
                                {selectedMessage.direction === "outbound_admin" ? "Sent to" : "From"}: {messageAddress(selectedMessage)} · {formatWhen(selectedMessage.created_at)}
                            </div>
                            <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed rounded-2xl bg-muted/40 p-4">{selectedMessage.body}</div>
                            {messageAttachments.length > 0 && (
                                <div className="mt-4">
                                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Attachments</div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {messageAttachments.map((attachment, index) => {
                                            const name = attachment.filename || attachment.name || `Attachment ${index + 1}`;
                                            const chip = (
                                                <>
                                                    <FileText className="h-3.5 w-3.5" />
                                                    <span>{name}</span>
                                                    {attachment.size ? <span className="text-muted-foreground">· {Math.max(1, Math.round(Number(attachment.size) / 1024))} KB</span> : null}
                                                </>
                                            );
                                            return attachment.download_url ? (
                                                <a key={attachment.id || index} href={attachment.download_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs hover:bg-muted">
                                                    {chip}
                                                </a>
                                            ) : (
                                                <span key={attachment.id || index} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs">
                                                    {chip}
                                                </span>
                                            );
                                        })}
                                    </div>
                                    <p className="mt-2 text-[11px] text-muted-foreground">
                                        {attachmentLoading ? "Refreshing secure attachment links…" : "Incoming attachment links are requested securely from Resend when you open the message; signed links expire automatically."}
                                    </p>
                                </div>
                            )}
                            <div className="mt-5 flex flex-wrap gap-2">
                                <button type="button" onClick={() => replyTo(selectedMessage)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold"><Reply className="h-3.5 w-3.5" /> Reply</button>
                                <button type="button" onClick={() => deleteMessage(selectedMessage)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-destructive text-destructive text-xs font-bold"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Email preview</DialogTitle></DialogHeader>
                    {preview && (
                        <>
                            <div className="grid sm:grid-cols-2 gap-3 text-xs">
                                <div className="rounded-xl bg-muted p-3"><strong>From</strong><br />{preview.from}</div>
                                <div className="rounded-xl bg-muted p-3"><strong>Recipients</strong><br />{preview.count} valid</div>
                            </div>
                            <div className="mt-3 rounded-xl border border-border p-3 text-sm"><strong>{preview.subject}</strong></div>
                            <iframe title="Email preview" srcDoc={preview.html || ""} sandbox="" className="mt-3 w-full h-[52vh] rounded-xl border border-border bg-white" />
                            {preview.attachments?.length > 0 && <div className="mt-3 text-xs text-muted-foreground">Attachments: {preview.attachments.map((item) => item.filename).join(", ")}</div>}
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <style>{`.comm-tab{display:inline-flex;align-items:center;gap:.4rem;border:1px solid hsl(var(--border));border-radius:9999px;padding:.55rem .9rem;font-size:.75rem;font-weight:700}.comm-tab.active{background:hsl(var(--foreground));color:hsl(var(--background));border-color:hsl(var(--foreground))}`}</style>
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
