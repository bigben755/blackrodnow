import React, { useMemo, useState } from "react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CalendarDays, Apple, Copy, Download, Rss, Sparkles, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { getDeviceId } from "@/lib/device";

/**
 * SubscribeCalendarDialog
 *
 * Presents platform-specific ways to add the live Blackrod Now calendar feed.
 * The backend endpoint `/api/calendar.ics` re-fetches events on every request,
 * so Apple / Google / Outlook stay in sync automatically.
 *
 * Props:
 *   open, onClose
 *   allCategories: string[]  – categories for the personalise dropdown (optional)
 *   allOrgs: {slug, name}[]  – orgs list (for "follow" scope; we honour the user's device follows)
 *   onDownloadIcs?: () => void  – optional callback to trigger a file download of current filter set
 */
export default function SubscribeCalendarDialog({ open, onClose, allCategories = [], onDownloadIcs }) {
    const [scope, setScope] = useState("all"); // "all" | "follows" | "category"
    const [category, setCategory] = useState(allCategories[0] || "Community");

    const { httpsUrl, webcalUrl } = useMemo(() => {
        if (typeof window === "undefined") return { httpsUrl: "", webcalUrl: "" };
        const host = window.location.host;
        const params = new URLSearchParams();
        if (scope === "follows") params.set("device", getDeviceId());
        if (scope === "category") params.set("category", category);
        const qs = params.toString();
        const https = `https://${host}/api/calendar.ics${qs ? `?${qs}` : ""}`;
        return { httpsUrl: https, webcalUrl: https.replace(/^https?:\/\//, "webcal://") };
    }, [scope, category]);

    const googleUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`;
    const outlookUrl = `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(httpsUrl)}&name=${encodeURIComponent("Blackrod Now")}`;

    const copy = async (text, msg) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success(msg);
        } catch {
            toast.error("Couldn't copy");
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-lg" data-testid="subscribe-calendar-dialog">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Rss className="h-5 w-5 text-primary" />
                        Subscribe to the live calendar
                    </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground -mt-1">
                    Auto-updating feed — new events appear in your calendar as soon as
                    they&rsquo;re published on Blackrod Now.
                </p>

                {/* Scope picker */}
                <div className="mt-3">
                    <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground mb-2">What to include</div>
                    <div className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
                        {[
                            { id: "all", label: "All events" },
                            { id: "follows", label: "My follows" },
                            { id: "category", label: "Category" },
                        ].map((s) => (
                            <button
                                key={s.id}
                                data-testid={`scope-${s.id}`}
                                onClick={() => setScope(s.id)}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                                    scope === s.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                                }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                    {scope === "category" && (
                        <select
                            data-testid="scope-category-select"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="mt-2 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
                        >
                            {allCategories.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    )}
                    {scope === "follows" && (
                        <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                            Uses the organisations & categories you follow on this device.
                        </p>
                    )}
                </div>

                {/* Platform buttons */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <a
                        data-testid="sub-apple"
                        href={webcalUrl}
                        className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-foreground text-background font-semibold text-sm"
                    >
                        <Apple className="h-4 w-4" /> Apple Calendar
                    </a>
                    <a
                        data-testid="sub-google"
                        href={googleUrl}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm"
                    >
                        <CalendarDays className="h-4 w-4" /> Google Calendar
                    </a>
                    <a
                        data-testid="sub-outlook"
                        href={outlookUrl}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#0F6CBD] text-white font-semibold text-sm"
                    >
                        <ExternalLink className="h-4 w-4" /> Outlook.com
                    </a>
                    <button
                        data-testid="sub-copy"
                        onClick={() => copy(webcalUrl, "webcal:// link copied — paste into any calendar app.")}
                        className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-muted text-foreground font-semibold text-sm hover:bg-muted/80"
                    >
                        <Copy className="h-4 w-4" /> Copy webcal:// link
                    </button>
                </div>

                {/* Raw URL */}
                <div className="mt-3 rounded-2xl border border-border bg-background p-3">
                    <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground mb-1">Direct URL</div>
                    <div className="text-xs font-mono text-foreground/80 break-all">{httpsUrl}</div>
                </div>

                {/* Fallback: one-time .ics download */}
                {onDownloadIcs && (
                    <div className="mt-3 pt-3 border-t border-border">
                        <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground mb-2">One-time snapshot</div>
                        <button
                            data-testid="sub-download"
                            onClick={onDownloadIcs}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-border text-xs font-semibold hover:bg-muted"
                        >
                            <Download className="h-3.5 w-3.5" /> Download .ics file
                        </button>
                        <span className="text-xs text-muted-foreground ml-2">Prefer a one-time import? Download the current view.</span>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
