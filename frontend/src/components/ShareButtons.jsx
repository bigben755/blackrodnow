import React from "react";
import { Facebook, Linkedin, MessageCircle, Copy, Share2, Instagram } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

/**
 * Universal share-to-socials button row.
 *
 * Props:
 *   text  – caption / message to share
 *   url   – human-facing / canonical URL (used for Copy link + Instagram)
 *   ogUrl – optional crawler URL for social platforms that fetch OG tags
 *            (Facebook, LinkedIn, X/Twitter, WhatsApp). When provided we
 *            share this URL so their scrapers see per-event OG meta and
 *            render a rich preview card. It should immediately redirect
 *            humans to `url`.
 *   title – optional title for native share
 *   compact – if true, renders icon-only buttons
 *   platforms – array to filter which platforms to show
 */
export default function ShareButtons({
    text = "",
    url,
    ogUrl,
    title = "",
    compact = false,
    platforms = ["facebook", "linkedin", "twitter", "whatsapp", "instagram", "copy"],
    analytics = null,
}) {
    const canonicalUrl = url || (typeof window !== "undefined" ? window.location.href : "");
    const socialUrl = ogUrl || canonicalUrl;
    const enc = (s) => encodeURIComponent(s || "");

    /**
     * Open in a new tab. We avoid width/height + noopener,noreferrer in the
     * features string because that combination is silently blocked by many
     * browsers (esp. Chrome mobile and popup-blocked contexts). A plain
     * `_blank` opens a normal new tab which every social sharer supports.
     */
    const open = (u) => {
        if (typeof window === "undefined") return;
        const win = window.open(u, "_blank");
        if (win) {
            try { win.opener = null; } catch (_) { /* ignore */ }
        } else {
            // Popup blocked — fall back to same-tab navigation.
            window.location.href = u;
        }
    };

    const trackShare = (platform) => {
        if (!analytics) return;
        api.trackAnalytics({
            kind: "share_click",
            entity_type: analytics.entityType,
            entity_id: analytics.entityId,
            org_slug: analytics.orgSlug,
            platform,
        }).catch(() => {});
    };

    const handlers = {
        facebook: {
            label: "Facebook",
            icon: Facebook,
            className: "bg-[#1877F2] text-white hover:brightness-110",
            // NOTE: Facebook's sharer cannot pre-fill text (deprecated in 2017) —
            // so we auto-copy the caption first, then open the composer with the
            // link attached. Users just paste (Ctrl/Cmd+V) into the post box.
            onClick: async () => {
                trackShare("facebook");
                if (text) {
                    try {
                        await navigator.clipboard.writeText(text);
                        toast.success("Caption copied — paste it into your Facebook post", { duration: 6000 });
                    } catch { /* clipboard blocked — still open the sharer */ }
                }
                open(`https://www.facebook.com/sharer/sharer.php?u=${enc(socialUrl)}`);
            },
        },
        linkedin: {
            label: "LinkedIn",
            icon: Linkedin,
            className: "bg-[#0A66C2] text-white hover:brightness-110",
            onClick: async () => {
                trackShare("linkedin");
                if (text) {
                    try {
                        await navigator.clipboard.writeText(text);
                        toast.success("Caption copied — paste it into your LinkedIn post", { duration: 6000 });
                    } catch { /* clipboard blocked — still open the sharer */ }
                }
                open(`https://www.linkedin.com/sharing/share-offsite/?url=${enc(socialUrl)}`);
            },
        },
        twitter: {
            label: "X / Twitter",
            icon: TwitterX,
            className: "bg-black text-white hover:brightness-110",
            onClick: () => {
                trackShare("twitter");
                open(`https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(socialUrl)}`);
            },
        },
        whatsapp: {
            label: "WhatsApp",
            icon: MessageCircle,
            className: "bg-[#25D366] text-white hover:brightness-110",
            onClick: () => {
                trackShare("whatsapp");
                open(`https://wa.me/?text=${enc(`${text}\n${socialUrl}`.trim())}`);
            },
        },
        instagram: {
            label: "Copy for Instagram",
            icon: Instagram,
            className: "bg-gradient-to-br from-[#E1306C] via-[#F56040] to-[#FCAF45] text-white hover:brightness-110",
            onClick: async () => {
                trackShare("instagram");
                try {
                    await navigator.clipboard.writeText(`${text}\n${canonicalUrl}`.trim());
                    toast.success("Caption copied — open Instagram and paste into your post or story.");
                } catch {
                    toast.error("Couldn't copy caption");
                }
            },
        },
        copy: {
            label: "Copy link",
            icon: Copy,
            className: "bg-muted text-foreground hover:bg-muted/80",
            onClick: async () => {
                trackShare("copy");
                try {
                    await navigator.clipboard.writeText(canonicalUrl);
                    toast.success("Link copied");
                } catch {
                    toast.error("Couldn't copy link");
                }
            },
        },
        native: {
            label: "Share…",
            icon: Share2,
            className: "bg-foreground text-background hover:brightness-110",
            onClick: async () => {
                trackShare("native");
                if (typeof navigator !== "undefined" && navigator.share) {
                    try {
                        await navigator.share({ title, text, url: canonicalUrl });
                    } catch { /* user cancelled */ }
                } else {
                    try {
                        await navigator.clipboard.writeText(`${text}\n${canonicalUrl}`);
                        toast.success("Copied — paste anywhere to share");
                    } catch {
                        toast.error("Sharing not supported");
                    }
                }
            },
        },
    };

    return (
        <div data-testid="share-buttons" className="flex flex-wrap gap-2">
            {platforms.map((p) => {
                const h = handlers[p];
                if (!h) return null;
                const Icon = h.icon;
                return (
                    <button
                        key={p}
                        type="button"
                        data-testid={`share-${p}`}
                        onClick={h.onClick}
                        className={`inline-flex items-center gap-1.5 rounded-full font-semibold text-xs transition ${h.className} ${
                            compact ? "h-8 w-8 grid place-items-center p-0" : "px-3 py-2"
                        }`}
                        title={h.label}
                        aria-label={h.label}
                    >
                        <Icon className={compact ? "h-3.5 w-3.5" : "h-3.5 w-3.5"} />
                        {!compact && <span>{h.label}</span>}
                    </button>
                );
            })}
        </div>
    );
}

// Simple X/Twitter logo (lucide has no X-logo yet)
const TwitterX = (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
        <path d="M18.244 2H21l-6.53 7.46L22 22h-6.828l-4.77-6.24L4.8 22H2l7-8.02L1.5 2h6.914l4.32 5.72L18.244 2Zm-1.196 18h1.833L7.06 4H5.126l11.922 16Z" />
    </svg>
);
