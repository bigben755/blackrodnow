import React from "react";
import { Facebook, Linkedin, MessageCircle, Copy, Share2, Instagram } from "lucide-react";
import { toast } from "sonner";

/**
 * Universal share-to-socials button row.
 *
 * Props:
 *   text  – caption / message to share
 *   url   – URL to link to (defaults to current page)
 *   title – optional title for native share
 *   compact – if true, renders icon-only buttons
 *   platforms – array to filter which platforms to show
 *                (default: ["facebook","linkedin","twitter","whatsapp","instagram","copy"])
 */
export default function ShareButtons({
    text = "",
    url,
    title = "",
    compact = false,
    platforms = ["facebook", "linkedin", "twitter", "whatsapp", "instagram", "copy"],
}) {
    const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");
    const enc = (s) => encodeURIComponent(s || "");

    const open = (u) => {
        if (typeof window !== "undefined") {
            window.open(u, "_blank", "width=680,height=560,noopener,noreferrer");
        }
    };

    const handlers = {
        facebook: {
            label: "Facebook",
            icon: Facebook,
            className: "bg-[#1877F2] text-white hover:brightness-110",
            onClick: () => open(`https://www.facebook.com/sharer/sharer.php?u=${enc(shareUrl)}&quote=${enc(text)}`),
        },
        linkedin: {
            label: "LinkedIn",
            icon: Linkedin,
            className: "bg-[#0A66C2] text-white hover:brightness-110",
            onClick: () => open(`https://www.linkedin.com/sharing/share-offsite/?url=${enc(shareUrl)}`),
        },
        twitter: {
            label: "X / Twitter",
            icon: TwitterX,
            className: "bg-black text-white hover:brightness-110",
            onClick: () => open(`https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(shareUrl)}`),
        },
        whatsapp: {
            label: "WhatsApp",
            icon: MessageCircle,
            className: "bg-[#25D366] text-white hover:brightness-110",
            onClick: () => open(`https://wa.me/?text=${enc(`${text}\n${shareUrl}`.trim())}`),
        },
        instagram: {
            label: "Copy for Instagram",
            icon: Instagram,
            className: "bg-gradient-to-br from-[#E1306C] via-[#F56040] to-[#FCAF45] text-white hover:brightness-110",
            onClick: async () => {
                try {
                    await navigator.clipboard.writeText(`${text}\n${shareUrl}`.trim());
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
                try {
                    await navigator.clipboard.writeText(shareUrl);
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
                if (typeof navigator !== "undefined" && navigator.share) {
                    try {
                        await navigator.share({ title, text, url: shareUrl });
                    } catch { /* user cancelled */ }
                } else {
                    try {
                        await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
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
