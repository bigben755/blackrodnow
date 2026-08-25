import React, { useState } from "react";
import { toast } from "sonner";
import { Megaphone, Send } from "lucide-react";
import { api } from "@/lib/api";

export default function PushAnnounceCard() {
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [url, setUrl] = useState("");
    const [sending, setSending] = useState(false);

    const send = async () => {
        if (!title.trim() || !body.trim()) {
            toast.error("Add a title and a message first");
            return;
        }
        if (!window.confirm("Send this push notification to every resident who has enabled notifications?")) return;
        setSending(true);
        try {
            const res = await api.pushAnnounce(title.trim(), body.trim(), url.trim());
            toast.success(`Sent to ${res.sent} of ${res.subscriptions} subscribed device${res.subscriptions === 1 ? "" : "s"}`);
            setTitle("");
            setBody("");
            setUrl("");
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not send the announcement");
        } finally {
            setSending(false);
        }
    };

    const inp = "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40";

    return (
        <div className="rounded-3xl border border-border bg-surface p-5" data-testid="push-announce-card">
            <h3 className="font-display font-bold text-lg inline-flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" /> Push announcement
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
                Send an instant notification to everyone who has enabled push notifications on their phone or browser.
            </p>
            <div className="mt-4 grid gap-2.5 sm:max-w-xl">
                <input
                    data-testid="push-announce-title"
                    className={inp}
                    placeholder="Title — e.g. Christmas market this Saturday!"
                    maxLength={80}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                />
                <textarea
                    data-testid="push-announce-body"
                    className={`${inp} min-h-[70px]`}
                    placeholder="Message (keep it short — this shows on lock screens)"
                    maxLength={200}
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                />
                <input
                    data-testid="push-announce-url"
                    className={inp}
                    placeholder="Optional link path — e.g. /events or /events/evt-festival-2026"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                />
                <button
                    type="button"
                    data-testid="push-announce-send"
                    disabled={sending}
                    onClick={send}
                    className="justify-self-start inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
                >
                    <Send className="h-3.5 w-3.5" /> {sending ? "Sending…" : "Send to all subscribers"}
                </button>
            </div>
        </div>
    );
}
