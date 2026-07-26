import React, { useEffect, useState } from "react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Copy, Download, Loader2, Sparkles, RefreshCw, Rocket } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import ShareButtons from "@/components/ShareButtons";

const TONES = [
    { key: "friendly", label: "Friendly" },
    { key: "punchy", label: "Punchy" },
    { key: "formal", label: "Formal" },
];

/**
 * One-click "Post Now" social bundle dialog.
 *
 * Props:
 *   event   – the event object (must have id + title, other fields optional)
 *   trigger – optional custom trigger element; if omitted, exposes `open`+`onOpenChange`
 *   open    – controlled open state (optional)
 *   onOpenChange – controlled setter
 */
export default function PostNowDialog({ event, open, onOpenChange }) {
    const [tone, setTone] = useState("friendly");
    const [bundle, setBundle] = useState(null);
    const [loading, setLoading] = useState(false);
    const [aiBusy, setAiBusy] = useState(false);
    const [caption, setCaption] = useState("");

    useEffect(() => {
        if (!open || !event?.id) return;
        (async () => {
            setLoading(true);
            try {
                const b = await api.eventSocialBundle(event.id, { tone, ai: false });
                setBundle(b);
                setCaption(b.caption);
            } catch (err) {
                toast.error(err?.response?.data?.detail || "Could not build post");
            } finally {
                setLoading(false);
            }
        })();
    }, [open, event?.id, tone]);

    const regenAi = async () => {
        if (!event?.id) return;
        setAiBusy(true);
        try {
            const b = await api.eventSocialBundle(event.id, { tone, ai: true });
            setBundle(b);
            setCaption(b.caption);
            if (b.ai) {
                toast.success("Caption rewritten by AI");
            } else {
                toast.info("Used template caption (AI unavailable)");
            }
        } catch (err) {
            toast.error(err?.response?.data?.detail || "Could not regenerate");
        } finally {
            setAiBusy(false);
        }
    };

    const copyText = async (text, msg = "Copied") => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success(msg);
        } catch {
            toast.error("Couldn't copy");
        }
    };

    const downloadPoster = async (kind = "png") => {
        if (!event?.id) return;
        const url = kind === "pdf"
            ? api.eventPosterPdfUrl(event.id)
            : api.eventPosterPngUrl(event.id);
        // Trigger a real download rather than a new tab so the org gets the file
        // ready to attach on Facebook/Instagram/etc. immediately.
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed");
            const blob = await res.blob();
            const dl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = dl;
            const safe = (event.title || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
            a.download = `blackrod-now-${safe}.${kind}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(dl);
            toast.success(`${kind.toUpperCase()} poster downloaded`);
        } catch {
            // Fallback: open in a new tab
            window.open(url, "_blank");
        }
    };

    const posterPngUrl = event?.id ? api.eventPosterPngUrl(event.id) : "";
    const link = bundle?.link || "";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                data-testid="post-now-dialog"
                className="max-w-3xl max-h-[92vh] overflow-y-auto"
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Rocket className="h-5 w-5 text-primary" />
                        Post Now — {event?.title}
                    </DialogTitle>
                    <DialogDescription>
                        One-click social bundle: poster + caption + share, ready for
                        Facebook, Instagram, WhatsApp and more.
                    </DialogDescription>
                </DialogHeader>

                {loading && !bundle ? (
                    <div className="py-16 text-center text-muted-foreground">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                        <p className="mt-2 text-sm">Building your post…</p>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Poster preview + downloads */}
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                Poster
                            </div>
                            <div className="rounded-2xl border border-border bg-muted overflow-hidden aspect-square">
                                {posterPngUrl ? (
                                    <img
                                        src={posterPngUrl}
                                        alt={`Poster for ${event?.title}`}
                                        className="w-full h-full object-cover"
                                        data-testid="post-now-poster-preview"
                                    />
                                ) : null}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    data-testid="post-now-download-png"
                                    onClick={() => downloadPoster("png")}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110"
                                >
                                    <Download className="h-3.5 w-3.5" /> PNG (1080×1080)
                                </button>
                                <button
                                    type="button"
                                    data-testid="post-now-download-pdf"
                                    onClick={() => downloadPoster("pdf")}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold hover:bg-muted"
                                >
                                    <Download className="h-3.5 w-3.5" /> A4 PDF
                                </button>
                            </div>
                            <p className="mt-2 text-[11px] text-muted-foreground">
                                Instagram tip: download the PNG, then paste the caption below.
                            </p>
                        </div>

                        {/* Caption + tone + copy */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Caption
                                </div>
                                <div className="flex gap-1" data-testid="post-now-tone-picker">
                                    {TONES.map((t) => (
                                        <button
                                            key={t.key}
                                            type="button"
                                            data-testid={`post-now-tone-${t.key}`}
                                            onClick={() => setTone(t.key)}
                                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition ${
                                                tone === t.key
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-muted text-foreground hover:bg-muted/70"
                                            }`}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <textarea
                                data-testid="post-now-caption"
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                rows={10}
                                className="w-full rounded-2xl border border-border bg-background p-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    data-testid="post-now-copy-caption"
                                    onClick={() => copyText(caption, "Caption copied")}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110"
                                >
                                    <Copy className="h-3.5 w-3.5" /> Copy caption
                                </button>
                                <button
                                    type="button"
                                    data-testid="post-now-copy-with-link"
                                    onClick={() =>
                                        copyText(
                                            caption.includes(link) ? caption : `${caption}\n\n${link}`,
                                            "Caption + link copied"
                                        )
                                    }
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold hover:bg-muted"
                                >
                                    <Copy className="h-3.5 w-3.5" /> Copy + link
                                </button>
                                <button
                                    type="button"
                                    data-testid="post-now-regenerate-ai"
                                    onClick={regenAi}
                                    disabled={aiBusy}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-accent text-accent-foreground text-xs font-semibold hover:brightness-110 disabled:opacity-60"
                                >
                                    {aiBusy ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Sparkles className="h-3.5 w-3.5" />
                                    )}
                                    {aiBusy ? "Rewriting…" : "Rewrite with AI"}
                                </button>
                                <button
                                    type="button"
                                    data-testid="post-now-reset"
                                    onClick={() => bundle && setCaption(bundle.caption)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold hover:bg-muted"
                                    title="Reset to template caption"
                                >
                                    <RefreshCw className="h-3.5 w-3.5" /> Reset
                                </button>
                            </div>
                        </div>

                        {/* One-tap share row (spans both columns) */}
                        <div className="md:col-span-2 border-t border-border pt-4">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                Post to socials
                            </div>
                            <ShareButtons
                                text={caption}
                                url={link}
                                ogUrl={bundle?.og_url}
                                title={event?.title}
                                platforms={[
                                    "facebook",
                                    "linkedin",
                                    "twitter",
                                    "whatsapp",
                                    "instagram",
                                    "copy",
                                ]}
                                analytics={{
                                    entityType: "event",
                                    entityId: event?.id,
                                    orgSlug: event?.orgSlug,
                                }}
                            />
                            <p className="mt-2 text-[11px] text-muted-foreground">
                                Facebook / LinkedIn / X / WhatsApp: opens the composer
                                with your caption + rich link preview attached.
                                Instagram: taps to copy caption — paste after uploading
                                the poster PNG.
                            </p>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
