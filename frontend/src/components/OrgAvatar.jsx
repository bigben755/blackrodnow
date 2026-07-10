import React from "react";
import { api } from "@/lib/api";

/**
 * Renders an organisation's logo. Uses the uploaded avatar image if set,
 * otherwise falls back to the emoji/short-string `org.logo`.
 *
 * Preserves aspect ratio via `object-contain` when the uploaded avatar is used.
 * The uploaded avatar is already center-cropped to 512×512 on the server so
 * displaying it in any square/rounded container gives a consistent look.
 */
export default function OrgAvatar({ org, size = 48, thumb = false, className = "", rounded = "rounded-2xl", style }) {
    const hasImage = !!org?.logo_path;
    const src = hasImage ? api.orgLogoUrl(org.slug, thumb, org.updated_at || "") : null;
    const dim = { width: size, height: size, minWidth: size, minHeight: size };
    return (
        <div
            data-testid={`org-avatar-${org?.slug || "unknown"}`}
            className={`grid place-items-center overflow-hidden bg-background border border-border ${rounded} ${className}`}
            style={{ ...dim, ...(style || {}) }}
            aria-label={org?.name || "Organisation logo"}
        >
            {hasImage ? (
                <img
                    src={src}
                    alt={org?.name || ""}
                    className="h-full w-full object-contain"
                    loading="lazy"
                />
            ) : (
                <span aria-hidden style={{ fontSize: Math.floor(size * 0.55), lineHeight: 1 }}>
                    {org?.logo || "✨"}
                </span>
            )}
        </div>
    );
}
